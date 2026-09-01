"use client";

import * as React from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tag } from "@/components/admin/types";

const codify = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");

/** The minimal version of TagsView's create form, embedded in the product dialog's badge picker. */
export function QuickTagDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tag: Tag) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [code, setCode] = React.useState("");
  const [tone, setTone] = React.useState<string>("orange");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLabel("");
    setCode("");
    setTone("orange");
    setError(null);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await adminFetch<Tag>("/api/admin/tags", {
        method: "POST",
        body: JSON.stringify({ code: codify(code || label), label: label.trim(), tone }),
      });
      onCreated(created);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that badge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add badge</DialogTitle>
          <DialogDescription>
            Creates a badge and applies it to this figure right away. Rename or retone it later on
            the Tags page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="quick-tag-label">Label <span className="text-destructive">*</span></Label>
            <Input
              id="quick-tag-label"
              required
              minLength={2}
              autoFocus
              value={label}
              onChange={(event) => {
                const next = event.target.value;
                setCode((current) => (current === codify(label) ? codify(next) : current));
                setLabel(next);
              }}
              placeholder="staff pick"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quick-tag-code">Code <span className="text-destructive">*</span></Label>
            <Input
              id="quick-tag-code"
              required
              minLength={2}
              value={code}
              onChange={(event) => setCode(codify(event.target.value))}
              placeholder="STAFF_PICK"
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quick-tag-tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="quick-tag-tone">
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
              {saving ? "Creating…" : "Create badge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
