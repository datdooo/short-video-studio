"use client";
import { Button } from "@/components/ui/button";

import { attemptSessionCheckpoint } from "@/lib/session-checkpoint";
import { useLayoutEffect, useRef } from "react";
export type EditorErrorProps = { error: Error & { digest?: string }; retry?: () => void; reset: () => void };
export default function EditorError({ retry, reset }: EditorErrorProps) {
  const notice = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => { const error = attemptSessionCheckpoint(); if (error && notice.current) notice.current.textContent = error; }, []);
  return <main role="alert" className="studio-error"><h1>Phiên chỉnh sửa gặp lỗi</h1><p ref={notice}>Đã thử ghi checkpoint để giữ phiên chỉnh sửa.</p><Button variant="secondary" size="md" type="button" onClick={retry || reset}>Thử lại</Button></main>;
}
