"use client";

import * as React from "react";
import Image from "next/image";
import { Star, Trash2, Wand2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageField } from "@/components/admin/ImageField";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import type { Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

/* Every product's photos, product by product — and the place to change them.

   The Images screen answers a storage question: what is in the bucket, is
   anything unused, can it go. This answers the merchandising one — which
   figures have a gallery worth browsing, which are still on a single photo,
   and which photo leads. The product form can do all this too, one figure at
   a time, but working through a catalogue that way means opening and closing
   a dialog several hundred times.

   The three roles are kept disjoint: a photo is the main, or the hover, or in
   the gallery, never two at once. Promoting one demotes whatever it replaced
   into the gallery rather than dropping it, because the alternative is a
   click that silently loses a photo. */

type Role = "Main" | "Hover" | "Gallery";
type Shot = { url: string; role: Role };

const PAGE = 24;

function shotsOf(product: Product): Shot[] {
  const shots: Shot[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined, role: Role) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    shots.push({ url, role });
  };
  push(product.imageUrl, "Main");
  push(product.hoverImageUrl, "Hover");
  for (const url of product.images) push(url, "Gallery");
  return shots;
}

/* The three fields as they should be after an action, derived from the whole
   product rather than patched field by field — the demote-the-old-one rule is
   easy to get subtly wrong when each is edited on its own. */
export function afterPromote(product: Product, url: string, to: "Main" | "Hover") {
  const displaced = to === "Main" ? product.imageUrl : product.hoverImageUrl;
  const other = to === "Main" ? product.hoverImageUrl : product.imageUrl;
  const gallery = product.images.filter((image) => image !== url && image !== displaced);
  // Whatever this replaced falls back into the gallery, unless it is already
  // carrying the other role.
  if (displaced && displaced !== url && displaced !== other) gallery.push(displaced);
  return to === "Main"
    ? { imageUrl: url, hoverImageUrl: other === url ? null : product.hoverImageUrl, images: gallery }
    : { hoverImageUrl: url, imageUrl: other === url ? null : product.imageUrl, images: gallery };
}

export function afterRemove(product: Product, url: string) {
  return {
    imageUrl: product.imageUrl === url ? null : product.imageUrl,
    hoverImageUrl: product.hoverImageUrl === url ? null : product.hoverImageUrl,
    images: product.images.filter((image) => image !== url),
  };
}

export function GalleriesView() {
  const products = useAdminResource<Product[]>("/api/admin/products");
  const [query, setQuery] = React.useState("");
  const [onlyThin, setOnlyThin] = React.useState(false);
  const [shown, setShown] = React.useState(PAGE);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const all = products.data ?? [];

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .map((product) => ({ product, shots: shotsOf(product) }))
      .filter(({ product, shots }) =>
        (!onlyThin || shots.length <= 1) &&
        (needle === "" || product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)))
      .sort((a, b) => a.shots.length - b.shots.length || a.product.name.localeCompare(b.product.name));
  }, [all, query, onlyThin]);

  // Reset the window when the filters change, or the count carries over from a
  // long list into a much shorter one.
  React.useEffect(() => setShown(PAGE), [query, onlyThin]);

  /* Loads the next page when the end of the list comes into view, instead of
     asking for a click. `rootMargin` starts the next batch a screen early, so
     scrolling stays continuous rather than stopping at a gap while thumbnails
     decode.

     Deliberately not virtualised: the rows are already rendered, and tearing
     out rows above the viewport would break in-page find, which is how you
     actually locate one figure among five hundred. This only grows the list. */
  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || shown >= matches.length) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setShown((current) => current + PAGE); },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, matches.length]);

  const thin = all.filter((product) => shotsOf(product).length <= 1).length;
  const withGallery = all.filter((product) => product.images.length > 0).length;

  async function patch(product: Product, data: Record<string, unknown>, message: string) {
    setBusy(product.id);
    try {
      await adminFetch(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify(data) });
      setNotice(message);
      await products.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update that product.");
    } finally {
      setBusy(null);
    }
  }

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

      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
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
            <p className="ml-auto text-xs text-muted-foreground">
              Removing a photo here only unlinks it — delete the file itself on the Images screen.
            </p>
          </div>

          {products.loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that.</p>
          ) : (
            <>
              <div className="grid gap-3">
                {matches.slice(0, shown).map(({ product, shots }) => (
                  <section key={product.id} className="rounded-lg border border-border p-3">
                    <header className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium text-foreground">{product.name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground">{product.sku}</span>
                      <Badge variant={shots.length <= 1 ? "outline" : "secondary"}>
                        {shots.length} {shots.length === 1 ? "photo" : "photos"}
                      </Badge>
                      {!product.visible && <Badge variant="outline">Hidden</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === product.id}
                        onClick={() => setAdding(adding === product.id ? null : product.id)}
                      >
                        {adding === product.id ? "Close" : "Add photo"}
                      </Button>
                    </header>

                    {shots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No photos at all — this figure shows a placeholder on the shop.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {shots.map((shot) => (
                          <figure key={shot.url} className="w-28">
                            <div className="relative aspect-square overflow-hidden rounded-md border border-input bg-secondary">
                              <Image src={shot.url} alt="" fill sizes="140px" className="object-contain p-1" unoptimized />
                              {shot.role !== "Gallery" && (
                                <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground">
                                  {shot.role}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Use as the main photo"
                                aria-label="Use as the main photo"
                                disabled={busy === product.id || shot.role === "Main"}
                                onClick={() => patch(product, afterPromote(product, shot.url, "Main"), `Main photo set for ${product.name}.`)}
                              >
                                <Star className={`size-3.5 ${shot.role === "Main" ? "fill-amber-400 text-amber-400" : ""}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Use as the hover photo"
                                aria-label="Use as the hover photo"
                                disabled={busy === product.id || shot.role === "Hover"}
                                onClick={() => patch(product, afterPromote(product, shot.url, "Hover"), `Hover photo set for ${product.name}.`)}
                              >
                                <Wand2 className={`size-3.5 ${shot.role === "Hover" ? "text-primary" : ""}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Remove from this product"
                                aria-label="Remove from this product"
                                disabled={busy === product.id}
                                onClick={() => patch(product, afterRemove(product, shot.url), `Photo removed from ${product.name}.`)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </figure>
                        ))}
                      </div>
                    )}

                    {/* Rendered only for the row being edited. One ImageField
                        per product would mount several hundred file inputs and
                        picker dialogs at once. */}
                    {adding === product.id && (
                      <div className="mt-3 border-t border-border pt-3">
                        <ImageField
                          id={`gallery-add-${product.id}`}
                          label="Add a photo"
                          value=""
                          onChange={(url) => {
                            if (!url || shotsOf(product).some((shot) => shot.url === url)) return;
                            const data = product.imageUrl
                              ? { images: [...product.images, url] }
                              // Nothing set yet, so the first photo added becomes
                              // the main one rather than an orphan in the gallery.
                              : { imageUrl: url };
                            void patch(product, data, `Photo added to ${product.name}.`);
                            setAdding(null);
                          }}
                          hint="Upload a new file, or pick one already in the bucket."
                        />
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* The observer target, plus a plain button behind it. The
                  observer never fires where IntersectionObserver is missing or
                  where the list is short enough not to scroll, and a list that
                  silently stops at row 24 with no way forward is worse than a
                  button nobody needs to press. */}
              {shown < matches.length && (
                <div ref={sentinel} className="mt-4 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setShown((current) => current + PAGE)}>
                    Loading {matches.length - shown} more…
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
