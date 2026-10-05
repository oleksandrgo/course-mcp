# Повторення Streamable HTTP {toggle="true"}
	На попередніх лекціях qauto MCP server працював через **stdio**: Cursor запускав процес і передавав credentials у `env`. Перед міграцією освіжимо, що таке **Streamable HTTP** і чим він відрізняється від локального subprocess.
	## Що це і навіщо
	**Transport layer** визначає, *як* JSON-RPC доходить між **Host** і **Server**. Формат повідомлень той самий — змінюється лише доставка.
	**Streamable HTTP** — мережевий transport: сервер працює як **окремий процес** з HTTP endpoint. Один процес може обслуговувати багато клієнтів одночасно — на відміну від stdio, де кожне з'єднання Client↔Server це окремий subprocess.
	## Як це працює
	- **Client → Server:** кожне JSON-RPC повідомлення — HTTP **POST** на MCP endpoint
	- **Server → Client:** опційно HTTP **GET** на той самий endpoint (streaming)
	- **Сесія:** заголовок **`Mcp-Session-Id`** після `initialize`
	- Працює і локально: `http://127.0.0.1:8000/mcp` — сервер запускається окремо, Host підключається по **url**
	У презентації — HTML-діаграма `.mcp-flow`: LOCAL MACHINE (User → Host) → HTTP → MCP Server.
	## Конфігурація Client: url замість command
	Для stdio Host сам стартує процес:
	```json
{
  "mcpServers": {
    "qauto-course": {
      "command": "uv",
      "args": ["run", "main.py"],
      "env": {
        "QAUTO_EMAIL": "user@example.com",
        "QAUTO_PASSWORD": "YourPass1"
      }
    }
  }
}
```
	Для Streamable HTTP — **url** + **headers** (замість `env`). Host **не запускає** subprocess:
	```json
{
  "mcpServers": {
    "qauto-course": {
      "url": "http://127.0.0.1:8000/mcp",
      "headers": {
        "QAUTO_EMAIL": "user@example.com",
        "QAUTO_PASSWORD": "YourPass1"
      }
    }
  }
}
```
	Ті самі ключі, що в stdio йшли в **`env`**, тут — у **`headers`**. Сервер читає їх з HTTP-запиту, а не з процесного середовища.
	## stdio vs Streamable HTTP (коротко)
	- **Desktop / локальна розробка без окремого процесу** → stdio
	- **Окремий процес, MCP Inspector, кілька клієнтів, спільний сервер** → Streamable HTTP
	- **Production remote** → Streamable HTTP + auth (детальніше — у модулі OAuth)
	## Місток до міграції qauto
	У stdio секрети йшли через **`env`** у mcp.json — Cursor інжектив їх у процес сервера. У HTTP режимі Cursor **не стартує** процес, тому блок `env` у конфігу **не працює**. Далі розберемо, куди переїжджають credentials і де налаштовувати **host** / **port** сервера.
