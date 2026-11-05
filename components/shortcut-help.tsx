"use client";
import { Button } from "./ui/button";
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
        <Button
          variant="secondary"
          size="icon"
          tooltip="Trợ giúp · ?"
          type="button"
          aria-label="Trợ giúp và phím tắt"
          title="Trợ giúp · ?"
        >
          ?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Trợ giúp</DialogTitle>
        <DialogDescription>Phím điều khiển preview và lịch sử không chạy khi đang nhập văn bản.</DialogDescription>
        <h3>Phím tắt</h3>
        <dl className="space-y-2 text-sm">
          <div>⌘/Ctrl + S — Lưu phiên</div>
          <div>⌘/Ctrl + Z — Hoàn tác chỉnh cut</div>
          <div>⌘/Ctrl + Shift + Z — Làm lại</div>
          <div>Space — Phát / dừng preview</div>
          <div>Esc — Đóng hộp thoại</div>
          <div>? — Mở trợ giúp này</div>
        </dl>
        <h3>Lưu ý</h3>
        <ul className="space-y-2 text-sm">
          <li>Gửi TXT + video cho AI, rồi dán JSON vào ô kết quả.</li>
          <li>Video và render cũ hơn 3 ngày tự động bị xoá (trừ mục đang dùng).</li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
