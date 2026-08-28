// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.delete("customer_session"); return response; }
