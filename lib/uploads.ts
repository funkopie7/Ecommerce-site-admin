/* Server-side upload to the Supabase Storage bucket seeded product photos
   already live in (see prisma/seed.ts). A plain REST call rather than the
   @supabase/supabase-js SDK — one POST with the service-role key is all this
   needs, and it mirrors the same call made by hand when the catalogue's
   photos were first moved off Unsplash. */

const BUCKET = "product-images";

export async function uploadProductImage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Image storage isn't configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)");
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "true" },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) throw new Error(`Upload failed: ${(await response.text()).slice(0, 200)}`);
  return `${base}/storage/v1/object/public/${BUCKET}/${filename}`;
}
