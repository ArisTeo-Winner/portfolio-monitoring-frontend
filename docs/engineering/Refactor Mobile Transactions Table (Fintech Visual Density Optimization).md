# TASK: Refactor Mobile Transactions Table (Fintech Visual Density Optimization)

## Context

The current mobile (sm ≤ 640px) Transactions section lacks visual consistency.

Compared to ARKM mobile layout:

- Typography is oversized
- Row height is too tall
- Secondary text competes with primary data
- Visual density is low
- Table feels heavy and less fintech-professional

We are NOT copying ARKM design.
We are optimizing typography hierarchy and density.

---

# OBJECTIVE

Refactor ONLY the Transactions section for mobile view (≤ 640px) to:

- Reduce typographic scale
- Improve hierarchy clarity
- Increase row density
- Achieve fintech-grade compactness
- Maintain readability
- Preserve desktop layout untouched

---

# VISUAL PROBLEMS IDENTIFIED

1. Asset name font too large
2. Quantity font too large
3. USD value font competes with asset name
4. Excess vertical spacing between rows
5. Filters section oversized
6. "Mostrando / Total" blocks unnecessary visual noise

---

# TARGET TYPOGRAPHY SCALE (Mobile Only)

Primary (Asset Symbol):
- 14px / 0.875rem
- font-weight: 600

Secondary (Asset Name):
- 11px / 0.6875rem
- opacity: 0.65

Transaction Amount:
- 13px / 0.8125rem
- font-weight: 600

USD Value:
- 11px / 0.6875rem
- opacity: 0.6

Section Title ("Activos con movimientos"):
- 15px / 0.9375rem
- font-weight: 600

Filter Buttons:
- 12px / 0.75rem

---

# ROW STRUCTURE REFACTOR

Current row height: ~72–88px  
Target row height: 56–60px max

Implement:

- Reduce vertical padding to py-3 (12px total)
- Icon size: 28px
- Gap between icon and text: 8px
- Right-side action button size: 36px

---

# REMOVE VISUAL NOISE

On mobile:

Remove completely:
- "Mostrando"
- "Total"
- Redundant statistics blocks

Keep:
- Filters
- Transactions list
- Section header

---

# LAYOUT STRUCTURE TARGET (Mobile)

[Filters]
↓
Section Title
↓
Transaction Row
Transaction Row
Transaction Row

No cards-within-cards nesting.
No extra background containers.

---

# CSS / Tailwind ACTIONS

1. Reduce font sizes in Transactions component only under mobile breakpoint.
2. Adjust spacing utilities:
   - Replace py-5 → py-3
   - Replace gap-4 → gap-2
3. Reduce icon container from 40px → 28px
4. Reduce right action button padding

---

# STRICT SCOPE CONTROL

⚠ DO NOT:

- Modify desktop layout
- Modify tablet layout
- Change business logic
- Change data structure
- Modify chart
- Modify header

Only refactor presentation layer in Transactions mobile viewport.

---

# IMPLEMENTATION STRATEGY

If using Tailwind:

Apply mobile-first classes:

Example:

```tsx
<div className="text-sm font-semibold sm:text-base md:text-lg">
```

Override mobile only using base sizing.

If using CSS:

Wrap under:

@media (max-width: 640px) {
   /* typography + spacing overrides */
}

---

# ACCEPTANCE CRITERIA

✔ Row height ≤ 60px  
✔ Asset symbol visually dominant  
✔ USD value secondary  
✔ Clear hierarchy  
✔ Higher density  
✔ Clean fintech aesthetic  
✔ No visual clutter blocks  
✔ Desktop unchanged  

---

# FINAL RESULT SHOULD FEEL:

- Compact
- Professional
- Structured
- Institutional
- High information density
- Mobile-native fintech

END TASK