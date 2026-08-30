import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const input = z.object({ amount: z.number().int().positive(), method: z.string().optional(), note: z.string().optional() });

const paymentStatusFor = (amountPaid: number, total: number) => (amountPaid <= 0 ? "PENDING" : amountPaid >= total ? "PAID" : "PARTIALLY_PAID");

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id: orderId } = await params;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) return error("Order not found", 404);
  const remaining = current.total - current.amountPaid;
  if (parsed.data.amount > remaining) return error(`That's more than the ₹${(remaining / 100).toFixed(2)} still owed`, 400);

  const order = await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { orderId, amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note } });
    const amountPaid = current.amountPaid + parsed.data.amount;
    return tx.order.update({
      where: { id: orderId },
      data: { amountPaid, paymentStatus: paymentStatusFor(amountPaid, current.total) },
      include: { customer: { select: { name: true, email: true } }, items: true, payments: { orderBy: { recordedAt: "desc" } } },
    });
  });
  return NextResponse.json(order);
}
