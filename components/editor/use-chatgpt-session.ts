"use client";
import { workerFetch, type ChatGPTSession } from "@/lib/api/worker-client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
export function useChatGPTSession(workerReady: boolean, setError: Dispatch<SetStateAction<string>>) {
  const [chatGPTSession, setChatGPTSession] = useState<ChatGPTSession | null>(null);
  const [isChatGPTConnecting, setIsChatGPTConnecting] = useState(false);
  const [isChatGPTDisconnecting, setIsChatGPTDisconnecting] = useState(false);
  const chatGPTAction = useRef<AbortController | null>(null),
    chatGPTSessionRevision = useRef(0);
  useEffect(
    () => () => {
      chatGPTSessionRevision.current++;
      chatGPTAction.current?.abort();
      chatGPTAction.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!workerReady) {
      const timer = window.setTimeout(() => setChatGPTSession(null), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    const controller = new AbortController(),
      revision = chatGPTSessionRevision.current;
    workerFetch(`/api/chatgpt/session`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
    })
      .then(async (response) => {
        const data = (await response.json()) as { session?: ChatGPTSession };
        if (active && revision === chatGPTSessionRevision.current && response.ok && data.session)
          setChatGPTSession(data.session);
      })
      .catch(() => {
        if (active && revision === chatGPTSessionRevision.current) setChatGPTSession(null);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [workerReady]);
  async function readChatGPTSession(signal: AbortSignal, revision: number) {
    const response = await workerFetch(`/api/chatgpt/session`, {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    });
    const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
    if (!response.ok || !data.session) throw new Error(data.error || "Không đọc được ChatGPT session.");
    signal.throwIfAborted();
    if (revision === chatGPTSessionRevision.current) setChatGPTSession(data.session);
    return data.session;
  }
  async function connectChatGPT() {
    if (chatGPTAction.current) return;
    setError("");
    if (!workerReady) {
      setError("Media worker đang offline. Chạy `npm run personal` trước.");
      return;
    }
    const controller = new AbortController(),
      revision = ++chatGPTSessionRevision.current;
    chatGPTAction.current = controller;
    const current = () => chatGPTAction.current === controller && !controller.signal.aborted;
    let popup: Window | null = null;
    let attemptId: string | undefined;
    setIsChatGPTConnecting(true);
    try {
      popup = window.open("about:blank", "shortcut-chatgpt", "popup,width=560,height=760");
      if (!popup) throw new Error("Trình duyệt đang chặn popup. Cho phép popup rồi thử lại.");
      const response = await workerFetch(`/api/chatgpt/auth/start`, {
        method: "POST",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
      });
      const data = (await response.json()) as { url?: string; attemptId?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Không bắt đầu được ChatGPT sign-in.");
      controller.signal.throwIfAborted();
      attemptId = data.attemptId;
      if (!attemptId) throw new Error("Worker chưa hỗ trợ trạng thái đăng nhập. Khởi động Beta bản mới.");
      popup.location.href = data.url;

      for (let attempt = 0; attempt < 360; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        controller.signal.throwIfAborted();
        const statusResponse = await workerFetch(
          `/api/chatgpt/auth/status?attemptId=${encodeURIComponent(attemptId)}`,
          { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) },
        );
        const auth = (await statusResponse.json()) as { status: string; error?: string };
        if (!statusResponse.ok)
          throw Error(auth.error || `Không đọc được trạng thái đăng nhập (HTTP ${statusResponse.status}).`);
        if (["failed", "cancelled", "expired"].includes(auth.status))
          throw new Error(auth.error || "Đăng nhập bị hủy/hết hạn.");
        if (auth.status !== "exchanging" && popup.closed && auth.status !== "connected")
          throw new Error("Bạn đã đóng cửa sổ đăng nhập. Bấm kết nối lại khi sẵn sàng.");
        if (auth.status === "connected") {
          const session = await readChatGPTSession(controller.signal, revision);
          if (!session.sharing)
            setError(
              "Đã đăng nhập nhưng ChatGPT plan usage chưa được cấp quyền. Bấm kết nối lại và cho phép plan usage.",
            );
          return;
        }
      }
      throw new Error("ChatGPT sign-in hết thời gian chờ. Hãy thử lại.");
    } catch (caughtError) {
      popup?.close();
      if (current()) setError(caughtError instanceof Error ? caughtError.message : "Không kết nối được ChatGPT.");
    } finally {
      if (attemptId)
        void workerFetch(`/api/chatgpt/auth/status?attemptId=${encodeURIComponent(attemptId)}`, {
          method: "DELETE",
        }).catch(() => {});
      if (chatGPTAction.current === controller) {
        chatGPTAction.current = null;
        setIsChatGPTConnecting(false);
      }
    }
  }
  async function disconnectChatGPT() {
    if (chatGPTAction.current) return;
    const controller = new AbortController();
    chatGPTAction.current = controller;
    chatGPTSessionRevision.current++;
    const current = () => chatGPTAction.current === controller && !controller.signal.aborted;
    setIsChatGPTDisconnecting(true);
    setError("");
    try {
      const response = await workerFetch(`/api/chatgpt/session`, {
        method: "DELETE",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
      });
      const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || "Không disconnect được ChatGPT.");
      if (current()) setChatGPTSession(data.session);
    } catch (caughtError) {
      if (current()) setError(caughtError instanceof Error ? caughtError.message : "Không disconnect được ChatGPT.");
    } finally {
      if (chatGPTAction.current === controller) {
        chatGPTAction.current = null;
        setIsChatGPTDisconnecting(false);
      }
    }
  }
  return { chatGPTSession, isChatGPTConnecting, isChatGPTDisconnecting, connectChatGPT, disconnectChatGPT };
}
