"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useToasts } from "@/lib/ui";
import type { Message } from "@/lib/types";
import { convDisplay, formatDayLabel, lastSeenText, otherMember, parseDate } from "@/lib/utils";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import GroupInfoModal from "./GroupInfoModal";
import { ArrowLeft, Phone, Video, Dots, Lock, Search } from "./icons";

interface Props {
  onBack?: () => void;
}

/** Right pane: conversation header, message thread and composer. */
export default function ChatPane({ onBack }: Props) {
  const activeId = useStore((s) => s.activeId);
  const conv = useStore((s) => s.conversations.find((c) => c.id === activeId) || null);
  const messages = useStore((s) => (activeId ? s.messages[activeId] : undefined));
  const typing = useStore((s) => (activeId ? s.typing[activeId] : undefined));
  const loading = useStore((s) => s.loadingMessages);
  const me = useStore((s) => s.me)!;
  const push = useToasts((s) => s.push);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [groupInfo, setGroupInfo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReplyTo(null), [activeId]);

  // Auto-scroll to bottom on new messages / typing.
  const typingNames = typing ? Object.values(typing) : [];
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages?.length, typingNames.length, activeId]);

  const byId = useMemo(() => {
    const m = new Map<string, Message>();
    messages?.forEach((x) => m.set(x.id, x));
    return m;
  }, [messages]);

  if (!conv) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-panel text-signal-blue">
          <Lock width={34} height={34} />
        </div>
        <h2 className="text-lg font-semibold">Select a chat to start messaging</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Your messages are protected with simulated end-to-end encryption.
        </p>
      </div>
    );
  }

  const { name, color } = convDisplay(conv, me.id);
  const other = conv.type === "direct" ? otherMember(conv, me.id) : null;
  const subtitle =
    conv.type === "group"
      ? `${conv.members.length} members`
      : other
      ? lastSeenText(other)
      : "";

  const replyName =
    replyTo &&
    (replyTo.sender_id === me.id
      ? "yourself"
      : conv.members.find((m) => m.user.id === replyTo.sender_id)?.user.display_name);

  return (
    <div className="flex h-full flex-1 flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2.5">
        {onBack && (
          <button onClick={onBack} className="rounded-full p-1.5 text-muted hover:bg-elevated md:hidden">
            <ArrowLeft width={20} height={20} />
          </button>
        )}
        <button
          onClick={() => conv.type === "group" && setGroupInfo(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar name={name} color={color} size={40} online={other?.is_online} isGroup={conv.type === "group"} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">
              {typingNames.length > 0 ? (
                <span className="text-signal-blue">
                  {conv.type === "group" ? `${typingNames[0]} is typing…` : "typing…"}
                </span>
              ) : (
                subtitle
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 text-muted">
          <button onClick={() => push("Voice calls — coming soon")} className="rounded-full p-2 hover:bg-elevated hover:text-ink">
            <Phone width={19} height={19} />
          </button>
          <button onClick={() => push("Video calls — coming soon")} className="rounded-full p-2 hover:bg-elevated hover:text-ink">
            <Video width={19} height={19} />
          </button>
          <button
            onClick={() => (conv.type === "group" ? setGroupInfo(true) : push("Search in chat — coming soon"))}
            className="rounded-full p-2 hover:bg-elevated hover:text-ink"
          >
            {conv.type === "group" ? <Dots width={19} height={19} /> : <Search width={19} height={19} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-canvas flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <div className="mb-4 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-xs text-muted">
              <Lock width={12} height={12} /> Messages are end-to-end encrypted (simulated)
            </span>
          </div>

          {loading && !messages && (
            <p className="py-8 text-center text-sm text-muted">Loading messages…</p>
          )}

          {messages?.map((m, i) => {
            const prev = messages[i - 1];
            const showDay =
              !prev || parseDate(prev.created_at).toDateString() !== parseDate(m.created_at).toDateString();
            const showSender = !prev || prev.sender_id !== m.sender_id || prev.type === "system";
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-panel px-3 py-1 text-xs font-medium text-muted">
                      {formatDayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={m}
                  conv={conv}
                  replyTo={m.reply_to_id ? byId.get(m.reply_to_id) : null}
                  showSender={showSender}
                  onReply={setReplyTo}
                />
              </div>
            );
          })}

          {typingNames.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-bubbleIn px-3 py-2.5 w-fit">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <MessageInput
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        replyName={replyName || undefined}
      />

      {conv.type === "group" && (
        <GroupInfoModal open={groupInfo} onClose={() => setGroupInfo(false)} conv={conv} />
      )}
    </div>
  );
}
