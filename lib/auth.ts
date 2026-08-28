import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-secret-change-me");
export type CustomerSession = { customerId: string; email: string };
export async function createCustomerSession(session: CustomerSession) { return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret()); }
export async function customerFromRequest(request: NextRequest): Promise<CustomerSession | null> { const token = request.cookies.get("customer_session")?.value; if (!token) return null; try { return (await jwtVerify(token, secret())).payload as unknown as CustomerSession; } catch { return null; } }
export function customerCookie(response: NextResponse, token: string) { response.cookies.set("customer_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 }); return response; }
export async function createAdminSession() { return new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret()); }
export async function adminSessionValid(token: string) { try { const payload = (await jwtVerify(token, secret())).payload; return payload.role === "admin"; } catch { return false; } }
export function adminCookie(response: NextResponse, token: string) { response.cookies.set("admin_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 }); return response; }
export async function adminFromRequest(request: NextRequest) { const token = request.cookies.get("admin_session")?.value; return token ? adminSessionValid(token) : false; }
