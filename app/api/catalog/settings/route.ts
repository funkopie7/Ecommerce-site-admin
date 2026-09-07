import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/storeSettings";

export async function GET() {
  return NextResponse.json(await getStoreSettings());
}
