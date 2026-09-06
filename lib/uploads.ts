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

/* Which Supabase project a bucket's objects actually live in.

   product-images was migrated wholesale to the Mumbai project — every
   existing object copied over, every Product.imageUrl rewritten to the new
   host. chat-images was deliberately left where it was: short-lived,
   per-conversation attachments with no reason to move.

   This function is the fix for a gap that migration left behind: the ONE-TIME
   copy moved the data, but this file kept reading the original project's
   credentials for every NEW write, regardless of which bucket. Every product
   photo uploaded since — including the size variants generated on upload and
   an uploaded hero model — was silently written to the retired project
   instead of the one 500+ other photos already live on. It looked fine only
   because the old project had not been paused yet; the moment it is, or its
   free-tier storage fills, those specific files stop resolving with no
   warning anywhere in this app. Get the bucket-to-project mapping here wrong
   again and the same thing happens the same silent way. */
function credentialsFor(bucket: string): { base: string; key: string } {
  if (bucket === PRODUCT_BUCKET) {
    const base = process.env.MUMBAI_SUPABASE_URL;
    const key = process.env.MUMBAI_SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) throw new Error("Image storage isn't configured (MUMBAI_SUPABASE_URL/MUMBAI_SUPABASE_SERVICE_ROLE_KEY missing)");
    return { base, key };
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Image storage isn't configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)");
  return { base, key };
}

export async function uploadImage(buffer: Buffer, filename: string, contentType: string, bucket: string): Promise<string> {
  const { base, key } = credentialsFor(bucket);

  /* Multipart with a `cacheControl` field, not a raw body with a
     `cache-control` header. Only this form is honoured — sending the header
     on a binary POST returns 200 and is then silently discarded, and the
     object continues to be served as `no-cache`. That is worth stating
     because the failure is invisible: the upload succeeds either way.

     Why it matters: `no-cache` upstream makes Next refuse to cache the
     optimized copy at all, so every request re-fetched the original from
     storage and re-encoded it. That is what exhausted 5,000 image
     transformations and drove gigabytes of egress in a few weeks.

     A year is safe because these names are immutable — every upload gets a
     fresh UUID, so a URL here can never come to mean a different file. */
  const form = new FormData();
  form.append("cacheControl", "31536000");
  form.append("", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);

  const response = await fetch(`${base}/storage/v1/object/${bucket}/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "x-upsert": "true" },
    body: form,
  });
  if (!response.ok) throw new Error(`Upload failed: ${(await response.text()).slice(0, 200)}`);
  return `${base}/storage/v1/object/public/${bucket}/${filename}`;
}

export const uploadProductImage = (buffer: Buffer, filename: string, contentType: string) => uploadImage(buffer, filename, contentType, PRODUCT_BUCKET);

export async function createSignedUploadUrl(filename: string, bucket: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { base, key } = credentialsFor(bucket);
  const response = await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(`Could not prepare upload: ${(await response.text()).slice(0, 200)}`);
  const body: { url: string } = await response.json();
  return {
    uploadUrl: `${base}/storage/v1${body.url}`,
    publicUrl: `${base}/storage/v1/object/public/${bucket}/${filename}`,
  };
}

/* Backs the "choose an image already uploaded" picker — every product,
   category and collection image field reads from the same product-images
   bucket, so anything uploaded from any one of them shows up for the
   others too. Newest first: that's almost always the one just uploaded. */
export type StoredImage = { name: string; url: string; size: number; createdAt: string | null };

export async function listImages(bucket: string, limit = 200): Promise<StoredImage[]> {
  const { base, key } = credentialsFor(bucket);
  const response = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit, sortBy: { column: "created_at", order: "desc" } }),
  });
  if (!response.ok) throw new Error(`Could not list images: ${(await response.text()).slice(0, 200)}`);
  const items: { name: string; created_at?: string; metadata?: { size?: number } }[] = await response.json();
  return items.map((item) => ({
    name: item.name,
    url: `${base}/storage/v1/object/public/${bucket}/${item.name}`,
    size: item.metadata?.size ?? 0,
    createdAt: item.created_at ?? null,
  }));
}

/* Removes objects from a bucket. Supabase takes a batch in one call, which
   matters here: the media screen deletes a selection, and one request per
   file would be both slow and only half-atomic if the network dropped
   partway. Returns nothing useful — Storage reports success per object and
   the caller relists anyway. */
export async function deleteImages(bucket: string, names: string[]): Promise<void> {
  const { base, key } = credentialsFor(bucket);
  const response = await fetch(`${base}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: names }),
  });
  if (!response.ok) throw new Error(`Could not delete: ${(await response.text()).slice(0, 200)}`);
}
