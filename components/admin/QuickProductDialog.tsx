"use client";

import * as React from "react";
import { Plus } from "lucide-react";

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
import { ImageField } from "@/components/admin/ImageField";
import { QuickCategoryDialog } from "@/components/admin/QuickCategoryDialog";
import type { Category, Product } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function QuickProductDialog({
  open,
  onOpenChange,
  categories,
  onCategoryCreated,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCategoryCreated?: () => void;
  onCreated: (product: Product) => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [stockQuantity, setStockQuantity] = React.useState("0");
  const [imageUrl, setImageUrl] = React.useState("");
  const [featured, setFeatured] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = React.useState(false);
  const [extraCategories, setExtraCategories] = React.useState<Category[]>([]);
  const categoryOptions = React.useMemo(
    () => [...categories, ...extraCategories.filter((extra) => !categories.some((category) => category.id === extra.id))],
    [categories, extraCategories],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setCategoryId(categories[0]?.id ?? "");
    setDescription("");
    setPrice("");
    setCost("");
    setStockQuantity("0");
    setImageUrl("");
    setFeatured(false);
    setVisible(false);
    setExtraCategories([]);
    setError(null);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim(),
        price: Math.round(Number(price || 0) * 100),
        cost: Math.round(Number(cost || 0) * 100),
        stockQuantity: Number(stockQuantity || 0),
        categoryId,
        visible,
        featured,
      };
      if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      const created = await adminFetch<Product>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(payload),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick add product</DialogTitle>
          <DialogDescription>
            Every field the Products page has, without leaving this collection.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="quick-product-name">Name <span className="text-destructive">*</span></Label>
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
              <div className="flex gap-1.5">
                <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
                  <SelectTrigger id="quick-product-category">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Quick add category"
                  title="Quick add category"
                  onClick={() => setQuickCategoryOpen(true)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="quick-product-slug">Slug <span className="text-destructive">*</span></Label>
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
            <Label htmlFor="quick-product-description">Description <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="quick-product-price">Price (₹) <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="quick-product-cost">Cost (₹) <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="quick-product-stock">Stock <span className="text-destructive">*</span></Label>
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

          <ImageField id="quick-product-image" label="Image" value={imageUrl} onChange={setImageUrl} />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Show in Featured drops
          </label>

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
            <Button type="submit" disabled={saving || !categoryId}>
              {saving ? "Creating…" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <QuickCategoryDialog
        open={quickCategoryOpen}
        onOpenChange={setQuickCategoryOpen}
        onCreated={(category) => {
          setExtraCategories((current) => [...current, category]);
          setCategoryId(category.id);
          onCategoryCreated?.();
        }}
      />
    </Dialog>
  );
}
