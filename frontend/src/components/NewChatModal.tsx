"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToasts } from "@/lib/ui";
import type { User } from "@/lib/types";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { Search, Users, Plus } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
  onNewGroup: () => void;
}

/** Find people and start a 1:1 conversation, or jump to group creation. */
export default function NewChatModal({ open, onClose, onNewGroup }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [adding, setAdding] = useState("");
  const refresh = useStore((s) => s.refreshConversations);
  const select = useStore((s) => s.selectConversation);
  const push = useToasts((s) => s.push);

  useEffect(() => {
    if (!open) return;
    let active = true;
    api.searchUsers(q).then((r) => active && setResults(r)).catch(() => {});
    return () => {
      active = false;
    };
  }, [q, open]);

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  async function startChat(u: User) {
    setAdding(u.id);
    try {
      const conv = await api.createDirect(u.id);
      await refresh();
      await select(conv.id);
      onClose();
    } catch (e: any) {
      push(e.message, "error");
    } finally {
      setAdding("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New chat">
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2">
          <Search width={18} height={18} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, username or phone"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <button
          onClick={onNewGroup}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-panel"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-blue text-white">
            <Users width={20} height={20} />
          </div>
          <span className="font-medium">New group</span>
        </button>

        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No users found</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => startChat(u)}
              disabled={!!adding}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel disabled:opacity-50"
            >
              <Avatar name={u.display_name} color={u.avatar_color} online={u.is_online} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{u.display_name}</div>
                <div className="truncate text-xs text-muted">
                  @{u.username}
                  {u.phone ? ` · ${u.phone}` : ""}
                </div>
              </div>
              {adding === u.id ? (
                <span className="text-xs text-muted">…</span>
              ) : (
                <Plus width={18} height={18} className="text-muted" />
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
