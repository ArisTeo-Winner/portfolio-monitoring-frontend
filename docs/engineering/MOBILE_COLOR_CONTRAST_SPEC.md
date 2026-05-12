# MOBILE_COLOR_CONTRAST_SPEC
## Portfolio Monitoring Frontend
Version: 1.0  
Scope: sm ≤ 640px  
Mode: Fintech High-Contrast Mobile  

---

## 1. Purpose

Define strict color and contrast standards for mobile financial UI optimized for:

- Readability under daylight conditions
- Fast numeric recognition
- Accessibility compliance (WCAG 2.1 AA minimum)
- Semantic financial clarity
- Dark-theme dominant fintech interface

This specification applies ONLY to mobile (≤640px).  
Tablet and desktop may extend but must not reduce contrast.

---

## 2. Design Philosophy

1. Contrast over aesthetics.  
2. Financial numbers must be immediately readable.  
3. Semantic colors must never be ambiguous.  
4. Dark theme must avoid washed-out grays.  
5. No low-contrast decorative elements.  

Mobile financial dashboards require clarity per pixel.

---

## 3. Base Theme (Dark Mode Default)

Primary Background:

```
#0F1116
```

Secondary Background:

```
#151922
```

Card Background:

```
#1B2130
```

Divider / Subtle Border:

```
#262D3D
```

Never use pure black (#000000) for main surfaces.

---

## 4. Primary Text Colors

Primary Text:

```
#FFFFFF
```

Secondary Text:

```
#B0B6C3
```

Muted Text:

```
#7D8596
```

Minimum contrast ratio for primary text:
4.5:1 against background.

---

## 5. Financial Semantic Colors

Profit (Positive):

```
#16C784
```

Loss (Negative):

```
#EA3943
```

Neutral / Stable:

```
#8892A6
```

Rules:

- Never mix red/green shades inconsistently.
- Profit must never appear red.
- Loss must never appear green.
- Do not reduce opacity below 80% for semantic colors.

---

## 6. Balance Emphasis

Total Portfolio Value:

Color:

```
#FFFFFF
```

Font weight: 600  

No gradient effects.  
No glow.  
No text-shadow.

Contrast must remain above WCAG AA threshold.

---

## 7. Chart Color Standards

Primary Line Color:

```
#2E90FA
```

Positive Trend Area Fill:

rgba(22, 199, 132, 0.15)

Negative Trend Area Fill:

rgba(234, 57, 67, 0.15)

Grid Lines:

```
#262D3D
```

Axis Labels:

```
#7D8596
```

Avoid saturated neon colors.

---

## 8. Button Colors

Primary Action Button:

Background:

```
#2E90FA
```

Text:

```
#FFFFFF
```

Secondary Button:

Background:

```
#262D3D
```

Text:

```
#FFFFFF
```

Minimum contrast: 4.5:1.

---

## 9. Asset Row Color Rules

Asset Name:

```
#FFFFFF
```

Secondary Asset Label:

```
#7D8596
```

Price:

```
#FFFFFF
```

Change %:

Green or Red (strict semantic mapping)

No pastel versions on mobile.

---

## 10. Divider and Border Usage

Border color:

```
#262D3D
```

Border width:

1px only.

Avoid thick separators.

Use spacing over heavy lines.

---

## 11. Hover and Active States (Mobile Touch)

Active press state:

Slight brightness increase:

brightness(1.1)

No heavy drop shadows.

No excessive glow effects.

---

## 12. Accessibility Compliance

Minimum standards:

- Text contrast ≥ 4.5:1
- Large text contrast ≥ 3:1
- Interactive elements must have visible focus state
- No color-only meaning (combine color + icon if critical)

Mobile must pass WCAG 2.1 AA baseline.

---

## 13. Forbidden Color Patterns

Do NOT use:

- Low-contrast gray on dark background
- Light gray text on secondary background
- Neon gradients
- Decorative color transitions
- Color-only state indicators without numeric context

No aesthetic-only color choices.

---

## 14. Implementation Strategy

Use semantic Tailwind tokens or CSS variables:

Example:

```
--color-bg-primary: #0F1116;
--color-bg-card: #1B2130;
--color-text-primary: #FFFFFF;
--color-profit: #16C784;
--color-loss: #EA3943;
```

Mobile must default to dark fintech theme.

---

## 15. Validation Checklist

On sm ≤ 640px verify:

✓ Balance clearly visible under sunlight  
✓ Asset rows readable without zoom  
✓ Profit/loss instantly recognizable  
✓ No washed-out text  
✓ Chart line visible without strain  
✓ Buttons readable and distinct  

If readability feels soft or muted, contrast is insufficient.

---

## 16. Final Constraint

Color in fintech UI is semantic infrastructure, not decoration.

Never reduce contrast for aesthetic minimalism.

Clarity > Branding > Style.

END