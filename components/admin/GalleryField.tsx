"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageField } from "@/components/admin/ImageField";

export function GalleryField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (images: string[]) => void;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="grid gap-2 rounded-lg border border-input p-3">
      <div className="flex items-baseline justify-between">
        <Label>Gallery</Label>
        <span className="text-xs text-muted-foreground">
          {value.length === 0 ? "None yet" : `${value.length} extra photo${value.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, index) => (
            <li key={`${url}-${index}`} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-20 rounded-md border border-input bg-secondary object-contain p-1" />
              <button
                type="button"
                aria-label="Remove from gallery"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-input bg-background text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
              <div className="mt-1 flex justify-center gap-0.5">
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Move earlier">
                  <ArrowLeft className="size-3" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={index === value.length - 1} onClick={() => move(index, index + 1)} aria-label="Move later">
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Value stays empty so this reads as "add", and the field clears itself
          after each pick — otherwise the last-added photo would sit in the box
          looking like it hadn't been added. */}
      <ImageField
        id="product-gallery-add"
        label="Add another photo"
        value=""
        onChange={(url) => { if (url && !value.includes(url)) onChange([...value, url]); }}
        hint="Shown as thumbnails on the figure page, in this order. The main and hover photos are added automatically — no need to repeat them here."
      />
    </div>
  );
}
