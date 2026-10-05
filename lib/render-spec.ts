import { EditPart, RENDER_PRESET } from "@/lib/edit-plan";

export type ScriptPreset = "latin" | "japanese" | "korean";

export const FONT_PRESETS: Record<ScriptPreset, string[]> = {
  latin: ["Arial Black", "Avenir Next", "Montserrat ExtraBold", "Noto Sans"],
  japanese: ["Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "sans-serif"],
  korean: ["Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "sans-serif"],
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

export type OverlayRole = "original" | "part";

type OverlayFitConfig = {
  maxFontSize: number;
  minFontSize: number;
  maxLines: number;
  maxWidth: number;
  maxHeight: number;
  lineSpacing: number;
};

const OVERLAY_FIT: Record<OverlayRole, OverlayFitConfig> = {
  original: {
    maxFontSize: 54,
    minFontSize: 32,
    maxLines: 3,
    maxWidth: 900,
    maxHeight: 220,
    lineSpacing: -2,
  },
  part: {
    maxFontSize: 82,
    minFontSize: 44,
    maxLines: 4,
    maxWidth: 900,
    maxHeight: 244,
    lineSpacing: -4,
  },
};

function characterWidthEm(character: string) {
  if (/\s/.test(character)) return 0.32;
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(character)) return 1;
  if (/[A-Z0-9]/.test(character)) return 0.9;
  if (/[a-z\u00c0-\u024f]/.test(character)) return 0.62;
  if (/[-–—.,:;!?()[\]{}'"/\\]/.test(character)) return 0.34;
  return 0.62;
}

function textWidthEm(value: string) {
  return Array.from(value).reduce((width, character) => width + characterWidthEm(character), 0);
}

function splitLongToken(token: string, maxWidthEm: number) {
  const chunks: string[] = [];
  let current = "";
  for (const character of Array.from(token)) {
    if (current && textWidthEm(`${current}${character}`) > maxWidthEm) {
      chunks.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapByVisualWidth(value: string, maxWidthEm: number) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidthEm(candidate) <= maxWidthEm) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    const chunks = splitLongToken(word, maxWidthEm);
    if (chunks.length > 1) {
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) || "";
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function ellipsizeLine(value: string, maxWidthEm: number) {
  let result = value.trimEnd();
  while (result && textWidthEm(`${result}…`) > maxWidthEm) {
    result = Array.from(result).slice(0, -1).join("").trimEnd();
  }
  return `${result}…`;
}

export function fitOverlayText(value: string, role: OverlayRole) {
  const config = OVERLAY_FIT[role];
  const normalized = value.trim().replace(/\s+/g, " ") || "UNTITLED";

  for (let fontSize = config.maxFontSize; fontSize >= config.minFontSize; fontSize -= 2) {
    const lines = wrapByVisualWidth(normalized, config.maxWidth / fontSize);
    const textHeight = lines.length * fontSize + Math.max(0, lines.length - 1) * config.lineSpacing;
    if (lines.length <= config.maxLines && textHeight <= config.maxHeight) {
      return {
        text: lines.join("\n"),
        fontSize,
        lineSpacing: config.lineSpacing,
        lineCount: lines.length,
        maxLines: config.maxLines,
        truncated: false,
      };
    }
  }

  const maxWidthEm = config.maxWidth / config.minFontSize;
  const lines = wrapByVisualWidth(normalized, maxWidthEm).slice(0, config.maxLines);
  lines[lines.length - 1] = ellipsizeLine(lines[lines.length - 1], maxWidthEm);
  return {
    text: lines.join("\n"),
    fontSize: config.minFontSize,
    lineSpacing: config.lineSpacing,
    lineCount: lines.length,
    maxLines: config.maxLines,
    truncated: true,
  };
}

function escapeDrawText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
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
  const originalFit = fitOverlayText(input.originalTitle, "original");
  const partFit = fitOverlayText(input.part.title, "part");
  const originalTitle = escapeDrawText(originalFit.text);
  const partTitle = escapeDrawText(partFit.text);
  const indicator = `${input.part.id}/${input.totalParts}`;
  const font = escapeDrawText(input.fontFile);

  const filterComplex = [
    ...segmentFilters,
    `${concatInputs}concat=n=${input.part.segments.length}:v=1:a=1[cutv][cuta]`,
    `[cutv]eq=contrast=1.04:saturation=1.06[graded]`,
    `[graded]split=2[bgsrc][mainsrc]`,
    `[bgsrc]scale=270:480:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=270:480,boxblur=12:2,scale=${RENDER_PRESET.width}:${RENDER_PRESET.height}:flags=bilinear,eq=brightness=-0.5[bg]`,
    `[mainsrc]crop=w='min(iw,1080)':h='min(ih,1080)':x='max((iw-1080)/2,0)':y='max((ih-1080)/2,0)',pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black[main]`,
    `[bg][main]overlay=0:360[layout]`,
    `[layout]drawtext=fontfile='${font}':text='${originalTitle}':fontcolor=white:fontsize=${originalFit.fontSize}:borderw=5:bordercolor=#c82018:shadowcolor=black@0.75:shadowx=3:shadowy=4:x=(w-text_w)/2:y=338-text_h:line_spacing=${originalFit.lineSpacing}[t1]`,
    `[t1]drawtext=fontfile='${font}':text='${partTitle}':fontcolor=white:fontsize=${partFit.fontSize}:borderw=7:bordercolor=#d52b20:shadowcolor=#ff2a20@0.55:shadowx=2:shadowy=3:x=(w-text_w)/2:y=1472:line_spacing=${partFit.lineSpacing}[t2]`,
    `[t2]drawtext=fontfile='${font}':text='${indicator}':fontcolor=white:fontsize=58:borderw=5:bordercolor=#c82018:shadowcolor=black@0.75:shadowx=3:shadowy=4:x=(w-text_w)/2:y=1804[titled]`,
    `[titled]format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,setpts=PTS/${RENDER_PRESET.speed}[vout]`,
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
    "h264_videotoolbox",
    "-profile:v",
    "high",
    "-b:v",
    "12M",
    "-color_range",
    "tv",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
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
  const originalFit = fitOverlayText(input.originalTitle, "original");
  const partFit = fitOverlayText(input.part.title, "part");
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
      fill: "#fffdfb",
      stroke: "#a81524",
      shadow: "rgba(0,0,0,.75)",
      maxWidthPercent: 83.3,
      autoScale: true,
      fixedZones: {
        originalTitle: { y: "94–338", align: "bottom", ...originalFit },
        partTitle: { y: "1472–1716", align: "top", ...partFit },
        partIndicator: { y: 1804 },
      },
    },
    mainVideo: {
      scale: "native 100%",
      frame: "1080x1080",
      position: "center",
      overflow: "crop horizontally; pad only when source is smaller than the frame",
    },
    output: {
      encoder: "Apple VideoToolbox H.264 (libx264 fallback)",
      colorSpace: "Rec.709 limited range",
      colorGrade: { contrast: 1.04, saturation: 1.06 },
    },
  };
}
