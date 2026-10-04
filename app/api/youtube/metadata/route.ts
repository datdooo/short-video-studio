import { NextResponse } from "next/server";

export const runtime = "edge";

function parseYouTubeUrl(rawUrl: string) {
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    throw new Error("URL phải thuộc youtube.com hoặc youtu.be.");
  }

  let videoId = "";
  if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  if (host === "youtube.com" || host === "m.youtube.com") {
    videoId = url.searchParams.get("v") || "";
    if (!videoId) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) videoId = parts[1] || "";
    }
  }

  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    throw new Error("Không tìm thấy YouTube video ID hợp lệ.");
  }

  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export async function GET(request: Request) {
  try {
    const rawUrl = new URL(request.url).searchParams.get("url")?.trim();
    if (!rawUrl) return NextResponse.json({ error: "Thiếu YouTube URL." }, { status: 400 });

    const parsed = parseYouTubeUrl(rawUrl);
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", parsed.canonicalUrl);
    endpoint.searchParams.set("format", "json");

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit);
    if (!response.ok) {
      return NextResponse.json({ error: "Không lấy được metadata của video này." }, { status: response.status === 404 ? 404 : 502 });
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title) return NextResponse.json({ error: "YouTube không trả về title." }, { status: 502 });

    return NextResponse.json({
      videoId: parsed.videoId,
      title: data.title,
      channelName: data.author_name || "",
      thumbnailUrl: data.thumbnail_url || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube URL không hợp lệ.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
