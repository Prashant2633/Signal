import type { Conversation, User } from "./types";

/** Two-letter initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Short time like "9:41 AM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Conversation-list timestamp: time today, "Yesterday", weekday, or date. */
export function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

/** Day separator label inside the chat ("Today", "Yesterday", full date). */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** "last seen" presence subtitle. */
export function lastSeenText(user: User): string {
  if (user.is_online) return "online";
  if (!user.last_seen) return "offline";
  const diff = Date.now() - new Date(user.last_seen).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  return `last seen ${formatListTime(user.last_seen)}`;
}

/** The "other" participant in a direct conversation, from the viewer's POV. */
export function otherMember(conv: Conversation, meId: string): User | null {
  const m = conv.members.find((mem) => mem.user.id !== meId);
  return m ? m.user : null;
}

/** Display name + colour for a conversation (group name or the other person). */
export function convDisplay(conv: Conversation, meId: string): { name: string; color: string } {
  if (conv.type === "group") {
    return { name: conv.name || "Group", color: conv.avatar_color };
  }
  const other = otherMember(conv, meId);
  return {
    name: other?.display_name || "Unknown",
    color: other?.avatar_color || conv.avatar_color,
  };
}

/** Plain-text preview of the last message for the conversation list. */
export function lastMessagePreview(conv: Conversation, meId: string): string {
  const m = conv.last_message;
  if (!m) return "No messages yet";
  if (m.type === "system") return m.content;
  const isGroup = conv.type === "group";
  const senderName =
    m.sender_id === meId
      ? "You"
      : conv.members.find((mem) => mem.user.id === m.sender_id)?.user.display_name.split(" ")[0];
  const prefix = isGroup && senderName ? `${senderName}: ` : m.sender_id === meId ? "You: " : "";
  return prefix + m.content;
}
