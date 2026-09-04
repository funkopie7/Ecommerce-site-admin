import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductSelect } from "@/lib/catalogSelect";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const products = await prisma.product.findMany({ where: { visible: true, ...(category ? { category: { slug: category } } : {}) }, select: publicProductSelect, orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}
