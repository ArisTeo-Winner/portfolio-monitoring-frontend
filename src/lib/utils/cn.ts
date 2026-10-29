import { twMerge } from "tailwind-merge";

// Plain string-joining (values.join(" ")) doesn't resolve conflicting
// Tailwind utilities — e.g. a caller's "bg-[#19c37d]" and a component
// default's "bg-blue-600" would both end up in the class list, and whichever
// happens to come later in the generated stylesheet wins, not whichever is
// later in this argument list. twMerge keeps only the last utility per
// property, so a caller's className reliably overrides component defaults.
export function cn(...values: Array<string | false | null | undefined>) {
  return twMerge(values.filter(Boolean).join(" "));
}
