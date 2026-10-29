# MOBILE_CHART_SPEC
## Portfolio Monitoring Frontend
Version: 1.0  
Scope: sm ≤ 640px  
Mode: Ultra Compact Fintech Chart  

---

## 1. Purpose

Define strict rules for mobile financial chart behavior optimized for:

- Compact layout
- Fast trend recognition
- Minimal cognitive load
- High contrast readability
- Exchange-grade UX (Binance / Bitget style)

Applies ONLY to mobile breakpoint (≤640px).

---

## 2. Design Principles

1. Chart supports balance, it does not dominate.
2. Simplicity over complexity.
3. Trend clarity over technical indicators.
4. Minimal UI chrome.
5. No decorative elements.

Mobile chart must be functional, not analytical-heavy.

---

## 3. Chart Type

Default mobile chart:

Area Line Chart

Not allowed in compact mode:

- Candlestick (unless explicitly switching to trading mode)
- Volume overlay
- Multiple indicators
- Multi-series comparisons

---

## 4. Chart Dimensions

Height:

160px – 200px maximum  

Recommended default:

180px  

Width:

100% container width  

No additional vertical padding around chart container.

---

## 5. Chart Layout Rules

Container spacing:

- mt-3
- mb-3
- px-3

Remove:

- Large top margins
- Decorative wrapper spacing
- Nested redundant div containers

Chart must sit tightly between Balance and Action Buttons.

---

## 6. Visual Style

Background:

Transparent or match card background  

Primary Line Color:

#2E90FA  

Positive Trend Fill:

rgba(22, 199, 132, 0.15)

Negative Trend Fill:

rgba(234, 57, 67, 0.15)

Line Width:

2px  

No heavy stroke effects.  
No glow.  
No gradients exceeding subtle opacity.

---

## 7. Axis Configuration

X Axis:

- Minimal tick marks
- Maximum 4–5 labels
- Font size: 10–11px
- Color: muted gray (#7D8596)

Y Axis:

- Optional
- No full grid lines
- Avoid large numeric labels

Remove:

- Thick grid lines
- Background shading

---

## 8. Tooltip Behavior

Tooltip must be:

- Compact
- Dark background
- Small typography (12px)
- Show only:
  - Date/time
  - Price

No large popup cards.

No shadow-heavy effects.

---

## 9. Timeframe Selector (Mobile)

Allowed compact format:

Inline tabs:

1D | 1W | 1M | 1Y  

or

Dropdown compact selector

Not allowed:

- Large segmented controls
- Oversized toggle buttons
- Multi-row timeframe UI

Selector must not push chart below fold.

---

## 10. Performance Rules

Chart must:

- Resize correctly on orientation change
- Avoid layout shift
- Avoid re-render loops
- Maintain smooth scrolling
- Avoid blocking main thread

Lazy-load if necessary.

---

## 11. Density Requirements

On first viewport load user must see:

✓ Balance  
✓ Chart  
✓ At least 2–3 asset rows  

If chart consumes more than 40% of screen height, reduce it.

---

## 12. Forbidden Patterns

Do NOT include:

- Multiple technical indicators
- Heavy legends
- Multi-line tooltips
- Volume bars
- Animated entrance transitions
- Over-saturated colors

Mobile chart is trend visualization, not trading terminal.

---

## 13. Touch Interaction

Touch must:

- Show single-point tooltip
- Not lock scrolling
- Dismiss cleanly
- Avoid gesture conflicts

No pinch-to-zoom unless explicitly in trading mode.

---

## 14. Chart Positioning Order

Final layout:

Header  
↓  
Balance  
↓  
Chart  
↓  
Action Buttons  
↓  
Asset List  

Chart must remain visually secondary to balance.

---

## 15. Accessibility

Minimum contrast ratio: 4.5:1  

Ensure:

- Line visible under daylight
- Tooltip readable
- No reliance on color-only meaning

---

## 16. Implementation Guidance

Mobile-first container example:

```tsx
<div className="h-[180px] w-full px-3">
```

Do not use:

h-[300px]  
h-[400px]  

Desktop may override upward.

---

## 17. UX Benchmark

Mobile chart must resemble:

- Binance asset overview
- Bitget asset chart
- Bybit compact chart
- TradingView mini chart

Not:

- Full trading dashboard
- Analytics-heavy SaaS charts

---

## 18. Final Constraint

Mobile chart exists to communicate trend quickly and efficiently.

It must remain compact, readable, and secondary to portfolio balance.

END