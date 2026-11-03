"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Toaster, toast } from "sonner";
type Choice = "confirm" | "save" | "cancel";
type Request = { message: string; title?: string; save?: boolean; confirmLabel?: string };
const Context = createContext<(request: Request) => Promise<Choice>>(() => Promise.resolve("cancel"));
export const useConfirm = () => useContext(Context);
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<{ resolve: (choice: Choice) => void; trigger: HTMLElement | null } | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  const finish = useCallback((choice: Choice) => {
    const current = pending.current;
    pending.current = null;
    trigger.current = current?.trigger || null;
    current?.resolve(choice);
    setRequest(null);
  }, []);
  const confirm = useCallback(
    (next: Request) =>
      new Promise<Choice>((resolve) => {
        // One dialog at a time: repeated clicks join no destructive operation.
        if (pending.current) {
          resolve("cancel");
          return;
        }
        pending.current = {
          resolve,
          trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        };
        setRequest(next);
      }),
    [],
  );
  useEffect(
    () => () => {
      pending.current?.resolve("cancel");
      pending.current = null;
    },
    [],
  );
  return (
    <Context.Provider value={confirm}>
      {children}
      <Toaster theme="dark" closeButton richColors position="bottom-right" />
      <AlertDialog
        open={!!request}
        onOpenChange={(open) => {
          if (!open) finish("cancel");
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
          }}
        >
          <AlertDialogTitle>{request?.title || "Xác nhận thao tác"}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{request?.message}</AlertDialogDescription>
          <AlertDialogFooter>
            <Button type="button" variant="secondary" onClick={() => finish("cancel")}>
              {request?.save ? "Ở lại" : "Hủy"}
            </Button>
            <Button type="button" variant={request?.save ? "secondary" : "destructive"} onClick={() => finish("confirm")}>
              {request?.confirmLabel || (request?.save ? "Bỏ phần chưa lưu" : "Xác nhận")}
            </Button>
            {request?.save && (
              <Button type="button" onClick={() => finish("save")}>
                Lưu rồi mở
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Context.Provider>
  );
}
export { toast };
