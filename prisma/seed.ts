import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const living = await prisma.category.upsert({ where: { slug: "living" }, update: {}, create: { name: "Living", slug: "living", description: "Objects for slower rooms" } });
  const lighting = await prisma.category.upsert({ where: { slug: "lighting" }, update: {}, create: { name: "Lighting", slug: "lighting", description: "Warm light for everyday rituals" } });
  await Promise.all([
    prisma.product.upsert({ where: { sku: "ARC-001" }, update: {}, create: { sku: "ARC-001", slug: "arc-ceramic-speaker", name: "Arc Ceramic Speaker", description: "A compact speaker with a sculptural ceramic body.", price: 129900, cost: 67000, stockQuantity: 28, categoryId: living.id, imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=80" } }),
    prisma.product.upsert({ where: { sku: "HAL-204" }, update: {}, create: { sku: "HAL-204", slug: "halo-desk-lamp", name: "Halo Desk Lamp", description: "A soft, focused pool of light for every desk.", price: 69900, cost: 31000, stockQuantity: 18, categoryId: lighting.id, imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80" } }),
  ]);
  await prisma.customer.upsert({ where: { email: "demo@mercury.store" }, update: {}, create: { name: "Demo Customer", email: "demo@mercury.store", passwordHash: await bcrypt.hash("demo-password", 12), cart: { create: {} } } });
}
main().finally(() => prisma.$disconnect());
