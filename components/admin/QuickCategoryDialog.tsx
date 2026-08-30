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
import { ImageField } from "@/components/admin/ImageField";
import type { Category } from "@/components/admin/types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * The minimal version of CategoriesView's create form — just enough to wire
 * up a product without leaving its dialog. Description and visibility still
 * need the full Categories page.
 */
export function QuickCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: Category) => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setImageUrl("");
    setError(null);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), slug: slug.trim() || slugify(name), visible: true };
      if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      const created = await adminFetch<Category>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(created);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add category</DialogTitle>
          <DialogDescription>
            Creates a visible category. Add a description on the Categories page later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="quick-category-name">Name</Label>
            <Input
              id="quick-category-name"
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
            <Label htmlFor="quick-category-slug">Slug</Label>
            <Input
              id="quick-category-slug"
              required
              minLength={2}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <ImageField id="quick-category-image" label="Image" value={imageUrl} onChange={setImageUrl} />
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
              {saving ? "Creating…" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
