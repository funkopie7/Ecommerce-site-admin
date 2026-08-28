import { NextRequest, NextResponse } from "next/server";
import { adminFromRequest } from "./auth";

export const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export const requireAdmin = async (request: NextRequest) => {
  const key = request.headers.get("x-admin-key");
  if (process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY) return true;
  return adminFromRequest(request);
};
