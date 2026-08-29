"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
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
import type { Category } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function CategoriesView() {
  const categories = useAdminResource<Category[]>("/api/admin/categories");
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const rows = categories.data ?? [];

  async function remove(category: Category) {
    if (!window.confirm(`Delete the “${category.name}” category?`)) return;
    try {
      await adminFetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      setNotice(`${category.name} was deleted.`);
      await categories.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete that category.");
    }
  }

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: "Category",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (row) => (
        <span className="line-clamp-1 text-sm text-muted-foreground">{row.description || "—"}</span>
      ),
    },
    {
      key: "products",
      header: "Products",
      sortValue: (row) => row._count?.products ?? 0,
      headClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row._count?.products ?? 0,
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
        title="Categories"
        description={
          categories.error
            ? "Categories unavailable"
            : `${rows.length} categories shape how the storefront browses`
        }
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add category
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {categories.error && (
        <ErrorState message={`Could not load categories (${categories.error}).`} />
      )}

      {/* An empty table under a failed fetch reads as "no rows exist", so the
          table is withheld until the data actually loads. */}
      {!categories.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={categories.loading}
          searchIn={(row) => `${row.name} ${row.slug}`}
          searchPlaceholder="Search categories"
          emptyMessage="No categories yet."
        />
      )}

      <CategoryDialog
        open={open}
        onOpenChange={setOpen}
        category={editing}
        onSaved={async (message) => {
          setNotice(message);
          await categories.reload();
        }}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [visible, setVisible] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setDescription(category?.description ?? "");
    setImageUrl(category?.imageUrl ?? "");
    setVisible(category?.visible ?? true);
    setError(null);
  }, [open, category]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
      visible,
    };
    if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();

    try {
      if (category) {
        await adminFetch(`/api/admin/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was updated.`);
      } else {
        await adminFetch("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.name} was created.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            Categories are the top-level way customers browse the shelf.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
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
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              required
              minLength={2}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category-description">Description</Label>
            <Input
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category-image">Image URL</Label>
            <Input
              id="category-image"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://…"
            />
            {category && (
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the current image; this form can't clear it.
              </p>
            )}
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
              {saving ? "Saving…" : category ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
