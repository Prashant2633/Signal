"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { StatusTick } from "./ConversationList";
import { Smile, Reply } from "./icons";

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

interface Props {
  msg: Message;
  conv: Conversation;
  replyTo?: Message | null;
  showSender: boolean; // group + first of a run from this sender
  onReply: (m: Message) => void;
}

export default function MessageBubble({ msg, conv, replyTo, showSender, onReply }: Props) {
  const me = useStore((s) => s.me)!;
  const toggleReaction = useStore((s) => s.toggleReaction);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = msg.sender_id === me.id;

  if (msg.type === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-panel px-3 py-1 text-xs text-muted">{msg.content}</span>
      </div>
    );
  }

  const sender = conv.members.find((m) => m.user.id === msg.sender_id)?.user;

  // Aggregate reactions by emoji -> count.
  const reactionGroups = msg.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction = msg.reactions.find((r) => r.user_id === me.id);

  return (
    <div className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        {/* Bubble */}
        <div
          className={`relative max-w-[min(75%,520px)] rounded-2xl px-3 py-2 text-[15px] leading-snug shadow-sm ${
            mine
              ? "rounded-br-md bg-bubbleOut text-white"
              : "rounded-bl-md bg-bubbleIn text-ink"
          }`}
        >
          {showSender && !mine && conv.type === "group" && sender && (
            <div className="mb-0.5 text-xs font-semibold" style={{ color: sender.avatar_color }}>
              {sender.display_name}
            </div>
          )}

          {replyTo && (
            <div
              className={`mb-1 rounded-md border-l-2 px-2 py-1 text-xs ${
                mine ? "border-white/60 bg-white/15" : "border-signal-blue bg-elevated"
              }`}
            >
              <div className={`font-semibold ${mine ? "text-white" : "text-signal-blue"}`}>
                {replyTo.sender_id === me.id
                  ? "You"
                  : conv.members.find((m) => m.user.id === replyTo.sender_id)?.user.display_name}
              </div>
              <div className={`truncate ${mine ? "text-white/80" : "text-muted"}`}>
                {replyTo.content}
              </div>
            </div>
          )}

          <span className="whitespace-pre-wrap break-words">{msg.content}</span>

          <span
            className={`ml-2 inline-flex translate-y-0.5 items-center gap-1 align-bottom text-[10px] ${
              mine ? "text-white/70" : "text-muted"
            }`}
          >
            {msg.expires_at && <span title="Disappearing message">⏱</span>}
            {formatTime(msg.created_at)}
            {mine && <StatusTick status={msg.status} />}
          </span>
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink"
            >
              <Smile width={16} height={16} />
            </button>
            {pickerOpen && (
              <div
                className={`absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-border bg-elevated px-2 py-1.5 shadow-lg ${
                  mine ? "right-0" : "left-0"
                }`}
              >
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      toggleReaction(msg.id, e);
                      setPickerOpen(false);
                    }}
                    className="text-lg transition hover:scale-125"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onReply(msg)}
            className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink"
          >
            <Reply width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Reaction chips */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className={`-mt-1 flex gap-1 ${mine ? "mr-1 flex-row-reverse" : "ml-1"}`}>
          {Object.entries(reactionGroups).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(msg.id, emoji)}
              className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs ${
                myReaction?.emoji === emoji
                  ? "border-signal-blue bg-signal-blue/15"
                  : "border-border bg-elevated"
              }`}
            >
              <span>{emoji}</span>
              {count > 1 && <span className="text-muted">{count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
