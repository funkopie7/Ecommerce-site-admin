// app/api/admin/uploads/route.test.ts
import { expect, it, vi } from "vitest";
/* sharp and the Storage PUT are the two things that must not really run; the
   validation in lib/imageUploads is deliberately left real so these tests
   still cover it. */
vi.mock("sharp", () => ({ default: () => ({ webp: () => ({ toBuffer: async () => Buffer.from("fake-webp-bytes") }) }) }));
const { uploadImage, listImages } = vi.hoisted(() => ({
  uploadImage: vi.fn(async (_b: Buffer, name: string, _t: string, bucket: string) => `https://example.supabase.co/storage/v1/object/public/${bucket}/${name}`),
  listImages: vi.fn(async () => [{ name: "a.webp", url: "https://example.supabase.co/storage/v1/object/public/product-images/a.webp" }]),
}));
vi.mock("@/lib/uploads", () => ({ uploadImage, listImages, PRODUCT_BUCKET: "product-images", CHAT_BUCKET: "chat-images" }));
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

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

it("puts a product photo in the catalogue bucket, not the chat one", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  uploadImage.mockClear();
  await POST(postWith(new File([Buffer.from("x")], "photo.png", { type: "image/png" })));
  expect(uploadImage).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(".webp"), "image/webp", "product-images");
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

it("lists previously uploaded images for the picker", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/uploads", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual([{ name: "a.webp", url: "https://example.supabase.co/storage/v1/object/public/product-images/a.webp" }]);
});

it("refuses an unauthenticated list", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/uploads");
  expect((await GET(request)).status).toBe(401);
});
