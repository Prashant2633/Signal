// Thin typed wrapper around the REST API. Handles auth header + JSON parsing.
import type { Conversation, Message, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "signal_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore non-JSON errors */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // ---- Auth ----
  requestOtp: (identifier: string) =>
    request<{ is_new_user: boolean; dev_otp: string }>("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),

  verify: (payload: {
    identifier: string;
    otp: string;
    display_name?: string;
    username?: string;
    avatar_color?: string;
  }) =>
    request<{ access_token: string; user: User }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<User>("/auth/me"),

  updateProfile: (payload: Partial<Pick<User, "display_name" | "about" | "avatar_color">>) =>
    request<User>("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),

  // ---- Users / contacts ----
  searchUsers: (q: string) =>
    request<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
  listContacts: () => request<User[]>("/contacts"),
  addContact: (identifier: string) =>
    request<User>("/contacts", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),

  // ---- Conversations ----
  listConversations: () => request<Conversation[]>("/conversations"),
  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  createDirect: (userId: string) =>
    request<Conversation>("/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  createGroup: (name: string, memberIds: string[]) =>
    request<Conversation>("/conversations/group", {
      method: "POST",
      body: JSON.stringify({ name, member_ids: memberIds }),
    }),
  updateGroup: (id: string, payload: { name?: string; disappearing_seconds?: number }) =>
    request<Conversation>(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addMember: (convId: string, userId: string) =>
    request<Conversation>(`/conversations/${convId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  removeMember: (convId: string, userId: string) =>
    request<Conversation>(`/conversations/${convId}/members/${userId}`, {
      method: "DELETE",
    }),

  // ---- Messages ----
  listMessages: (convId: string) =>
    request<Message[]>(`/conversations/${convId}/messages`),
  sendMessage: (
    convId: string,
    content: string,
    replyToId?: string | null,
    clientId?: string
  ) =>
    request<Message>(`/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, reply_to_id: replyToId, client_id: clientId }),
    }),
  markRead: (convId: string, upToMessageId: string) =>
    request<{ ok: boolean }>(`/conversations/${convId}/read`, {
      method: "POST",
      body: JSON.stringify({ up_to_message_id: upToMessageId }),
    }),
  toggleReaction: (messageId: string, emoji: string) =>
    request<Message>(`/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),
};
