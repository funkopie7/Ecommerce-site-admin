import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/storeSettings";

/* Public: the storefront needs the accent colour and hero model on every
   render, and neither is a secret — both are visible in the page source the
   moment they take effect. Behind the same CORS matcher as the rest of
   /api/catalog. */
export async function GET() {
  return NextResponse.json(await getStoreSettings());
}
