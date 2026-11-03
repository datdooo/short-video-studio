"use client";
import { workerFetch, type WorkerHealth } from "@/lib/api/worker-client";
import { useEffect, useState } from "react";
export function useWorkerHealth() {
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  useEffect(() => {
    let active = true,
      pending = false;
    const controller = new AbortController();
    async function checkWorker() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await workerFetch(`/health`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        const data = (await response.json()) as WorkerHealth;
        const next = response.ok ? data : null;
        if (active)
          setWorkerHealth((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
      } catch {
        if (active) setWorkerHealth(null);
      } finally {
        pending = false;
      }
    }
    void checkWorker();
    const timer = window.setInterval(checkWorker, 5_000);
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void checkWorker();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);
  return workerHealth;
}
