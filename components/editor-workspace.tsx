"use client";
import { Button } from "@/components/ui/button";

import { UI_STRINGS } from "@/lib/ui-strings";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PanelLeft, PanelRight, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

type Side = "source" | "inspector";
// Retire only the exact size keys this component previously owned. Editor
// session/drafts/media and unrelated localStorage values are never touched.
const retiredLayouts = [
  ["shortcut-prototype-wide-v1", "source:preview:inspector"],
  ["shortcut-prototype-vertical-v1", "source:preview:inspector"],
  ["shortcut-prototype-center-v1", "preview-area:timeline-area"],
];

// UI exception drawer-backdrop: full drawer dismissal surface, outside the keyboard tab order.
export function EditorWorkspace({
  source,
  preview,
  timeline,
  inspector,
  status,
  visible = true,
}: {
  source: ReactNode;
  preview: ReactNode;
  timeline: ReactNode;
  inspector: ReactNode;
  status: ReactNode;
  visible?: boolean;
}) {
  const [narrow, setNarrow] = useState(false);
  const [collapsed, setCollapsed] = useState({ source: false, inspector: false });
  const [drawer, setDrawer] = useState<Side | null>(null);
  const sourcePanel = useRef<HTMLDivElement | null>(null),
    inspectorPanel = useRef<HTMLDivElement | null>(null);
  const sourceToggle = useRef<HTMLButtonElement | null>(null),
    inspectorToggle = useRef<HTMLButtonElement | null>(null);
  const sourceClose = useRef<HTMLButtonElement | null>(null),
    inspectorClose = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      for (const [id, panels] of retiredLayouts) {
        localStorage.removeItem(`react-resizable-panels:${id}`);
        localStorage.removeItem(`react-resizable-panels:${id}:${panels}`);
      }
    } catch {
      /* Disabled storage must not prevent layout or draft editing. */
    }
    const query = matchMedia("(max-width: 1050px)");
    const update = () => {
      // Closing a drawer at a breakpoint must not leave focus in hidden content.
      if (sourcePanel.current?.contains(document.activeElement)) sourceToggle.current?.focus();
      else if (inspectorPanel.current?.contains(document.activeElement)) inspectorToggle.current?.focus();
      setNarrow(query.matches);
      setDrawer(null);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const sourceOpen = narrow ? drawer === "source" : !collapsed.source;
  const inspectorOpen = narrow ? drawer === "inspector" : !collapsed.inspector;
  function closeDrawer() {
    const previous = drawer;
    setDrawer(null);
    if (previous === "source") sourceToggle.current?.focus();
    else if (previous === "inspector") inspectorToggle.current?.focus();
  }
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setDrawer(null);
  }
  useEffect(() => {
    if (!visible) return;
    if (!narrow || !drawer) return;
    const panel = (drawer === "source" ? sourcePanel : inspectorPanel).current;
    if (!panel) return;
    // Match the pointer-blocking backdrop for keyboard/assistive technology.
    // Keep existing inert values, mounted drafts, and portalled Select/Popover
    // content intact; only the surrounding page branches are disabled here.
    const background: HTMLElement[] = [];
    for (
      let branch: HTMLElement = panel;
      branch.parentElement && branch !== document.body;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (
          !(sibling instanceof HTMLElement) ||
          sibling === branch ||
          sibling.inert ||
          sibling.classList.contains("studio-drawer-backdrop")
        )
          continue;
        sibling.setAttribute("inert", "");
        background.push(sibling);
      }
    }
    (drawer === "source" ? sourceClose : inspectorClose).current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawer(null);
        (drawer === "source" ? sourceToggle : inspectorToggle).current?.focus();
        return;
      }
      // Nested portalled controls manage their own focus scope. Once focus is
      // back in this drawer, Tab must not fall through to browser/background UI.
      if (
        event.key !== "Tab" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !panel.contains(document.activeElement)
      )
        return;
      const tabbable = Array.from(
        panel.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]"),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[inert],[hidden]") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      const first = tabbable[0],
        last = tabbable[tabbable.length - 1];
      if (!first) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Bubble: nested Select/Popover can consume Escape before closing the drawer.
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      const restoreFocus = panel.contains(document.activeElement) || document.activeElement === document.body;
      for (const element of background) element.removeAttribute("inert");
      const trigger = (drawer === "source" ? sourceToggle : inspectorToggle).current;
      if (restoreFocus && trigger && trigger.getClientRects().length > 0 && !trigger.closest("[inert],[hidden]"))
        trigger.focus();
    };
  }, [narrow, drawer, visible]);
  function toggle(side: Side) {
    if (narrow) setDrawer((current) => (current === side ? null : side));
    else setCollapsed((current) => ({ ...current, [side]: !current[side] }));
  }

  return (
    <div className="editor-workspace">
      <div className="studio-fixed-columns" data-source-open={sourceOpen} data-inspector-open={inspectorOpen}>
        {narrow && drawer && visible && (
          <button data-ui-exception="drawer-backdrop"
            type="button"
            tabIndex={-1}
            className="studio-drawer-backdrop"
            aria-label="Đóng panel"
            onClick={closeDrawer}
          />
        )}
        <div
          id="studio-source-column"
          ref={sourcePanel}
          className="studio-side-panel studio-source-column"
          data-drawer-open={narrow && drawer === "source" && visible}
          inert={!sourceOpen || !visible}
          aria-hidden={!sourceOpen || !visible}
          role={narrow && drawer === "source" && visible ? "dialog" : undefined}
          aria-modal={narrow && drawer === "source" && visible ? true : undefined}
          aria-labelledby={narrow && drawer === "source" && visible ? "studio-source-drawer-title" : undefined}
          tabIndex={-1}
        >
          <div className="studio-drawer-heading">
            <strong id="studio-source-drawer-title">Nguồn và AI</strong>
            <Button variant="icon" size="icon" ref={sourceClose} type="button" aria-label="Đóng nguồn" onClick={closeDrawer}>
              <X size={16} />
            </Button>
          </div>
          <EditorSourcePanel>{source}</EditorSourcePanel>
        </div>
        <EditorPreviewPanel preview={preview} timeline={timeline} />
        <div
          id="studio-inspector-column"
          ref={inspectorPanel}
          className="studio-side-panel studio-inspector-column"
          data-drawer-open={narrow && drawer === "inspector" && visible}
          inert={!inspectorOpen || !visible}
          aria-hidden={!inspectorOpen || !visible}
          role={narrow && drawer === "inspector" && visible ? "dialog" : undefined}
          aria-modal={narrow && drawer === "inspector" && visible ? true : undefined}
          aria-labelledby={narrow && drawer === "inspector" && visible ? "studio-inspector-drawer-title" : undefined}
          tabIndex={-1}
        >
          <div className="studio-drawer-heading">
            <strong id="studio-inspector-drawer-title">Chỉnh sửa</strong>
            <Button variant="icon" size="icon" ref={inspectorClose} type="button" aria-label={UI_STRINGS.closeInspector} onClick={closeDrawer}>
              <X size={16} />
            </Button>
          </div>
          <div className="studio-inspector-scroll">{inspector}</div>
        </div>
      </div>
      <EditorStatusBar
        controls={
          <>
            <Button variant="icon" size="icon"
              ref={sourceToggle}
              type="button"
              aria-controls="studio-source-column"
              aria-expanded={sourceOpen}
              title="Thu/mở nguồn"
              aria-label="Thu/mở nguồn"
              onClick={() => toggle("source")}
            >
              <PanelLeft size={16} />
            </Button>
            <Button variant="icon" size="icon"
              ref={inspectorToggle}
              type="button"
              aria-controls="studio-inspector-column"
              aria-expanded={inspectorOpen}
              title={UI_STRINGS.toggleInspector}
              aria-label={UI_STRINGS.toggleInspector}
              onClick={() => toggle("inspector")}
            >
              <PanelRight size={16} />
            </Button>
          </>
        }
      >
        {status}
      </EditorStatusBar>
    </div>
  );
}
export function EditorSourcePanel({ children }: { children: ReactNode }) {
  return (
    <aside aria-label="Nguồn và AI" className="studio-source-panel">
      {children}
    </aside>
  );
}
export function EditorPreviewPanel({ preview, timeline }: { preview: ReactNode; timeline: ReactNode }) {
  return (
    <div className="studio-center-group">
      <section aria-label={UI_STRINGS.preview} className="studio-preview-area">
        {preview}
      </section>
      <section aria-label="Timeline đang chọn" className="studio-timeline-scroll">
        {timeline}
      </section>
    </div>
  );
}
export function EditorInspector({
  appearance,
  text,
  music,
  tab,
  onTab,
}: {
  appearance: ReactNode;
  text: ReactNode;
  music: ReactNode;
  tab: string;
  onTab: (value: string) => void;
}) {
  return (
    <aside aria-label={UI_STRINGS.inspector} className="studio-inspector">
      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="studio-inspector-tabs">
          <TabsTrigger value="appearance">Giao diện</TabsTrigger>
          <TabsTrigger value="text">Chữ</TabsTrigger>
          <TabsTrigger value="music">Nhạc</TabsTrigger>
        </TabsList>
        <TabsContent
          forceMount
          value="appearance"
          hidden={tab !== "appearance"}
          className={tab !== "appearance" ? "hidden" : "studio-inspector-body"}
        >
          {appearance}
        </TabsContent>
        <TabsContent
          forceMount
          value="text"
          hidden={tab !== "text"}
          className={tab !== "text" ? "hidden" : "studio-inspector-body"}
        >
          {text}
        </TabsContent>
        <TabsContent
          forceMount
          value="music"
          hidden={tab !== "music"}
          className={tab !== "music" ? "hidden" : "studio-inspector-body"}
        >
          {music}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
export function EditorStatusBar({ children, controls }: { children: ReactNode; controls: ReactNode }) {
  return (
    <footer aria-label="Validation và render" className="studio-statusbar">
      <div className="studio-panel-toggles">{controls}</div>
      {children}
    </footer>
  );
}
