"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToasts } from "@/lib/ui";
import type { User } from "@/lib/types";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { Search, Check } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Create a group: name + multi-select members. */
export default function NewGroupModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const refresh = useStore((s) => s.refreshConversations);
  const select = useStore((s) => s.selectConversation);
  const push = useToasts((s) => s.push);

  useEffect(() => {
    if (!open) return;
    api.searchUsers(q).then(setResults).catch(() => {});
  }, [q, open]);

  useEffect(() => {
    if (open) {
      setName("");
      setQ("");
      setSelected([]);
    }
  }, [open]);

  function toggle(u: User) {
    setSelected((s) =>
      s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]
    );
  }

  async function create() {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    try {
      const conv = await api.createGroup(name.trim(), selected.map((u) => u.id));
      await refresh();
      await select(conv.id);
      push("Group created", "success");
      onClose();
    } catch (e: any) {
      push(e.message, "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New group">
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="w-full rounded-lg border border-border bg-panel px-3.5 py-2.5 text-sm outline-none focus:border-signal-blue"
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span
                key={u.id}
                onClick={() => toggle(u)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-signal-blue/15 py-1 pl-1 pr-2.5 text-xs font-medium text-signal-blue"
              >
                <Avatar name={u.display_name} color={u.avatar_color} size={20} />
                {u.display_name.split(" ")[0]} ✕
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2">
          <Search width={18} height={18} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add members"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="max-h-56 overflow-y-auto">
          {results.map((u) => {
            const on = selected.some((x) => x.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel"
              >
                <Avatar name={u.display_name} color={u.avatar_color} online={u.is_online} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.display_name}</div>
                  <div className="truncate text-xs text-muted">@{u.username}</div>
                </div>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    on ? "border-signal-blue bg-signal-blue text-white" : "border-border"
                  }`}
                >
                  {on && <Check width={13} height={13} />}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={create}
          disabled={creating || !name.trim() || selected.length === 0}
          className="w-full rounded-lg bg-signal-blue py-2.5 text-sm font-semibold text-white transition hover:bg-signal-bluedark disabled:opacity-50"
        >
          {creating ? "Creating…" : `Create group${selected.length ? ` · ${selected.length}` : ""}`}
        </button>
      </div>
    </Modal>
  );
}
