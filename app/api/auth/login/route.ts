import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCustomerSession, customerCookie } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(request: NextRequest) { const parsed = input.safeParse(await request.json()); if (!parsed.success) return error("Email and password are required", 400); const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  /* A null hash means the account was created through Google and has no
     password — never "any password works". Said plainly rather than as
     "invalid email or password", because that would leave someone typing
     guesses at an account that has no password to guess. The email is already
     known to exist at this point, so naming the sign-in method leaks nothing
     a password reset flow would not. */
  if (customer && !customer.passwordHash) return error("This account signs in with Google — use Continue with Google", 409);
  if (!customer?.passwordHash || !(await bcrypt.compare(parsed.data.password, customer.passwordHash))) return error("Invalid email or password", 401); return customerCookie(NextResponse.json({ id: customer.id, name: customer.name, email: customer.email }), await createCustomerSession({ customerId: customer.id, email: customer.email })); }
