import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicCollectionSelect } from "@/lib/catalogSelect";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await prisma.collection.findFirst({ where: { slug, visible: true }, select: publicCollectionSelect });
  return collection ? NextResponse.json(collection) : NextResponse.json({ error: "Collection not found" }, { status: 404 });
}
