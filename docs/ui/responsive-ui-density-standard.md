# Fintech Responsive UI Density Standard

## Purpose

This standard defines measurable responsive UI density rules for financial dashboard screens.

It prevents inconsistent spacing, oversized cards, excessive gaps, poor mobile density and underused desktop layouts.

---

## Breakpoints

| Breakpoint | Width | Target |
|---|---:|---|
| xs | 0px | Default mobile, primary target 375x812 |
| sm | 640px | Large mobile |
| md | 768px | Tablet |
| lg | 1024px | Small desktop |
| xl | 1280px+ | Desktop |

---

## General Principles

- Mobile-first.
- Dense but readable.
- Touch targets must be at least 44px.
- Avoid excessive vertical spacing.
- Do not let fixed navigation cover actionable content.
- Prefer shared components over one-off Tailwind classes.
- Use layout changes at `md`, `lg`, and `xl` instead of only increasing spacing.

---

## Page Container

### xs

- Horizontal padding: 20px
- Tailwind: `px-5`
- Top padding: 24px
- Tailwind: `pt-6`
- Bottom padding with bottom navigation: minimum 112px
- Tailwind: `pb-28`
- Section gap: 20px
- Tailwind: `space-y-5`

### sm

- Horizontal padding: 24px
- Tailwind: `sm:px-6`
- Section gap: 24px
- Tailwind: `sm:space-y-6`

### md

- Horizontal padding: 32px
- Tailwind: `md:px-8`
- Max content width may be introduced.
- Bottom padding can be reduced if bottom navigation is not present.

### lg

- Horizontal padding: 40px
- Tailwind: `lg:px-10`
- Use wider content area.
- Consider two-column layout for settings if useful.

### xl

- Horizontal padding: 48px
- Tailwind: `xl:px-12`
- Max width: 1120px–1280px depending on screen.
- Avoid stretching forms too wide.

---

## Settings Layout

### xs

- One column.
- Category selector full width.
- Cards full width.
- Form fields stacked vertically.

### sm

- One column.
- Slightly wider spacing.
- Cards still full width.

### md

- One column or split layout depending on content.
- Cards may use `md:px-8 md:py-8`.
- Form controls can remain stacked.

### lg

- Prefer two-column layout when multiple settings sections exist.
- Example:
  - left: category navigation
  - right: selected settings card
- Or use grid cards if showing several sections.

### xl

- Use max-width container.
- Avoid forms wider than 640px–720px unless justified.
- Keep readable line length.

---

## Settings Card

### xs

- Padding: 20px horizontal, 24px vertical
- Tailwind: `px-5 py-6`
- Radius: `rounded-2xl`
- Max recommended card height: 720px when card is visible inside mobile viewport.
- Avoid: `p-10`, `py-10`, `space-y-10`, `space-y-12`.

### sm

- Padding: 24px
- Tailwind: `sm:p-6`

### md

- Padding: 32px
- Tailwind: `md:px-8 md:py-8`

### lg

- Padding: 32px–40px
- Tailwind: `lg:p-8` or `lg:p-10` only when layout has enough width and no density issue.

### xl

- Padding can remain `p-8`.
- Avoid unnecessary `p-12` for form-heavy cards.

---

## Settings Header

### xs

- Bottom margin: 20px
- Bottom padding: 20px
- Tailwind: `mb-5 pb-5`
- Title: 18px
- Tailwind: `text-lg leading-6`
- Description: 14px, line-height 20px
- Tailwind: `text-sm leading-5`

### md+

- Title may increase only if hierarchy requires it.
- Avoid oversized headers in form-heavy pages.

---

## Form Fields

### xs

- Field vertical padding: 16px
- Tailwind: `py-4`
- Label-input gap: 8px
- Tailwind: `mb-2`
- Field divider: allowed with `divide-y`.

### sm

- Field vertical padding: 16px–20px
- Tailwind: `sm:py-5` if needed.

### md+

- Keep field spacing controlled.
- Do not inflate vertical spacing just because viewport is wider.
- Use horizontal layout only when labels are short and content benefits from it.

---

## Controls

Applies to inputs, selects and buttons.

### xs

- Minimum height: 44px
- Preferred height: 48px
- Maximum regular height: 56px
- Tailwind: `h-12`
- Border radius: `rounded-xl` or `rounded-2xl`

### sm / md / lg / xl

- Keep controls between 44px and 56px.
- Do not increase control height unnecessarily on desktop.
- Width may change, height usually should not.

---

## Actions

### xs

- Top margin: 24px
- Tailwind: `mt-6`
- Gap: 12px
- Tailwind: `gap-3`
- Stacked buttons are acceptable.

### sm

- Buttons may remain stacked or become inline if space allows.

### md+

- Prefer inline actions when appropriate:
  - Reset secondary
  - Save primary
- Keep alignment consistent.

---

## Forbidden Classes in Settings Mobile

Avoid in mobile settings modules unless explicitly justified:

- `p-10`
- `px-10`
- `py-10`
- `p-12`
- `space-y-10`
- `space-y-12`
- `gap-10`
- `mb-10`
- `mt-10`
- `py-8` on repeated fields

---

## Recommended Responsive Classes

Settings page:

```text
px-5 pt-6 pb-28 space-y-5
sm:px-6 sm:space-y-6
md:px-8
lg:px-10
xl:px-12