import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicCollectionSelect } from "@/lib/catalogSelect";

export async function GET() {
  const collections = await prisma.collection.findMany({ where: { visible: true }, select: publicCollectionSelect, orderBy: { createdAt: "desc" } });
  return NextResponse.json(collections);
}
