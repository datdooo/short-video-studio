"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The Editor remains an owner while viewing Batch/Kho. This is presence only;
// raw draft / source media / authentication are never stored by the lease.
export function useEditorSourceLease(worker: string, sourceId: string, ready: boolean) {
  const owner = useRef(""),
    revision = useRef(0),
    current = useRef({ sourceId, ready }),
    live = useRef(true);
  useLayoutEffect(() => {
    current.current = { sourceId, ready };
  }, [sourceId, ready]);
  const pending = useRef<{ sourceId: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const [failure, setFailure] = useState({ sourceId: "", message: "" });
  const ensureCurrent = useCallback(async () => {
    const target = current.current;
    if (!target.ready) throw Error("Chưa kết nối worker để kiểm tra nguồn Editor.");
    // Before deleting after New Session, await release of our previous source;
    // do not race an unacknowledged pagehide/cleanup beacon.
    if (!target.sourceId && !owner.current) return;
    if (pending.current?.sourceId === target.sourceId) return pending.current.promise;
    owner.current ||= crypto.randomUUID();
    const ticket = ++revision.current,
      controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await fetch(`${worker}/api/editor/source-lease`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          body: JSON.stringify({ ownerId: owner.current, sourceId: target.sourceId || null, revision: ticket }),
        });
        const result = (await response.json()) as { accepted?: boolean; error?: string };
        if (!response.ok || !result.accepted) throw Error(result.error || "Chưa xác nhận được bảo vệ nguồn Editor.");
        if (ticket !== revision.current || target.sourceId !== current.current.sourceId)
          throw new DOMException("Phiên Editor đã đổi.", "AbortError");
        if (live.current)
          setFailure((previous) =>
            previous.sourceId === target.sourceId && !previous.message
              ? previous
              : { sourceId: target.sourceId, message: "" },
          );
      } catch (caught) {
        if (live.current && ticket === revision.current && target.sourceId === current.current.sourceId) {
          const message = caught instanceof Error ? caught.message : "Chưa bảo vệ được nguồn Editor.";
          setFailure((previous) =>
            previous.sourceId === target.sourceId && previous.message === message
              ? previous
              : { sourceId: target.sourceId, message },
          );
        }
        throw caught;
      } finally {
        if (pending.current?.controller === controller) pending.current = null;
      }
    });
    pending.current = { sourceId: target.sourceId, controller, promise };
    return promise;
  }, [worker]);
  useEffect(() => {
    live.current = true;
    const release = () => {
      pending.current?.controller.abort();
      pending.current = null;
      if (!owner.current) return;
      const body = JSON.stringify({ ownerId: owner.current, sourceId: null, revision: ++revision.current });
      const url = `${worker}/api/editor/source-lease`;
      let sent = false;
      try {
        sent = navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" })) === true;
      } catch {
        /* TTL also releases crashed/unreachable renderers. */
      }
      if (!sent)
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
    };
    const renew = () => {
      if (current.current.ready && current.current.sourceId) void ensureCurrent().catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === "visible") renew();
    };
    renew();
    const timer = ready && sourceId ? window.setInterval(renew, 20_000) : undefined;
    window.addEventListener("focus", renew);
    window.addEventListener("pageshow", renew);
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", visible);
    return () => {
      live.current = false;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", renew);
      window.removeEventListener("pageshow", renew);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", visible);
      release();
    };
  }, [worker, sourceId, ready, ensureCurrent]);
  return { ensureCurrent, error: sourceId && ready && failure.sourceId === sourceId ? failure.message : "" };
}
