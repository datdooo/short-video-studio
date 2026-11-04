"use client";
import { Button } from "./ui/button";
import { useRef, useState } from "react";
import { Files, Trash2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
export function PreservedDrafts({
  drafts,
  onOpen,
  onDelete,
  onClearAll,
  disabled = false,
}: {
  drafts: { key: string; label: string }[];
  onOpen: (key: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  disabled?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function run(action: () => Promise<void>, reopen: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setOpen(false);
    try {
      await action();
    } finally {
      pending.current = false;
      setBusy(false);
      if (reopen) setOpen(true);
    }
  }
  const act = (key: string, remove: boolean) => run(() => (remove ? onDelete(key) : onOpen(key)), remove);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm"
          type="button"
          className="studio-session-drafts"
          disabled={disabled || busy}
          aria-label={`Bản nháp đã giữ (${drafts.length})`}
          title="Mở, xóa hoặc xóa tất cả bản nháp đã giữ"
        >
          <Files size={14} aria-hidden="true" />
          Bản nháp
          {drafts.length > 0 && <span className="studio-draft-count">{drafts.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        collisionPadding={12}
        className="studio-preserved-drafts"
        aria-label="Bản nháp đã giữ"
      >
        <p className="studio-preserved-drafts-heading">Bản nháp đã giữ ({drafts.length})</p>
        {drafts.length === 0 ? (
          <p className="studio-preserved-drafts-empty">Chưa có bản nháp đã giữ.</p>
        ) : (
          <ul>
            {drafts.map((draft) => (
              <li key={draft.key}>
                <span title={draft.label}>{draft.label}</span>
                <Button variant="secondary" type="button" disabled={busy} onClick={() => void act(draft.key, false)}>
                  Mở
                </Button>
                <Button variant="destructive"
                  type="button"
                  disabled={busy}
                  aria-label={`Xóa bản nháp ${draft.label}`}
                  onClick={() => void act(draft.key, true)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Xóa
                </Button>
              </li>
            ))}
          </ul>
        )}
        {drafts.length > 0 && (
          <div className="studio-preserved-drafts-footer">
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              onClick={() => void run(onClearAll, true)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Xóa tất cả ({drafts.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
