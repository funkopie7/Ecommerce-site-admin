import { beforeEach, expect, it, vi } from "vitest";
vi.mock("sharp", () => {
  const chain = { resize: () => chain, webp: () => chain, toBuffer: async () => Buffer.from("fake-webp-bytes"), metadata: async () => ({ width: 1600, height: 1600 }) };
  return { default: () => chain };
});
const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn(async (_b: Buffer, name: string, _t: string, bucket: string) => `https://example.supabase.co/storage/v1/object/public/${bucket}/${name}`) }));
vi.mock("@/lib/uploads", () => ({ uploadImage, PRODUCT_BUCKET: "product-images", CHAT_BUCKET: "chat-images" }));
const { customerFromRequest } = vi.hoisted(() => ({ customerFromRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ customerFromRequest }));
import { NextRequest } from "next/server";
import { POST } from "./route";

function postWith(file: File | null) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest("http://localhost/api/customer/uploads", { method: "POST", body: form });
}
const png = () => new File([Buffer.from("not-really-a-png")], "unboxing.png", { type: "image/png" });

beforeEach(() => { customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" }); uploadImage.mockClear(); });

it("converts a shopper's photo and returns its chat-bucket URL", async () => {
  const response = await POST(postWith(png()));
  expect(response.status).toBe(201);
  expect((await response.json()).url).toContain("/chat-images/");
  expect(uploadImage).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(".webp"), "image/webp", "chat-images");
});

it("rejects a file type the pipeline doesn't accept", async () => {
  expect((await POST(postWith(new File([Buffer.from("x")], "invoice.pdf", { type: "application/pdf" })))).status).toBe(400);
});

it("rejects a request with no file", async () => {
  expect((await POST(postWith(null))).status).toBe(400);
});

it("refuses a signed-out visitor", async () => {
  customerFromRequest.mockResolvedValue(null);
  expect((await POST(postWith(png()))).status).toBe(401);
  expect(uploadImage).not.toHaveBeenCalled();
});
