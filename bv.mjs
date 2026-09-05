/* Pre-generates the handful of widths the shop actually displays, and stores
   them next to the original.

   This replaces Vercel's image optimizer with something that costs nothing to
   run. The optimizer earns its keep when sources change often or arrive in
   unpredictable sizes; here they are uploaded once, never edited, and already
   normalised to WebP. Resizing the same file on demand forever — and being
   billed per resize — buys nothing that doing it once at upload does not.

   Variants live under a width prefix, so `NAME.webp` gains `w320/NAME.webp`,
   `w640/NAME.webp` and `w1280/NAME.webp`. A prefix rather than a suffix keeps
   the filename intact, which matters because the media screen and the usage
   check both key on it.

   Resumable and safe to re-run: anything already generated is skipped, so an
   interrupted pass costs only what it had not yet done. */
import sharp from "sharp";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(process.env.ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=")).map((line) => {
    const i = line.indexOf("=");
    return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const BASE = env.MUMBAI_SUPABASE_URL;
const KEY = env.MUMBAI_SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";
const WIDTHS = [320, 640, 1280];
const DRY = process.env.APPLY !== "1";

async function listAll(prefix = "") {
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${BASE}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!response.ok) throw new Error(`list ${prefix} failed ${response.status}`);
    const page = await response.json();
    all.push(...page);
    if (page.length < 100) return all;
  }
}

const put = async (path, body, type) => {
  const form = new FormData();
  form.append("cacheControl", "31536000");
  form.append("", new Blob([new Uint8Array(body)], { type }), path.split("/").pop());
  const response = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "x-upsert": "true" },
    body: form,
  });
  if (!response.ok) throw new Error(`upload ${response.status}: ${(await response.text()).slice(0, 120)}`);
};

const root = (await listAll()).filter((o) => o.metadata?.size && /\.(webp|jpg|jpeg|png)$/i.test(o.name));
const existing = new Map();
for (const width of WIDTHS) {
  existing.set(width, new Set((await listAll(`w${width}`)).map((o) => o.name)));
}

const todo = root.filter((o) => WIDTHS.some((w) => !existing.get(w).has(o.name)));
console.log(`${root.length} source images`);
console.log(`${todo.length} still need variants at ${WIDTHS.join(", ")}px`);
if (DRY) { console.log("\nDRY RUN — nothing written. Re-run with APPLY=1."); process.exit(0); }

let done = 0, made = 0, failed = 0, saved = 0;
for (const object of todo) {
  try {
    const missing = WIDTHS.filter((w) => !existing.get(w).has(object.name));
    const source = await fetch(`${BASE}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(object.name)}`);
    if (!source.ok) throw new Error(`download ${source.status}`);
    const body = Buffer.from(await source.arrayBuffer());
    const meta = await sharp(body).metadata();

    for (const width of missing) {
      /* Never upscale. A source narrower than the target is stored as-is at
         that slot, so the loader always finds something and the browser is
         never handed a blurred enlargement. */
      const out = (meta.width ?? 0) <= width
        ? await sharp(body).webp({ quality: 80 }).toBuffer()
        : await sharp(body).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await put(`w${width}/${object.name}`, out, "image/webp");
      made += 1;
      saved += body.length - out.length;
    }
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${todo.length} images, ${made} variants…`);
  } catch (cause) {
    failed += 1;
    if (failed < 6) console.log(`  FAILED ${object.name} — ${cause.message}`);
  }
}
console.log(`\n${done} images processed, ${made} variants written, ${failed} failed.`);
