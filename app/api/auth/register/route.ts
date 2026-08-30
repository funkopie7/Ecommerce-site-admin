import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createCustomerSession, customerCookie } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) });
export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try {
    const customer = await prisma.customer.create({ data: { name: parsed.data.name, email: parsed.data.email.toLowerCase(), passwordHash: await bcrypt.hash(parsed.data.password, 12), cart: { create: {} } } });
    return customerCookie(NextResponse.json({ id: customer.id, name: customer.name, email: customer.email }, { status: 201 }), await createCustomerSession({ customerId: customer.id, email: customer.email }));
  } catch (cause) {
    // Only a real unique-constraint hit on email means "already exists" — any
    // other failure (a cold-starting DB connection, a transient timeout) was
    // being mislabeled as that, which hid the actual problem from both the
    // customer and whoever had to debug it.
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return error("An account with that email already exists", 409);
    }
    console.error("Registration failed", cause);
    return error("Could not create your account — please try again in a moment", 500);
  }
}
