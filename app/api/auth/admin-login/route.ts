import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, createAdminSession } from "@/lib/auth";
import { error } from "@/lib/api";
const input = z.object({ key: z.string().min(1) });
export async function POST(request: NextRequest) { const parsed = input.safeParse(await request.json()); if (!parsed.success) return error("Enter the admin key", 400); if (!process.env.ADMIN_API_KEY || parsed.data.key !== process.env.ADMIN_API_KEY) return error("Incorrect admin key", 401); return adminCookie(NextResponse.json({ ok: true }), await createAdminSession()); }
