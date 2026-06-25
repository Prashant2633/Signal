"use client";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/ui";
import Avatar from "./Avatar";
import { Compose, Phone, Settings, Moon, Sun } from "./icons";

export type View = "chats" | "calls" | "stories";

interface Props {
  view: View;
  setView: (v: View) => void;
  onSettings: () => void;
}

/** Slim left navigation rail (Signal Desktop style). */
export default function NavRail({ view, setView, onSettings }: Props) {
  const me = useStore((s) => s.me)!;
  const { theme, toggle } = useTheme();

  const items: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "chats", label: "Chats", icon: <Compose width={22} height={22} /> },
    { id: "calls", label: "Calls", icon: <Phone width={22} height={22} /> },
    { id: "stories", label: "Stories", icon: <StoriesIcon /> },
  ];

  return (
    <div className="flex w-16 shrink-0 flex-col items-center border-r border-border bg-elevated py-4">
      <div className="flex flex-1 flex-col items-center gap-1">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setView(it.id)}
            title={it.label}
            className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
              view === it.id
                ? "bg-signal-blue/15 text-signal-blue"
                : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            {it.icon}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={toggle}
          title="Toggle theme"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-panel hover:text-ink"
        >
          {theme === "dark" ? <Sun width={20} height={20} /> : <Moon width={20} height={20} />}
        </button>
        <button
          onClick={onSettings}
          title="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:bg-panel hover:text-ink"
        >
          <Settings width={22} height={22} />
        </button>
        <button onClick={onSettings} title="Profile" className="mt-1">
          <Avatar name={me.display_name} color={me.avatar_color} size={34} />
        </button>
      </div>
    </div>
  );
}

function StoriesIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
