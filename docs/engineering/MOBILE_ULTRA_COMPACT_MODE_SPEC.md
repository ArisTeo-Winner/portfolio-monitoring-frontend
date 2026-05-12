# MOBILE_ULTRA_COMPACT_MODE_SPEC
## Portfolio Monitoring Frontend
Version: 1.0  
Scope: sm ≤ 640px only  
Mode: Ultra Compact Fintech (Binance / Bitget density model)

---

## 1. Purpose

Define strict implementation rules for an Ultra Compact Mobile Mode optimized for:

- High information density
- Fast scanning
- Financial data prioritization
- Reduced vertical scrolling
- Professional fintech UX

This specification applies ONLY to mobile breakpoint (≤640px).

---

## 2. Core Design Principles

1. Numbers over decoration  
2. Density over whitespace  
3. Scanability over aesthetics  
4. Vertical compression without sacrificing clarity  
5. Functional minimalism  

Mobile is transactional, not promotional.

---

## 3. Breakpoint Scope

Apply only when:

sm ≤ 640px

Do NOT affect:
- md
- lg
- xl
- 2xl

Mobile styles must be default (mobile-first).

---

## 4. Layout Structure (Mobile)

Viewport priority order:

1. Header (compact)
2. Portfolio Balance
3. 24h Change Indicator
4. Compact Chart
5. Action Buttons (Buy / Sell)
6. Asset List (dense)

User must see Balance + Chart + at least 2 assets without excessive scrolling.

---

## 5. Header Specification

Max height: 56px  
Padding: px-3 py-2  

Remove:
- Large titles
- Subtitles
- Marketing descriptions
- Extra top margin

Header is functional only.

---

## 6. Portfolio Balance Block

Structure:

Label (small)  
Primary Balance (large)  
Change % + absolute value (medium)

Typography:

Balance: 22px (1.375rem)  
Change: 14px  
Label: 12px  

Vertical spacing between elements: 6–8px  
Block margin-bottom: 12px  

---

## 7. Chart Specification

Type: Compact Area Chart  
Height: 160–200px  

Remove:
- Large legends
- Multiple axes labels
- Verbose timeframe buttons

Allow:
- Minimal timeframe selector (1D / 1W / 1M)
- No extra padding around chart

Chart must not dominate the screen.

---

## 8. Asset List Specification

Row height target: 48–56px  

Row structure:

LEFT:
- 24px icon
- Symbol
- Optional small subtitle (12px)

RIGHT:
- Current price
- % change

Optional (collapsed):
- Holdings value

Remove:
- Long descriptions
- Redundant metadata
- Oversized badges

Minimum density target:
At least 3–4 assets visible per viewport.

---

## 9. Spacing Rules (4px Grid)

Base unit: 4px  

Allowed spacing values:
- 4px
- 8px
- 12px
- 16px

Avoid:
- p-6
- p-8
- space-y-10
- my-12

Max vertical gap between sections: 16px  

---

## 10. Button Density

Button height: h-9  
Horizontal padding: px-3  
Gap between buttons: gap-2  

Buttons must not exceed 40px height.

---

## 11. Typography Rules

Hierarchy:

Balance → 22px  
Primary value → 15px  
Asset name → 14px  
Secondary text → 12px  
Meta → 11px  

Line-height:
Numbers → 1.2–1.3  
Text → 1.3–1.4  

No text above 24px on mobile.

---

## 12. Data Density Requirements

On first viewport load user must see:

✓ Total balance  
✓ 24h change  
✓ Chart  
✓ At least 2–3 assets  

If not, layout is too spaced.

---

## 13. Forbidden Patterns

On mobile DO NOT use:

- text-4xl
- py-8
- my-10
- space-y-12
- large hero blocks
- decorative marketing text

This is a financial dashboard.

---

## 14. Implementation Strategy

Mobile-first Tailwind example:

```tsx
<div className="px-3 py-2 md:px-6 md:py-4">
```

Mobile styles apply first.  
Tablet and desktop override upward.

Never create mobile-only hacks using negative margins.

---

## 15. UX Benchmark

Mobile density must resemble:

- Binance mobile
- Bitget mobile
- Bybit mobile
- TradingView compact dashboard

Not SaaS landing pages.

---

## 16. Performance Constraint

Ultra Compact Mode must:

- Avoid layout shift
- Avoid oversized skeleton loaders
- Avoid cumulative whitespace
- Maintain fast scroll performance

---

## 17. Final Constraint

Mobile Ultra Compact Mode is a product-level rule.  
Do not reintroduce excessive whitespace for aesthetic preference.

Fintech dashboards prioritize clarity, speed, and density.

END