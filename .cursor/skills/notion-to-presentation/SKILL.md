---
name: notion-to-presentation
description: Генерує HTML-презентації зі слайдами з конспекту лекції MCP у Notion, використовуючи деки lesson N як шаблон (Hillel MAX стиль, GSAP анімації). Для слайда «Як це працює» — обовʼязково HTML-діаграма .mcp-flow (diagram-examples.md). Використовувати після generate-konspekt, коли користувач просить «зроби презентацію», «notion-to-presentation Лекція N».
---

# Генератор презентації Notion → Lesson N (MCP курс)

## Мета

Перетворити конспект лекції з Notion у HTML-презентацію в стилі [Hillel MAX](https://max.ithillel.ua/) з пошаговими анімаціями по кліку.

Проєкт: `/Users/oleksandr.golubishko/Learning/mcp`

## Передумова

Конспект лекції **вже існує** в Notion.

## Вибір шаблону

- Шаблон за замовчуванням: `lesson 1/` (styles.css + app.js — канонічний движок).
- Нову лекцію створювати як `lesson <N>/`, копіюючи файли з `lesson 1/`.

## Жорсткі правила

**Заборонено в слайдах:** «Джерело», посилання на modelcontextprotocol.io, згадки workspace/підключених серверів, meta про генерацію. Див. `.cursor/rules/mcp-course.mdc`.

### 1) Слайд 1 — титульний

- Фон: `../video%20and%20pcitures/Video/main%20slide.mp4`
- Логотип Hillel MAX, eyebrow «IT · MCP», `h1.slide__title` — назва лекції

### 2) Слайд 2 — план (лише H1)

- Заголовок: «План заняття»
- `ol.plan-list` з `.js-plan-step` — **тільки H1** з конспекту (без «Висновки» як окремого блоку в плані, якщо це фінал)

### 3) Блоки = H1 глави

Кожен H1 (крім фінального «Висновки») → блок:
- Вступний слайд блоку: `screensaver slide.mp4`, eyebrow «Блок N»
- Контентні слайди: **одне** відео на блок з:
  - `ice cubes.mp4`
  - `nextflix slide.mp4`
  - `northern lights slide.mp4`

### 4) Контентні слайди

- H2 → заголовок слайда (`slide__heading`)
- Абзаци → `slide__lead` (max 2 на слайд)
- **Практичні сценарії:** окремий слайд на кожен H2 + вступний слайд з контекстом; текст через `slide__lead`, **не** стискати в один список з трьох пунктів
- Списки → `.content-list__item` (max 5 пунктів; ділити на кілька слайдів)
- Картки → `.token-card` + `steps-slide` для покрокової появи
- **Схема «Як це працює»:** **обовʼязково** HTML-діаграма `.mcp-flow` за шаблоном у [`diagram-examples.md`](diagram-examples.md). Копіювати з `lesson 1/index.html`. **Заборонено:** PNG, SVG-картинки, `<img>` для цієї схеми.
- **Інші схеми MCP** (архітектура, transport): той самий патерн `.mcp-flow` / `.diagram-slide`, адаптувати підписи вузлів — див. `diagram-examples.md`.
- Для вступної лекції: окремі слайди «Основна проблема», «Наслідки», «Рішення: MCP», «Що це дає», «Ефект екосистеми»

### 5) Фінал — «Підсумки»

- Останній слайд: eyebrow «Фінал заняття», heading «Підсумки»
- **Текстом** — 2–3 абзаци `slide__lead`, не bullet list
- **Зміст:** за шаблоном H1 «Висновки» з конспекту — загальний підсумок заняття («На цій лекції ми…»), без детальних схем і покрокових flow. Див. `.cursor/rules/mcp-course.mdc` → «Блок Висновки».

## Успадкування шаблону

Скопіювати з `lesson 1/`:
- `styles.css`, `app.js` — без змін (містять `.mcp-flow`, `.scenario-card`, nav progress)
- `index.html` — редагувати лише контент слайдів
- `../video and pcitures/icons/` — technology icons (копіювати разом із lesson)

**Не змінювати:** CSS-класи, структуру deck, логіку `app.js`.

## Шляхи до відео

```
../video%20and%20pcitures/Video/main%20slide.mp4
../video%20and%20pcitures/Video/screensaver%20slide.mp4
../video%20and%20pcitures/Video/ice%20cubes.mp4
../video%20and%20pcitures/Video/nextflix%20slide.mp4
../video%20and%20pcitures/Video/northern%20lights%20slide.mp4
../video%20and%20pcitures/Hillel%20MAX%20Logo/logo-w.svg
```

## Після генерації

1. Оновити [`index.html`](../../index.html) hub — додати посилання на нову лекцію.
2. **Обовʼязково:** заповнити Notion → сторінка **«Відео»** лекції — **3 toggle-секції H3** (еталон: Лекція 1 → «Відео»):
   - `Посилання на гугл док де зберігається відео`
   - `Опис до відео`
   - `Посилання на презентацію`
   Див. `.cursor/rules/mcp-course.mdc` → «Структура кожної лекції в Notion».

## Приклади

- Загальна структура деки: [`examples.md`](examples.md)
- **HTML-діаграми:** [`diagram-examples.md`](diagram-examples.md)
- **Іконки та акценти Hillel MAX:** [`design-icons.md`](design-icons.md) — **конспект Notion не змінювати**

## Чеклист

- [ ] Слайд 1: main slide.mp4 + назва лекції
- [ ] Слайд 2: план лише з H1
- [ ] Кожен H1-блок: screensaver intro + контент
- [ ] Один фон на блок для контентних слайдів
- [ ] Останній слайд: «Підсумки» — загальний підсумок заняття (як H1 «Висновки»)
- [ ] Якщо є «Як це працює» — діаграма `.mcp-flow` за `diagram-examples.md`
- [ ] Notion «Відео»: 3 toggle-секції (Google doc / опис / презентація)
- [ ] Hub index.html оновлено
