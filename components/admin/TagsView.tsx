"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { TONES } from "@/lib/tags";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import type { Tag } from "@/components/admin/types";
import { useAdminResource } from "@/components/admin/useAdminResource";

/* A tag code is what actually lands in Product.badges, so it is normalised the
   way the API validates it: upper snake case, nothing else. */
const codify = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");

/* The storefront draws each tone as a hand-stuck paper sticker. These swatches
   are only an approximation of that palette — enough to tell them apart in a
   table without pretending the admin renders the real thing. */
const TONE_SWATCH: Record<string, string> = {
  orange: "#f4772e",
  yellow: "#f2c744",
  blue: "#4b7fd6",
  peach: "#f6b39a",
  ink: "#232022",
};

export function TagsView() {
  const tags = useAdminResource<Tag[]>("/api/admin/tags");
  const [editing, setEditing] = React.useState<Tag | null>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const rows = tags.data ?? [];

  async function remove(tag: Tag) {
    if (
      !window.confirm(
        `Delete the “${tag.label}” tag? Products already carrying ${tag.code} keep it, but it will show with a plain fallback sticker.`,
      )
    )
      return;
    try {
      await adminFetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
      setNotice(`${tag.label} was deleted.`);
      await tags.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete that tag.");
    }
  }

  const columns: Column<Tag>[] = [
    {
      key: "code",
      header: "Tag",
      sortValue: (row) => row.code,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.label}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: "tone",
      header: "Tone",
      sortValue: (row) => row.tone,
      cell: (row) => (
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-3 rounded-full border border-border"
            style={{ background: TONE_SWATCH[row.tone] ?? "transparent" }}
          />
          {row.tone}
        </span>
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
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.label}`}>
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
        title="Tags"
        description={
          tags.error
            ? "Tags unavailable"
            : `${rows.length} badge${rows.length === 1 ? "" : "s"} products can wear on the storefront`
        }
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add tag
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      {tags.error && <ErrorState message={`Could not load tags (${tags.error}).`} />}

      {/* Same reasoning as Categories: an empty table under a failed fetch
          reads as "no rows exist", so it is withheld until the data lands. */}
      {!tags.error && (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={tags.loading}
          searchIn={(row) => `${row.code} ${row.label}`}
          searchPlaceholder="Search tags"
          emptyMessage="No tags yet."
        />
      )}

      <TagDialog
        open={open}
        onOpenChange={setOpen}
        tag={editing}
        onSaved={async (message) => {
          setNotice(message);
          await tags.reload();
        }}
      />
    </div>
  );
}

function TagDialog({
  open,
  onOpenChange,
  tag,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onSaved: (message: string) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [code, setCode] = React.useState("");
  const [tone, setTone] = React.useState<string>("orange");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLabel(tag?.label ?? "");
    setCode(tag?.code ?? "");
    setTone(tag?.tone ?? "orange");
    setError(null);
  }, [open, tag]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { code: codify(code || label), label: label.trim(), tone };

    try {
      if (tag) {
        await adminFetch(`/api/admin/tags/${tag.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.label} was updated.`);
      } else {
        await adminFetch("/api/admin/tags", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`${payload.label} was created.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that tag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? "Edit tag" : "Add tag"}</DialogTitle>
          <DialogDescription>
            Tags are the stickers a figure wears on the storefront — the label is what shoppers
            read, the code is what gets stored on the product.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tag-label">Label <span className="text-destructive">*</span></Label>
            <Input
              id="tag-label"
              required
              minLength={2}
              value={label}
              onChange={(event) => {
                const next = event.target.value;
                // Keep the code in lockstep until the admin edits it themselves.
                setCode((current) => (current === codify(label) ? codify(next) : current));
                setLabel(next);
              }}
              placeholder="staff pick"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tag-code">Code <span className="text-destructive">*</span></Label>
            <Input
              id="tag-code"
              required
              minLength={2}
              value={code}
              onChange={(event) => setCode(codify(event.target.value))}
              placeholder="STAFF_PICK"
              className="font-mono"
            />
            {tag && (
              <p className="text-xs text-muted-foreground">
                Products store this code. Renaming it leaves existing products pointing at the old
                one.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tag-tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tag-tone">
                <SelectValue placeholder="Choose a tone" />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              One of the five sticker treatments the storefront can draw.
            </p>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : tag ? "Save changes" : "Create tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
