"use client";
import { useEffect } from "react";
import { X } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

/** Centered modal with backdrop, escape-to-close and a header row. */
export default function Modal({ open, onClose, title, children, width = "max-w-md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-2xl bg-elevated border border-border shadow-2xl animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink transition"
            >
              <X width={18} height={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
