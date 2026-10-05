# Еталонні HTML-діаграми для презентацій MCP

**Канонічна реалізація:** `lesson 1/index.html` (слайд «Як це працює») + стилі в `lesson 1/styles.css` + логіка `diagram-slide` у `lesson 1/app.js`.

**Завжди копіювати цей патерн**, коли в конспекті є H2 **«Як це працює»** або потрібно показати потік **Агент → MCP Server → Сервіси**. **Не використовувати PNG/SVG-зображення.**

---

## Коли застосовувати

| Конспект (Notion) | Презентація |
|---|---|
| H2 «Як це працює» у блоці «Введення до MCP» | Слайд `.slide--diagram.diagram-slide` з `.mcp-flow` |
| Пояснення client-server (Лекція 2+) | Адаптувати `.mcp-flow`: замінити «Сервіси» на Tools/Resources |
| Transport stdio vs HTTP | Окрема діаграма за тим самим патерном (нові підписи вузлів) |

---

## Логіка діаграми (ASCII)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Агент     │ ───► │ MCP Server  │ ───► │  Сервіси    │
│  (AI badge) │      │  (hub glow) │      │ Email · DB  │
│ Cursor/...  │      │ Одна інтегр│      │ API · Notion│
└─────────────┘      └─────────────┘      └─────────────┘
        ▲                    ▲                    ▲
   крок 1 (клік)       крок 2 (клік)       крок 3 (клік)
                                              + крок 4: caption
                                              → анімація потоку
```

Після 4-го кроку на контейнер `.mcp-flow` додається клас **`mcp-flow--streaming`** — зелені «пакети» рухаються по лініях.

---

## Покрокове розкриття (4 кліки)

| Крок | Клас `.mcp-flow__step` | Що зʼявляється |
|------|------------------------|----------------|
| 1 | `.mcp-flow__agents` | Агент + підпис «Потребує доступ до різних сервісів» |
| 2 | `.mcp-flow__hub-group` | Лінія зліва + MCP Server (пульсуюче кільце) |
| 3 | `.mcp-flow__services-group` | Лінія справа + сітка сервісів (2×2) |
| 4 | `.mcp-flow__caption` | Підпис + `mcp-flow--streaming` |

---

## HTML-шаблон (копіювати повністю)

```html
<section class="slide slide--diagram diagram-slide" aria-label="Схема MCP">
  <video class="slide__video" autoplay muted loop playsinline preload="auto">
    <source src="../video%20and%20pcitures/Video/northern%20lights%20slide.mp4" type="video/mp4" />
  </video>
  <div class="slide__scrim slide__scrim--plan"></div>
  <div class="slide__glow slide__glow--soft" aria-hidden="true"></div>
  <div class="slide__inner slide__inner--content slide__inner--diagram">
    <p class="slide__eyebrow js-reveal">Введення до MCP</p>
    <h2 class="slide__heading js-reveal">Як це працює</h2>
    <div class="mcp-flow js-reveal" role="img" aria-label="Агент підключається до MCP-сервера, який надає доступ до зовнішніх сервісів">
      <div class="mcp-flow__lane">
        <!-- Крок 1: Агент -->
        <div class="mcp-flow__agents mcp-flow__step">
          <div class="mcp-flow__node mcp-flow__node--agent">
            <span class="mcp-flow__badge">AI</span>
            <span class="mcp-flow__label">Агент</span>
            <span class="mcp-flow__hint">Cursor · Claude · VS Code</span>
          </div>
          <p class="mcp-flow__note">Потребує доступ до різних сервісів</p>
        </div>

        <!-- Крок 2: Hub + лінія зліва -->
        <div class="mcp-flow__hub-group mcp-flow__step">
          <div class="mcp-flow__pipe mcp-flow__pipe--left" aria-hidden="true">
            <span class="mcp-flow__line"></span>
            <span class="mcp-flow__dot mcp-flow__dot--a"></span>
            <span class="mcp-flow__dot mcp-flow__dot--b"></span>
          </div>
          <div class="mcp-flow__hub">
            <span class="mcp-flow__hub-ring" aria-hidden="true"></span>
            <span class="mcp-flow__hub-tag">MCP</span>
            <span class="mcp-flow__hub-title">Server</span>
            <span class="mcp-flow__hub-sub">Одна інтеграція</span>
          </div>
        </div>

        <!-- Крок 3: Сервіси + лінія справа -->
        <div class="mcp-flow__services-group mcp-flow__step">
          <div class="mcp-flow__pipe mcp-flow__pipe--right" aria-hidden="true">
            <span class="mcp-flow__line"></span>
            <span class="mcp-flow__dot mcp-flow__dot--a"></span>
            <span class="mcp-flow__dot mcp-flow__dot--b"></span>
            <span class="mcp-flow__dot mcp-flow__dot--c"></span>
          </div>
          <div class="mcp-flow__services">
            <div class="mcp-flow__node mcp-flow__node--service">
              <span class="mcp-flow__service-icon">@</span>
              <span class="mcp-flow__label">Email</span>
            </div>
            <div class="mcp-flow__node mcp-flow__node--service">
              <span class="mcp-flow__service-icon">DB</span>
              <span class="mcp-flow__label">База даних</span>
            </div>
            <div class="mcp-flow__node mcp-flow__node--service">
              <span class="mcp-flow__service-icon">API</span>
              <span class="mcp-flow__label">Зовнішні API</span>
            </div>
            <div class="mcp-flow__node mcp-flow__node--service">
              <span class="mcp-flow__service-icon">N</span>
              <span class="mcp-flow__label">Notion</span>
            </div>
          </div>
        </div>
      </div>
      <!-- Крок 4: Підпис -->
      <p class="mcp-flow__caption mcp-flow__step">
        Агент підключається до <strong>MCP-сервера</strong> — і отримує tools для всіх сервісів без окремої розробки
      </p>
    </div>
  </div>
