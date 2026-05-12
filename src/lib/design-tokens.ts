// Bridge file: JS constants mirroring the fintech palette in tailwind.config.ts.
//
// Rule: use Tailwind classes (text-fintech-positive, bg-fintech-card, etc.) in JSX.
// Use these constants ONLY where Tailwind classes are unavailable:
//   - chart library configs (lightweight-charts, recharts inline props)
//   - SVG fill/stroke attributes
//   - inline style values
export const tokens = {
  positive: "#16C784",
  negative: "#EA3943",
  loss: "#ff5b6e",
  muted: "#7f8aa3",
  dim: "#71819b",
  card: "#111317",
  input: "#0f1217",
  deep: "#0d1016",
  grid: "#1a1f29",
  active: "#151d2a",
} as const;
