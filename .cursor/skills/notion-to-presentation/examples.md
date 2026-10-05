## Приклад: Лекція 1 → структура деки

### H1 з конспекту

- Введення до MCP
- Практичні сценарії
- Висновки

### Ключові слайди

| Блок | Слайди | Патерн |
|------|--------|--------|
| Введення | проблема, наслідки, рішення, **як це працює**, переваги, екосистема | текст + **діаграма `.mcp-flow`** |
| Практичні сценарії | вступ + 1 слайд на H2 + Cursor | `slide__lead`, не список |
| Підсумки | 3 абзаци текстом | `slide__lead` — загальний підсумок заняття, не детальний flow |

### Діаграма «Як це працює»

**Обовʼязковий еталон:** [`diagram-examples.md`](diagram-examples.md) — копіювати HTML з `lesson 1/index.html`.

```
Агент ──► MCP Server ──► Email / DB / API / Notion
         (4 кліки + анімація потоку)
```

---

## HTML патерн контентного слайда

```html
<section class="slide" aria-label="...">
  <video class="slide__video" autoplay muted loop playsinline preload="auto">
    <source src="../video%20and%20pcitures/Video/ice%20cubes.mp4" type="video/mp4" />
  </video>
  <div class="slide__scrim"></div>
  <div class="slide__glow slide__glow--soft" aria-hidden="true"></div>
  <div class="slide__inner slide__inner--content">
    <p class="slide__eyebrow js-reveal">Практичні сценарії</p>
    <h2 class="slide__heading js-reveal">Персональний асистент</h2>
    <p class="slide__lead js-reveal">...</p>
    <p class="slide__lead js-reveal">...</p>
  </div>
</section>
```
