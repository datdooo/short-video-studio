import { EditPart, RENDER_PRESET } from "@/lib/edit-plan";

export type ScriptPreset = "latin" | "japanese" | "korean";

export const FONT_PRESETS: Record<ScriptPreset, string[]> = {
  latin: ["Montserrat ExtraBold", "Poppins ExtraBold", "Inter Black", "Noto Sans"],
  japanese: ["Noto Sans JP Bold", "Zen Kaku Gothic New Bold", "Noto Sans"],
  korean: ["Pretendard Bold", "Noto Sans KR Bold", "Noto Sans"],
};

export function detectScript(text: string): ScriptPreset {
  const japanese = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const korean = (text.match(/[\uac00-\ud7af]/g) || []).length;
  if (japanese > korean && japanese > 0) return "japanese";
  if (korean > 0) return "korean";
  return "latin";
}

export function fontStackFor(text: string) {
  return FONT_PRESETS[detectScript(text)];
}

function escapeDrawText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function wrapOverlayText(value: string, maxLatinChars: number, maxEastAsianChars: number, maxLines: number) {
  const maxChars = detectScript(value) === "latin" ? maxLatinChars : maxEastAsianChars;
  const words = detectScript(value) === "latin" ? value.split(/\s+/) : Array.from(value);
  const separator = detectScript(value) === "latin" ? " " : "";
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current}${separator}${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
}

export type RenderSpecInput = {
  sourcePath: string;
  outputPath: string;
  originalTitle: string;
  part: EditPart;
  totalParts: number;
  fontFile: string;
};

export function buildFfmpegArgs(input: RenderSpecInput) {
  const segmentFilters = input.part.segments.flatMap((segment, index) => [
    `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]`,
    `[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${index}]`,
  ]);
  const concatInputs = input.part.segments.map((_, index) => `[v${index}][a${index}]`).join("");
  const originalTitle = escapeDrawText(wrapOverlayText(input.originalTitle, 32, 17, 3));
  const partTitle = escapeDrawText(wrapOverlayText(input.part.title, 24, 13, 4));
  const indicator = `${input.part.id}/${input.totalParts}`;
  const font = escapeDrawText(input.fontFile);

  const filterComplex = [
    ...segmentFilters,
    `${concatInputs}concat=n=${input.part.segments.length}:v=1:a=1[cutv][cuta]`,
    `[cutv]split=2[bgsrc][mainsrc]`,
    `[bgsrc]scale=${RENDER_PRESET.width}:${RENDER_PRESET.height}:force_original_aspect_ratio=increase,crop=${RENDER_PRESET.width}:${RENDER_PRESET.height},boxblur=50:25,eq=brightness=-0.5[bg]`,
    `[mainsrc]crop=w='min(iw,1080)':h='min(ih,1080)':x='max((iw-1080)/2,0)':y='max((ih-1080)/2,0)',pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black[main]`,
    `[bg][main]overlay=0:360[layout]`,
    `[layout]drawtext=fontfile='${font}':text='${originalTitle}':fontcolor=white:fontsize=${input.originalTitle.length > 70 ? 42 : 52}:borderw=5:bordercolor=#c82018:shadowcolor=black@0.75:shadowx=3:shadowy=4:x=(w-text_w)/2:y=340-text_h:line_spacing=-3[t1]`,
    `[t1]drawtext=fontfile='${font}':text='${partTitle}':fontcolor=white:fontsize=${input.part.title.length > 48 ? 62 : 78}:borderw=7:bordercolor=#d52b20:shadowcolor=#ff2a20@0.55:shadowx=2:shadowy=3:x=(w-text_w)/2:y=1460:line_spacing=-5[t2]`,
    `[t2]drawtext=fontfile='${font}':text='${indicator}':fontcolor=white:fontsize=58:borderw=5:bordercolor=#c82018:shadowcolor=black@0.75:shadowx=3:shadowy=4:x=(w-text_w)/2:y=1770[titled]`,
    `[titled]setpts=PTS/${RENDER_PRESET.speed}[vout]`,
    `[cuta]atempo=${RENDER_PRESET.speed}[aout]`,
  ].join(";");

  return [
    "-y",
    "-i",
    input.sourcePath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outputPath,
  ];
}

export function buildRenderManifest(input: Omit<RenderSpecInput, "fontFile">) {
  const fonts = fontStackFor(`${input.originalTitle} ${input.part.title}`);
  return {
    pipeline: [
      "select source-timestamp segments",
      "cut and concatenate chronologically",
      "compose 1080x1920 portrait layout",
      "add blurred background and styled titles",
      "apply final video/audio speed 1.25x",
      "export MP4",
    ],
    sourceTimestamps: input.part.segments,
    render: RENDER_PRESET,
    typography: {
      script: detectScript(`${input.originalTitle} ${input.part.title}`),
      fontFallbacks: fonts,
      fill: "#ffffff",
      stroke: "#d52b20",
      shadow: "rgba(0,0,0,.75)",
      maxWidthPercent: 86,
    },
    mainVideo: {
      scale: "native 100%",
      frame: "1080x1080",
      position: "center",
      overflow: "crop horizontally; pad only when source is smaller than the frame",
    },
  };
}
