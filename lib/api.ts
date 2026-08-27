import { NextRequest, NextResponse } from "next/server";

export const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export const requireAdmin = (request: NextRequest) => {
  const key = request.headers.get("x-admin-key");
  return Boolean(process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY);
};
