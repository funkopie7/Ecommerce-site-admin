"use client";

import * as React from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { useAdminResource } from "@/components/admin/useAdminResource";

type MediaImage = { name: string; url: string; size: number; createdAt: string | null; usedBy: string[] };

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/* The bucket, as a contact sheet.

   Selection is limited to unused images by design: an image a product still
   points at cannot be picked, so the delete button can never be aimed at
   something the storefront needs. The API re-checks anyway, in case this page
   has been open since before someone assigned one. */
export function MediaView() {
  const media = useAdminResource<MediaImage[]>("/api/admin/media");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [notice, setNotice] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showUnusedOnly, setShowUnusedOnly] = React.useState(false);

  const all = media.data ?? [];
  const unusedCount = all.filter((image) => image.usedBy.length === 0).length;
  const bytes = all.reduce((sum, image) => sum + image.size, 0);

  const rows = all.filter(
    (image) =>
      (!showUnusedOnly || image.usedBy.length === 0) &&
      (query.trim() === "" ||
        image.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        image.usedBy.some((owner) => owner.toLowerCase().includes(query.trim().toLowerCase()))),
  );

  function toggle(image: MediaImage) {
    if (image.usedBy.length > 0) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(image.name)) next.delete(image.name);
      else next.add(image.name);
      return next;
    });
  }

  async function remove() {
    const names = [...selected];
    if (names.length === 0) return;
    if (!confirm(`Permanently delete ${names.length} image${names.length === 1 ? "" : "s"} from storage? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/media", { method: "DELETE", body: JSON.stringify({ names }) });
      setNotice(`Deleted ${names.length} image${names.length === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await media.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete those images.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Catalog"
        title="Images"
        description={
          media.loading
            ? "Reading the storage bucket…"
            : `${all.length} file${all.length === 1 ? "" : "s"} · ${formatSize(bytes)} · ${unusedCount} not used by anything.`
        }
        action={
          selected.size > 0 ? (
            <Button variant="destructive" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="mr-1.5 size-4" />
              Delete {selected.size}
            </Button>
          ) : undefined
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      {media.error && <ErrorState message={`Could not load the bucket (${media.error}).`} />}

      {!media.error && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Find by filename or product…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-xs"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showUnusedOnly}
                onChange={(event) => setShowUnusedOnly(event.target.checked)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Only show unused
            </label>
          </div>

          {media.loading ? (
            <p className="text-sm text-muted-foreground">Loading images…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {rows.map((image) => {
                const inUse = image.usedBy.length > 0;
                const picked = selected.has(image.name);
                return (
                  <figure
                    key={image.name}
                    onClick={() => toggle(image)}
                    className={`group relative overflow-hidden rounded-lg border transition-colors ${
                      picked ? "border-destructive ring-2 ring-destructive/30" : "border-border"
                    } ${inUse ? "cursor-default" : "cursor-pointer hover:border-primary"}`}
                  >
                    <div className="relative aspect-square bg-secondary">
                      <Image src={image.url} alt="" fill sizes="220px" className="object-contain p-2" unoptimized />
                      {!inUse && (
                        <span
                          className={`absolute left-2 top-2 flex size-5 items-center justify-center rounded border bg-background text-[11px] ${
                            picked ? "border-destructive text-destructive" : "border-input text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <figcaption className="space-y-1 border-t border-border p-2">
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{image.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatSize(image.size)}</p>
                      {inUse ? (
                        <p className="truncate text-[11px] text-foreground" title={image.usedBy.join(", ")}>
                          {image.usedBy[0]}
                          {image.usedBy.length > 1 ? ` +${image.usedBy.length - 1}` : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/70">Not used</p>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
