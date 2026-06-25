"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { convDisplay, formatListTime, lastMessagePreview, otherMember } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import Avatar from "./Avatar";
import { Search, Compose, DoubleCheck, Check, Clock } from "./icons";

interface Props {
  onCompose: () => void;
}

/** Left column: search bar + activity-sorted conversation list. */
export default function ConversationList({ onCompose }: Props) {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectConversation);
  const me = useStore((s) => s.me)!;
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return conversations;
    const needle = q.toLowerCase();
    return conversations.filter((c) => {
      const { name } = convDisplay(c, me.id);
      const preview = c.last_message?.content || "";
      return name.toLowerCase().includes(needle) || preview.toLowerCase().includes(needle);
    });
  }, [q, conversations, me.id]);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-xl font-bold">Chats</h1>
        <button
          onClick={onCompose}
          className="rounded-full p-2 text-muted transition hover:bg-elevated hover:text-ink"
          title="New chat"
        >
          <Compose width={20} height={20} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2">
          <Search width={17} height={17} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted">
            {q ? "No matches" : "No conversations yet"}
          </p>
        )}
        {filtered.map((c) => (
          <ConversationRow
            key={c.id}
            conv={c}
            active={c.id === activeId}
            meId={me.id}
            onClick={() => select(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  active,
  meId,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  meId: string;
  onClick: () => void;
}) {
  const { name, color } = convDisplay(conv, meId);
  const other = conv.type === "direct" ? otherMember(conv, meId) : null;
  const preview = lastMessagePreview(conv, meId);
  const last = conv.last_message;
  const mine = last && last.sender_id === meId && last.type !== "system";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
        active ? "bg-signal-blue/15" : "hover:bg-elevated"
      }`}
    >
      <Avatar
        name={name}
        color={color}
        online={other?.is_online}
        isGroup={conv.type === "group"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span
            className={`shrink-0 text-xs ${
              conv.unread_count > 0 ? "font-semibold text-signal-blue" : "text-muted"
            }`}
          >
            {formatListTime(conv.last_message_at)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {mine && <StatusTick status={last!.status} />}
          <span
            className={`flex-1 truncate text-sm ${
              conv.unread_count > 0 ? "text-ink" : "text-muted"
            }`}
          >
            {preview}
          </span>
          {conv.unread_count > 0 && (
            <span className="ml-1 inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-full bg-signal-blue px-1.5 text-xs font-semibold text-white">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** Single tick (sent), grey double (delivered), blue double (read), clock (sending). */
export function StatusTick({ status }: { status: string }) {
  if (status === "sending") return <Clock width={14} height={14} className="shrink-0 text-muted" />;
  if (status === "sent") return <Check width={14} height={14} className="shrink-0 text-muted" />;
  if (status === "delivered")
    return <DoubleCheck width={15} height={15} className="shrink-0 text-muted" />;
  return <DoubleCheck width={15} height={15} className="shrink-0 text-signal-blue" />;
}
