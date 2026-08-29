// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearCustomerCookie } from "@/lib/auth";
export async function POST() { return clearCustomerCookie(NextResponse.json({ ok: true })); }
