"use client";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
export function PreservedDrafts({
  drafts,
  onOpen,
  onDelete,
}: {
  drafts: { key: string; label: string }[];
  onOpen: (key: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  async function act(key: string, remove: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await (remove ? onDelete(key) : onOpen(key));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="studio-preserved-drafts">
      <summary>Bản nháp đã giữ ({drafts.length})</summary>
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
    </details>
  );
}
