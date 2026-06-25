"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToasts } from "@/lib/ui";
import type { Conversation, User } from "@/lib/types";
import { convDisplay, lastSeenText } from "@/lib/utils";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { Plus, Trash, Timer, Search, Logout } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
  conv: Conversation;
}

const DISAPPEARING_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30 seconds", value: 30 },
  { label: "5 minutes", value: 300 },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
];

/** Group details: members, admin controls, disappearing messages. */
export default function GroupInfoModal({ open, onClose, conv }: Props) {
  const me = useStore((s) => s.me)!;
  const refresh = useStore((s) => s.refreshConversations);
  const select = useStore((s) => s.selectConversation);
  const push = useToasts((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);

  const myRole = conv.members.find((m) => m.user.id === me.id)?.role;
  const isAdmin = myRole === "admin";
  const { name, color } = convDisplay(conv, me.id);

  useEffect(() => {
    if (!adding) return;
    api.searchUsers(q).then(setResults).catch(() => {});
  }, [q, adding]);

  const memberIds = new Set(conv.members.map((m) => m.user.id));

  async function addMember(u: User) {
    try {
      await api.addMember(conv.id, u.id);
      await refresh();
      await select(conv.id);
      push(`Added ${u.display_name}`, "success");
    } catch (e: any) {
      push(e.message, "error");
    }
  }

  async function removeMember(u: User) {
    try {
      await api.removeMember(conv.id, u.id);
      await refresh();
      await select(conv.id);
      push(`Removed ${u.display_name}`);
    } catch (e: any) {
      push(e.message, "error");
    }
  }

  async function leave() {
    try {
      await api.removeMember(conv.id, me.id);
      await refresh();
      await select(null);
      onClose();
      push("You left the group");
    } catch (e: any) {
      push(e.message, "error");
    }
  }

  async function setDisappearing(seconds: number) {
    try {
      await api.updateGroup(conv.id, { disappearing_seconds: seconds });
      await refresh();
      await select(conv.id);
    } catch (e: any) {
      push(e.message, "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Group info" width="max-w-md">
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={name} color={color} size={80} isGroup />
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-muted">{conv.members.length} members</p>
        </div>

        {/* Disappearing messages */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Timer width={16} height={16} className="text-signal-blue" />
            Disappearing messages
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DISAPPEARING_OPTIONS.map((o) => (
              <button
                key={o.value}
                disabled={!isAdmin}
                onClick={() => setDisappearing(o.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  conv.disappearing_seconds === o.value
                    ? "bg-signal-blue text-white"
                    : "bg-panel text-muted hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Members */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Members</span>
            {isAdmin && (
              <button
                onClick={() => setAdding((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-signal-blue"
              >
                <Plus width={14} height={14} /> Add
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-3 rounded-lg border border-border p-2">
              <div className="mb-2 flex items-center gap-2 rounded-md bg-panel px-2 py-1.5">
                <Search width={16} height={16} className="text-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search users"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {results
                  .filter((u) => !memberIds.has(u.id))
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMember(u)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-panel"
                    >
                      <Avatar name={u.display_name} color={u.avatar_color} size={32} />
                      <span className="flex-1 truncate text-sm">{u.display_name}</span>
                      <Plus width={16} height={16} className="text-signal-blue" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {conv.members.map((m) => (
              <div key={m.user.id} className="group flex items-center gap-3 rounded-lg px-1 py-1.5">
                <Avatar
                  name={m.user.display_name}
                  color={m.user.avatar_color}
                  size={38}
                  online={m.user.is_online}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {m.user.display_name}
                    {m.user.id === me.id && <span className="text-muted"> (You)</span>}
                  </div>
                  <div className="truncate text-xs text-muted">{lastSeenText(m.user)}</div>
                </div>
                {m.role === "admin" && (
                  <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                    Admin
                  </span>
                )}
                {isAdmin && m.user.id !== me.id && (
                  <button
                    onClick={() => removeMember(m.user)}
                    className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash width={16} height={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={leave}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
        >
          <Logout width={16} height={16} />
          Leave group
        </button>
      </div>
    </Modal>
  );
}
