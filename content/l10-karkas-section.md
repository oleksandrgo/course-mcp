# Каркас сервера {toggle="true"}
	Після архітектури збираємо **каркас**: параметри `FastMCP` і єдиний процес опису tools для Host і LLM.
	Головна ідея: модель **не бачить Python-код**. Вона бачить лише JSON з `tools/list` — результат інтроспекції при реєстрації tool.
	Логування відкладаємо: на stdio stdout зайнятий протоколом. Підключимо в лекції про Streamable HTTP.
	## FastMCP з параметрами
	Мінімальний старт:
	```python
mcp = FastMCP("qauto")
	```
	У каркасі передаємо параметри явно:
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
	- **`name`** — ідентифікатор сервера в Host
	- **`instructions`** — гайд на рівні всього сервера (порядок дій, resources, prompts). Доповнює описи tools, не замінює їх
	- **`lifespan`** — startup/shutdown (HTTP-клієнт і teardown)
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
	Типи є. Але **немає `description` у полях схеми** — якщо не винести їх у docstring / інший механізм з описами.
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
	- **`enum` з `Literal`** — модель заздалегідь знає точний набір `status`
	- **`car_id` може бути `null`** — і в description сказано, коли поле заповнене
	- **`message` завжди є** — модель може пояснити результат навіть при помилці
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
