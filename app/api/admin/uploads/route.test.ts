// app/api/admin/uploads/route.test.ts
import { expect, it, vi } from "vitest";
vi.mock("sharp", () => ({ default: () => ({ webp: () => ({ toBuffer: async () => Buffer.from("fake-webp-bytes") }) }) }));
vi.mock("@/lib/uploads", () => ({ uploadProductImage: vi.fn().mockResolvedValue("https://example.supabase.co/storage/v1/object/public/product-images/fake.webp") }));
import { NextRequest } from "next/server";
import { POST } from "./route";

function postWith(file: File | null) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest("http://localhost/api/admin/uploads", { method: "POST", headers: { "x-admin-key": "test-key" }, body: form });
}

it("converts an uploaded image and returns its Storage URL", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const file = new File([Buffer.from("not-really-a-png")], "photo.png", { type: "image/png" });
  const response = await POST(postWith(file));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.url).toContain(".webp");
});

it("rejects a file type the pipeline doesn't accept", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const file = new File([Buffer.from("not-an-image")], "notes.txt", { type: "text/plain" });
  expect((await POST(postWith(file))).status).toBe(400);
});

it("rejects a request with no file", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  expect((await POST(postWith(null))).status).toBe(400);
});

it("refuses an unauthenticated upload", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const form = new FormData();
  form.append("file", new File([Buffer.from("x")], "photo.png", { type: "image/png" }));
  const request = new NextRequest("http://localhost/api/admin/uploads", { method: "POST", body: form });
  expect((await POST(request)).status).toBe(401);
});
