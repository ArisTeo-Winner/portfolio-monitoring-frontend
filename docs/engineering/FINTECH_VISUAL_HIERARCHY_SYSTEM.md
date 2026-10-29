# FINTECH_VISUAL_HIERARCHY_SYSTEM
## Portfolio Monitoring Frontend
Version: 1.0  
Scope: sm ≤ 640px (Primary), scalable upward  
Mode: Professional Financial UI Hierarchy  

---

## 1. Purpose

Define a strict visual hierarchy system for a multi-asset fintech dashboard ensuring:

- Immediate numeric clarity
- Cognitive efficiency
- Reduced decision friction
- Professional exchange-grade layout
- Clear prioritization of financial data

This system governs how visual weight is distributed across the interface.

---

## 2. Core Principle

In fintech UI:

Numbers > State > Context > Decoration

If hierarchy is unclear, users lose trust.

---

## 3. Hierarchy Levels

### Level 1 — Critical Financial Value

Examples:
- Total Portfolio Balance
- Net Worth
- Liquidation Value
- Margin Level

Characteristics:

- Largest font on screen
- Highest contrast color (#FFFFFF)
- Font-weight: 600
- Tight line-height (1.2)
- No competing elements nearby

Only ONE Level 1 element per screen.

---

### Level 2 — Immediate Financial State

Examples:
- 24h Change %
- Unrealized PnL
- Realized PnL
- Asset Price

Characteristics:

- Medium emphasis
- Semantic color (green/red)
- Font-weight: 500–600
- Slightly smaller than Level 1

Level 2 supports Level 1.

---

### Level 3 — Contextual Financial Information

Examples:
- Asset name
- Quantity held
- Average cost
- Allocation %

Characteristics:

- Neutral color (#B0B6C3)
- Font-weight: 400–500
- Clear but secondary
- Never overpower numeric values

---

### Level 4 — Metadata

Examples:
- Timestamp
- Network name
- Fee info
- Exchange source

Characteristics:

- Small font
- Muted gray (#7D8596)
- Minimal spacing
- Never draw attention

---

## 4. Visual Weight Rules

Visual weight is defined by:

1. Font size  
2. Font weight  
3. Color contrast  
4. Position in layout  
5. Spacing isolation  

Only Level 1 gets maximum weight.

---

## 5. Layout Priority Model

Mobile stacking order:

1. Balance (Level 1)
2. Change Indicator (Level 2)
3. Chart (Visual Context)
4. Action Buttons (Functional Priority)
5. Asset List (Level 2 + Level 3)

No decorative blocks above Level 1.

---

## 6. Numeric Emphasis Standard

All financial numbers must:

- Be left- or right-aligned consistently
- Use tabular numerals if possible
- Avoid excessive letter-spacing
- Avoid italics
- Avoid gradients

Numbers must feel stable and reliable.

---

## 7. Color Hierarchy Mapping

| Level | Color |
|-------|-------|
| Level 1 | #FFFFFF |
| Level 2 Positive | #16C784 |
| Level 2 Negative | #EA3943 |
| Level 3 | #B0B6C3 |
| Level 4 | #7D8596 |

No mixing hierarchy colors randomly.

---

## 8. Spacing as Hierarchy Tool

Hierarchy is reinforced by spacing:

Level 1 block → 12–16px bottom spacing  
Level 2 block → 8–12px  
Level 3 rows → 8px  
Metadata → 4px  

Spacing must visually separate priority tiers.

---

## 9. Component Hierarchy Rules

Within Asset Row:

LEFT:
- Symbol (Level 3)
- Subtitle (Level 4)

RIGHT:
- Price (Level 2)
- Change % (Level 2)

Price must visually outweigh asset name.

---

## 10. Chart Hierarchy Role

Chart is contextual support.

It must:

- Never visually overpower Level 1
- Remain within 40% viewport height
- Use restrained color palette

Chart supports decision; it is not the focus.

---

## 11. Interaction Hierarchy

Action buttons:

- Medium emphasis
- Visible but not dominant
- Positioned after chart

No oversized CTA blocks on mobile.

---

## 12. Forbidden Hierarchy Violations

Do NOT:

- Use large decorative titles
- Give