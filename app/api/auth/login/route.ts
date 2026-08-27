import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCustomerSession, customerCookie } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(request: NextRequest) { const parsed = input.safeParse(await request.json()); if (!parsed.success) return error("Email and password are required", 400); const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email.toLowerCase() } }); if (!customer || !(await bcrypt.compare(parsed.data.password, customer.passwordHash))) return error("Invalid email or password", 401); return customerCookie(NextResponse.json({ id: customer.id, name: customer.name, email: customer.email }), await createCustomerSession({ customerId: customer.id, email: customer.email })); }
