# MOBILE_TYPOGRAPHY_SCALE
## Portfolio Monitoring Frontend
Version: 1.0  
Scope: sm ≤ 640px  
Mode: Fintech Ultra Compact Typography  

---

## 1. Purpose

Define a strict, mobile-first typography scale optimized for:

- Financial data density
- Rapid scanning
- Numeric clarity
- Minimal vertical expansion
- Professional fintech UI consistency

This scale applies ONLY to mobile (≤640px).  
Tablet and desktop may override upward.

---

## 2. Typography Design Principles

1. Numbers dominate.
2. Labels are secondary.
3. Avoid oversized headings.
4. Maintain tight but readable line-height.
5. Use a controlled vertical rhythm.
6. Avoid aesthetic exaggeration.

This is a financial dashboard, not a marketing site.

---

## 3. Font Family

Primary:
- Inter (recommended)
- System UI fallback

Font stack example:

```
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

---

## 4. Base Settings

Root font size: 16px  

Mobile text must remain readable at arm-length viewing distance.

---

## 5. Typography Scale (Mobile Only)

| Token | Size (px) | Size (rem) | Usage |
|-------|----------|------------|-------|
| display-mobile | 22px | 1.375rem | Total Portfolio Balance |
| headline-mobile | 18px | 1.125rem | Section titles |
| title-mobile | 16px | 1rem | Card headers |
| body-strong | 15px | 0.9375rem | Asset price |
| body | 14px | 0.875rem | Asset name |
| body-small | 12px | 0.75rem | Labels, subtitles |
| caption | 11px | 0.6875rem | Metadata, timestamps |

No text above 24px on mobile.

---

## 6. Numeric Emphasis Rules

Financial numbers must:

- Use font-medium or font-semibold
- Maintain tight line-height (1.2–1.3)
- Avoid letter spacing changes
- Avoid italic

Example:

```
text-[22px] font-semibold leading-[1.2]
```

---

## 7. Line Height Standards

| Context | Line Height |
|----------|------------|
| Large numbers | 1.2 |
| Asset price | 1.25 |
| Body text | 1.35 |
| Small labels | 1.4 |

Avoid default browser spacing.

---

## 8. Font Weight Hierarchy

| Use Case | Weight |
|----------|--------|
| Portfolio balance | 600 |
| Asset price | 600 |
| Section titles | 500 |
| Asset name | 500 |
| Labels | 400 |
| Metadata | 400 |

Avoid excessive bold stacking.

---

## 9. Text Truncation Rules

On mobile:

- Asset names truncate with ellipsis.
- Never wrap long symbols.
- Prevent multi-line asset rows.

Example:

```
truncate max-w-[120px]
```

---

## 10. Financial Color Semantics

Use strict semantic colors:

- Profit → text-green-500
- Loss → text-red-500
- Neutral → text-gray-400

Never mix semantic states.

---

## 11. Vertical Rhythm

Follow 4px grid.

Spacing after headings:

- display-mobile → margin-bottom 8px
- headline-mobile → margin-bottom 8px
- title-mobile → margin-bottom 6px

Avoid large spacing like mb-10 or mt-12.

---

## 12. Mobile Balance Block Example

Structure:

Label → small  
Balance → large  
Change → medium  

Example Tailwind:

```
<p class="text-[12px] text-gray-400">Total Balance</p>
<p class="text-[22px] font-semibold leading-[1.2]">$12,430.55</p>
<p class="text-[14px] font-medium text-green-500">+2.45%</p>
```

---

## 13. Asset Row Example

```
<div class="flex justify-between items-center h-12">
  <div>
    <p class="text-[14px] font-medium">BTC</p>
    <p class="text-[12px] text-gray-400">Bitcoin</p>
  </div>
  <div class="text-right">
    <p class="text-[15px] font-semibold">$63,240</p>
    <p class="text-[12px] text-red-500">-1.12%</p>
  </div>
</div>
```

---

## 14. Forbidden Typography Patterns (Mobile)

DO NOT use:

- text-4xl
- text-5xl
- leading-loose
- uppercase excessive
- decorative fonts
- bold on every element

---

## 15. Responsive Constraint

Mobile is the baseline.  
Tablet and desktop override upward.

Never downscale from desktop to mobile.  
Always scale upward from mobile.

---

## 16. Performance Considerations

- Avoid layout shift due to dynamic font resizing.
- Avoid reflow from inconsistent line-height.
- Keep typography stable across data updates.

---

## 17. Final Constraint

Typography must maximize clarity per pixel.  
Financial dashboards require precision, not decoration.

END