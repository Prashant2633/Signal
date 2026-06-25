"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { Send, Smile, Plus, X } from "./icons";

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🎉", "❤️", "🔥", "😎", "😢", "🤔", "👏", "🥳", "😴", "🚀", "☕"];

interface Props {
  replyTo: Message | null;
  onClearReply: () => void;
  replyName?: string;
}

/** Composer: textarea with typing indicator, emoji picker and reply banner. */
export default function MessageInput({ replyTo, onClearReply, replyName }: Props) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const send = useStore((s) => s.sendMessage);
  const setTyping = useStore((s) => s.setTyping);
  const activeId = useStore((s) => s.activeId);
  const ref = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();

  // Reset composer when switching conversations.
  useEffect(() => {
    setText("");
    setEmojiOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  function emitTyping() {
    if (!typingRef.current) {
      typingRef.current = true;
      setTyping(true);
    }
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      typingRef.current = false;
      setTyping(false);
    }, 1500);
  }

  function submit() {
    const value = text.trim();
    if (!value) return;
    send(value, replyTo?.id);
    setText("");
    onClearReply();
    typingRef.current = false;
    setTyping(false);
    clearTimeout(stopTimer.current);
    ref.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-panel px-4 py-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-signal-blue bg-elevated px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-signal-blue">Replying to {replyName}</div>
            <div className="truncate text-xs text-muted">{replyTo.content}</div>
          </div>
          <button onClick={onClearReply} className="text-muted hover:text-ink">
            <X width={16} height={16} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          className="mb-1 rounded-full p-2 text-muted hover:bg-elevated hover:text-ink"
          title="Attachments — coming soon"
        >
          <Plus width={20} height={20} />
        </button>

        <div className="relative flex flex-1 items-end rounded-2xl border border-border bg-elevated px-3 py-2">
          <textarea
            ref={ref}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              emitTyping();
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={onKeyDown}
            placeholder="Message"
            className="max-h-36 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          <button
            onClick={() => setEmojiOpen((v) => !v)}
            className="mb-0.5 shrink-0 text-muted hover:text-ink"
          >
            <Smile width={20} height={20} />
          </button>

          {emojiOpen && (
            <div className="absolute bottom-full right-0 mb-2 grid grid-cols-8 gap-1 rounded-xl border border-border bg-elevated p-2 shadow-xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setText((t) => t + e);
                    ref.current?.focus();
                  }}
                  className="rounded p-1 text-xl transition hover:scale-110 hover:bg-panel"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!text.trim()}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal-blue text-white transition hover:bg-signal-bluedark disabled:opacity-40"
        >
          <Send width={18} height={18} />
        </button>
      </div>
    </div>
  );
}
