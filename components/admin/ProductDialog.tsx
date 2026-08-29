"use client";

import * as React from "react";

import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Product } from "@/components/admin/types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Draft = {
  name: string;
  sku: string;
  slug: string;
  description: string;
  price: string;
  cost: string;
  stockQuantity: string;
  categoryId: string;
  imageUrl: string;
  visible: boolean;
};

function draftFrom(product: Product | null, categories: Category[]): Draft {
  if (!product) {
    return {
      name: "",
      sku: "",
      slug: "",
      description: "",
      price: "",
      cost: "",
      stockQuantity: "0",
      categoryId: categories[0]?.id ?? "",
      imageUrl: "",
      // New figures start hidden-safe (see the dialog copy below) — check the
      // box to launch immediately.
      visible: false,
    };
  }
  return {
    name: product.name,
    sku: product.sku,
    slug: product.slug,
    description: product.description,
    price: (product.price / 100).toString(),
    cost: (product.cost / 100).toString(),
    stockQuantity: product.stockQuantity.toString(),
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? "",
    visible: product.visible,
  };
}

/**
 * Create/edit form for a product. The field set is exactly what
 * POST/PATCH /api/admin/products accept — see the note rendered in the footer
 * about the catalog-only fields (franchise, character, edition, release date,
 * badges) that the schema stores but those routes do not yet take.
 */
export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(product, categories));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(draftFrom(product, categories));
      setError(null);
    }
  }, [open, product, categories]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const slug = draft.slug.trim() || slugify(draft.name);
    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      slug,
      description: draft.description.trim(),
      price: Math.round(Number(draft.price || 0) * 100),
      cost: Math.round(Number(draft.cost || 0) * 100),
      stockQuantity: Number(draft.stockQuantity || 0),
      categoryId: draft.categoryId,
      visible: draft.visible,
    };
    // The route validates imageUrl as a URL, so only send it when it is one.
    if (draft.imageUrl.trim()) payload.imageUrl = draft.imageUrl.trim();

    try {
      if (product) {
        await adminFetch(`/api/admin/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was updated.`);
      } else {
        await adminFetch("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was added to the catalog.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Changes go live on the storefront as soon as you save."
              : "New figures start hidden-safe: uncheck visible to stage before launch."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="product-name">
              <Input
                id="product-name"
                required
                minLength={2}
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    name,
                    // Keep slug in lockstep until the user edits it themselves.
                    slug: current.slug === slugify(current.name) ? slugify(name) : current.slug,
                  }));
                }}
                placeholder="Woody — Sheriff Edition"
              />
            </Field>
            <Field label="Category" htmlFor="product-category">
              <Select value={draft.categoryId} onValueChange={(value) => set("categoryId", value)}>
                <SelectTrigger id="product-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="SKU" htmlFor="product-sku">
              <Input
                id="product-sku"
                required
                minLength={2}
                value={draft.sku}
                onChange={(event) => set("sku", event.target.value)}
                placeholder="FNK-0042"
              />
            </Field>
            <Field label="Slug" htmlFor="product-slug">
              <Input
                id="product-slug"
                required
                minLength={2}
                value={draft.slug}
                onChange={(event) => set("slug", event.target.value)}
                placeholder="woody-sheriff-edition"
              />
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="product-description"
            hint="At least 10 characters — this is the storefront copy."
          >
            <textarea
              id="product-description"
              required
              minLength={10}
              rows={3}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Hand-painted vinyl figure, 10cm, boxed."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (₹)" htmlFor="product-price">
              <Input
                id="product-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(event) => set("price", event.target.value)}
              />
            </Field>
            <Field label="Cost (₹)" htmlFor="product-cost">
              <Input
                id="product-cost"
                required
                type="number"
                min="0"
                step="0.01"
                value={draft.cost}
                onChange={(event) => set("cost", event.target.value)}
              />
            </Field>
            <Field label="Stock" htmlFor="product-stock">
              <Input
                id="product-stock"
                required
                type="number"
                min="0"
                step="1"
                value={draft.stockQuantity}
                onChange={(event) => set("stockQuantity", event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Image URL"
            htmlFor="product-image"
            hint={
              product
                ? "Optional — must be a full URL. Leave blank to keep the current image; this form can't clear it."
                : "Optional — must be a full URL."
            }
          >
            <Input
              id="product-image"
              type="url"
              value={draft.imageUrl}
              onChange={(event) => set("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(event) => set("visible", event.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Visible on the storefront
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Franchise, character, edition, release date and badges are stored on the product record
            but are not accepted by the admin create/update API yet, so they are shown read-only in
            the table.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !draft.categoryId}>
              {saving ? "Saving…" : product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
