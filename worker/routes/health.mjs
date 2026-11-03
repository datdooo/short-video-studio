// Extracted route bodies retain their original order and response contracts.
export function createHealthRoutes({
  FOREGROUND_SCALE,
  PLAYBACK_RATE,
  codexPeek,
  dataRoot,
  exportBusy,
  ffmpeg,
  ffprobe,
  mediaResources,
  preferredVideoEncoder,
  renderContrast,
  renderSaturation,
  sendJson,
  versions,
}) {
  return [
    {
      order: 1,
      condition: 'request.method === "GET" && requestUrl.pathname === "/health"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/health") {
          sendJson(request, response, 200, {
            ok: Boolean(ffmpeg && ffprobe),
            readyForYouTube: Boolean(ffmpeg && ffprobe),
            // Never spawns the CLI here: /health is polled every few seconds.
            codex: codexPeek(),
            tools: versions,
            render: {
              playbackRate: PLAYBACK_RATE,
              foregroundScale: FOREGROUND_SCALE,
              contrast: renderContrast,
              saturation: renderSaturation,
              encoder: preferredVideoEncoder,
              hardwareAccelerated: preferredVideoEncoder === "h264_videotoolbox",
              videoBitrate: process.env.FFMPEG_VIDEO_BITRATE || "12M",
              videoMaxrate: process.env.FFMPEG_VIDEO_MAXRATE || "14M",
              videoBufsize: process.env.FFMPEG_VIDEO_BUFSIZE || "24M",
              label: preferredVideoEncoder === "h264_videotoolbox" ? "Apple VideoToolbox" : preferredVideoEncoder,
              colorSpace: "Rec.709",
              resources: { ...mediaResources.state(), renderBusy: exportBusy() },
            },
            dataRoot,
          });
          return;
        }
        return false;
      },
    },
  ];
}
