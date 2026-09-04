import { prisma } from "@/lib/prisma";

/* The one settings row. Upserted rather than fetched, so a database that has
   never had one — a fresh clone, a restored backup — still answers instead of
   handing every caller a null to special-case. */
export const SETTINGS_ID = "store";

export const DEFAULT_ACCENT = "#E8622A";

export type PublicSettings = {
  accentColor: string;
  secondaryColor: string | null;
  heroModelUrl: string | null;
  heroModelName: string | null;
};

export async function getStoreSettings(): Promise<PublicSettings> {
  const row = await prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
    select: { accentColor: true, secondaryColor: true, heroModelUrl: true, heroModelName: true },
  });
  return row;
}

/* Hex only, and validated on both sides of the wire.

   The colour is interpolated into a <style> block on the storefront, so it is
   the one setting here that reaches a page as code rather than as text. A
   strict pattern is what stops `red; } body { display:none } .x {` — or
   anything with a closing brace in it — from being a stylesheet edit rather
   than a colour. Three or six hex digits and nothing else. */
export const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const isHexColor = (value: string) => HEX.test(value);
