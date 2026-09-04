import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_AUTH, googleConfigured, newState, newVerifier, redirectUri, safeReturnTo } from "@/lib/googleAuth";

/* Step one: send the customer to Google.

   The state and the PKCE verifier are stashed in short-lived httpOnly
   cookies rather than in a signed URL, so neither is readable or forgeable by
   the page that started the flow. Ten minutes is longer than any real
   consent screen takes and short enough that an abandoned attempt cannot be
   resumed later from a shared machine. */
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
  // Ask for an account chooser rather than silently reusing whichever Google
  // account the browser happens to be signed into — on a shared device that
  // is how someone ends up ordering from a stranger's account.
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url.toString());
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  /* SameSite=Lax, not None: these are read when Google redirects the browser
     back here, which is a top-level GET navigation and therefore sends Lax
     cookies. The session cookie set at the end of the flow still needs None,
     because the storefront reads it cross-origin. */
  response.cookies.set("google_state", state, options);
  response.cookies.set("google_verifier", verifier, options);
  response.cookies.set("google_return", returnTo, options);
  return response;
}
