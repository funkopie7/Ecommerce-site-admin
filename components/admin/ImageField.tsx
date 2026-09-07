"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UploadedImage = { name: string; url: string };

function uploadFileWithProgress(url: string, file: File, onProgress: (percent: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve({ url: data.url });
      else reject(new Error(data.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function ImageField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [images, setImages] = React.useState<UploadedImage[] | null>(null);
  const [loadingImages, setLoadingImages] = React.useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const { url } = await uploadFileWithProgress("/api/admin/uploads", file, setProgress);
      onChange(url);
      setImages(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openPicker() {
    setPickerOpen(true);
    if (images) return;
    setLoadingImages(true);
    try {
      const response = await fetch("/api/admin/uploads", { credentials: "include" });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error || "Could not load images");
      setImages(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load images");
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-upload`}>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-12 w-12 flex-none rounded-md border object-cover" />
        ) : null}
        <Input
          id={`${id}-upload`}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.target.value = "";
          }}
        />
        <Button type="button" onClick={openPicker} disabled={uploading}>
          Choose existing
        </Button>
      </div>
      <Input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="or paste an image URL directly…"
      />
      {uploading ? (
        <div className="grid gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progress < 100 ? `Uploading… ${progress}%` : "Converting to .webp…"}</p>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose an uploaded image</DialogTitle>
            <DialogDescription>
              Anything uploaded before, from any product, category or bundle.
            </DialogDescription>
          </DialogHeader>
          {loadingImages ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !images || images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images uploaded yet — upload one first.</p>
          ) : (
            <div className="grid max-h-96 grid-cols-4 gap-4 overflow-y-auto p-1 sm:grid-cols-5">
              {images.map((image) => (
                <button
                  type="button"
                  key={image.name}
                  onClick={() => {
                    onChange(image.url);
                    setPickerOpen(false);
                  }}
                  aria-label="Use this image"
                  className={`block h-28 w-full overflow-hidden rounded-md border transition-colors hover:border-primary ${
                    value === image.url ? "border-primary ring-2 ring-primary" : "border-input"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="block h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
