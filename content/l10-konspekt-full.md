# Архітектура MCP-сервера {toggle="true"}
	На попередніх лекціях ми зібрали qauto MCP server в одному файлі `main.py`: **tools**, **prompts**, **resources**, HTTP-клієнт, моделі Pydantic і робота з сесією.
	Це нормальний старт — швидкий прототип. Але коли сервер росте, один файл стає важко читати, тестувати і розширювати.
	Мета цієї секції — **цільова архітектура**: куди що класти і навіщо кожен шар. Далі в лекції — описи для LLM, можливості FastMCP і правила/скіли.
	## Навіщо структурізація
	Поки все в `main.py`, зміна одного tool чіпає файл із сотнями рядків. Легко змішати:
	- валідацію вхідних даних
	- HTTP-виклики до QAuto API
	- логіку сесії (`sid`)
	- MCP-декоратори (`@mcp.tool`, `@mcp.resource`, `@mcp.prompt`)
	- формат відповідей для моделі
	Структурізація дає:
	- **читабельність** — новий tool додається в одне місце
	- **розділення відповідальностей** — MCP-шар тонкий, бізнес-логіка окремо
	- **простіші тести** — models і services можна перевіряти без MCP Host
	- **масштабування** — нові endpoints не роздувають один файл
	Правило: **MCP surface тонкий**. Tools / resources / prompts лише приймають аргументи, валідують і делегують у services.
	## Цільове дерево проєкту
	Переходимо на пакет `src/qauto_mcp/` замість монолітного `main.py`.
	```plain text
mcp-example/
├── pyproject.toml
├── README.md
├── .env.example
├── data/
│   └── car_catalog.json
└── src/
    └── qauto_mcp/
        ├── __init__.py
        ├── __main__.py          # python -m qauto_mcp
        ├── server.py            # FastMCP + реєстрація + lifespan
        ├── config.py            # налаштування з env
        ├── formatting.py        # єдиний формат відповідей tool
        ├── models/
        │   ├── auth.py          # SignUpRequest, SignInRequest
        │   └── cars.py          # AddCarRequest
        ├── services/
        │   ├── http_client.py   # створення/закриття httpx-клієнта
        │   ├── session.py       # sid, signin_as, ensure_session
        │   └── catalog.py       # завантаження довідника брендів
        ├── tools/
        │   ├── auth.py          # signup, signin
        │   └── cars.py          # add_car, get_cars
        ├── resources/
        │   └── cars.py          # qauto://cars/catalog, brands/{id}
        └── prompts/
            └── cars.py          # analyze_cars
	```
	Корінь проєкту тримає лише конфіг пакета, документацію, дані й entrypoint через `pyproject.toml`. Бізнес-логіка живе в `src/qauto_mcp/`.
	## Шари: для чого що потрібно
	### Точка входу — `__main__.py` і `server.py`
	**Навіщо:** одне місце старту сервера для Cursor / будь-якого MCP Host.
	- `__main__.py` — запускає `mcp.run(transport="stdio")`
	- `server.py` — створює обʼєкт `FastMCP`, підключає lifespan, викликає `register_tools` / `register_resources` / `register_prompts`
	Сюди **не** кладемо HTTP-логіку й Pydantic-моделі. Тільки збірка сервера.
	### Config — `config.py`
	**Навіщо:** усі налаштування в одному місці замість розкиданих `os.getenv`.
	Тут: `QAUTO_BASE_URL`, credentials з env, timeout, шлях до `car_catalog.json`.
	Tools і services читають settings, а не парсять env самостійно.
	### Models — `models/`
	**Навіщо:** валідація вхідних даних до виклику API.
	- `auth.py` — signup / signin
	- `cars.py` — add_car
	Моделі знають схему і `to_payload()`. Вони **не** ходять у мережу.
	### Services — `services/`
	**Навіщо:** доменна логіка, спільна для кількох tools.
	- `http_client.py` — спільний `httpx.AsyncClient` (створення в lifespan, закриття на shutdown)
	- `session.py` — пріоритет авторизації: аргументи tool → існуючий `sid` → env credentials
	- `catalog.py` — читання довідника брендів/моделей для resources
	Якщо завтра зʼявиться новий tool «оновити mileage», він перевикористає session і client, а не скопіює код.
	### Formatting — `formatting.py`
	**Навіщо:** єдиний контракт відповіді для LLM.
	Усі tools повертають однаковий JSON-формат: `status_code` + `body` (або error). Моделі простіше парсити стабільну структуру.
	### MCP surface — `tools/`, `resources/`, `prompts/`
	**Навіщо:** те, що бачить Host і модель.
	- **tools** — дії: signup, signin, add_car, get_cars
	- **resources** — довідники за URI (каталог авто)
	- **prompts** — готові сценарії (`analyze_cars`)
	Кожен модуль експортує `register_*(mcp)` — `server.py` лишається коротким.
	Описи (docstring, `Field(description=...)`) живуть саме тут: це UX для LLM і UI Host.
	### Дані — `data/`
	**Навіщо:** статичний контент без коду.
	`car_catalog.json` — довідник для resources. Код його лише читає.
	## Потік залежностей
	Шари залежать лише «вниз», не навпаки:
	```plain text
__main__ → server → tools / resources / prompts
                         ↓
                    models + services + formatting
                         ↓
                       config
	```
	- tools можуть імпортувати models і services
	- services **не** імпортують tools
	- models нічого не знають про MCP і httpx
	Так легше тестувати й уникати циклічних імпортів.
	## Як виглядає `server.py`
	Після структуризації серце сервера виглядає так (псевдокод):
	```python
mcp = FastMCP(
    "qauto",
    instructions="...",  # загальний гайд для LLM — пізніше
    lifespan=app_lifespan,
)

register_tools(mcp)
register_resources(mcp)
register_prompts(mcp)
	```
	**Lifespan** створює HTTP-клієнт на старті й коректно закриває його на зупинці — замість глобальної змінної без teardown.
	## План переносу
	Структурізацію робимо **покроково**, щоб tools/resources/prompts працювали так само, як зараз.
	1. **Каркас** — створити пакет `src/qauto_mcp/` і порожні модулі за деревом вище; налаштувати entrypoint у `pyproject.toml`.
	2. **Фундамент** — перенести `config` → `formatting` → `models` → `services`.
	3. **MCP surface** — винести tools, resources, prompts + `register_*`; зібрати в `server.py`.
	4. **Entrypoint** — `python -m qauto_mcp`; оновити шлях у MCP-конфігу Host і README.
	5. **Cleanup** — прибрати мертвий код і застарілий `main.py` (або лишити тонкий shim).
	На цьому етапі **не змінюємо** набір tools і контракт відповідей — лише розкладка по файлах.
