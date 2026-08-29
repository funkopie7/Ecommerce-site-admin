import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class joiner with Tailwind conflict resolution — the helper every
 * components/ui/* primitive imports. clsx flattens the conditional forms,
 * tailwind-merge then drops earlier utilities a later one would fight with, so
 * `cn("p-2", "p-6")` resolves to "p-6" rather than shipping both.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
