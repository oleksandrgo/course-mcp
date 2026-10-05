# Іконки та візуальні акценти (Hillel MAX deck)

**Конспект Notion не змінювати** — лише HTML/CSS презентація.

## Локальні assets

```
video and pcitures/icons/
  mcp.png       — Hillel LMS (technology MCP)
  figma.png
  mysql.png
  postman.png
  chatgpt.png
  jira.png
  git.png
  email.svg     — mint outline (немає на max.ithillel.ua)
  notion.svg    — mint outline
video and pcitures/Hillel MAX Logo/symbol.svg — watermark block-intro
```

Шлях з `lesson N/index.html`: `../video%20and%20pcitures/icons/mcp.png`

## Де використовувати

| Елемент | Клас / патерн |
|---------|----------------|
| Watermark block-intro | `.slide--block-intro` + `.slide__watermark` (symbol.svg, по центру за текстом). **Не** додавати `position: relative` на `.slide` — ламає fullscreen layout |
| План заняття | `.plan-list__icon` поруч із номером |
| Титул | `.tech-chips` + `.tech-chip` |
| Діаграма `.mcp-flow` | `<img>` у agent, hub, services |
| Сценарії | `.scenario-card` + `.scenario-card__icon` |
| Навігація | `#navProgress` — `поточний / всього` |

## Чеклист

- [ ] Іконки локально, не CDN під час показу
- [ ] Block-intro має watermark
- [ ] `.mcp-flow` — PNG/SVG, не літери `@`, `DB`
- [ ] Сценарії — картка з іконкою
- [ ] Конспект Notion **не редагувати**
