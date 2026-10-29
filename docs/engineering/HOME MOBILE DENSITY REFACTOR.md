# TASK: HOME MOBILE DENSITY REFACTOR (Binance / Bybit Level)

## SCOPE

Refactor ONLY mobile base styles (≤ 640px).
DO NOT modify md, lg, xl breakpoints.
DO NOT change business logic.
DO NOT modify data structure.

Goal:
Maximum information density without losing readability.
Strict hierarchy.
Zero visual noise.
Professional fintech app compactness.

---

# PROBLEMS DETECTED (FROM SCREENSHOTS)

1. Excessive card padding (too airy)
2. Too many independent cards
3. Duplicated metrics (24h vs All-Time)
4. Intro text unnecessary
5. Chart too tall
6. Too much vertical spacing between sections
7. Titles too large
8. Weak hierarchy grouping
9. Redundant separators
10. Distribution card oversized
11. Bottom nav overlapping visual balance

---

# RADICAL CLEANUP PLAN

## REMOVE (Mobile Only)

Delete completely:

- "Hola, Inversor"
- Intro descriptive paragraph
- "Generar Reporte" button (move elsewhere if needed)
- Duplicate metric cards (keep ONE performance block)
- Redundant PNL duplication (24h + All-time both large)
- Large empty separators

---

# RESTRUCTURE HOME (Mobile Layout Order)

NEW STRUCTURE:

1. Compact Portfolio Summary (single block)
2. Mini Chart (compressed height)
3. Distribution (compact)
4. Top Movers (condensed list)
5. Recent Activity (compact rows)

No standalone airy cards.
Reduce card count by 40–50%.

---

# 1️⃣ PORTFOLIO SUMMARY (Compact Block)

Merge:

- Balance Neto
- 24h variation
- All-Time PNL

Into ONE card:

Layout:

[ Total Balance ]
[ +$X (+X%) 24h | +$X All-Time ]

Rules:

- Balance font: 22px
- Change font: 14px
- Secondary metric: 12px opacity 0.7

Padding:
- px-4 py-4 max

Remove decorative icons.

---

# 2️⃣ CHART COMPRESSION

Current height: too tall (~280–320px)

Target height mobile:
- 160px max

Remove vertical empty gradient padding.

Reduce timeframe selector spacing:

Replace:
gap-6 → gap-3

Timeframe font:
12px

---

# 3️⃣ DISTRIBUTION CARD OPTIMIZATION

Problems:
- Oversized donut
- Large vertical margins
- Legend too spaced

Adjust:

Donut size:
- 160px max width

Legend spacing:
- gap-2
- font 12px
- percentage aligned right compact

Remove extra card padding.

Card padding mobile:
- p-4 max

---

# 4️⃣ MOVIMIENTOS DESTACADOS (24h)

Reduce:

Row height target:
56px max

Typography:

Asset name:
14px weight 600

Holding:
11px opacity 0.65

Price:
13px weight 600

Change:
11px

Remove thick separators.

Use subtle border:
border-b border-white/5

---

# 5️⃣ ACTIVIDAD RECIENTE (Compact Mode)

Problems:
- Rows too tall
- Icon circles too big
- Too much vertical whitespace

Refactor:

Row height:
56px max

Left icon:
28px circle

Title:
14px

Date:
11px opacity 0.6

Right amount:
13px weight 600

USD:
11px opacity 0.6

Remove card shadow layers.

---

# TYPOGRAPHY SCALE (Mobile Only)

H1 (balance):
22px

Section Title:
15px

Primary Row Text:
14px

Secondary:
11px

Meta:
10–11px

---

# SPACING SYSTEM (Mobile Only)

Replace:

py-6 → py-4
py-5 → py-3
gap-6 → gap-3
gap-4 → gap-2
mb-8 → mb-5
mb-6 → mb-4

Maximum vertical rhythm step:
16px

---

# CARD STYLE REDUCTION

Replace:

Rounded-xl heavy cards
With:
Rounded-lg subtle

Shadow:
Remove heavy drop shadows.
Use soft background contrast instead.

---

# VISUAL HIERARCHY RULES

1. ONE dominant number per screen.
2. No duplicated metrics.
3. Secondary data always smaller + lower opacity.
4. Lists denser than dashboards.
5. No empty vertical zones > 24px.

---

# DO NOT TOUCH

- Desktop breakpoints
- Tablet layout
- Navigation structure
- Chart logic
- API calls
- State management

---

# ACCEPTANCE CRITERIA

✔ Home scroll length reduced by at least 30%
✔ Chart height ≤ 160px
✔ Card padding reduced
✔ No duplicated metric blocks
✔ Clean institutional look
✔ Dense but readable
✔ md+ visually identical to current version

---

# FINAL RESULT SHOULD FEEL LIKE

Binance app density.
Bybit professional clarity.
Institutional fintech compact dashboard.
No marketing fluff.
Pure data clarity.

END TASK