// Shared types mirroring the backend's JSON contract.

export interface User {
  id: string;
  username: string;
  phone: string | null;
  display_name: string;
  about: string;
  avatar_color: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface Member {
  user: User;
  role: "admin" | "member";
  muted: boolean;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Reaction {
  emoji: string;
  user_id: string;
}

export interface Receipt {
  user_id: string;
  status: "delivered" | "read";
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: "text" | "system";
  content: string;
  status: MessageStatus;
  reply_to_id: string | null;
  edited: boolean;
  deleted: boolean;
  expires_at: string | null;
  created_at: string;
  reactions: Reaction[];
  receipts: Receipt[];
  // Client-only optimistic id used before the server row arrives.
  client_id?: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_color: string;
  disappearing_seconds: number;
  created_by: string | null;
  last_message_at: string;
  members: Member[];
  last_message: Message | null;
  unread_count: number;
}
