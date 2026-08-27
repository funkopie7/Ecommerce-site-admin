export type ProductPreview = { name: string; sku: string; category: string; price: number; stock: number; image: string; status: "Live" | "Draft" };

export const demoProducts: ProductPreview[] = [
  { name: "Arc Ceramic Speaker", sku: "ARC-001", category: "Living", price: 129900, stock: 28, image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80", status: "Live" },
  { name: "Halo Desk Lamp", sku: "HAL-204", category: "Lighting", price: 69900, stock: 8, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80", status: "Live" },
  { name: "Sable Throw", sku: "SBL-042", category: "Textiles", price: 45900, stock: 3, image: "https://images.unsplash.com/photo-1583845112203-454c9f9b1a00?auto=format&fit=crop&w=800&q=80", status: "Draft" }
];
