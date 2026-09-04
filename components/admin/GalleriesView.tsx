"use client";

import * as React from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ErrorState, PageHeader } from "@/components/admin/PageHeader";
import type { Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

/* Every product's photos, product by product.

   The Images screen answers "what is in the bucket, and is anything unused" —
   a storage question. This answers the merchandising one: which figures have
   a gallery worth browsing and which are still showing a single photo. The
   figure page's thumbnails, arrows and full-screen view only earn their place
   when there is more than one image, so a catalogue where most products have
   none is worth being able to see at a glance.

   Order is by fewest photos first, because the products needing attention are
   the point of the screen; sorting alphabetically would bury them. */

type Shot = { url: string; role: "Main" | "Hover" | "Gallery" };

function shotsOf(product: Product): Shot[] {
  const shots: Shot[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined, role: Shot["role"]) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    shots.push({ url, role });
  };
  push(product.imageUrl, "Main");
  push(product.hoverImageUrl, "Hover");
  for (const url of product.images) push(url, "Gallery");
  return shots;
}

export function GalleriesView() {
  const products = useAdminResource<Product[]>("/api/admin/products");
  const [query, setQuery] = React.useState("");
  const [onlyThin, setOnlyThin] = React.useState(false);

  const rows = React.useMemo(() => {
    const all = (products.data ?? []).map((product) => ({ product, shots: shotsOf(product) }));
    const needle = query.trim().toLowerCase();
    return all
      .filter(({ product, shots }) => (!onlyThin || shots.length <= 1) &&
        (needle === "" || product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)))
      .sort((a, b) => a.shots.length - b.shots.length || a.product.name.localeCompare(b.product.name));
  }, [products.data, query, onlyThin]);

  const all = products.data ?? [];
  const thin = all.filter((product) => shotsOf(product).length <= 1).length;
  const withGallery = all.filter((product) => product.images.length > 0).length;

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Catalog"
        title="Product galleries"
        description={
          products.loading
            ? "Reading the catalogue…"
            : `${withGallery} of ${all.length} products have extra gallery photos · ${thin} have one photo or none.`
        }
      />

      {products.error && <ErrorState message={`Could not load products (${products.error}).`} />}

      {!products.error && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Find a figure by name or SKU…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-xs"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyThin}
                onChange={(event) => setOnlyThin(event.target.checked)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Only show figures needing photos
            </label>
          </div>

          {products.loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that.</p>
          ) : (
            <div className="grid gap-3">
              {rows.map(({ product, shots }) => (
                <section key={product.id} className="rounded-lg border border-border p-3">
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-foreground">{product.name}</p>
                    <span className="font-mono text-[11px] text-muted-foreground">{product.sku}</span>
                    <Badge variant={shots.length <= 1 ? "outline" : "secondary"}>
                      {shots.length} {shots.length === 1 ? "photo" : "photos"}
                    </Badge>
                    {!product.visible && <Badge variant="outline">Hidden</Badge>}
                  </header>

                  {shots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No photos at all — this figure shows a placeholder on the shop.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {shots.map((shot) => (
                        <figure key={shot.url} className="w-24">
                          <div className="relative aspect-square overflow-hidden rounded-md border border-input bg-secondary">
                            <Image src={shot.url} alt="" fill sizes="120px" className="object-contain p-1" unoptimized />
                          </div>
                          <figcaption className="mt-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                            {shot.role}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