</section>
```

---

## Що можна змінювати під лекцію

| Елемент | Як адаптувати |
|---------|---------------|
| `.mcp-flow__hint` | Платформи агента (Cursor, Claude Desktop, VS Code) |
| `.mcp-flow__note` | Короткий контекст проблеми |
| `.mcp-flow__hub-sub` | «Одна інтеграція», «stdio transport», тощо |
| Сервіси (4 вузли) | Email, DB, API, Notion, Figma, GitLab — за темою лекції |
| `.mcp-flow__caption` | Підсумок одним реченням |
| `aria-label` на `.mcp-flow` | Опис для доступності |

**Не змінювати:** структуру `.mcp-flow__lane` (3 колонки), класи `.mcp-flow__step`, `.diagram-slide`, імена pipe/dot/hub — інакше зламається GSAP у `app.js`.

---

## Залежності (не дублювати в нових lesson N)

- **CSS:** блок `.mcp-flow` … `@media (max-width: 820px)` уже в `lesson 1/styles.css` — копіювати `styles.css` цілком.
- **JS:** `diagram-slide`, `resetDiagramSteps`, `revealNextDiagramStep` — уже в `lesson 1/app.js` — копіювати `app.js` цілком.

---

## Конспект → презентація

У Notion для H2 «Як це працює» достатньо **тексту** (2–3 речення про «інтеграція один раз → MCP-сервер → агенти»). Зображення в Notion — опціонально.

У **HTML-презентації** — **завжди** HTML-діагrama `.mcp-flow` за цим шаблоном.

---

## Чеклист діаграми

- [ ] `<section class="slide slide--diagram diagram-slide">`
- [ ] Заголовок H2: «Як це працює»
- [ ] 4 елементи з класом `.mcp-flow__step`
- [ ] Не `<img>` і не PNG
- [ ] Після останнього кроку — анімація потоку (`mcp-flow--streaming` через app.js)
- [ ] Eyebrow = назва H1-блоку з конспекту
