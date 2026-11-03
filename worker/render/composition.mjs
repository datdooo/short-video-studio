import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { effectiveMusic } from "../../lib/music/settings.mjs";
import {
  FOREGROUND_Y,
  PLAYBACK_RATE,
  TITLE_LAYOUT,
  TITLE_SHINE_SECONDS,
  TITLE_SHINE_WIDTH,
  foregroundFilter,
} from "../../lib/render-config.mjs";
import { partCaptions, sourceCaptionTrack, subtitleStyle, subtitleY } from "../../lib/subtitles.mjs";
import { partTransitionWindows, presentationDuration, presentationSegments } from "../../lib/teaser-hooks.mjs";
import { normalizeTitleAnimation } from "../../lib/visual-style/animations.mjs";
import { assertRenderableBackground } from "../../lib/visual-style/backgrounds.mjs";
import { DEFAULT_VISUAL_STYLE } from "../../lib/visual-style/defaults.mjs";
import { ffmpegFilterExpression } from "../../lib/visual-style/filters.mjs";
import { fontFamilyForStyle, listFonts } from "../../lib/visual-style/fonts.mjs";
import { TRANSITION_SPRITE } from "../../lib/visual-style/foreground-transitions.mjs";
import { styledTextSvg } from "../../lib/visual-style/text-render.mjs";
import { constrainTitlePair, needsMeasuredTitleFit, partOverlayTitle } from "../../lib/visual-style/title-fit.mjs";
import { cutTransitionFilters } from "../cut-transition.mjs";
import { EXPORT_METADATA_ARGS } from "../export-metadata.mjs";
import { RENDER_FILTER_COMPLEX_THREADS } from "../media-resources.mjs";
import { musicMixFilters } from "../music-audio.mjs";
import { prepareRangeInput } from "../range-input.mjs";
import { titleAnimationFilters } from "../title-animation.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createRenderComposition(read) {
  const hardwareDecodeCodecs = new Set(["h264", "hevc", "prores"]);

  function fontFamilyFor(text, font = "auto") {
    return fontFamilyForStyle(font, text, {
      overrides: {
        latin: process.env.FONT_LATIN_FAMILY,
        japanese: process.env.FONT_JAPANESE_FAMILY,
        korean: process.env.FONT_KOREAN_FAMILY,
      },
    });
  }

  let overlayFontsReady;

  function registerOverlayFonts() {
    const { projectRoot } = read();

    overlayFontsReady ||= Promise.all(
      listFonts()
        .filter((font) => font.bundled)
        .map(({ family, file }) =>
          sharp({
            text: {
              text: "A",
              font: `${family} Bold 12`,
              fontfile: path.join(projectRoot, "public", file),
              rgba: true,
            },
          })
            .png()
            .toBuffer(),
        ),
    );
    return overlayFontsReady;
  }

  const overlayFitConfig = {
    original: { ...TITLE_LAYOUT, maxHeight: TITLE_LAYOUT.original.bottom - TITLE_LAYOUT.original.top },
    part: { ...TITLE_LAYOUT, maxHeight: TITLE_LAYOUT.part.bottom - TITLE_LAYOUT.part.top },
  };

  function characterWidthEm(character) {
    if (/\s/.test(character)) return 0.32;
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(character)) return 1;
    if (/[A-Z0-9]/.test(character)) return 0.9;
    if (/[a-z\u00c0-\u024f]/.test(character)) return 0.62;
    if (/[-–—.,:;!?()[\]{}'"/\\]/.test(character)) return 0.34;
    return 0.62;
  }

  function textWidthEm(value) {
    return Array.from(value).reduce((width, character) => width + characterWidthEm(character), 0);
  }

  function splitLongToken(token, maxWidthEm) {
    const chunks = [];
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

  function wrapByVisualWidth(value, maxWidthEm) {
    const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
    const lines = [];
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

  function ellipsizeLine(value, maxWidthEm) {
    let result = value.trimEnd();
    while (result && textWidthEm(`${result}…`) > maxWidthEm) {
      result = Array.from(result).slice(0, -1).join("").trimEnd();
    }
    return `${result}…`;
  }

  function fitOverlayText(value, role, fontCap = TITLE_LAYOUT.maxFontSize) {
    const config = overlayFitConfig[role];
    const normalized =
      String(value || "")
        .trim()
        .replace(/\s+/g, " ") || "UNTITLED";

    for (let fontSize = Math.min(config.maxFontSize, fontCap); fontSize >= config.minFontSize; fontSize -= 2) {
      const lines = wrapByVisualWidth(normalized, config.maxWidth / fontSize);
      const textHeight = lines.length * fontSize + Math.max(0, lines.length - 1) * config.lineSpacing;
      if (lines.length <= config.maxLines && textHeight <= config.maxHeight) {
        return { lines, fontSize, lineSpacing: config.lineSpacing, truncated: false };
      }
    }

    const maxWidthEm = config.maxWidth / config.minFontSize;
    const lines = wrapByVisualWidth(normalized, maxWidthEm).slice(0, config.maxLines);
    lines[lines.length - 1] = ellipsizeLine(lines[lines.length - 1], maxWidthEm);
    return { lines, fontSize: config.minFontSize, lineSpacing: config.lineSpacing, truncated: true };
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  async function renderTitleOverlay({
    outputPath,
    shineOutputPath,
    originalTitle,
    partTitle,
    partId,
    totalParts,
    visualStyle = DEFAULT_VISUAL_STYLE,
  }) {
    partTitle = partOverlayTitle(partTitle);
    await registerOverlayFonts();
    const size = Math.min(
      fitOverlayText(originalTitle, "original").fontSize,
      fitOverlayText(partTitle, "part").fontSize,
    );
    let pair = {
      original: fitOverlayText(originalTitle, "original", size),
      part: fitOverlayText(partTitle, "part", size),
    };
    if (needsMeasuredTitleFit(visualStyle)) {
      pair = await constrainTitlePair(originalTitle, partTitle, pair, async (text, fontSize, role) => {
        const style = visualStyle[role === "original" ? "originalTitle" : "partTitle"];
        const family = fontFamilyFor(role === "original" ? originalTitle : partTitle, style.font);
        const { width } = await sharp({
          text: {
            text: `<span font_family="${escapeXml(family)}" weight="${style.fontWeight}" size="${fontSize * 1024}">${escapeXml(text)}</span>`,
            rgba: true,
          },
        }).metadata();
        return width + style.outline * 2 + 2;
      });
    }
    const { original: originalFit, part: partFit } = pair;
    const originalLineHeight = originalFit.fontSize + originalFit.lineSpacing;
    const originalLastBaseline = TITLE_LAYOUT.original.bottom - originalFit.fontSize * 0.2;
    const originalFirstBaseline = originalLastBaseline - (originalFit.lines.length - 1) * originalLineHeight;
    const partLineHeight = partFit.fontSize + partFit.lineSpacing;
    const originalFamily = fontFamilyFor(originalTitle, visualStyle.originalTitle.font);
    const partFamily = fontFamilyFor(partTitle, visualStyle.partTitle.font);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs><clipPath id="top-title-zone"><rect x="0" y="0" width="1080" height="${FOREGROUND_Y}" /></clipPath><clipPath id="bottom-title-zone"><rect x="0" y="${TITLE_LAYOUT.part.top - 24}" width="1080" height="${1800 - (TITLE_LAYOUT.part.top - 24)}" /></clipPath></defs>
      <g clip-path="url(#top-title-zone)">${styledTextSvg(originalFit.lines, { fontFamily: originalFamily, fontSize: originalFit.fontSize, firstBaseline: originalFirstBaseline, lineHeight: originalLineHeight, style: visualStyle.originalTitle })}</g>
      <g clip-path="url(#bottom-title-zone)">${styledTextSvg(partFit.lines, { fontFamily: partFamily, fontSize: partFit.fontSize, firstBaseline: TITLE_LAYOUT.part.top + partFit.fontSize * 0.82, lineHeight: partLineHeight, style: visualStyle.partTitle })}</g>
      ${styledTextSvg([`${partId}/${totalParts}`], { fontFamily: visualStyle.partIndicator.font === "auto" ? partFamily : fontFamilyFor(partTitle, visualStyle.partIndicator.font), fontSize: 58, firstBaseline: 1850, lineHeight: 60, style: visualStyle.partIndicator })}
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(outputPath);
    if (shineOutputPath) {
      const shineText = (fit, family, baseline, style) =>
        style.effect !== "current-title-glow-shine"
          ? ""
          : `<g font-family="${escapeXml(family)}" font-size="${fit.fontSize}" font-weight="${style.fontWeight}" opacity="${style.opacity}"><g fill="#b4e9ff" filter="url(#shine-glow)">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join("")}</g><g fill="#e8f7ff">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join("")}</g></g>`;
      const shineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="shine-glow"><feGaussianBlur stdDeviation="${originalFit.fontSize * 0.08}"/></filter><clipPath id="top"><rect width="1080" height="${FOREGROUND_Y}"/></clipPath><clipPath id="bottom"><rect y="${TITLE_LAYOUT.part.top - 24}" width="1080" height="${1800 - TITLE_LAYOUT.part.top + 24}"/></clipPath></defs><g clip-path="url(#top)">${shineText(originalFit, originalFamily, originalFirstBaseline, visualStyle.originalTitle)}</g><g clip-path="url(#bottom)">${shineText(partFit, partFamily, TITLE_LAYOUT.part.top + partFit.fontSize * 0.82, visualStyle.partTitle)}</g></svg>`;
      await sharp(Buffer.from(shineSvg)).png().toFile(shineOutputPath);
    }
  }

  async function subtitleFrames(source, plan, part, directory, signal) {
    const { speech } = read();

    const style = subtitleStyle(plan.subtitles);
    if (!style.enabled) return null;
    const supplied = plan.captionCues;
    let cues;
    if (!style.enabled) cues = [];
    else if (supplied) {
      cues = sourceCaptionTrack(supplied, source).cues;
    } else cues = (await speech.captions(source, signal, { provider: style.source })).cues;
    if (style.enabled && !cues.length) {
      if (!source.hasAudio) return null;
      throw new Error("Không nhận diện được lời nói để tạo phụ đề. Kiểm tra audio hoặc tắt Auto Subtitle.");
    }
    await registerOverlayFonts();
    const captions = partCaptions(cues, part, style);
    const blank = path.join(directory, "subtitle-blank.png");
    await sharp({ create: { width: 1080, height: 1920, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toFile(blank);
    const frames = [];
    let position = 0;
    // Replayed teaser/main captions can share exact bitmaps within this part.
    const subtitleImages = new Map();
    const add = (file, duration) => {
      if (duration > 0.001)
        frames.push(`file '${path.basename(file)}'\nduration ${(duration / PLAYBACK_RATE).toFixed(6)}`);
    };
    for (const [index, cue] of captions.entries()) {
      signal?.throwIfAborted();
      const start = Math.max(position, cue.start),
        end = Math.min(cue.end, captions[index + 1]?.start ?? Infinity);
      if (end <= start) continue;
      add(blank, start - position);
      const size = style.size;
      const lines = cue.text.split("\n"),
        family = fontFamilyFor(cue.text, style.font);
      const y = subtitleY(style, source.height);
      const text = lines
        .map(
          (line, lineIndex) =>
            `<text x="540" y="${y - (lines.length - lineIndex - 1) * size * 1.2}" text-anchor="middle">${escapeXml(line)}</text>`,
        )
        .join("");
      const legacyGraphic = `<g font-family="${escapeXml(family)}" font-size="${size}" font-weight="700" stroke-linejoin="round" paint-order="stroke fill"><g transform="translate(2,3)" fill="#000" stroke="#000" stroke-width="${style.outline * 2 + 2}" opacity=".6">${text}</g><g fill="${style.color}" stroke="${style.outlineColor}" stroke-width="${style.outline * 2}">${text}</g></g>`;
      const graphic =
        style.effect === undefined
          ? legacyGraphic
          : styledTextSvg(lines, {
              fontFamily: family,
              fontSize: size,
              firstBaseline: y - (lines.length - 1) * size * 1.2,
              lineHeight: size * 1.2,
              roundBaseline: false,
              style: { ...style, fontWeight: style.fontWeight ?? 700, opacity: style.opacity ?? 1 },
            });
      const svg = (opacity) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><g opacity="${opacity}">${graphic}</g></svg>`;
      const image = svg(1);
      let file = subtitleImages.get(image);
      if (!file) {
        file = path.join(directory, `subtitle-${index}.png`);
        await sharp(Buffer.from(image)).png().toFile(file);
        if (subtitleImages.size < 256) subtitleImages.set(image, file);
      }
      add(file, end - start);
      position = end;
    }
    const duration = presentationDuration(part);
    add(blank, Math.max(0.04, duration - position));
    const list = path.join(directory, "subtitles.ffconcat");
    await writeFile(list, `ffconcat version 1.0\n${frames.join("\n")}\nfile '${path.basename(blank)}'\n`);
    return list;
  }

  async function renderPart({
    source,
    plan,
    part,
    totalParts,
    outputPath,
    backgroundAsset,
    sceneAsset,
    onProgress,
    onEncoder = () => {},
    signal,
  }) {
    const { ffmpeg, musicLibrary, preferredVideoEncoder, projectRoot, renderContrast, renderSaturation, run } = read();

    signal?.throwIfAborted();
    if (!ffmpeg) throw new Error("Không tìm thấy FFmpeg. macOS: brew install ffmpeg");
    const workDirectory = path.dirname(outputPath);
    const titleOverlayPath = path.join(workDirectory, `part-${part.id}-titles.png`);
    const visualStyle = plan.visualStyle || DEFAULT_VISUAL_STYLE;
    const animated = normalizeTitleAnimation(visualStyle.titleAnimation) !== "none";
    // Static non-shine titles previously decoded an entirely transparent PNG and
    // ran crop/geq/overlay on it every frame. Keep the existing animated grouping
    // (including its format conversions) and actual shine effects untouched.
    const needsShineInput =
      animated ||
      [visualStyle.originalTitle, visualStyle.partTitle].some((style) => style.effect === "current-title-glow-shine");
    const titleShinePath = needsShineInput ? path.join(workDirectory, `part-${part.id}-shine.png`) : null;
    await renderTitleOverlay({
      outputPath: titleOverlayPath,
      shineOutputPath: titleShinePath,
      originalTitle: plan.originalTitle,
      partTitle: part.title,
      partId: part.id,
      totalParts,
      visualStyle,
    });

    // Scene decorations stay outside the foreground transition, under text.
    const musicSettings = effectiveMusic(plan.music, part.id);
    const musicAsset = musicSettings.enabled ? await musicLibrary.resolve(musicSettings.assetId) : null;
    const segments = presentationSegments(part);
    // One output clock before composition. Do not use AV-concat's longest-stream
    // padding, per-segment fps conversion or cloned EOF frames to conceal cuts.
    const outputFrames = Math.round((presentationDuration(part) / PLAYBACK_RATE) * 30);
    const transitionWindows = partTransitionWindows(part, plan.visualStyle?.cutTransition, plan.hookTransition).map(
      (w) => ({ ...w, presetId: w.presetId || plan.visualStyle?.cutTransition || "none" }),
    );
    const hasTransitions = transitionWindows.length > 0;
    let titleInputPath = titleOverlayPath;
    if (sceneAsset && !animated) {
      titleInputPath = path.join(workDirectory, `part-${part.id}-scene-titles.png`);
      await sharp(sceneAsset)
        .composite([{ input: titleOverlayPath }])
        .png()
        .toFile(titleInputPath);
    }

    const subtitlesPath = await subtitleFrames(source, plan, part, workDirectory, signal);
    const rangeInput = await prepareRangeInput({ source, segments, directory: workDirectory, ffmpeg, run, signal });
    const filterGraphPath = path.join(workDirectory, `part-${part.id}-filters.ffgraph`);
    try {
      const overlayInput = 2; // sequential source video + finite, sample-trimmed PCM
      // Allocate optional inputs in precisely the same order as buildArgs below.
      let nextInput = overlayInput + 1;
      const shineInput = needsShineInput ? nextInput++ : undefined;
      const subtitleInput = subtitlesPath ? nextInput++ : undefined;
      const backgroundInput = backgroundAsset ? nextInput++ : undefined;
      const animatedSceneInput = animated && sceneAsset ? nextInput++ : undefined;
      const vrInput = nextInput;
      // Decode each static PNG once, then repeat that one decoded frame on the same
      // 30fps output clock. Never use this for source video or caption sequences.
      const staticInputFilter = "loop=loop=-1:size=1:start=0,setpts=N/(30*TB),";
      const shineX = `(1080-${TITLE_SHINE_WIDTH})*mod(t,${TITLE_SHINE_SECONDS})/${TITLE_SHINE_SECONDS}`;
      // Keep the existing Rec.709 limited output contract after composition.
      const background = assertRenderableBackground(plan.visualStyle?.background);
      const rgbFilter = Boolean(plan.visualStyle?.filter?.presetId) || background.mode !== "source-blur";
      const overlayFormat = rgbFilter ? ":format=rgb" : "";
      const outputColor = rgbFilter ? "scale=out_color_matrix=bt709:out_range=tv," : "";
      const animationFilters = titleAnimationFilters({
        id: plan.visualStyle?.titleAnimation,
        titleInput: overlayInput,
        shineInput,
        sceneInput: animatedSceneInput,
        overlayFormat,
        clockRate: 1,
        staticInputFilter,
      });
      const filters = [
        `[0:v]select=concatdec_select,settb=AVTB,setpts=PTS/${PLAYBACK_RATE},fps=30:start_time=0:round=near:eof_action=round,trim=end_frame=${outputFrames}[cutv]`,
        "[1:a]asetpts=N/SR/TB[cuta]",
        `[cutv]${ffmpegFilterExpression(plan.visualStyle?.filter, { contrast: renderContrast, saturation: renderSaturation })}[graded]`,
        ...(background.mode === "source-blur"
          ? [
              `[graded]split=2[bgsrc][mainsrc]`,
              `color=c=black:s=1080x1920:r=30[black]`,
              `[bgsrc]scale=270:480:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=270:480,boxblur=12:2,scale=1080:1920:flags=bilinear,format=rgba,colorchannelmixer=aa=${background.opacity}[bgvideo]`,
              `[black][bgvideo]overlay=shortest=1${overlayFormat}[bg]`,
            ]
          : [
              `[graded]null[mainsrc]`,
              background.mode === "solid"
                ? `color=c=black:s=1080x1920:r=30,format=rgb24[bg]`
                : `[${backgroundInput}:v]${staticInputFilter}format=rgb24[bg]`,
            ]),
        `[mainsrc]${foregroundFilter()}[mainUnlit]`,
        ...(cutTransitionFilters(plan.visualStyle?.cutTransition, segments, transitionWindows, {
          spriteInput: vrInput,
          staticInputFilter,
        }) || ["[mainUnlit]null[main]"]),
        `[bg][main]overlay=0:${FOREGROUND_Y}:shortest=1${overlayFormat}[layout]`,
        ...(animationFilters || [
          `[${overlayInput}:v]${staticInputFilter}format=rgba[titlecard]`,
          `[layout][titlecard]overlay=0:0:shortest=1${overlayFormat}[baseTitles]`,
          ...(needsShineInput
            ? [
                `[${shineInput}:v]${staticInputFilter}format=rgba,crop=${TITLE_SHINE_WIDTH}:1920:x='${shineX}':y=0,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*max(0,1-abs(X-${TITLE_SHINE_WIDTH / 2})/${TITLE_SHINE_WIDTH / 2})'[shine]`,
                `[baseTitles][shine]overlay=x='${shineX}':y=0:shortest=1${overlayFormat}[titled]`,
              ]
            : [`[baseTitles]null[titled]`]),
        ]),
        ...(subtitlesPath
          ? [
              `[${subtitleInput}:v]fps=30,format=rgba[subcard]`,
              `[titled][subcard]overlay=0:0:eof_action=pass:repeatlast=0${overlayFormat}[subtitled]`,
            ]
          : []),
        `[${subtitlesPath ? "subtitled" : "titled"}]${outputColor}format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,trim=end_frame=${outputFrames}[vout]`,
        `[cuta]atempo=${PLAYBACK_RATE}[${musicAsset ? "originalaudio" : "aout"}]`,
      ];

      const buildArgs = async (videoEncoder) => {
        const hardwareRender = videoEncoder === "h264_videotoolbox";
        const args = ["-y", "-copyts"];
        if (hardwareRender && hardwareDecodeCodecs.has(source.videoCodec)) {
          args.push("-hwaccel", "videotoolbox");
        }
        args.push(
          "-an",
          "-sn",
          "-dn",
          "-f",
          "concat",
          "-safe",
          "0",
          "-segment_time_metadata",
          "1",
          "-i",
          rangeInput.list,
        );
        args.push("-f", "f32le", "-ar", "48000", "-ac", "2", "-i", rangeInput.audio);
        args.push("-framerate", "30", "-i", titleInputPath);
        if (needsShineInput) args.push("-framerate", "30", "-i", titleShinePath);
        if (subtitlesPath) args.push("-f", "concat", "-safe", "0", "-i", subtitlesPath);
        if (backgroundAsset) args.push("-framerate", "30", "-i", backgroundAsset);
        if (animatedSceneInput !== undefined) args.push("-framerate", "30", "-i", sceneAsset);
        if (hasTransitions)
          args.push("-framerate", "30", "-i", path.join(projectRoot, "public", TRANSITION_SPRITE.slice(1)));
        const renderFilters = [...filters];
        if (musicAsset) {
          const input = args.filter((a) => a === "-i").length;
          args.push("-stream_loop", "-1", "-i", musicAsset.file);
          renderFilters.push(
            ...musicMixFilters({
              input,
              settings: musicSettings,
              part,
              activity: plan.musicSpeech,
              duration: presentationDuration(part) / PLAYBACK_RATE,
            }),
          );
        }
        await writeFile(filterGraphPath, renderFilters.join(";"), { mode: 0o600 });
        args.push(
          // FFmpeg 9 reads argument files with -/option; keep large graphs off argv.
          "-/filter_complex",
          filterGraphPath,
          "-map",
          "[vout]",
          "-map",
          "[aout]",
          // OUTPUT scope, after all -i inputs and before the output filename.
          // Only rendered A/V: no source tags, chapters, subtitles/data/attachments.
          ...EXPORT_METADATA_ARGS,
          "-r",
          "30",
          "-pix_fmt",
          "yuv420p",
          "-color_range",
          "tv",
          "-colorspace",
          "bt709",
          "-color_primaries",
          "bt709",
          "-color_trc",
          "bt709",
        );
        if (hardwareRender) {
          args.push(
            "-c:v",
            "h264_videotoolbox",
            "-profile:v",
            "high",
            "-level:v",
            "4.2",
            "-b:v",
            process.env.FFMPEG_VIDEO_BITRATE || "12M",
            "-maxrate",
            process.env.FFMPEG_VIDEO_MAXRATE || "14M",
            "-bufsize",
            process.env.FFMPEG_VIDEO_BUFSIZE || "24M",
            "-spatial_aq",
            "1",
            "-realtime",
            "0",
            "-allow_sw",
            "0",
          );
        } else {
          args.push(
            "-c:v",
            videoEncoder,
            "-preset",
            process.env.FFMPEG_PRESET || "medium",
            ...(process.env.FFMPEG_CRF
              ? ["-crf", process.env.FFMPEG_CRF]
              : ["-b:v", process.env.FFMPEG_VIDEO_BITRATE || "12M"]),
            "-maxrate",
            process.env.FFMPEG_VIDEO_MAXRATE || "14M",
            "-bufsize",
            process.env.FFMPEG_VIDEO_BUFSIZE || "24M",
            "-x264-params",
            "threads=2:lookahead-threads=1",
          );
        }
        args.push(
          "-threads:v",
          "2",
          "-threads:a",
          "1",
          "-max_muxing_queue_size",
          "128",
          "-tag:v",
          "avc1",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart+write_colr",
          // Both streams are finite. Let independently concatenated source audio
          // finish rather than truncating its tail to the video frame grid.
          "-progress",
          "pipe:1",
          "-nostats",
          outputPath,
        );
        return args;
      };

      const expectedMicroseconds = (presentationDuration(part) / PLAYBACK_RATE) * 1_000_000;
      let progressBuffer = "";
      const renderOptions = {
        signal,
        filterComplexThreads: RENDER_FILTER_COMPLEX_THREADS,
        onStdout(chunk) {
          progressBuffer += chunk;
          const lines = progressBuffer.split(/\r?\n/);
          progressBuffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("out_time_us=")) continue;
            const current = Number(line.slice("out_time_us=".length));
            if (Number.isFinite(current) && expectedMicroseconds > 0)
              onProgress(Math.min(1, current / expectedMicroseconds));
          }
        },
      };
      let encoderUsed = preferredVideoEncoder;
      onEncoder(encoderUsed, false);
      try {
        await run(ffmpeg, await buildArgs(encoderUsed), renderOptions);
      } catch (error) {
        signal?.throwIfAborted();
        if (encoderUsed !== "h264_videotoolbox") throw error;
        encoderUsed = "libx264";
        onEncoder(encoderUsed, true);
        progressBuffer = "";
        await run(ffmpeg, await buildArgs(encoderUsed), renderOptions);
      }
      onProgress(1);
      return encoderUsed;
    } finally {
      await rangeInput.dispose();
      await rm(filterGraphPath, { force: true });
    }
  }
  return { renderPart };
}
