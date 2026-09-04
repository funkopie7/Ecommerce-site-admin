// app/api/admin/uploads/chat/route.test.ts
import { expect, it, vi } from "vitest";
/* The pipeline chains resize().webp().toBuffer(), so the mock has to be
   chainable too — a stub missing resize() fails inside the route and surfaces
   as a 500 rather than as the missing method it is. */
vi.mock("sharp", () => {
  const chain = { resize: () => chain, webp: () => chain, toBuffer: async () => Buffer.from("fake-webp-bytes") };
  return { default: () => chain };
});
const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn(async (_b: Buffer, name: string, _t: string, bucket: string) => `https://example.supabase.co/storage/v1/object/public/${bucket}/${name}`) }));
vi.mock("@/lib/uploads", () => ({ uploadImage, PRODUCT_BUCKET: "product-images", CHAT_BUCKET: "chat-images" }));
import { NextRequest } from "next/server";
import { POST } from "./route";

function postWith(file: File | null, authed = true) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest("http://localhost/api/admin/uploads/chat", { method: "POST", headers: authed ? { "x-admin-key": "test-key" } : {}, body: form });
}
const png = () => new File([Buffer.from("not-really-a-png")], "shelf.png", { type: "image/png" });

it("sends an admin chat attachment to the chat bucket", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  uploadImage.mockClear();
  const response = await POST(postWith(png()));
  expect(response.status).toBe(201);
  expect((await response.json()).url).toContain("/chat-images/");
  expect(uploadImage).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(".webp"), "image/webp", "chat-images");
});

it("rejects a file type the pipeline doesn't accept", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  expect((await POST(postWith(new File([Buffer.from("x")], "notes.txt", { type: "text/plain" })))).status).toBe(400);
});

it("rejects a request with no file", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  expect((await POST(postWith(null))).status).toBe(400);
});

it("refuses an unauthenticated upload", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  expect((await POST(postWith(png(), false))).status).toBe(401);
});
