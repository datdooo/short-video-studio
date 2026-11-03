"use client";
import { Button } from "./ui/button";
import { StatusChip } from "./ui/status-chip";
import Image from "next/image";
import { ShortcutHelp } from "./shortcut-help";
import { BETA_RELEASE } from "../desktop/beta-release.mjs";
import { Cloud, CloudOff, Save, Film, LayoutGrid, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import type { ReactNode } from "react";
export type SaveState = "idle" | "restoring" | "saving" | "saved" | "dirty" | "error";
export function StudioHeader({
  workspace,
  onWorkspace,
  workerReady,
  providerLabel,
  providerReady,
  drafts,
  saveState,
  saveMessage,
  onSave,
  saveBlocked,
  onNewSession,
  ready,
}: {
  workspace: "editor" | "batch" | "storage";
  onWorkspace: (value: "editor" | "batch" | "storage") => void;
  workerReady: boolean;
  providerLabel: string;
  providerReady: boolean;
  drafts?: ReactNode;
  saveState: SaveState;
  saveMessage: string;
  onSave: () => void;
  saveBlocked: boolean;
  onNewSession: () => void;
  ready: boolean;
}) {
  const [confirmNew, setConfirmNew] = useState(false);
  const tabs: { id: "editor" | "batch" | "storage"; label: string; icon: ReactNode }[] = [
    { id: "editor", label: "Editor", icon: <Film size={14} /> },
    { id: "batch", label: "Batch", icon: <LayoutGrid size={14} /> },
    { id: "storage", label: "Kho", icon: <FolderOpen size={14} /> },
  ];
  return (
    <header className="studio-header">
      <strong className="studio-brand">
        <Image
          unoptimized
          loading="eager"
          src="/favicon.svg?v=play-3"
          width={32}
          height={32}
          alt="Logo ShortCut Studio"
          className="studio-brand-logo"
        />{" "}
        ShortCut Studio <span>BETA {BETA_RELEASE.version}</span>
      </strong>
      <nav aria-label="Chế độ làm việc" className="studio-workspaces">
        {tabs.map((tab) => (
          <Button variant="segmented"
            data-state={workspace === tab.id ? "active" : "inactive"}
            type="button"
            key={tab.id}
            aria-current={workspace === tab.id ? "page" : undefined}
            onClick={() => onWorkspace(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </nav>
      <div className="studio-header-status">
        <StatusChip
          tone={workerReady ? "success" : "warning"}
          role="status"
          title={workerReady ? "Media worker đang kết nối" : "Media worker chưa kết nối"}
          className={workerReady ? "studio-connected" : "studio-warning"}
        >
          {workerReady ? <Cloud size={13} /> : <CloudOff size={13} />}
          <span>{workerReady ? "Worker sẵn sàng" : "Mất kết nối"}</span>
        </StatusChip>
        <StatusChip
          tone={providerReady ? "success" : "warning"}
          className={`studio-provider-status ${providerReady ? "studio-connected" : "studio-warning"}`}
          title="Trạng thái cấu hình/đăng nhập; không đồng nghĩa đã kiểm chứng inference."
        >
          {providerLabel}
        </StatusChip>
        {drafts}
        <Button variant="secondary" size="sm"
          type="button"
          className="studio-session-save"
          data-unsaved={saveState === "dirty" || saveState === "error"}
          disabled={!ready || saveBlocked || saveState === "saving" || saveState === "restoring"}
          onClick={onSave}
          aria-label={saveState === "saved" ? "Đã lưu phiên chỉnh sửa" : "Lưu phiên chỉnh sửa"}
          aria-keyshortcuts="Meta+S Control+S"
          aria-busy={saveState === "saving"}
          title={
            saveBlocked
              ? "Giữ bản gốc chưa đọc được trước khi lưu thay thế."
              : saveState === "error"
                ? saveMessage
                : "Lưu · ⌘/Ctrl+S"
          }
        >
          <Save size={13} aria-hidden="true" />
          {saveState === "saved" ? <StatusChip tone="success">Đã lưu</StatusChip> : saveState === "saving" ? "Đang lưu…" : "Lưu"}
        </Button>
        <Popover open={confirmNew} onOpenChange={setConfirmNew}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" type="button" disabled={!ready}>
              Phiên mới
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="studio-new-session-popover">
            <p className="font-semibold">Tạo phiên mới?</p>
            <p className="mt-2 text-xs">Bỏ bản nháp đang chỉnh. Giữ video nguồn, nhạc, MP4 đã xuất và job worker.</p>
            <div className="studio-action-row mt-3 flex justify-end gap-2">
              <Button variant="secondary" type="button" className="studio-ghost" onClick={() => setConfirmNew(false)}>
                Hủy
              </Button>
              <Button variant="destructive"
                type="button"
                onClick={() => {
                  setConfirmNew(false);
                  onNewSession();
                }}
              >
                Bỏ nháp & tạo mới
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <ShortcutHelp />
      </div>
    </header>
  );
}
