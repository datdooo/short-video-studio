"use client";
import { useRef, useState } from "react";
import { Files, Trash2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
export function PreservedDrafts({
  drafts,
  onOpen,
  onDelete,
  disabled = false,
}: {
  drafts: { key: string; label: string }[];
  onOpen: (key: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  disabled?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function act(key: string, remove: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setOpen(false);
    try {
      await (remove ? onDelete(key) : onOpen(key));
    } finally {
      pending.current = false;
      setBusy(false);
      if (remove) setOpen(true);
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="studio-session-drafts"
          disabled={disabled || busy}
          aria-label={`Bản nháp đã giữ (${drafts.length})`}
          title="Mở hoặc xóa bản nháp đã giữ"
        >
          <Files size={14} aria-hidden="true" />
          Bản nháp
          {drafts.length > 0 && <span className="studio-draft-count">{drafts.length}</span>}
        </button>
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
                <button type="button" disabled={busy} onClick={() => void act(draft.key, false)}>
                  Mở
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Xóa bản nháp ${draft.label}`}
                  onClick={() => void act(draft.key, true)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
