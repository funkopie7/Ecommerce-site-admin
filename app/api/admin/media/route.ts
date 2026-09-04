// app/api/admin/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { PRODUCT_BUCKET, deleteImages, listImages } from "@/lib/uploads";
import { revalidateStorefront } from "@/lib/revalidateStorefront";

/* The bucket, with every image's usage worked out.

   Deleting a photo that a product still points at doesn't fail — Storage
   happily removes it — it just leaves a broken image on the live storefront,
   and nothing in the admin would say so until a customer saw it. So the list
   carries what each file is used by, and the delete refuses anything still
   referenced. That is a far better guarantee than a confirmation dialog:
   the destructive thing simply cannot be done by accident. */

/** Every URL the catalogue currently points at, mapped to what points at it. */
async function usage(): Promise<Map<string, string[]>> {
  const [products, categories, collections] = await Promise.all([
    prisma.product.findMany({ select: { name: true, imageUrl: true, hoverImageUrl: true, images: true } }),
    prisma.category.findMany({ select: { name: true, imageUrl: true } }),
    prisma.collection.findMany({ select: { name: true, imageUrl: true } }),
  ]);

  const used = new Map<string, string[]>();
  const claim = (url: string | null | undefined, by: string) => {
    if (!url) return;
    // Keyed on the filename, not the whole URL: the bucket moved host once
    // already during the Mumbai migration, and rows written before that still
    // carry the old origin. The filename is what actually identifies a file.
    const name = url.split("/").pop();
    if (!name) return;
    const owners = used.get(name);
    if (owners) { if (!owners.includes(by)) owners.push(by); }
    else used.set(name, [by]);
  };

  for (const product of products) {
    claim(product.imageUrl, product.name);
    claim(product.hoverImageUrl, product.name);
    for (const image of product.images) claim(image, product.name);
  }
  for (const category of categories) claim(category.imageUrl, `${category.name} (category)`);
  for (const collection of collections) claim(collection.imageUrl, `${collection.name} (bundle)`);
  return used;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  try {
    const [images, used] = await Promise.all([listImages(PRODUCT_BUCKET, 1000), usage()]);
    return NextResponse.json(
      images.map((image) => ({ ...image, usedBy: used.get(image.name) ?? [] })),
    );
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not list images", 500);
  }
}

const input = z.object({ names: z.array(z.string().min(1)).min(1).max(200) });

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose at least one image to delete", 400);

  try {
    /* Re-checked here rather than trusted from the client. The screen already
       disables in-use images, but a stale page is exactly how a photo gets
       deleted a second after someone else assigns it to a product. */
    const used = await usage();
    const blocked = parsed.data.names.filter((name) => (used.get(name) ?? []).length > 0);
    if (blocked.length > 0) {
      const first = used.get(blocked[0])!;
      return error(
        blocked.length === 1
          ? `That image is still used by ${first[0]}${first.length > 1 ? ` and ${first.length - 1} other${first.length > 2 ? "s" : ""}` : ""}. Remove it there first.`
          : `${blocked.length} of those images are still in use. Remove them from their products first.`,
        409,
      );
    }

    await deleteImages(PRODUCT_BUCKET, parsed.data.names);
    // Nothing in the catalogue referenced these, so the storefront's pages
    // don't change — but relisting is cheap and keeps the picker honest.
    revalidateStorefront();
    return NextResponse.json({ deleted: parsed.data.names.length });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not delete those images", 500);
  }
}
