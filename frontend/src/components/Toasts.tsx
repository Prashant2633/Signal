"use client";
import { useToasts } from "@/lib/ui";

/** Bottom-center toast stack for notifications and errors. */
export default function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto animate-slide-up rounded-full px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur ${
            t.kind === "error"
              ? "bg-red-600 text-white"
              : t.kind === "success"
              ? "bg-green-600 text-white"
              : "bg-elevated text-ink border border-border"
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
