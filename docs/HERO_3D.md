# The hero 3D system

The homepage's rotating Funko-style figure, its box art, and the paint studio are custom-built (three.js / React Three Fiber), not a library. Most of the actual rendering code lives in the **storefront** repo; this doc covers the whole system end to end since the admin UI drives it.

## The model itself

`StoreSettings.heroModelUrl` is a `.glb` file uploaded through the admin Settings page. Two shapes of model show up in practice:

- **Textured models** — render as-is, no special handling.
- **Untextured / 3MF-converted models** — geometry only, one flat white material, no UV coordinates. These come from 3D-printing exports and need the auto-paint system below or they render as a plain white shape.

## Auto-paint (photo-derived color)

`StoreSettings.heroTintPhotoUrl` is a reference photo (e.g. the product's own packaging photo). For an untextured model, the storefront analyzes this photo client-side and paints the model using **vertex colors** — not a texture map, since there are no UVs to hang one on:

1. The photo is sampled in horizontal slices (`PAINT_BANDS = 48`) to get an average color per height band — this alone gives a banded, seamless base color with no projection artifacts (an earlier planar-projection approach was tried and discarded: it inherently produces mismatched patches on any rounded, limbed shape, since one 2D pixel corresponds to many depths on the model).
2. For camera-facing geometry, each vertex additionally samples the actual photo pixel at its projected position, blending toward it as the surface faces the camera and fading back to the flat band color as it turns away — this is what lets an edge like the blindfold in the reference example follow its real curve instead of reading as a straight horizontal cut.
3. Background pixels in the photo are excluded by a luminance/alpha threshold before any of this runs.

This all happens in `components/home/heroFigure.ts` (storefront repo) — `analysePhoto`/`loadPhotoPaint` do the photo analysis, `buildFigure` applies it to the model.

## Manual paint studio

Auto-paint from one photo can't cover everything (blemishes, small marks, corrections). `/hero-paint` (storefront repo, a standalone route so it can be iframed into the admin dashboard) is a small paint app:

- **Brush / Eraser / Eyedropper**, with a size slider on an exponential curve (`components/home/HeroPaintStudio.tsx`).
- Paint is stored as **strokes** (`{x, y, z, r, c, e?}` — position, radius, hex color, optional "erase" flag), not baked pixel/vertex data. A few KB of JSON survives model rotation and rescaling; baked per-vertex color data would be tied to one exact geometry and roughly 750KB for a model this dense.
- A spatial grid (`lib/heroPaint.ts`'s `VertexGrid`) keeps each stroke's paint lookup local, so painting stays responsive on a ~250k-vertex mesh.
- The brush's **minimum size is derived from the model's own median vertex spacing**, not a hardcoded number — paint is vertex colors, so a brush narrower than the gap between vertices covers nothing. This adapts automatically to whatever model is loaded.
- The eraser restores to bare white (strips the auto-paint back off), not back to the auto-painted color — it's a "remove the paint here" tool, not an undo.

Strokes save to `StoreSettings.heroModelPaint` (or a `HeroPreset`'s own field) via `postMessage` back to the admin Settings page hosting the iframe.

## Rotation

`heroModelRotationX/Y/Z` (degrees, −360 to 360) let a model that was exported lying on its side be stood upright. Rotation is applied **before** the auto-fit/scale measurement, not after — the auto-fit scales the model by its measured height, so a model rotated after measurement gets measured across the wrong axis and comes out the wrong size.

## Hero presets

`HeroPreset` is a full copy of the `StoreSettings` hero fields (model, rotation, paint, tint photo, box art colors/text) under a name — a saveable, switchable snapshot. It's a copy on save, not a reference: editing the live settings afterward must not silently rewrite a preset you'd want to go back to.

## Chase Room curation

`StoreSettings.chaseRoomProductIds` is an ordered array of product IDs, editable from the admin Settings page (search, check, reorder). If it's empty, the homepage's "Chase Room" shelf falls back to its original automatic behavior — every `variantType: "Chase"` product, sorted by price descending — so an unconfigured store looks exactly as it always did. The admin picker only offers **visible** products; a hidden/unpublished product can still be present in a saved list from before (it's silently skipped by the storefront, since it only ever sees visible products) but is called out in the admin UI as "Hidden — won't show on the homepage" rather than silently doing nothing with no explanation.

## Preview routes

`/hero-preview` and `/hero-paint` (storefront repo) render just the 3D figure from URL query params, for embedding as an iframe in the admin dashboard's Settings page. Both are explicitly exempted from the site's normal `X-Frame-Options: SAMEORIGIN` header in `next.config.ts` (replaced with a `Content-Security-Policy: frame-ancestors` allowing only the admin origin) — without that, the iframe just shows a browser's built-in broken-frame page instead of the preview.
