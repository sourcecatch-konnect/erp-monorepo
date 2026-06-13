# LLM Guidelines

Rules an AI assistant (and humans) must follow when writing code in this monorepo.
Read the relevant file before generating UI or frontend code.

| File                         | Scope                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [design.md](./design.md)     | Visual design system — colors, borders, spacing, typography, component usage. Applies to **web** and **web**. |
| [frontend.md](./frontend.md) | Frontend architecture — state management, data fetching, auth, folder structure.                              |

## Non-negotiables (quick reference)

1. **No curved/rounded look.** Global border radius is **2px** (`--radius: 0.125rem`). Never add `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` (except true circles like avatars/spinners).
2. **One primary color.** Blue `#2563EB`. Use the `primary` design token — never hardcode hex or `bg-blue-600`.
3. **Use `packages/ui` components.** Don't hand-roll buttons, inputs, dialogs, tables. Import from `@skerp/ui`.
4. **Design tokens over raw colors.** Use `bg-card`, `text-foreground`, `border-border`, `bg-primary` — not `bg-white`, `text-gray-900`, `bg-gray-200`.
5. Both web apps must look identical in design language.
