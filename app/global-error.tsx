"use client";
import EditorError, { type EditorErrorProps } from "./error";
export default function GlobalError(props: EditorErrorProps) {
  return <html lang="vi"><body><EditorError {...props} /></body></html>;
}
