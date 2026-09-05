"use client";

import * as React from "react";
import { Blend, Box, Palette, Type } from "lucide-react";

import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Notice, PageHeader } from "@/components/admin/PageHeader";
import { useAdminResource } from "@/components/admin/useAdminResource";

type BoxLabels = {
  heroBoxLine: string;
  heroBoxNumber: string;
  heroBoxBanner: string;
  heroBoxName: string;
  heroBoxSubtitle: string;
  heroBoxCheckLight: string;
  heroBoxCheckDark: string;
  heroBoxNumberColor: string;
};

type HeroPreset = { id: string; name: string; heroModelUrl: string | null; heroModelName: string | null } & BoxLabels;

type Settings = { accentColor: string; secondaryColor: string | null; heroModelUrl: string | null; heroModelName: string | null } & BoxLabels;

/* The box face is drawn in code, so these are the only words on it. Order
   here matches the order they appear on the packaging, top to bottom, which
   is the only arrangement that lets someone check their work against the
   preview without hunting. */
const BOX_FIELDS: { key: keyof BoxLabels; label: string; hint: string }[] = [
  { key: "heroBoxLine", label: "POP! line", hint: "Printed under the POP! badge — Animation, Marvel, Games…" },
  { key: "heroBoxNumber", label: "Figure number", hint: "Top right corner." },
  { key: "heroBoxBanner", label: "Banner", hint: "The franchise strip across the top." },
  { key: "heroBoxName", label: "Nameplate", hint: "The character name at the bottom." },
  { key: "heroBoxSubtitle", label: "Nameplate subtitle", hint: "The smaller line under the name. Leave blank to omit it." },
];

/* The checkerboard behind the figure, and the box's own sides. Separate from
   the text fields because they are colours, not copy — and because they are
   the one part of the artwork a shop is likely to change without changing the
   model, to match a different franchise's packaging. */
const BOX_CHECKS: { key: "heroBoxCheckLight" | "heroBoxCheckDark" | "heroBoxNumberColor"; label: string; hint: string }[] = [
  { key: "heroBoxCheckLight", label: "Check colour", hint: "The lighter square of the checkerboard." },
  { key: "heroBoxCheckDark", label: "Check shadow", hint: "The darker square, and the box's own sides." },
  { key: "heroBoxNumberColor", label: "Figure number", hint: "The number in the top-right corner. It sits on the checks, so it may need contrast against them." },
];

const DEFAULT_BOX: BoxLabels = {
  heroBoxLine: "ANIMATION",
  heroBoxNumber: "1000",
  heroBoxBanner: "DEMON SLAYER",
  heroBoxName: "TANJIRO",
  heroBoxSubtitle: "WITH NOODLES",
  heroBoxCheckLight: "#1E5B4F",
  heroBoxCheckDark: "#12181A",
  heroBoxNumberColor: "#FFFFFF",
};

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

/* Cooler and quieter than the primary set: this colour's job is to sit beside
   the accent without competing with it. */
const SECONDARY_PRESETS = [
  { name: "Slate blue", value: "#6E8CA0" },
  { name: "Teal", value: "#3E8079" },
  { name: "Clay", value: "#B07A5A" },
  { name: "Moss", value: "#6B7F4F" },
  { name: "Dusk", value: "#7C7391" },
  { name: "Charcoal", value: "#5A5651" },
];

/* Where the live preview comes from. It is the storefront rendering itself
   with the chosen colours, not a mock-up drawn here — a preview that can
   disagree with the shop is worse than none. */
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://www.funkopie.in";

