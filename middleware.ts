// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = () => process.env.NEXT_PUBLIC_STORE_URL || "";

function withCors(response: NextResponse, origin: string) {
  const allowed = allowedOrigin();
  if (allowed && origin === allowed) {
    response.headers.set("Access-Control-Allow-Origin", allowed);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return withCors(response, origin);
  }
  return withCors(NextResponse.next(), origin);
}

export const config = { matcher: ["/api/catalog/:path*", "/api/auth/:path*", "/api/customer/:path*"] };
