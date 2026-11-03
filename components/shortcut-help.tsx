"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (target instanceof HTMLElement && target.closest('input,textarea,select,[contenteditable="true"]'))
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Phím tắt" title="Phím tắt · ?">
          ?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Phím tắt</DialogTitle>
        <DialogDescription>Phím điều khiển preview và lịch sử không chạy khi đang nhập văn bản.</DialogDescription>
        <dl className="space-y-2 text-sm">
          <div>⌘/Ctrl + S — Lưu phiên</div>
          <div>⌘/Ctrl + Z — Hoàn tác chỉnh cut</div>
          <div>⌘/Ctrl + Shift + Z — Làm lại</div>
          <div>Space — Phát / dừng preview</div>
          <div>Esc — Đóng hộp thoại</div>
          <div>? — Mở danh sách phím tắt</div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
