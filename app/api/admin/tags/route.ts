import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { TONES } from "@/lib/tags";
const input = z.object({ code: z.string().min(2).regex(/^[A-Z0-9_]+$/, "Code must be upper-case letters, digits and underscores"), label: z.string().min(2), tone: z.enum(TONES).default("orange") });
export async function GET(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); return NextResponse.json(await prisma.tag.findMany({ orderBy: { code: "asc" } })); }
export async function POST(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); const parsed = input.safeParse(await request.json()); if (!parsed.success) return error(parsed.error.issues[0].message, 400); try { return NextResponse.json(await prisma.tag.create({ data: parsed.data }), { status: 201 }); } catch { return error("Tag code must be unique", 409); } }
