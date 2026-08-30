You are a senior frontend refactoring agent working on a fintech-grade web app.

GOAL:
Refactor the transaction flow (Add Transaction, Select Asset, Asset Type) for MOBILE ONLY (≤ 640px) to achieve:

- Ultra compact density
- Strict visual hierarchy
- Elimination of visual noise
- Binance / Bybit mobile UX standard
- 30–40% vertical compression
- No changes to md+ breakpoints
- No changes to business logic
- No structural component rewrites

DO NOT:
- Modify desktop styles
- Break responsive behavior
- Touch logic files unless required for layout cleanup
- Remove accessibility attributes

====================================================
STEP 1 — REMOVE VISUAL NOISE
====================================================

1. Remove redundant subtitles:
   - "Completa los datos de la operación"
   - "Selecciona una moneda para registrar tu operación"
   - "Crypto wallet"
   - Long explanatory paragraphs

2. Replace multi-line header with compact header:

Header spec:
- Title: 18px
- Step indicator: 11px
- Padding: 12px 16px
- Remove divider lines unless structurally required

====================================================
STEP 2 — APPLY MOBILE TYPOGRAPHY SCALE
====================================================

Enforce this scale ONLY under max-width: 640px:

H1: 18px (1.125rem)
H2: 16px (1rem)
Body: 14px (0.875rem)
Secondary: 13px (0.8125rem)
Small: 12px (0.75rem)
Micro: 11px (0.6875rem)
Label: 10px (0.625rem uppercase)

Remove any font-size > 18px inside modal.
Remove any font-size between 19px–22px.

====================================================
STEP 3 — COMPRESS SPACING SYSTEM
====================================================

Under mobile:

- Between inputs: 12px
- Between sections: 16px
- Major block separation: max 20px
- Remove margin-top > 24px
- Remove padding > 16px
- All spacing must be multiples of 4px

Refactor excessive:
- margin-bottom: 24px → 12px
- padding: 24px → 12px
- vertical gaps > 28px → 16px

====================================================
STEP 4 — INPUT FIELD REFACTOR
====================================================

Enforce:

Input height: 44px
Padding: 10px 12px
Border-radius: 14px max
Label font: 10px uppercase
Value font: 14px

Remove:
- Shadows
- Decorative borders
- Double wrappers
- Nested padding layers

====================================================
STEP 5 — TABS COMPRESSION
====================================================

Buy / Sell / Transfer:

Container height: 36px
Tab height: 28px
Font: 13px
Padding horizontal: 12px
Border-radius: 12px
Remove shadows

====================================================
STEP 6 — SELECT ASSET LIST REFACTOR
====================================================

Replace card-per-row with flat list style.

Row:
- Height: 56px
- Padding: 8px 12px
- Icon: 28px
- Primary font: 14px
- Secondary font: 11px
- Remove per-item shadows
- Remove excessive border-radius

====================================================
STEP 7 — TOTAL SPENT BLOCK
====================================================

Remove extra card container.

Replace with compact block:

Label: 10px uppercase
Value: 16px
Margin-top: 12px

====================================================
STEP 8 — ICON NORMALIZATION
====================================================

Header icons: 18px
Inline icons: 16px
Asset icons: 28px

Remove decorative oversized icons.

====================================================
STEP 9 — HEIGHT TARGET
====================================================

Ensure modal visible height reduced by at least 30%.

Modal must not exceed 90vh.
Enable internal scroll if needed.

====================================================
STEP 10 — STYLE SCOPING
====================================================

All changes must be wrapped inside:

@media (max-width: 640px)

Do not modify md+.

====================================================
VALIDATION CHECKLIST BEFORE COMPLETION
====================================================

- No font-size > 18px in modal
- No spacing > 24px vertical
- No duplicate header descriptions
- No excessive shadows
- Reduced DOM nesting for layout
- Vertical compression achieved
- No layout overflow
- Desktop unaffected

====================================================
EXPECTED RESULT
====================================================

- Compact fintech UX
- Dense but readable
- Fast scan
- Professional institutional layout
- UI Governance Score improvement

Return:
1. Summary of changes made
2. % vertical reduction estimate
3. Files modified
4. Confirmation md+ unchanged