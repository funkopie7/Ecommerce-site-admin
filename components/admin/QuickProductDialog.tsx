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

/**
 * The minimal version of ProductDialog's create form, for wiring a new figure
 * into a bundle without leaving the collection editor. Franchise, character,
 * edition, images and badges still need the full Products page.
 */
export function QuickProductDialog({
  open,
  onOpenChange,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCreated: (product: Product) => void;
}) {
  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [stockQuantity, setStockQuantity] = React.useState("0");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSku("");
    setSlug("");
    setCategoryId(categories[0]?.id ?? "");
    setDescription("");
    setPrice("");
    setCost("");
    setStockQuantity("0");
    setError(null);
  }, [open, categories]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await adminFetch<Product>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          slug: slug.trim() || slugify(name),
          description: description.trim(),
          price: Math.round(Number(price || 0) * 100),
          cost: Math.round(Number(cost || 0) * 100),
          stockQuantity: Number(stockQuantity || 0),
          categoryId,
          // New figures start hidden-safe, same default the full form uses —
          // launch it from the Products page once it's fully dressed.
          visible: false,
        }),
      });
      onCreated(created);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add product</DialogTitle>
          <DialogDescription>
            Creates the figure hidden-safe and adds it to this bundle. Add its image, franchise and
            badges on the Products page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-name">Name</Label>
              <Input
                id="quick-product-name"
                required
                minLength={2}
                autoFocus
                value={name}
                onChange={(event) => {
                  const next = event.target.value;
                  setSlug((current) => (current === slugify(name) ? slugify(next) : current));
                  setName(next);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="quick-product-category">
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
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-sku">SKU</Label>
              <Input
                id="quick-product-sku"
                required
                minLength={2}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="FNK-0042"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-slug">Slug</Label>
              <Input
                id="quick-product-slug"
                required
                minLength={2}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-product-description">Description</Label>
            <textarea
              id="quick-product-description"
              required
              minLength={10}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Hand-painted vinyl figure, 10cm, boxed."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-price">Price (₹)</Label>
              <Input
                id="quick-product-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-cost">Cost (₹)</Label>
              <Input
                id="quick-product-cost"
                required
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-stock">Stock</Label>
              <Input
                id="quick-product-stock"
                required
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !categoryId}>
              {saving ? "Creating…" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
