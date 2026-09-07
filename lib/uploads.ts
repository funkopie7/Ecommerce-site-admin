export const PRODUCT_BUCKET = "product-images";
export const CHAT_BUCKET = "chat-images";

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

export async function deleteImages(bucket: string, names: string[]): Promise<void> {
  const { base, key } = credentialsFor(bucket);
  const response = await fetch(`${base}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: names }),
  });
  if (!response.ok) throw new Error(`Could not delete: ${(await response.text()).slice(0, 200)}`);
}
