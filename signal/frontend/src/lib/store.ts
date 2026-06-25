// Central client state (Zustand). Owns the WebSocket connection, the conversation
// list, per-conversation message caches, typing + presence state, and all the
// actions the UI calls. Real-time server events flow through `handleEvent`.
import { create } from "zustand";
import { api } from "./api";
import type { Conversation, Message, User } from "./types";
import { SignalSocket, WsEvent } from "./ws";

interface State {
  me: User | null;
  socket: SignalSocket | null;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;
  // convId -> { userId: displayName } of people currently typing
  typing: Record<string, Record<string, string>>;
  loadingMessages: boolean;

  bootstrap: (me: User, token: string) => Promise<void>;
  teardown: () => void;
  refreshConversations: () => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  sendMessage: (content: string, replyToId?: string | null) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  markConversationRead: (id: string) => Promise<void>;
  setMe: (u: User) => void;

  handleEvent: (e: WsEvent) => void;
}

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useStore = create<State>((set, get) => ({
  me: null,
  socket: null,
  conversations: [],
  activeId: null,
  messages: {},
  typing: {},
  loadingMessages: false,

  setMe: (u) => set({ me: u }),

  bootstrap: async (me, token) => {
    get().socket?.close();
    const socket = new SignalSocket(token, (e) => get().handleEvent(e));
    socket.connect();
    set({ me, socket });
    await get().refreshConversations();
  },

  teardown: () => {
    get().socket?.close();
    set({ me: null, socket: null, conversations: [], messages: {}, activeId: null, typing: {} });
  },

  refreshConversations: async () => {
    const convs = await api.listConversations();
    set({ conversations: sortConvs(convs) });
  },

  selectConversation: async (id) => {
    set({ activeId: id });
    if (!id) return;
    if (!get().messages[id]) set({ loadingMessages: true });
    const msgs = await api.listMessages(id);
    set((s) => ({ messages: { ...s.messages, [id]: msgs }, loadingMessages: false }));
    await get().markConversationRead(id);
  },

  markConversationRead: async (id) => {
    const msgs = get().messages[id];
    const me = get().me;
    if (!msgs?.length || !me) return;
    const last = msgs[msgs.length - 1];
    // Only call the API if there is something unread that isn't ours.
    const conv = get().conversations.find((c) => c.id === id);
    if (conv && conv.unread_count === 0) return;
    try {
      await api.markRead(id, last.id);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch {
      /* ignore */
    }
  },

  sendMessage: async (content, replyToId) => {
    const { activeId, me } = get();
    if (!activeId || !me || !content.trim()) return;
    const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: clientId,
      client_id: clientId,
      conversation_id: activeId,
      sender_id: me.id,
      type: "text",
      content: content.trim(),
      status: "sending",
      reply_to_id: replyToId || null,
      edited: false,
      deleted: false,
      expires_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
      receipts: [],
    };
    set((s) => ({
      messages: { ...s.messages, [activeId]: [...(s.messages[activeId] || []), optimistic] },
    }));
    get().socket?.sendTyping(activeId, false);
    try {
      await api.sendMessage(activeId, content.trim(), replyToId, clientId);
      // The authoritative row arrives via the WS "message" event and reconciles
      // the optimistic bubble by client_id.
    } catch {
      // Mark the optimistic bubble as failed by leaving it in "sending" state.
    }
  },

  toggleReaction: async (messageId, emoji) => {
    const updated = await api.toggleReaction(messageId, emoji);
    patchMessage(set, updated);
  },

  setTyping: (isTyping) => {
    const { activeId, socket } = get();
    if (activeId) socket?.sendTyping(activeId, isTyping);
  },

  handleEvent: (e) => {
    switch (e.type) {
      case "message": {
        const msg: Message = e.data;
        upsertMessage(set, get, msg, e.client_id);
        // Acknowledge delivery if it's an incoming message in any conversation.
        const me = get().me;
        if (msg.sender_id && me && msg.sender_id !== me.id) {
          get().socket?.ackDelivered(msg.conversation_id, msg.id);
          // If the user is currently viewing this conversation, mark read too.
          if (get().activeId === msg.conversation_id) {
            get().markConversationRead(msg.conversation_id);
          }
        }
        break;
      }
      case "message_update": {
        patchMessage(set, e.data);
        break;
      }
      case "conversation": {
        const conv: Conversation = e.data;
        set((s) => {
          const exists = s.conversations.some((c) => c.id === conv.id);
          const list = exists
            ? s.conversations.map((c) => (c.id === conv.id ? conv : c))
            : [conv, ...s.conversations];
          return { conversations: sortConvs(list) };
        });
        break;
      }
      case "receipt": {
        applyReceipt(set, get, e);
        break;
      }
      case "typing": {
        applyTyping(set, e);
        break;
      }
      case "presence": {
        applyPresence(set, e);
        break;
      }
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortConvs(convs: Conversation[]): Conversation[] {
  return [...convs].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

type SetFn = (fn: (s: State) => Partial<State>) => void;

/** Insert or reconcile an incoming message into the cache + conversation list. */
function upsertMessage(
  set: SetFn,
  get: () => State,
  msg: Message,
  clientId?: string
) {
  set((s) => {
    const existing = s.messages[msg.conversation_id] || [];
    let next: Message[];
    const optimisticIdx = clientId
      ? existing.findIndex((m) => m.id === clientId || m.client_id === clientId)
      : -1;
    if (optimisticIdx >= 0) {
      next = [...existing];
      next[optimisticIdx] = msg; // reconcile optimistic bubble
    } else if (existing.some((m) => m.id === msg.id)) {
      next = existing.map((m) => (m.id === msg.id ? msg : m));
    } else {
      next = [...existing, msg];
    }

    // Update the conversation's last-message + unread count + ordering.
    const me = s.me;
    const isActive = s.activeId === msg.conversation_id;
    const conversations = sortConvs(
      s.conversations.map((c) => {
        if (c.id !== msg.conversation_id) return c;
        const incoming = me && msg.sender_id && msg.sender_id !== me.id;
        const unread = incoming && !isActive ? c.unread_count + 1 : c.unread_count;
        return { ...c, last_message: msg, last_message_at: msg.created_at, unread_count: unread };
      })
    );
    return { messages: { ...s.messages, [msg.conversation_id]: next }, conversations };
  });

  // A brand new conversation we don't know about yet — refresh the list.
  if (!get().conversations.some((c) => c.id === msg.conversation_id)) {
    get().refreshConversations();
  }
}

/** Replace a message everywhere it appears (reactions/edits). */
function patchMessage(set: SetFn, msg: Message) {
  set((s) => {
    const list = s.messages[msg.conversation_id];
    if (!list) return {};
    return {
      messages: {
        ...s.messages,
        [msg.conversation_id]: list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
      },
    };
  });
}

/** Apply a delivered/read receipt to our own sent messages. */
function applyReceipt(set: SetFn, get: () => State, e: any) {
  const convId = e.conversation_id as string;
  const me = get().me;
  set((s) => {
    const list = s.messages[convId];
    if (!list || !me) return {};
    const upTo = e.up_to ? new Date(e.up_to).getTime() : null;
    const next = list.map((m) => {
      if (m.sender_id !== me.id) return m;
      if (e.message_id && m.id !== e.message_id) {
        // single-message delivered ack
      }
      const inRange = e.status === "read" && upTo ? new Date(m.created_at).getTime() <= upTo : true;
      if (e.message_id && m.id === e.message_id && e.status === "delivered") {
        return m.status === "read" ? m : { ...m, status: "delivered" as const };
      }
      if (e.status === "read" && inRange && (m.status === "sent" || m.status === "delivered")) {
        return { ...m, status: "read" as const };
      }
      return m;
    });
    return { messages: { ...s.messages, [convId]: next } };
  });
}

function applyTyping(set: SetFn, e: Extract<WsEvent, { type: "typing" }>) {
  const key = `${e.conversation_id}:${e.user_id}`;
  set((s) => {
    const conv = { ...(s.typing[e.conversation_id] || {}) };
    if (e.is_typing) conv[e.user_id] = e.display_name;
    else delete conv[e.user_id];
    return { typing: { ...s.typing, [e.conversation_id]: conv } };
  });
  // Safety auto-clear so a dropped "stop" event doesn't leave it stuck.
  if (typingTimers[key]) clearTimeout(typingTimers[key]);
  if (e.is_typing) {
    typingTimers[key] = setTimeout(() => {
      set((s) => {
        const conv = { ...(s.typing[e.conversation_id] || {}) };
        delete conv[e.user_id];
        return { typing: { ...s.typing, [e.conversation_id]: conv } };
      });
    }, 4000);
  }
}

function applyPresence(set: SetFn, e: Extract<WsEvent, { type: "presence" }>) {
  set((s) => ({
    conversations: s.conversations.map((c) => ({
      ...c,
      members: c.members.map((m) =>
        m.user.id === e.user_id
          ? { ...m, user: { ...m.user, is_online: e.is_online, last_seen: e.last_seen } }
          : m
      ),
    })),
  }));
}