export function SettingsView() {
  const settings = useAdminResource<Settings>("/api/admin/settings");
  const [accent, setAccent] = React.useState(DEFAULT_ACCENT);
  const [secondary, setSecondary] = React.useState<string | null>(null);
  const [box, setBox] = React.useState<BoxLabels>(DEFAULT_BOX);
  const presets = useAdminResource<HeroPreset[]>("/api/admin/hero-presets");
  const [presetBusy, setPresetBusy] = React.useState(false);
  const [model, setModel] = React.useState<{ url: string | null; name: string | null }>({ url: null, name: null });
  const [notice, setNotice] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!settings.data) return;
    setAccent(settings.data.accentColor);
    setSecondary(settings.data.secondaryColor);
    setBox({
      heroBoxLine: settings.data.heroBoxLine,
      heroBoxNumber: settings.data.heroBoxNumber,
      heroBoxBanner: settings.data.heroBoxBanner,
      heroBoxName: settings.data.heroBoxName,
      heroBoxSubtitle: settings.data.heroBoxSubtitle,
      heroBoxCheckLight: settings.data.heroBoxCheckLight,
      heroBoxCheckDark: settings.data.heroBoxCheckDark,
      heroBoxNumberColor: settings.data.heroBoxNumberColor,
    });
    setModel({ url: settings.data.heroModelUrl, name: settings.data.heroModelName });
  }, [settings.data]);

  const valid = HEX.test(accent) && (secondary === null || HEX.test(secondary)) &&
    BOX_CHECKS.every(({ key }) => HEX.test(box[key]));
  const dirty =
    Boolean(settings.data) &&
    (accent !== settings.data!.accentColor ||
      secondary !== settings.data!.secondaryColor ||
      model.url !== settings.data!.heroModelUrl ||
      BOX_FIELDS.some(({ key }) => box[key] !== settings.data![key]) ||
      BOX_CHECKS.some(({ key }) => box[key] !== settings.data![key]));

  /* Debounced so dragging the colour wheel doesn't reload the iframe on every
     pixel of movement — the picker fires continuously while the pointer is
     down. A quarter second is long enough to coalesce a drag and short enough
     to still feel like it's following you. */
  const [previewColours, setPreviewColours] = React.useState({ accent, secondary });
  React.useEffect(() => {
    const timer = setTimeout(() => setPreviewColours({ accent, secondary }), 250);
    return () => clearTimeout(timer);
  }, [accent, secondary]);

  const previewSrc = `${STORE_URL}/theme-preview?accent=${encodeURIComponent(previewColours.accent)}${
    previewColours.secondary ? `&secondary=${encodeURIComponent(previewColours.secondary)}` : ""
  }`;

  /* Applying loads the preset into the form but does NOT save it. The change
     is visible in the preview above first, and Save is still the thing that
     puts it on the shop — so trying a preset is free and reversible. */
  function applyPreset(preset: HeroPreset) {
    setBox({
      heroBoxLine: preset.heroBoxLine,
      heroBoxNumber: preset.heroBoxNumber,
      heroBoxBanner: preset.heroBoxBanner,
      heroBoxName: preset.heroBoxName,
      heroBoxSubtitle: preset.heroBoxSubtitle,
      heroBoxCheckLight: preset.heroBoxCheckLight,
      heroBoxCheckDark: preset.heroBoxCheckDark,
      heroBoxNumberColor: preset.heroBoxNumberColor,
    });
    setModel({ url: preset.heroModelUrl, name: preset.heroModelName });
    setNotice(`Loaded "${preset.name}" — press Save to put it on the shop.`);
  }

  async function savePreset() {
    const name = prompt("Save the current hero setup as a preset called:", box.heroBoxName || "New preset");
    if (!name?.trim()) return;
    setPresetBusy(true);
    try {
      await adminFetch("/api/admin/hero-presets", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), heroModelUrl: model.url, heroModelName: model.name, ...box }),
      });
      setNotice(`Saved the preset "${name.trim()}".`);
      await presets.reload();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not save that preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function deletePreset(preset: HeroPreset) {
    if (!confirm(`Delete the preset "${preset.name}"? The hero itself is not affected.`)) return;
    setPresetBusy(true);
    try {
      await adminFetch(`/api/admin/hero-presets/${preset.id}`, { method: "DELETE" });
      setNotice(`Deleted the preset "${preset.name}".`);
      await presets.reload();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not delete that preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function save() {
    if (!valid) { setFailure("Enter a colour as a hex value, like #E8622A"); return; }
    setSaving(true);
    setFailure(null);
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ accentColor: accent, secondaryColor: secondary, heroModelUrl: model.url, heroModelName: model.name, ...box }),
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

      {/* The live preview, above the controls rather than beside them: it is
          the thing being edited, and the colour pickers are how you edit it.

          It is an iframe of the storefront rendering itself with the chosen
          colours, not swatches drawn here. Deriving the palette a second time
          in the admin would mean two implementations of both the colour maths
          and the shop's styling, and a preview that can disagree with the shop
          is worse than no preview at all. The trade is that it needs the
          storefront to be reachable — which, if it isn't, is worth knowing
          before changing the theme anyway. */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Live preview — the real storefront, with the colours below
            {dirty && <span className="ml-2 text-foreground">· unsaved</span>}
          </p>
          <a
            href={previewSrc}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Open full size
          </a>
        </div>
        <iframe
          /* Keyed on the URL so a colour change swaps the frame rather than
             navigating it — navigating would push an entry into the admin's
             own history, and Back would then walk through every colour tried
             instead of leaving the page. */
          key={previewSrc}
          src={previewSrc}
          title="Storefront theme preview"
          className="h-[520px] w-full border-0 bg-secondary"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
        />
      </div>

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

          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Blend className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Secondary colour</CardTitle>
              <CardDescription>
                The contrast colour — the &ldquo;just unboxed&rdquo; sticker, the DC wash, the dark drops
                band. Leave it derived and it follows the accent automatically.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Derived is the default and deliberately first: most shops
                  never need to touch this, and the automatic complement is a
                  better answer than a colour picked without reference to the
                  accent. */}
              <button
                type="button"
                onClick={() => setSecondary(null)}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                  secondary === null ? "border-foreground text-foreground" : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                Derive from accent
              </button>
              {SECONDARY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSecondary(preset.value)}
                  title={preset.name}
                  aria-label={preset.name}
                  className={`size-9 rounded-full border-2 transition-transform hover:scale-110 ${
                    secondary?.toLowerCase() === preset.value.toLowerCase() ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondary && HEX.test(secondary) ? secondary : "#6E8CA0"}
                onChange={(event) => setSecondary(event.target.value.toUpperCase())}
                className="size-10 cursor-pointer rounded border border-input bg-transparent p-1"
                aria-label="Pick a secondary colour"
              />
              <Input
                value={secondary ?? ""}
                placeholder="Derived from the accent"
                onChange={(event) => setSecondary(event.target.value.trim() === "" ? null : event.target.value)}
                className="max-w-[190px] font-mono"
                aria-label="Secondary hex colour"
              />
              {secondary !== null && !HEX.test(secondary) && (
                <span className="text-xs text-destructive">Needs to be a hex value</span>
              )}
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
            <div className="min-w-0 rounded-lg border border-input px-3 py-2 text-sm">
              {model.url ? (
                <>
                  <p className="break-all font-medium text-foreground">{model.name ?? "Custom model"}</p>
                  {/* `truncate` needs a width to truncate against, and inside
                      a grid item that width is the content's own — so a long
                      Storage URL just widened the card and pushed itself past
                      the edge. `break-all` wraps it instead. */}
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{model.url}</p>
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

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Type className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Box artwork</CardTitle>
              <CardDescription>
                The words printed on the POP! box behind the 3D figure. The artwork is drawn in
                code, so these are the only text on it — change the model and these need changing
                too, or the new figure stands in the old one&apos;s packaging.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Presets sit above the fields they fill, because switching
                figure is the common task and editing eight values by hand is
                the rare one. */}
            <div className="sm:col-span-2 rounded-lg border border-input p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Presets</p>
                <Button type="button" variant="outline" size="sm" disabled={presetBusy} onClick={savePreset}>
                  Save current setup
                </Button>
              </div>
              {presets.data && presets.data.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {presets.data.map((preset) => (
                    <span key={preset.id} className="inline-flex items-center overflow-hidden rounded-full border border-input">
                      <button
                        type="button"
                        disabled={presetBusy}
                        onClick={() => applyPreset(preset)}
                        className="px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        title={`${preset.heroBoxBanner} · ${preset.heroBoxName}`}
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        disabled={presetBusy}
                        onClick={() => deletePreset(preset)}
                        aria-label={`Delete the ${preset.name} preset`}
                        className="border-l border-input px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  None saved yet. Set the box up the way you want it, then use Save current setup — the
                  model and all eight values are stored together, so switching figure later is one click.
                </p>
              )}
            </div>

            {BOX_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`box-${field.key}`}>{field.label}</Label>
                <Input
                  id={`box-${field.key}`}
                  value={box[field.key]}
                  maxLength={40}
                  onChange={(event) => setBox((current) => ({ ...current, [field.key]: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              </div>
            ))}

            {BOX_CHECKS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`box-${field.key}`}>{field.label}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={HEX.test(box[field.key]) ? box[field.key] : DEFAULT_BOX[field.key]}
                    onChange={(event) => setBox((current) => ({ ...current, [field.key]: event.target.value.toUpperCase() }))}
                    className="size-10 cursor-pointer rounded border border-input bg-transparent p-1"
                    aria-label={field.label}
                  />
                  <Input
                    id={`box-${field.key}`}
                    value={box[field.key]}
                    onChange={(event) => setBox((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="max-w-[140px] font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
