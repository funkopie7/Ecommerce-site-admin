import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const collections = await prisma.collection.findMany({ where: { visible: true }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(collections);
}
