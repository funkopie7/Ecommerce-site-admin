import { prisma } from "@/lib/prisma";

export const SETTINGS_ID = "store";

export const DEFAULT_ACCENT = "#E8622A";

export type PublicSettings = {
  accentColor: string;
  secondaryColor: string | null;
  secondaryTextColor: string | null;
  heroModelUrl: string | null;
  heroModelName: string | null;
  heroBoxLine: string;
  heroBoxNumber: string;
  heroBoxBanner: string;
  heroBoxName: string;
  heroBoxSubtitle: string;
  heroBoxCheckLight: string;
  heroBoxCheckDark: string;
  heroBoxNumberColor: string;
};

export async function getStoreSettings(): Promise<PublicSettings> {
  const row = await prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
    select: { accentColor: true, secondaryColor: true, secondaryTextColor: true, heroModelUrl: true, heroModelName: true, heroBoxLine: true, heroBoxNumber: true, heroBoxBanner: true, heroBoxName: true, heroBoxSubtitle: true, heroBoxCheckLight: true, heroBoxCheckDark: true, heroBoxNumberColor: true },
  });
  return row;
}

export const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const isHexColor = (value: string) => HEX.test(value);
