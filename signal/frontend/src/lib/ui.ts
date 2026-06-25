// Small UI-only stores: theme (light/dark) and toast notifications.
import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  init: () => void;
  set: (t: Theme) => void;
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "dark",
  init: () => {
    const saved = (localStorage.getItem("signal_theme") as Theme) || "dark";
    apply(saved);
    set({ theme: saved });
  },
  set: (t) => {
    localStorage.setItem("signal_theme", t);
    apply(t);
    set({ theme: t });
  },
  toggle: () => get().set(get().theme === "dark" ? "light" : "dark"),
}));

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "info") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
