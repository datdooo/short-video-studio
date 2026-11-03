"use client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { listTitleAnimations, normalizeTitleAnimation } from "@/lib/visual-style/animations.mjs";
import type { TitleAnimationId } from "@/lib/visual-style/animations.mjs";
const animations = listTitleAnimations();
export function TextAnimationPanel({
  value,
  onChange,
}: {
  value?: TitleAnimationId;
  onChange: (id: TitleAnimationId) => void;
}) {
  return (
    <div className="mt-5">
      <label htmlFor="title-animation" className="text-xs font-semibold text-zinc-300">
        Text animation
      </label>
      <Select
        value={normalizeTitleAnimation(value)}
        onValueChange={(value) => onChange(normalizeTitleAnimation(value))}
      >
        <SelectTrigger id="title-animation" className="studio-input mt-1 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {animations.map(({ id, label }) => (
            <SelectItem key={id} value={id}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
