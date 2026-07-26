"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

export const inputCls =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-accent/40";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-muted">
      {label}
      <div className="mt-1.5 font-normal normal-case tracking-normal">{children}</div>
      {hint && <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-muted">{hint}</p>}
    </label>
  );
}

export type ToastKind = "ok" | "err";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "ok") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((list) => [...list, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return { toasts, toast, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            t.kind === "err"
              ? "border-red-500/40 bg-red-950/90 text-red-100"
              : "border-accent/40 bg-bg-elevated/95 text-cream"
          }`}
        >
          <p className="flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            className="shrink-0 text-muted hover:text-foreground"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-bg-elevated shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-2xl tracking-wide text-cream">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line p-2 text-muted hover:bg-white/5 hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg/40 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export function useConfirmDialog() {
  const [req, setReq] = useState<(ConfirmRequest & { resolve: (v: boolean) => void }) | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((options: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setReq({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      if (!req) return;
      req.resolve(value);
      setReq(null);
      setBusy(false);
    },
    [req]
  );

  const dialog = (
    <Modal
      open={!!req}
      title={req?.title || "Confirm"}
      description={req?.message}
      onClose={() => close(false)}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary !py-2 text-sm"
            disabled={busy}
            onClick={() => close(false)}
          >
            {req?.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy}
            className={`!py-2 text-sm ${
              req?.danger
                ? "rounded-full bg-red-600 px-5 font-bold text-white hover:bg-red-500 disabled:opacity-50"
                : "btn-primary"
            }`}
            onClick={() => close(true)}
          >
            {req?.confirmLabel || "Confirm"}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {req?.danger
          ? "This action cannot be undone."
          : "Please confirm you want to continue."}
      </p>
    </Modal>
  );

  return { confirm, dialog, busy, setBusy };
}
