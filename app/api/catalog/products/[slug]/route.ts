import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductSelect } from "@/lib/catalogSelect";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, visible: true }, select: publicProductSelect });
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}
