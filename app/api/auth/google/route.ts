import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_AUTH, googleConfigured, newState, newVerifier, redirectUri, safeReturnTo } from "@/lib/googleAuth";

export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google sign-in isn't configured" }, { status: 503 });
  }

  const state = newState();
  const { verifier, challenge } = newVerifier();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url.toString());
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  response.cookies.set("google_state", state, options);
  response.cookies.set("google_verifier", verifier, options);
  response.cookies.set("google_return", returnTo, options);
  return response;
}
