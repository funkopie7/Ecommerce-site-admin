import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import { createCustomerSession, customerCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GOOGLE_ISSUERS, GOOGLE_JWKS, GOOGLE_TOKEN, googleConfigured, redirectUri, safeReturnTo } from "@/lib/googleAuth";

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS));

const fail = (reason: string) =>
  NextResponse.redirect(`${process.env.NEXT_PUBLIC_STORE_URL || "https://www.funkopie.in"}/account?error=${encodeURIComponent(reason)}`);

export async function GET(request: NextRequest) {
  if (!googleConfigured()) return fail("Google sign-in isn't configured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("Google sign-in was cancelled");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("google_state")?.value;
  const verifier = request.cookies.get("google_verifier")?.value;
  const returnTo = safeReturnTo(null);
  const stored = request.cookies.get("google_return")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return fail("That sign-in link expired — please try again");
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) {
      console.error("[google] token exchange failed", tokenResponse.status, (await tokenResponse.text()).slice(0, 200));
      return fail("Could not complete Google sign-in");
    }
    const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
    if (!idToken) return fail("Could not complete Google sign-in");

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleId = String(payload.sub ?? "");
    const email = String(payload.email ?? "").toLowerCase();
    const name = String(payload.name || email.split("@")[0] || "Collector");
    if (!googleId || !email || payload.email_verified !== true) {
      return fail("Your Google account has no verified email address");
    }

    let customer = await prisma.customer.findUnique({ where: { googleId } });
    if (!customer) {
      const byEmail = await prisma.customer.findUnique({ where: { email } });
      if (byEmail) {
        customer = await prisma.customer.update({ where: { id: byEmail.id }, data: { googleId } });
      } else {
        try {
          customer = await prisma.customer.create({ data: { name, email, googleId, cart: { create: {} } } });
        } catch (cause) {
          if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
            customer = await prisma.customer.findUnique({ where: { email } });
          } else throw cause;
        }
      }
    }
    if (!customer) return fail("Could not complete Google sign-in");

    const response = NextResponse.redirect(stored?.startsWith("http") ? stored : returnTo);
    customerCookie(response, await createCustomerSession({ customerId: customer.id, email: customer.email }));
    for (const name of ["google_state", "google_verifier", "google_return"]) {
      response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
    }
    return response;
  } catch (cause) {
    console.error("[google] sign-in failed", cause instanceof Error ? cause.message : cause);
    return fail("Could not complete Google sign-in");
  }
}