# Перехід на Streamable HTTP {toggle="true"}
	Мета цієї секції — перевести qauto MCP server зі **stdio** на **Streamable HTTP** з credentials у **headers** клієнтського конфігу. Tools, resources і prompts **не переписуємо** — змінюємо transport, каркас `FastMCP` і спосіб отримання email/password.
	## Обмеження Cursor: env більше не працює
	Зараз у stdio клієнт передає секрети так:
	```json
"env": {
  "QAUTO_EMAIL": "your_user@example.com",
  "QAUTO_PASSWORD": "YourPass1"
}
```
	Для Streamable HTTP Cursor **не запускає** процес сервера — блок **`env` у mcp.json не працює**. Офіційний спосіб підключення — **`url` + `headers`**:
	```json
{
  "mcpServers": {
    "qauto-course": {
      "url": "http://127.0.0.1:8000/mcp",
      "headers": {
        "QAUTO_EMAIL": "your_user@example.com",
        "QAUTO_PASSWORD": "YourPass1"
      }
    }
  }
}
```
	Ті самі ключі, що зараз у `env`, але в **headers**. Серверна змінна **`QAUTO_BASE_URL`** лишається на стороні **процесу сервера** — у `.env` або shell при `uv run`, бо клієнт її більше не інжектить.
	## Як це працює
	- **Cursor** (`mcp.json`) → `url` + `headers` → **MCP Streamable HTTP** на `:8000/mcp`
	- MCP server → `signin` / `cars` → **QAuto API**
	- **`.env` на сервері** → `QAUTO_BASE_URL` → MCP server
	У презентації — HTML-діаграма `.mcp-flow` з трьома вузлами: Cursor, HTTP MCP, QAuto API + `.env`.
	## FastMCP: transport-параметри в конструкторі
	На Лекції 10 ми передавали в конструктор `name`, `instructions`, `lifespan`. Для HTTP той самий **`FastMCP(...)`** приймає мережеві параметри — **host**, **port**, **streamable_http_path** тощо. Їх задаємо **один раз при створенні** об'єкта, а не дублюємо в `run()`.
	### Параметри конструктора для HTTP
	- **`host`** — адреса bind (локально `127.0.0.1`)
	- **`port`** — порт (дефолт для qauto: `8000`)
	- **`streamable_http_path`** — шлях endpoint (дефолт `/mcp`)
	- **`log_level`** — рівень логів (`DEBUG` / `INFO` / …); на HTTP stdout вільний для логів
	- опційно: `mount_path`, `json_response`, `stateless_http`, `max_request_body_size`
	### Читаємо з env, передаємо в конструктор
	```python
import os
from mcp.server.fastmcp import FastMCP

MCP_HOST = os.getenv("MCP_HOST", "127.0.0.1")
MCP_PORT = int(os.getenv("MCP_PORT", "8000"))
MCP_HTTP_PATH = os.getenv("MCP_HTTP_PATH", "/mcp")

mcp = FastMCP(
    name="qauto-course",
    instructions=(
        "MCP server for QAuto garage API. "
        "Auth: signup/signin set session cookie sid. "
        "Before create_car, read resource qauto://cars/catalog."
    ),
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path=MCP_HTTP_PATH,
    log_level=os.getenv("MCP_LOG_LEVEL", "INFO"),
)
```
	Endpoint для клієнта: `http://{MCP_HOST}:{MCP_PORT}{MCP_HTTP_PATH}` → `http://127.0.0.1:8000/mcp`.
	**Правило:** host/port/path — у **`FastMCP(...)`**. У `run()` лишаємо лише вибір transport.
	## Запуск: transport через MCP_TRANSPORT
	`mcp.run()` вибирає **як** слухати — stdio або HTTP. Значення host/port уже в конструкторі.
	```python
if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")
    mcp.run(transport=transport)
```
	- **`MCP_TRANSPORT=streamable-http`** (дефолт після міграції) — HTTP-сервер на host/port з конструктора
	- **`MCP_TRANSPORT=stdio`** — fallback для старих сценаріїв і локальної розробки без окремого процесу
	Повний фрагмент entrypoint:
	```python
if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")
    if transport == "streamable-http":
        # host/port/streamable_http_path уже в FastMCP(...)
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")
```
	## Credentials з HTTP headers + fallback на env
	У stdio `_get_configured_credentials()` читає лише `os.getenv`. Для HTTP додаємо пріоритет **headers** з поточного запиту.
	### Читання headers через Context
	```python
from mcp.server.fastmcp import Context

def _get_configured_credentials(ctx: Context | None = None) -> tuple[str, str] | str:
    email = password = ""

    if ctx is not None:
        request = ctx.request_context.request  # Starlette Request
        email = (request.headers.get("QAUTO_EMAIL") or "").strip()
        password = (request.headers.get("QAUTO_PASSWORD") or "").strip()

    if not email or not password:
        email = os.getenv("QAUTO_EMAIL", "").strip()
        password = os.getenv("QAUTO_PASSWORD", "").strip()

    if not email or not password:
        return (
            "QAUTO_EMAIL and QAUTO_PASSWORD must be set in MCP client headers "
            "(mcp.json → mcpServers.qauto-course.headers) or server env as fallback"
        )
    return email, password
```
	### Context у tools
	У HTTP один процес обслуговує багато запитів — глобальний `_is_signed_in` **недостатній**, якщо різні клієнти передають різні headers. Треба:
	- інжектити **`ctx: Context`** у `create_car` / `get_cars`
	- передавати `ctx` у `_ensure_signed_in(ctx)`
	- якщо **email змінився** порівняно з останнім успішним логіном — робити **повторний signin**
	```python
@mcp.tool()
async def get_cars(ctx: Context) -> str:
    auth_error = await _ensure_signed_in(ctx)
    if auth_error is not None:
        return auth_error
    ...
```
	### Приклад _ensure_signed_in з перевіркою email
	```python
_last_signed_in_email: str | None = None

async def _ensure_signed_in(ctx: Context) -> str | None:
    global _is_signed_in, _last_signed_in_email

    credentials = _get_configured_credentials(ctx)
    if isinstance(credentials, str):
        return _format_error(credentials, status_code=400)

    email, password = credentials

    if _is_signed_in and _last_signed_in_email == email:
        return None

    # signin через httpx ...
    _is_signed_in = True
    _last_signed_in_email = email
    return None
```
	## Розподіл змінних: клієнт vs сервер
	<table header-row="true">
		<tr>
			<td>Змінна</td>
			<td>Де задається</td>
			<td>Навіщо</td>
		</tr>
		<tr>
			<td>`QAUTO_EMAIL`, `QAUTO_PASSWORD`</td>
			<td>Cursor `headers` (fallback: server `.env`)</td>
			<td>Автологін для tools</td>
		</tr>
		<tr>
			<td>`QAUTO_BASE_URL`</td>
			<td>`.env` на сервері</td>
			<td>Базовий URL QAuto API для httpx-клієнта</td>
		</tr>
		<tr>
			<td>`MCP_HOST`, `MCP_PORT`, `MCP_HTTP_PATH`</td>
			<td>`.env` → конструктор `FastMCP`</td>
			<td>Де слухає MCP endpoint</td>
		</tr>
		<tr>
			<td>`MCP_TRANSPORT`</td>
			<td>shell при запуску</td>
			<td>`streamable-http` або `stdio`</td>
		</tr>
	</table>
	## Документація (README)
	Оновити README після міграції:
	- Запуск HTTP: `uv run main.py` → endpoint `http://127.0.0.1:8000/mcp`
	- Секція Cursor/Claude — приклад з **`url` + `headers`**
	- Короткий note: `MCP_TRANSPORT=stdio` для старого режиму
	- Опис змінних: клієнтські credentials → **headers**; серверні → **`.env`**
	## Перевірка після міграції
	1. Запустити `uv run main.py` — переконатися, що слухає `:8000`
	2. Підключити **MCP Inspector** або **Cursor** на `http://127.0.0.1:8000/mcp` з headers
	3. Викликати `get_cars` / `create_car` — автологін має брати email/password з headers
	4. Змінити email у headers — сервер має зробити повторний signin
