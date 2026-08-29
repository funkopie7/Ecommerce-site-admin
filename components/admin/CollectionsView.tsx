"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import type { Collection, Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function CollectionsView() {
  const collections = useAdminResource<Collection[]>("/api/admin/collections");
  const products = useAdminResource<Product[]>("/api/admin/products");
  const [editing, setEditing] = React.useState<Collection | null>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const rows = collections.data ?? [];

  async function remove(collection: Collection) {
    if (!window.confirm(`Delete the “${collection.name}” bundle?`)) return;
    try {
      await adminFetch(`/api/admin/collections/${collection.id}`, { method: "DELETE" });
      setNotice(`${collection.name} was deleted.`);
      await collections.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete that collection.");
    }
  }

  const columns: Column<Collection>[] = [
    {
      key: "name",
      header: "Collection",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Figures",
      sortValue: (row) => row.items.reduce((total, item) => total + item.quantity, 0),
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.items.length} {row.items.length === 1 ? "product" : "products"} ·{" "}
          {row.items.reduce((total, item) => total + item.quantity, 0)} units
        </span>
      ),
    },
    {
      key: "price",
      header: "Bundle price",
      sortValue: (row) => row.price,
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => (
        <div>
          <span>{formatMoney(row.price)}</span>
          {row.compareAtPrice ? (
            <span className="ml-2 text-xs text-muted-foreground line-through">
              {formatMoney(row.compareAtPrice)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => (row.visible ? "visible" : "hidden"),
      cell: (row) => (
        <Badge variant={row.visible ? "success" : "outline"}>
          {row.visible ? "Visible" : "Hidden"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-10",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setEditing(row);
                setOpen(true);
              }}
            >
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => void remove(row)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Catalog"
        title="Collections"
        description="Curated multi-figure bundles sold as one purchasable set"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            disabled={(products.data ?? []).length === 0}
          >
            <Plus /> Add collection
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {collections.error && (
        <ErrorState message={`Could not load collections (${collections.error}).`} />
      )}

      {/* An empty table under a failed fetch reads as "no rows exist", so the
          table is withheld until the data actually loads. */}
      {!collections.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={collections.loading}
          searchIn={(row) => `${row.name} ${row.slug}`}
          searchPlaceholder="Search collections"
          emptyMessage="No collections yet. Bundle a few figures together."
        />
      )}

      <CollectionDialog
        open={open}
        onOpenChange={setOpen}
        collection={editing}
        products={products.data ?? []}
        onSaved={async (message) => {
          setNotice(message);
          await collections.reload();
        }}
      />
    </div>
  );
}

function CollectionDialog({
  open,
  onOpenChange,
  collection,
  products,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection | null;
  products: Product[];
  onSaved: (message: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [compareAtPrice, setCompareAtPrice] = React.useState("");
  const [visible, setVisible] = React.useState(true);
  /** productId -> quantity, for the products currently in the bundle. */
  const [items, setItems] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? "");
    setSlug(collection?.slug ?? "");
    setDescription(collection?.description ?? "");
    setPrice(collection ? (collection.price / 100).toString() : "");
    setCompareAtPrice(collection?.compareAtPrice ? (collection.compareAtPrice / 100).toString() : "");
    setVisible(collection?.visible ?? true);
    setItems(
      Object.fromEntries(
        (collection?.items ?? []).map((item) => [item.productId, item.quantity]),
      ),
    );
    setError(null);
  }, [open, collection]);

  const selected = Object.entries(items);

  function toggle(productId: string, checked: boolean) {
    setItems((current) => {
      const next = { ...current };
      if (checked) next[productId] = next[productId] ?? 1;
      else delete next[productId];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0) {
      setError("A collection needs at least one product.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
      price: Math.round(Number(price || 0) * 100),
      visible,
      items: selected.map(([productId, quantity]) => ({ productId, quantity })),
    };
    if (compareAtPrice.trim()) {
      payload.compareAtPrice = Math.round(Number(compareAtPrice) * 100);
    }

    try {
      if (collection) {
        await adminFetch(`/api/admin/collections/${collection.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was updated.`);
      } else {
        await adminFetch("/api/admin/collections", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was created.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that collection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{collection ? "Edit collection" : "Add collection"}</DialogTitle>
          <DialogDescription>
            Pick the figures in the set, then price the bundle as a whole.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                required
                minLength={2}
                value={name}
                onChange={(event) => {
                  const next = event.target.value;
                  setSlug((current) => (current === slugify(name) ? slugify(next) : current));
                  setName(next);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-slug">Slug</Label>
              <Input
                id="collection-slug"
                required
                minLength={2}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-price">Bundle price (₹)</Label>
              <Input
                id="collection-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-compare">Compare-at price (₹)</Label>
              <Input
                id="collection-compare"
                type="number"
                min="0"
                step="0.01"
                value={compareAtPrice}
                onChange={(event) => setCompareAtPrice(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="collection-description">Description</Label>
            <Input
              id="collection-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Figures in this collection ({selected.length})</Label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {products.map((product) => {
                const checked = product.id in items;
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggle(product.id, event.target.checked)}
                      className="size-4 accent-[hsl(var(--primary))]"
                      aria-label={`Include ${product.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{product.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {product.sku} · {formatMoney(product.price)}
                      </p>
                    </div>
                    {checked && (
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={items[product.id]}
                        onChange={(event) =>
                          setItems((current) => ({
                            ...current,
                            [product.id]: Math.max(1, Number(event.target.value || 1)),
                          }))
                        }
                        className="h-8 w-16"
                        aria-label={`Quantity of ${product.name}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visible}
              onChange={(event) => setVisible(event.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Visible on the storefront
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : collection ? "Save changes" : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
