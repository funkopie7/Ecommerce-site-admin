import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: the storefront resolves each code in a product's `badges` array to a
// label and tone through this list. No auth — it is display vocabulary.
export async function GET() {
  return NextResponse.json(await prisma.tag.findMany({ orderBy: { code: "asc" } }));
}
