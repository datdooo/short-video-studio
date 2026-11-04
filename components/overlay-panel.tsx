"use client";

import { UI_STRINGS } from "@/lib/ui-strings";

import { Check } from "lucide-react";
import type { OverlayStyle } from "@/lib/visual-style/types";
import { activeSceneOverlays, listOverlayPresets, overlayAssetUrl } from "@/lib/visual-style/overlays.mjs";
const presets = listOverlayPresets();
// UI exception sample-card: large overlay swatch keeps its sample geometry.
export function SceneOverlays({ overlays }: { overlays: OverlayStyle[] }) {
  // Legacy reserved descriptors remain non-renderable; they cannot supply URLs.
  const curated = overlays.filter((overlay) => "presetId" in overlay);
  return (
    <div aria-hidden="true" data-scene-overlays className="pointer-events-none absolute inset-0 z-[5]">
      {activeSceneOverlays(curated).map((overlay) => (
        <span
          key={overlay.id}
          data-overlay-asset={overlay.assetId}
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("${overlayAssetUrl(overlay.assetId)}")`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            opacity: overlay.opacity,
          }}
        />
      ))}
    </div>
  );
}
export function OverlayPanel({
  overlays,
  onPreset,
  onOpacity,
}: {
  overlays: OverlayStyle[];
  onPreset: (id: string) => void;
  onOpacity: (opacity: number) => void;
}) {
  const selected = overlays.length === 0 ? "none" : "presetId" in overlays[0] ? overlays[0].presetId : undefined;
  return (
    <section aria-labelledby="overlay-heading" className="studio-card">
      <h3 id="overlay-heading" className="text-sm font-semibold">
        Overlay
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            data-ui-exception="sample-card"
            key={preset.id}
            type="button"
            aria-label={`Overlay: ${preset.label}`}
            aria-pressed={selected === preset.id}
            onClick={() => onPreset(preset.id)}
            className={`relative rounded-xl border p-2 text-left`}
          >
            <span aria-hidden="true" className="relative block h-12 overflow-hidden rounded-lg bg-zinc-600">
              {preset.overlays.map((overlay) => (
                <span
                  key={overlay.id}
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("${overlayAssetUrl(overlay.assetId)}")`,
                    backgroundSize: "100% 100%",
                    opacity: overlay.opacity,
                  }}
                />
              ))}
            </span>
            <span className="mt-2 flex items-center justify-between gap-1 text-xs font-medium">
              {preset.label}
              {selected === preset.id && <Check aria-hidden="true" className="size-3 shrink-0" />}
            </span>
          </button>
        ))}
      </div>
      <label htmlFor="overlay-opacity" className="field-label mt-3 flex justify-between">
        <span>Opacity</span>
        <output>{Math.round((overlays[0]?.opacity ?? 0) * 100)}%</output>
      </label>
      <input
        id="overlay-opacity"
        aria-label={UI_STRINGS.overlayOpacity}
        type="range"
        min="0"
        max="100"
        value={Math.round((overlays[0]?.opacity ?? 0) * 100)}
        disabled={!overlays.length}
        onChange={(event) => onOpacity(Number(event.target.value) / 100)}
        className="mt-2 w-full accent-white disabled:opacity-30"
      />
    </section>
  );
}
