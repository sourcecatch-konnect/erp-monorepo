# Design System — SKERP Web Apps

Applies to **web**. The app should keep one design language across all roles.
The source of truth for tokens is each app's `app/globals.css` `:root` block — keep them in sync.

---

## 1. Core Principles

1. **Precise, not sharp.** Borders use a restrained 6px radius — crisp and serious
   (Notion/Linear territory), never pill-shaped or bubbly. Still a data tool, not a consumer app.
2. **One primary color.** Everything that needs emphasis uses the single primary blue.
   No secondary brand colors, no gradients, no color theming per module.
3. **Tokens, never raw values.** Components reference CSS-variable-backed Tailwind tokens.
   A screen should re-theme correctly if a token changes. Neutrals carry a whisper of
   warmth (oklch hue ~92, chroma ≤0.005) — never reintroduce pure-gray or raw Tailwind grays.
4. **Reuse `packages/ui`.** Visual consistency comes from using shared components, not from
   re-styling per page.
5. **Restraint.** Flat surfaces, minimal shadow, generous whitespace, clear hierarchy.
6. **Quiet motion.** A small fixed motion vocabulary (see §11) — color/opacity transitions,
   overlay fades, skeleton shimmer. Nothing springs, bounces, or scales on hover.
7. **Readable first.** Primary users are mid-age; body and data text never go below 14px
   (`text-sm`), labels never below 12px (`text-xs`). Don't shrink text for aesthetics.

---

## 2. Border Radius

Global radius is **6px** (`--radius: 0.375rem`). All `rounded-*` utilities derive from it
(`rounded-lg` = 6px, `rounded-md` ≈ 5px, `rounded-sm` ≈ 3.6px).

| Do                                                          | Don't                                       |
| ----------------------------------------------------------- | ------------------------------------------- |
| Rely on the default radius from `@skerp/ui` components      | Add `rounded-xl`, `rounded-2xl`, or larger  |
| Use `rounded-sm` / `rounded-md` / `rounded-lg` (token-based) | Use `rounded-full` on non-circular elements |
| `rounded-full` **only** for avatars, status dots, spinners  | Override radius to make a softer card       |

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
- Sizes: `text-xs` (helper/labels — the floor; never `text-[10px]`/`text-[11px]`),
  `text-sm` (default body, inputs, table cells & headers), `text-base` (section titles),
  `text-lg`/`text-xl` (page titles). Avoid larger. Don't shrink text to "fit the aesthetic" —
  hierarchy comes from weight and `text-muted-foreground`, not size reduction.
- Weight: `font-medium` for labels/buttons, `font-semibold` for headings. Avoid `font-bold`.
- Letter-spacing: default tracking everywhere. `tracking-tight` is allowed only on page-level
  headings (`text-xl`+). Never `tracking-wide`/`wider` micro-labels.
- Use `text-muted-foreground` for secondary text — don't dim with opacity.

---

## 5. Spacing & Layout

- Spacing scale: multiples of 4 (`gap-2`, `gap-4`, `p-4`, `p-6`). Avoid odd values.
- Page content max width for forms: `max-w-md`; for data screens use full width with padding.
- Group related fields with `space-y-4`; section gaps `space-y-6`.
- Prefer fl/grid layouts from utilities over custom CSS modules.

---

## 6. Elevation & Surfaces

- Flat by default. Cards use a 1px border (`border border-border`) on `bg-card`, not shadows.
  The page background sits 1% below white, so white cards read as raised surfaces for free.
- Shadows allowed only for floating layers: dropdowns, dialogs, popovers, toasts, sticky
  action bars — and those come from `@skerp/ui`, so don't add your own. No `hover:shadow-*`.
- **Interactive items use background shifts, not borders.** Sidebar items, table rows, and
  menu entries are borderless with `hover:bg-muted` (or `hover:bg-sidebar-accent`) ghost
  treatment. Reserve borders for structural containers: cards, inputs, table frames.

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

- [ ] No `rounded-xl`/`2xl`/`full` (except true circles)
- [ ] No hardcoded hex / `bg-blue-*` / `text-gray-*` / `bg-white` — tokens only
- [ ] No text below `text-xs`; body/data text is `text-sm`+; no `tracking-wide` labels
- [ ] No `shadow-*` on static surfaces; no `hover:shadow-*` / `hover:scale-*`
- [ ] Hover states are `transition-colors` background/border shifts (150–300ms)
- [ ] All form controls, buttons, dialogs from `@skerp/ui`
- [ ] One primary button per view
- [ ] Focus, disabled, loading (Skeleton, never "Loading…"), error, empty states handled
- [ ] Looks consistent with the same screen type elsewhere in the app

---

## 11. Motion

A fixed, minimal vocabulary — used everywhere, nothing else added per screen:

| Pattern            | Recipe                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| Hover / state      | `transition-colors duration-150` on rows, sidebar items, buttons, links  |
| Overlays           | fade + slight zoom/slide from `@skerp/ui` (tw-animate-css) — don't add own |
| Collapse / expand  | height/opacity ease from the shared `accordion`/`collapsible` components |
| Loading            | `Skeleton` (shimmer is built in) — never spinners-in-cells or text       |

**Banned:** spring/bounce easings, `hover:scale-*`, gradient text/blobs, glassmorphism,
staggered entrance animations, anything longer than 300ms for a micro-interaction.
`prefers-reduced-motion` is honored globally in `globals.css` — don't bypass it.
