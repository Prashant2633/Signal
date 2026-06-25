"use client";
import { useState } from "react";
import { api, clearToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useTheme, useToasts } from "@/lib/ui";
import type { User } from "@/lib/types";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { Moon, Sun, Lock, Bell, Paint, Logout, Phone } from "./icons";

const COLORS = ["#3b7ddd", "#10a37f", "#e6618a", "#f0a500", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6"];

type Tab = "profile" | "appearance" | "privacy" | "notifications" | "devices";

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.me)!;
  const setMe = useStore((s) => s.setMe);
  const teardown = useStore((s) => s.teardown);
  const { theme, set: setTheme } = useTheme();
  const push = useToasts((s) => s.push);
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(me?.display_name || "");
  const [about, setAbout] = useState(me?.about || "");
  const [color, setColor] = useState(me?.avatar_color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated: User = await api.updateProfile({ display_name: name, about, avatar_color: color });
      setMe(updated);
      push("Profile updated", "success");
    } catch (e: any) {
      push(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearToken();
    teardown();
    location.reload();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <Avatar name={name || "?"} color={color} size={18} /> },
    { id: "appearance", label: "Appearance", icon: <Paint width={16} height={16} /> },
    { id: "privacy", label: "Privacy", icon: <Lock width={16} height={16} /> },
    { id: "notifications", label: "Notifications", icon: <Bell width={16} height={16} /> },
    { id: "devices", label: "Linked devices", icon: <Phone width={16} height={16} /> },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="max-w-lg">
      <div className="flex gap-4">
        <div className="w-40 shrink-0 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                tab === t.id ? "bg-signal-blue/15 text-signal-blue" : "text-muted hover:bg-panel"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-panel"
          >
            <Logout width={16} height={16} />
            Log out
          </button>
        </div>

        <div className="min-h-[300px] flex-1">
          {tab === "profile" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar name={name || "?"} color={color} size={72} />
                <div className="flex flex-wrap justify-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full transition ${
                        color === c ? "ring-2 ring-offset-2 ring-offset-elevated ring-ink" : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-signal-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">About</label>
                <input
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-signal-blue"
                />
              </div>
              <div className="text-xs text-muted">
                Username: <span className="text-ink">@{me.username}</span>
                {me.phone && (
                  <>
                    {" · "}Phone: <span className="text-ink">{me.phone}</span>
                  </>
                )}
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-white hover:bg-signal-bluedark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Theme</p>
              <div className="grid grid-cols-2 gap-3">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                      theme === t ? "border-signal-blue bg-signal-blue/10" : "border-border hover:bg-panel"
                    }`}
                  >
                    {t === "light" ? <Sun /> : <Moon />}
                    <span className="text-sm capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <Placeholder
              icon={<Lock />}
              rows={["Read receipts", "Typing indicators", "Disappearing messages", "Screen lock"]}
            />
          )}
          {tab === "notifications" && (
            <Placeholder
              icon={<Bell />}
              rows={["Message notifications", "Sound", "Show preview", "Notify when mentioned"]}
            />
          )}
          {tab === "devices" && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted">
              <Phone width={36} height={36} className="mb-3 text-signal-blue" />
              <p className="text-sm">Link a new device by scanning a QR code.</p>
              <span className="mt-3 rounded-full bg-panel px-3 py-1 text-xs">Coming soon</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Placeholder({ icon, rows }: { icon: React.ReactNode; rows: string[] }) {
  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center gap-2 text-signal-blue">{icon}</div>
      {rows.map((r) => (
        <div
          key={r}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
        >
          <span>{r}</span>
          <span className="text-xs text-muted">Coming soon</span>
        </div>
      ))}
    </div>
  );
}
