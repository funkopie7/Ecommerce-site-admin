/* Server-side upload to the Supabase Storage buckets this app owns. A plain
   REST call rather than the @supabase/supabase-js SDK — one POST with the
   service-role key is all this needs, and it mirrors the same call made by
   hand when the catalogue's photos were first moved off Unsplash.

   Two buckets, deliberately separate: the catalogue's photos are public
   merchandising assets with a long life, while a chat attachment belongs to
   one support thread. Keeping them apart means a retention or access-policy
   change to one never has to reason about the other. */

export const PRODUCT_BUCKET = "product-images";
export const CHAT_BUCKET = "chat-images";

export async function uploadImage(buffer: Buffer, filename: string, contentType: string, bucket: string): Promise<string> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Image storage isn't configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)");
  const response = await fetch(`${base}/storage/v1/object/${bucket}/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "true" },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) throw new Error(`Upload failed: ${(await response.text()).slice(0, 200)}`);
  return `${base}/storage/v1/object/public/${bucket}/${filename}`;
}

export const uploadProductImage = (buffer: Buffer, filename: string, contentType: string) => uploadImage(buffer, filename, contentType, PRODUCT_BUCKET);