# Каркас сервера {toggle="true"}
	Після архітектури збираємо **каркас**: параметри `FastMCP` і єдиний процес опису tools для Host і LLM.
	Головна ідея: модель **не бачить Python-код**. Вона бачить лише JSON з `tools/list` — результат інтроспекції при реєстрації tool.
	Логування на stdio обмежене (stdout зайнятий протоколом) — див. `log_level` нижче; повний HTTP-logging — у лекції про Streamable HTTP.
	## FastMCP з параметрами
	Конструктор `FastMCP(...)` має багато опцій. Для **stdio**-сервера (як наш qauto у Cursor) реально потрібні лише кілька. Решта — для HTTP/SSE, OAuth і прод-налаштувань.
	### Мінімум і наш каркас
	Мінімальний старт:
	```python
mcp = FastMCP("qauto")
	```
	У каркасі передаємо явно те, що корисно з першого дня:
	```python
mcp = FastMCP(
    name="qauto",
    instructions=(
        "MCP server for QAuto garage API. "
        "Auth: signup/signin set session cookie sid. "
        "Before add_car, read resource qauto://cars/catalog. "
        "For car analysis use prompt analyze_cars."
    ),
    lifespan=app_lifespan,
)
	```
	### Популярні параметри (розбір)
	Це ті, з якими ви працюватимете найчастіше.
	- **`name`** — імʼя сервера в Host. Якщо не задати — буде `"FastMCP"`. Краще явна назва: `qauto`, `qauto-mcp`.
	- **`instructions`** — гайд на рівні **всього сервера**. Передається клієнту при ініціалізації протоколу. Пишіть порядок дій, які resources читати перед tools, які prompts є. **Доповнює** описи tools, не замінює їх.
	- **`lifespan`** — async context manager: код на **старті** і **зупинці** сервера. Типово: відкрити `httpx.AsyncClient` / БД → `yield` контекст → закрити зʼєднання в `finally`. Без цього легко лишити «висячі» клієнти.
	- **`website_url`** — посилання на сайт або документацію сервера (метадані для клієнта).
	- **`icons`** — іконки **сервера** (не окремого tool).
	- **`tools`** — список уже зібраних обʼєктів `Tool` при створенні. Альтернатива декораторам `@mcp.tool`. У нашому стилі зручніше реєструвати через `register_tools(mcp)`.
	- **`debug`** / **`log_level`** — діагностика. `log_level`: `DEBUG` | `INFO` | `WARNING` | `ERROR` | `CRITICAL`. На **stdio** stdout зайнятий протоколом — логувати в stderr / файл; детальніше на Streamable HTTP.
	- **`warn_on_duplicate_tools`** / **`warn_on_duplicate_resources`** / **`warn_on_duplicate_prompts`** — попереджати, якщо двічі реєструєте компонент з тим самим імʼям (за замовчуванням `True`).
	- **`dependencies`** — список залежностей пакета; деякі клієнти/раннери показують їх як вимоги сервера.
	### Параметри за групами (огляд)
	Повний конструктор великий — тримайте карту груп. Деталі HTTP і OAuth розберемо в окремих лекціях.
	**Ідентифікація:** `name`, `instructions`, `website_url`, `icons`.
	**Компоненти:** `tools` (реєстрація одразу), плюс попередження про дублікати (`warn_on_duplicate_*`).
	**Життєвий цикл:** `lifespan`.
	**Транспорт / мережа (лише HTTP/SSE, не stdio):** `host`, `port`, `mount_path`, `sse_path`, `message_path`, `streamable_http_path`, `json_response`, `stateless_http`, `max_request_body_size`. Для stdio ці значення **не впливають** на роботу.
	**Авторизація / безпека:** `auth`, `auth_server_provider`, `token_verifier`, `transport_security`. `auth` потрібен, якщо задано провайдер або верифікатор; `auth_server_provider` і `token_verifier` разом не вказують.
	**Resumable / retry:** `event_store`, `retry_interval` — для відновлення зʼєднань і повторів.
	**Правило для qauto (stdio):** почніть з `name` + `instructions` (+ `lifespan` для HTTP-клієнта). Host/port/SSE/Streamable HTTP підключите, коли перейдете на мережевий транспорт.
	## Що бачить LLM насправді
	Модель **ніколи** не читає тіло функції, `async def` чи імпорти. Вона отримує лише «фасад» tool:
	- `name`, `title`, `description`
	- `inputSchema` — схема аргументів
	- `outputSchema` — схема відповіді (якщо заданий return type)
	FastMCP збирає цей JSON **один раз при реєстрації**, розбираючи:
	1. Аргументи декоратора `@mcp.tool(...)` → `name`, `title`, `description`
	2. Тайп-хінти параметрів → `inputSchema`
	3. Тайп-хінт повернення → `outputSchema`
	4. Docstring — якщо `description` у декораторі не задано, або для доповнення сенсу Args/Returns
	Формулювання: **LLM бачить не код, а згенеровану з сигнатури JSON-схему. Який інструмент її зібрав (Pydantic / dataclass / plain types) — моделі байдуже. Важливо лише, що потрапило в схему.**
	## Docstring — базовий спосіб опису
	Якщо параметри — звичайні типи (`int`, `str`) без `Field`, усе пояснення кладіть у **docstring**: що робить tool, коли викликати, **Args**, **Returns**.
	```python
@mcp.tool(
    name="add_car",
    title="Add car to garage",
)
async def add_car(
    carBrandId: int,
    carModelId: int,
    mileage: int = 0,
) -> str:
    """Create a car for the current user (POST /cars).

    Before calling, read qauto://cars/catalog for valid ids.
    Do not use for listing cars — use get_cars.

    Args:
        carBrandId: Brand id from catalog (>= 1).
        carModelId: Model id for that brand (>= 1).
        mileage: Current mileage, 0..999999.

    Returns:
        JSON string with status_code and body (Car or error).
    """
    ...
	```
	Без Args/Returns модель бачить майже лише імена й типи — сенс полів губиться.
	## Розширений опис через `@mcp.tool(...)`
	Декоратор дає явний контроль над тим, що піде в `tools/list`:
	```python
@mcp.tool(
    name="add_car",
    title="Add car to garage",
    description=(
        "Add a single car to the current QAuto user garage "
        "by brand id, model id, and mileage. "
        "Before calling, read qauto://cars/catalog for valid ids."
    ),
)
async def add_car(...):
    ...
	```
	### Що означає кожен параметр
	- **`name`** — стабільний id tool у протоколі (`snake_case`). Саме його викликає модель.
	- **`title`** — короткий людський заголовок для UI Host (список tools).
	- **`description`** — текст для LLM: що робить, коли викликати, передумови, чого не робити.
	Рекомендація: `description` декоратора = поведінка tool; деталі полів — у схемі аргументів (docstring Args або `Field`).
	## Приклад без Pydantic
	Plain types + docstring. Механізм той самий: FastMCP зніме типи в `inputSchema`.
	```python
@mcp.tool(
    name="add_car",
    title="Add car to garage",
    description=(
        "Create a car (POST /cars). "
        "Read qauto://cars/catalog first for valid ids."
    ),
)
async def add_car(
    carBrandId: int,
    carModelId: int,
    mileage: int = 0,
) -> str:
    """Args:
        carBrandId: Brand id from catalog (>= 1).
        carModelId: Model id for that brand (>= 1).
        mileage: Current mileage, default 0.

    Returns:
        JSON with status_code and body.
    """
    ...
	```
	Що піде в `tools/list` (спрощено):
	```json
{
  "name": "add_car",
  "title": "Add car to garage",
  "description": "Create a car (POST /cars). Read qauto://cars/catalog first for valid ids.",
  "inputSchema": {
    "properties": {
      "carBrandId": { "type": "integer" },
      "carModelId": { "type": "integer" },
      "mileage": { "default": 0, "type": "integer" }
    },
    "required": ["carBrandId", "carModelId"]
  }
}
	```
	Типи є. Але в полях схеми **немає description** — якщо не винести їх у docstring / інший механізм з описами.
	Те саме з `dataclass`: структура схеми (`properties`, `type`, `required`) зʼявиться, але без текстових описів полів — у dataclass немає `Field(description=...)`.
	## Приклад з Pydantic
	Pydantic — не вимога протоколу. Це спосіб зробити схему **багатшою**: `description`, `min`/`max`, `enum`, `Literal`.
	```python
from typing import Literal
from pydantic import BaseModel, Field

class AddCarInput(BaseModel):
    carBrandId: int = Field(description="Brand id from qauto://cars/catalog (>= 1)")
    carModelId: int = Field(description="Model id for that brand (>= 1)")
    mileage: int = Field(default=0, ge=0, le=999999, description="Current mileage")

class AddCarResult(BaseModel):
    status: Literal["added", "already_exists", "error"] = Field(
        description="Result of the operation"
    )
    car_id: str | None = Field(
        default=None,
        description="ID of the new car; only if status is added",
    )
    message: str = Field(description="Human-readable explanation")

@mcp.tool(
    name="add_car",
    title="Add car to garage",
    description=(
        "Add a single car to the current QAuto user garage "
        "by brand id, model id, and mileage."
    ),
)
async def add_car(car: AddCarInput) -> AddCarResult:
    ...
	```
	Фрагмент того, що бачить LLM у `tools/list`:
	```json
{
  "name": "add_car",
  "title": "Add car to garage",
  "description": "Add a single car to the current QAuto user garage by brand id, model id, and mileage.",
  "inputSchema": {
    "properties": {
      "car": { "$ref": "#/$defs/AddCarInput" }
    },
    "required": ["car"]
  },
  "outputSchema": {
    "properties": {
      "status": {
        "description": "Result of the operation",
        "enum": ["added", "already_exists", "error"],
        "type": "string"
      },
      "car_id": {
        "anyOf": [{ "type": "string" }, { "type": "null" }],
        "description": "ID of the new car; only if status is added"
      },
      "message": {
        "description": "Human-readable explanation",
        "type": "string"
      }
    },
    "required": ["status", "message"]
  }
}
	```
	### Навіщо багата схема
	- **enum** з **Literal** — модель заздалегідь знає точний набір `status`
	- **car_id** може бути **null** — і в description сказано, коли поле заповнене
	- **message** завжди є — модель може пояснити результат навіть при помилці
	Завдяки `outputSchema` модель може **спланувати наступний крок до виклику** (наприклад: якщо `already_exists` — сказати користувачу, а не додавати знову).
	## Коротке правило
	1. LLM бачить JSON-схему, не тіло функції.
	2. Базовий рівень — **docstring** з Args/Returns + `@mcp.tool(name=..., title=...)`.
	3. Розширення — явний **`description`** у декораторі.
	4. Pydantic / plain types / dataclass — **один механізм** генерації схеми. Різниця лише в **багатстві** полів (`description`, constraints, `enum`).
	5. Описали в одному місці — не дублюйте роман у docstring і в `description`.
	## Той самий стиль для resources і prompts
	```python
@mcp.resource(
    "qauto://cars/catalog",
    name="car_catalog",
    title="QAuto car brands and models",
    description=(
        "Full brand/model id map for add_car. "
        "Does not list the user's cars — use get_cars."
    ),
    mime_type="application/json",
)
def get_car_catalog() -> str:
    ...

@mcp.prompt(
    name="analyze_cars",
    title="Analyze QAuto cars",
    description=(
        "Analyze all cars: sort by mileage, "
        "color-code status, return a markdown table."
    ),
)
def analyze_cars() -> str:
    ...
	```
	Для **tools** description читає переважно LLM. Для **resources/prompts** — частіше людина в списку Host; пишіть зрозуміло для обох.
