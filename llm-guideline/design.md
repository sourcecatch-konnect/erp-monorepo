# Design System — SKERP Web Apps

Applies to **web**. The app should keep one design language across all roles.
The source of truth for tokens is each app's `app/globals.css` `:root` block — keep them in sync.

---

## 1. Core Principles

1. **Sharp, not soft.** Borders are effectively square (2px radius). The product should feel
   like a precise data tool, not a consumer app.
2. **One primary color.** Everything that needs emphasis uses the single primary blue.
   No secondary brand colors, no gradients, no color theming per module.
3. **Tokens, never raw values.** Components reference CSS-variable-backed Tailwind tokens.
   A screen should re-theme correctly if a token changes.
4. **Reuse `packages/ui`.** Visual consistency comes from using shared components, not from
   re-styling per page.
5. **Restraint.** Flat surfaces, minimal shadow, generous whitespace, clear hierarchy.

---

## 2. Border Radius — "No Curved Borders"

Global radius is **2px** (`--radius: 0.125rem`). This is a deliberate "barely there" radius
to avoid jagged pixel corners while staying visually square.

| Do                                                                        | Don't                                         |
| ------------------------------------------------------------------------- | --------------------------------------------- |
| Rely on the default radius from `@skerp/ui` components                    | Add `rounded-lg`, `rounded-xl`, `rounded-2xl` |
| Use `rounded-sm` / `rounded-md` (both resolve near-square via `--radius`) | Use `rounded-full` on non-circular elements   |
| `rounded-full` **only** for avatars, status dots, spinners                | Override radius to make a softer card         |

If you need a corner change, change `--radius` globally — never per component.

---

## 3. Color

### Primary

- **Primary:** Blue `#2563EB` → `oklch(0.546 0.215 263)` → token `--primary`
- **Primary foreground:** White → `--primary-foreground`
- Use for: primary buttons, active nav, links, focus rings, selected states, key icons.

### Token palette (use these, not raw Tailwind colors)

| Token                                    | Use                                   |
| ---------------------------------------- | ------------------------------------- |
| `bg-background` / `text-foreground`      | Page surface and default text         |
| `bg-card` / `text-card-foreground`       | Cards, panels, table containers       |
| `bg-primary` / `text-primary-foreground` | Primary actions                       |
| `bg-secondary` / `bg-muted`              | Subtle fills, disabled, table headers |
| `text-muted-foreground`                  | Secondary/helper text                 |
| `border-border` / `border-input`         | All borders                           |
| `ring-ring`                              | Focus rings (tinted with primary)     |
| `text-destructive` / `bg-destructive`    | Errors, delete actions                |

**Never** write `bg-blue-600`, `text-gray-900`, `bg-white`, `#2563EB` in components.
There is no `success`/`warning` brand token yet — if you need one, add it to `globals.css`
first and document it here.

---

## 4. Typography

- Font: the app's default sans (Geist). Don't import new fonts.
- Sizes: `text-xs` (helper/labels), `text-sm` (default body & inputs), `text-base` (section
  titles), `text-lg`/`text-xl` (page titles). Avoid larger.
- Weight: `font-medium` for labels/buttons, `font-semibold` for headings. Avoid `font-bold`.
- Use `text-muted-foreground` for secondary text — don't dim with opacity.

---

## 5. Spacing & Layout

- Spacing scale: multiples of 4 (`gap-2`, `gap-4`, `p-4`, `p-6`). Avoid odd values.
- Page content max width for forms: `max-w-md`; for data screens use full width with padding.
- Group related fields with `space-y-4`; section gaps `space-y-6`.
- Prefer fl/grid layouts from utilities over custom CSS modules.

---

## 6. Elevation

- Flat by default. Cards use a 1px border (`border border-border`), not shadows.
- Shadows allowed only for floating layers: dropdowns, dialogs, popovers, toasts —
  and those come from `@skerp/ui`, so don't add your own.

---

## 7. Components — Always Use `packages/ui` (`@skerp/ui`)

Import shared components instead of building or restyling your own:

```tsx
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";
```

Available (see `packages/ui/src/components`): `button`, `input`, `inputgroup`, `inputOTP`,
`textarea`, `select`, `checkbox`, `radioButton`, `switch`, `lable`, `Field`, `card`/`Card`,
`dialog`, `sheet`, `popver`, `dropdown`, `command`, `tooltip`, `table`, `pagination`,
`tabler`, `sidebar`, `separator`, `skeleton`, `calender`, `datepicker`, `DateRangePicker`,
`item`, `sooner`/`toaster`.

**Rules**

- Need a component that exists in `@skerp/ui`? Use it.
- Need a variant? Add it to the shared component, don't fork it into an app.
- Need something new and reusable? Add it to `packages/ui` so both apps benefit.
- One-off layout composition (page-specific arrangements) lives in the app.

### Buttons

- `variant="default"` / `"primary"` → primary blue action. One primary button per view.
- `variant="outline"` / `"secondary"` → secondary actions.
- `variant="ghost"` → toolbar/icon actions.
- `variant="destructive"` → delete/irreversible actions.

---

## 8. States

- **Focus:** visible `ring-ring` ring — never remove outlines.
- **Disabled:** `opacity-50` + `cursor-not-allowed` (handled by `@skerp/ui`).
- **Loading:** use `skeleton` for content; disable buttons and show inline text/spinner.
- **Error:** field errors in `text-xs text-destructive` under the field; form-level errors
  in a bordered `bg-destructive/10 text-destructive` block.
- **Empty:** short message in `text-muted-foreground`, centered, with an action if relevant.

---

## 9. Accessibility

- Every input has a `<Label htmlFor>`.
- Interactive elements are real `<button>`/`<a>` or `@skerp/ui` components.
- Maintain contrast — rely on tokens, which are tuned for it.
- Don't convey meaning by color alone (pair with icon/text).

---

## 10. Checklist Before Shipping a Screen

- [ ] No `rounded-lg`/`xl`/`2xl`/`full` (except true circles)
- [ ] No hardcoded hex / `bg-blue-*` / `text-gray-*` / `bg-white` — tokens only
- [ ] All form controls, buttons, dialogs from `@skerp/ui`
- [ ] One primary button per view
- [ ] Focus, disabled, loading, error, empty states handled
- [ ] Looks consistent with the same screen type in the other web app
