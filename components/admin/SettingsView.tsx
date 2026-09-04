"use client";

import * as React from "react";
import { Box, Palette } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { useAdminResource } from "@/components/admin/useAdminResource";

type Settings = { accentColor: string; heroModelUrl: string | null; heroModelName: string | null };

const DEFAULT_ACCENT = "#E8622A";
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/* A handful of presets rather than only a colour wheel. The storefront's
   palette is warm — cream paper, brown ink — and a colour picked in isolation
   can land somewhere that fights it. These are known to sit properly against
   that background; the picker is still there for anything else. */
const PRESETS = [
  { name: "Funko orange", value: "#E8622A" },
  { name: "Deep red", value: "#C1503A" },
  { name: "Ink blue", value: "#1A73C7" },
  { name: "Forest", value: "#2F6B4F" },
  { name: "Plum", value: "#7A3E7A" },
  { name: "Gold", value: "#C99031" },
];

export function SettingsView() {
  const settings = useAdminResource<Settings>("/api/admin/settings");
  const [accent, setAccent] = React.useState(DEFAULT_ACCENT);
  const [model, setModel] = React.useState<{ url: string | null; name: string | null }>({ url: null, name: null });
  const [notice, setNotice] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!settings.data) return;
    setAccent(settings.data.accentColor);
    setModel({ url: settings.data.heroModelUrl, name: settings.data.heroModelName });
  }, [settings.data]);

  const valid = HEX.test(accent);
  const dirty =
    Boolean(settings.data) &&
    (accent !== settings.data!.accentColor || model.url !== settings.data!.heroModelUrl);

  async function save() {
    if (!valid) { setFailure("Enter a colour as a hex value, like #E8622A"); return; }
    setSaving(true);
    setFailure(null);
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ accentColor: accent, heroModelUrl: model.url, heroModelName: model.name }),
      });
      setNotice("Saved — the storefront updates within a few seconds.");
      await settings.reload();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not save those settings.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadModel(file: File) {
    setUploading(true);
    setFailure(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Not adminFetch: that sets a JSON content type, and multipart needs the
      // browser to set its own boundary.
      const response = await fetch("/api/admin/uploads/model", { method: "POST", body: form, credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Upload failed");
      setModel({ url: body.url, name: body.name });
      setNotice("Model uploaded — press Save to put it on the homepage.");
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not upload that model.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Storefront appearance. Changes go live within a few seconds of saving."
        action={
          <Button size="sm" disabled={!dirty || saving || !valid} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      {failure && <ErrorState message={failure} />}
      {settings.error && <ErrorState message={`Could not load settings (${settings.error}).`} />}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Palette className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Accent colour</CardTitle>
              <CardDescription>
                The shop&apos;s one brand colour — buttons, prices, links, badges and the cart.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setAccent(preset.value)}
                  title={preset.name}
                  aria-label={preset.name}
                  className={`size-9 rounded-full border-2 transition-transform hover:scale-110 ${
                    accent.toLowerCase() === preset.value.toLowerCase() ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={HEX.test(accent) ? accent : DEFAULT_ACCENT}
                onChange={(event) => setAccent(event.target.value.toUpperCase())}
                className="size-10 cursor-pointer rounded border border-input bg-transparent p-1"
                aria-label="Pick a colour"
              />
              <Input
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="max-w-[140px] font-mono"
                aria-label="Hex colour"
              />
              {!valid && <span className="text-xs text-destructive">Needs to be a hex value</span>}
              {accent !== DEFAULT_ACCENT && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAccent(DEFAULT_ACCENT)}>
                  Reset
                </Button>
              )}
            </div>

            {/* A live sample, because a hex value tells you nothing about how
                it will sit against the storefront's cream. */}
            <div className="rounded-lg border border-input p-4" style={{ backgroundColor: "#FBF3E7" }}>
              <p className="mb-2 text-xs" style={{ color: "#8A7A65" }}>Preview</p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="rounded-full px-5 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: valid ? accent : DEFAULT_ACCENT, color: "#FFFDF9" }}
                >
                  Add to bag
                </span>
                <span className="text-sm font-semibold" style={{ color: valid ? accent : DEFAULT_ACCENT }}>
                  ₹1,799.00
                </span>
                <span className="text-sm" style={{ color: "#3A2E22" }}>
                  Jujutsu Kaisen – Satoru Gojo
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Box className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Homepage 3D figure</CardTitle>
              <CardDescription>
                The rotating model in the hero. A .glb file, under 12MB — every first-time
                visitor downloads it before the page settles.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-lg border border-input px-3 py-2 text-sm">
              {model.url ? (
                <>
                  <p className="font-medium text-foreground">{model.name ?? "Custom model"}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{model.url}</p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Using the built-in Tanjiro model. Upload one to replace it.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="hero-model">Replace</Label>
              <Input
                id="hero-model"
                type="file"
                accept=".glb,model/gltf-binary"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadModel(file);
                  event.target.value = "";
                }}
              />
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>

            {model.url && (
              <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setModel({ url: null, name: null })}>
                Go back to the built-in model
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
