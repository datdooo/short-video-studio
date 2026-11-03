"use client";
import { Button } from "@/components/ui/button";

import { Disclosure, DisclosureTrigger } from "@/components/ui/disclosure";

import { Fragment, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEditorDraft } from "./editor-draft-context";
import type { ReactNode } from "react";
import type { EditPlan, EditPart } from "@/lib/edit-plan";
import { hookRangeKey } from "@/lib/teaser-hooks.mjs";
import { MAX_MAIN_RANGES, mainRangeRows, inspectMainRanges } from "@/lib/main-ranges.mjs";
import type { MainRangeRow } from "@/lib/main-ranges.mjs";

type Props = {
  statusTarget?: HTMLElement | null;
  active?: boolean;
  children?: ReactNode;
  plan: EditPlan;
  part: EditPart;
  duration: number;
  onSeek?: (index: number) => void;
  onEdit: (id: number, rows: MainRangeRow[], expectedKey: string, group?: string) => void;
  onHistoryBoundary?: () => void;
  onDraft: (id: number, key: string, invalid: boolean) => void;
  onRestore: (id: number) => void;
  onInvalidate: () => void;
};
export function MainRangesEditor({
  statusTarget,
  active = true,
  plan,
  part,
  duration,
  onEdit,
  onDraft,
  onRestore,
  onInvalidate,
  children,
  onSeek,
  onHistoryBoundary,
}: Props) {
  const key = hookRangeKey(part);
  const [draft, setDraft] = useEditorDraft<{ key: string; appliedKey?: string; rows: MainRangeRow[] } | null>(
    `main-${part.id}`,
    null,
    (v) =>
      v === null ||
      (!!v &&
        typeof v === "object" &&
        "key" in v &&
        typeof v.key === "string" &&
        "rows" in v &&
        Array.isArray(v.rows) &&
        v.rows.length <= MAX_MAIN_RANGES &&
        v.rows.every(
          (r) =>
            r &&
            typeof r.start === "string" &&
            typeof r.end === "string" &&
            (r.exactStart === undefined || Number.isFinite(r.exactStart)) &&
            (r.exactEnd === undefined || Number.isFinite(r.exactEnd)),
        )),
  );
  const [ownApplied, setOwnApplied] = useState<string | null>(null);
  const rows =
    draft && (draft.key === key || draft.appliedKey === key || ownApplied === key) ? draft.rows : mainRangeRows(part);
  const checked = inspectMainRanges(plan, part.id, rows, duration),
    invalid = Boolean(checked.error || checked.errors.some(Boolean));
  const report = useRef(onDraft);
  useEffect(() => {
    report.current = onDraft;
  }, [onDraft]);
  useEffect(() => {
    report.current(part.id, key, invalid);
  }, [part.id, key, invalid]);
  function edit(next: MainRangeRow[], group?: string) {
    onInvalidate();
    setOwnApplied(null);
    const result = inspectMainRanges(plan, part.id, next, duration),
      bad = Boolean(result.error || result.errors.some(Boolean));
    setDraft({
      key,
      rows: next,
      ...(!bad ? { appliedKey: JSON.stringify(result.ranges.map((r) => [r.start, r.end])) } : {}),
    });
    onDraft(part.id, key, bad);
    if (!bad) {
      setOwnApplied(JSON.stringify(result.ranges.map((r) => [r.start, r.end])));
      onEdit(part.id, next, key, group);
    }
  }
  return (
    <section hidden={!active} className="mt-3 min-w-0 space-y-2" aria-label={`Timeline Part ${part.id}`}>
      {children}
      <div className="studio-main-editor min-w-0 space-y-2 text-xs">
        <div className="studio-teaser-header">
          <h4 className="font-semibold">Nội dung chính</h4>
        </div>
        <div
          className="studio-main-range-row grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] gap-1.5 text-xs text-zinc-500"
          aria-hidden="true"
        >
          <span>Đoạn</span>
          <span>Bắt đầu</span>
          <span>Kết thúc</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <Fragment key={i}>
            <div className="studio-main-range-row grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-1.5">
              <span className="text-xs text-zinc-400">{i + 1}</span>
              {(["start", "end"] as const).map((boundary) => (
                <input
                  key={boundary}
                  aria-label={`Part ${part.id} đoạn ${i + 1} ${boundary === "start" ? "Bắt đầu" : "Kết thúc"}`}
                  aria-invalid={Boolean(checked.errors[i])}
                  aria-describedby={checked.errors[i] ? `main-${part.id}-${i}-error` : undefined}
                  inputMode="text"
                  placeholder="00:00:00:00"
                  title="HH:MM:SS:FF · 30 FPS"
                  autoComplete="off"
                  spellCheck={false}
                  className="studio-input w-full min-w-0 px-1.5 py-2 font-mono text-xs"
                  value={row[boundary]}
                  onFocus={onHistoryBoundary}
                  onBlur={onHistoryBoundary}
                  onChange={(e) =>
                    edit(
                      rows.map((r, j) =>
                        i === j
                          ? {
                              ...r,
                              [boundary]: e.target.value,
                              [boundary === "start" ? "exactStart" : "exactEnd"]: undefined,
                              timecode: true,
                            }
                          : r,
                      ),
                      `main:${part.id}:${i}:${boundary}`,
                    )
                  }
                />
              ))}
              <div className="studio-main-range-actions flex items-center justify-start gap-1">
                {onSeek && (
                  <Button variant="ghost" size="md"
                    type="button"
                    disabled={invalid}
                    className="studio-ghost"
                    title="Tới đoạn này trong preview 1×"
                    onClick={() => onSeek(i)}
                  >
                    Xem
                  </Button>
                )}
                <Button variant="destructive" size="icon"
                  type="button"
                  aria-label={`Xóa đoạn ${i + 1} Part ${part.id}`}
                  title="Xóa đoạn"
                  data-control-size="icon"
                  className="rounded border border-white/15 py-2 text-sm focus-visible:outline-2 focus-visible:outline-white"
                  onClick={() => edit(rows.filter((_, j) => j !== i))}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Fragment>
        ))}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <Button variant="secondary" size="md"
            type="button"
            disabled={rows.length >= MAX_MAIN_RANGES}
            className="rounded border border-white/15 px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
            onClick={() => edit([...rows, { start: "", end: "", timecode: true }])}
          >
            + Thêm đoạn
          </Button>
          <Button variant="secondary" size="md"
            type="button"
            disabled={!part.aiMainRanges}
            title={!part.aiMainRanges ? "Chưa có bản cắt AI để khôi phục." : undefined}
            className="rounded border border-white/15 px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
            onClick={() => {
              setDraft(null);
              setOwnApplied(null);
              onDraft(part.id, key, false);
              onRestore(part.id);
            }}
          >
            Dùng lại bản AI
          </Button>
        </div>
      </div>
      {active &&
        invalid &&
        statusTarget &&
        createPortal(
          <div className="studio-timeline-notice" role="status">
            <span>Part {part.id} · Mốc Main chưa hợp lệ.</span>
            <Disclosure>
              <DisclosureTrigger>Chi tiết</DisclosureTrigger>
              {checked.error && <p>{checked.error}</p>}
              {checked.errors.map((message, i) =>
                message ? (
                  <p key={i} id={`main-${part.id}-${i}-error`}>
                    Đoạn {i + 1}: {message}
                  </p>
                ) : null,
              )}
            </Disclosure>
          </div>,
          statusTarget,
        )}
    </section>
  );
}
