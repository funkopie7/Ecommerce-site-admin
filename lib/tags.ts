/**
 * A badge tone is not a free string: it names one of the five sticker
 * treatments the storefront actually draws (its components/home/FigureBadge.tsx).
 * Kept here so the API validation and the admin UI's picker read from one list.
 */
export const TONES = ["orange", "yellow", "blue", "peach", "ink"] as const;
export type Tone = (typeof TONES)[number];
