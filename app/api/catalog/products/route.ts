import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const products = await prisma.product.findMany({ where: { visible: true, ...(category ? { category: { slug: category } } : {}) }, include: { category: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}