# Логування {toggle="true"}
	Після міграції на **Streamable HTTP** зручніше дивитися, що відбувається на сервері. Але **логування — не одне ціле**: є рівень **MCP / transport** (framework) і рівень **додатку** (виклики QAuto API у tools). У цій секції розбираємо їх окремо — спочатку **`log_level` у FastMCP**.
	## log_level у FastMCP
	На **stdio** **stdout** зайнятий протоколом MCP — туди не можна писати діагностику. Після переходу на **Streamable HTTP** transport не займає stdout: у конструкторі **`FastMCP(...)`** задаємо **`log_level`** — `INFO`, `DEBUG` тощо.
	### Що саме логує log_level
	Це логи **самого MCP-сервера і transport layer**, не вашого бізнес-коду:
	- старт і зупинка HTTP-сервера
	- обраний transport (`streamable-http`)
	- вхідні **MCP**-запити на endpoint `/mcp` (JSON-RPC: `initialize`, `tools/call` тощо)
	Перевіряйте **stderr** після `uv run main.py`: має бути видно, що сервер слухає порт і приймає MCP-запити від Host або Inspector.
	### Чого log_level не дає
	**`log_level` не логує API-запити qauto** — виклики через **httpx** у tools (`POST /auth/signin`, `GET /cars`, помилки REST API). Це інший шар: application logging (наступна частина секції — **`logging`** у Python).
	Якщо tool викликав `get_cars`, у stderr від `log_level` ви побачите лише факт MCP-виклику `tools/call`, а не те, що всередині пішов запит на `https://qauto.forstudy.space/api/cars`.
	### Рівні log_level
	`log_level` у **`FastMCP(...)`** — це поріг **verbosity** для логів framework (transport, HTTP-сервер, MCP lifecycle). Приймає ті самі значення, що й стандартний **Python logging**. За замовчуванням — **`INFO`**.
	- **`DEBUG`** — максимум деталей: старт/зупинка, bind host/port, transport, вхідні запити на `/mcp`, внутрішні події FastMCP/ASGI. Зручно, коли сервер «мовчить» або дебажите підключення Host / Inspector.
	- **`INFO`** — робочий режим для локальної розробки: сервер стартував, слухає endpoint, прийшов MCP-запит — без «шуму» DEBUG.
	- **`WARNING`** — лише попередження framework (нестандартні ситуації, deprecated transport тощо).
	- **`ERROR`** — лише помилки на рівні сервера/transport (не вдалося обробити MCP-запит, падіння handler тощо).
	- **`CRITICAL`** — лише критичні збої (сервер не може продовжувати роботу).
	**Як це працює:** рівень — це **фільтр «від і вище»**. На `INFO` ви не побачите DEBUG-рядки; на `ERROR` — ні INFO, ні WARNING. Усі ці рівні стосуються **лише MCP/transport**, не httpx-викликів до QAuto.
	**Практика для qauto:**
	- локально — `INFO` або `DEBUG` (`MCP_LOG_LEVEL=DEBUG uv run main.py`)
	- shared / production — `WARNING` або `ERROR`, щоб stderr не роздувався
	### Налаштування
	- У конструкторі: `log_level=os.getenv("MCP_LOG_LEVEL", "INFO")`
	- Для детальнішої діагностики transport: `MCP_LOG_LEVEL=DEBUG`
	- Production-логування (файли, агрегація) — у наступних лекціях (контейнеризація, деплой)
	### Мінімальний приклад
	```python
mcp = FastMCP(
    name="qauto-course",
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path=MCP_HTTP_PATH,
    log_level=os.getenv("MCP_LOG_LEVEL", "INFO"),
)
```
	## logging (Python)
	`log_level` у FastMCP покриває **transport**. Щоб бачити **що робить qauto server** — виклики tools, запити до QAuto API, час відповіді — потрібен окремий шар: **`logging`** у Python + хуки **httpx** + централізований wrapper для tools.
	### Контекст: що вже є після FastMCP(...)
	У **`FastMCP.__init__`** наприкінці викликається **`configure_logging(log_level)`** — стандартний **`logging.basicConfig`** на root-логері, вивід у **stderr** (RichHandler). Звідси два правила:
	- **Свою** донастройку логерів робимо **після** `mcp = FastMCP(...)` у `server.py`, інакше FastMCP перезапише конфіг.
	- **stderr** безпечний і для **stdio**, і для **Streamable HTTP** — протокол MCP не займає stderr.
	`MCP_LOG_LEVEL` (у конструкторі FastMCP) і **`LOG_LEVEL`** (для коду `qauto_mcp`) — **різні рівні**: перший — framework, другий — ваш додаток. Їх можна тримати однаковими, але це окремі перемикачі.
	### Чого не вистачає «з коробки»
	- **httpx** на `INFO` дає лише рядок на кшталт `HTTP Request: POST ... "HTTP/1.1 201 Created"` — **без тіла** request/response.
	- **httpcore** на `DEBUG` засипає stderr трейсами з `_trace.py` — шум, а не користь.
	- Вхідний tool видно як `Processing request of type CallToolRequest` — **без імені tool**, аргументів і часу виконання.
	Мета цієї частини — логувати **вхідні tools** і **вихідні HTTP** до QAuto з **маскуванням секретів**.
	### Env-налаштування (`config.py`)
	Поруч із `MCP_*` додаємо змінні для application logging:
	```python
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_HTTP_BODIES = os.getenv("LOG_HTTP_BODIES", "true").lower() not in ("0", "false", "no")
LOG_BODY_MAX_CHARS = int(os.getenv("LOG_BODY_MAX_CHARS", "2000"))
```
	- **`LOG_LEVEL`** — verbosity логера `qauto_mcp` (не transport).
	- **`LOG_HTTP_BODIES`** — чи писати тіла signup / signin / POST `/cars` (за замовчуванням увімкнено).
	- **`LOG_BODY_MAX_CHARS`** — обрізка довгих JSON, щоб stderr не роздувався.
	### Модуль `logging_setup.py`
	Окремий файл **`logging_setup.py`**, не `logging.py` — щоб не конфліктувати зі stdlib.
	**`get_logger(name)`** — тонка обгортка над `logging.getLogger`.
	**`configure()`** — викликається **після** конструктора FastMCP:
	- рівень логера **`qauto_mcp`** → `LOG_LEVEL`;
	- **`httpcore`** → `WARNING` (прибрати DEBUG-трейси);
	- **`httpx`** → `WARNING` (його рядки дублюють наші event hooks).
	**Маскування** — ключі `password`, `repeatPassword`, `sid`, `cookie`, `set-cookie`, `authorization`, `x-qauto-password` замінюються на `***`.
	```python
def redact_body(raw: bytes) -> str:
    """JSON → рекурсивно маскує ключі → обрізка до LOG_BODY_MAX_CHARS."""

def redact_mapping(data: dict) -> dict:
    """Для аргументів tool (наприклад credentials.password)."""
```
	### Вихідні HTTP: event hooks у `http_client.py`
	У **`open_client()`** передаємо **`event_hooks`** в **`httpx.AsyncClient`**:
	```python
async def _log_request(request: httpx.Request) -> None:
    logger.info("→ %s %s", request.method, request.url)
    if LOG_HTTP_BODIES and request.content:
        logger.debug("→ body %s", redact_body(request.content))

async def _log_response(response: httpx.Response) -> None:
    await response.aread()  # інакше .content / .elapsed недоступні в хуку
    logger.info(
        "← %s %s (%.0f ms)",
        response.status_code,
        response.request.url,
        response.elapsed.total_seconds() * 1000,
    )
    if LOG_HTTP_BODIES:
        logger.debug("← body %s", redact_body(response.content))
```
	У stderr з’являться **`→ POST .../auth/signin`**, **`← 200 ... ms`**, а на **`DEBUG`** — тіла з **`password`** / **`sid`** як `***`.
	### Вхідні tools: `LoggingFastMCP`
	`FastMCP` реєструє **`call_tool`** всередині **`__init__`**, тому підміна `mcp.call_tool` після створення об’єкта **не спрацює**. Централізований варіант — **підклас**:
	```python
class LoggingFastMCP(FastMCP):
    async def call_tool(self, name: str, arguments: dict[str, Any]):
        started = perf_counter()
        logger.info("tool → %s %s", name, redact_mapping(arguments))
        try:
            result = await super().call_tool(name, arguments)
        except Exception:
            logger.exception("tool ✗ %s (%.0f ms)", name, (perf_counter() - started) * 1000)
            raise
        logger.info("tool ← %s ok (%.0f ms)", name, (perf_counter() - started) * 1000)
        return result
```
	Плюс: **усі** tools (і майбутні) логуються в одному місці, схеми tools не чіпаємо. Альтернатива без класу — декоратор **`log_tool_call`** на кожному `@mcp.tool(...)`, але його треба ставити **руками** на кожну функцію.
	У **`server.py`**: замість жорсткого `log_level="DEBUG"` — `log_level=MCP_LOG_LEVEL`; після конструктора — **`logging_setup.configure()`**.
	### Перевірка
	1. `uv run python -m qauto_mcp` — перезапустити сервер.
	2. З Cursor викликати **`get_cars`** / **`add_car`**.
	3. У терміналі (stderr) очікуємо ланцюжок:
		- `tool → add_car {...}` — аргументи з redact
		- `→ POST .../auth/signin`
		- `← 200 ... ms`
		- `tool ← add_car ok (... ms)`
	4. **`password`** і **`sid`** у логах — лише `***`.
	5. **`LOG_LEVEL=DEBUG`** — з’являються тіла; **`LOG_HTTP_BODIES=false`** — лише method, URL, status, час.
	У **`.env`** / README додати опис `LOG_LEVEL`, `LOG_HTTP_BODIES`, `LOG_BODY_MAX_CHARS` з приміткою: логи в **stderr**, секрети маскуються.
# Висновки {toggle="true"}
	На цій лекції ми освіжили **Streamable HTTP**, перевели qauto MCP server зі **stdio** на мережевий transport і розібрали, як credentials переїжджають з **`env`** у **`headers`** клієнтського конфігу.
	Також розвели два рівні логування: **`log_level`** FastMCP (transport) і **`logging`** додатку (tools + httpx до QAuto) з маскуванням секретів.
	Ключова ідея: **host**, **port** і **streamable_http_path** задаємо в конструкторі **FastMCP**; у `run()` лишається лише вибір transport. Це готує сервер до спільного використання, зручного дебагу та подальшого деплою.
	У наступній лекції перейдемо до **контейнеризації** MCP server — Docker і запуск HTTP-сервера в ізольованому середовищі.
