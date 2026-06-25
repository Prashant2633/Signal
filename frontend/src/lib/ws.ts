// Reconnecting WebSocket wrapper. Emits parsed server events to a single handler.

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WsEvent =
  | { type: "message"; data: any; client_id?: string }
  | { type: "message_update"; data: any }
  | { type: "conversation"; data: any }
  | { type: "receipt"; [k: string]: any }
  | { type: "typing"; conversation_id: string; user_id: string; display_name: string; is_typing: boolean }
  | { type: "presence"; user_id: string; is_online: boolean; last_seen: string | null };

export class SignalSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private onEvent: (e: WsEvent) => void;
  private shouldRun = false;
  private retry = 0;

  constructor(token: string, onEvent: (e: WsEvent) => void) {
    this.token = token;
    this.onEvent = onEvent;
  }

  connect() {
    this.shouldRun = true;
    this.open();
  }

  private open() {
    if (!this.shouldRun) return;
    this.ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(this.token)}`);

    this.ws.onopen = () => {
      this.retry = 0;
    };
    this.ws.onmessage = (ev) => {
      try {
        this.onEvent(JSON.parse(ev.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = () => {
      if (!this.shouldRun) return;
      // Exponential backoff capped at 5s.
      this.retry = Math.min(this.retry + 1, 5);
      setTimeout(() => this.open(), this.retry * 1000);
    };
    this.ws.onerror = () => this.ws?.close();
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.send({ type: "typing", conversation_id: conversationId, is_typing: isTyping });
  }

  ackDelivered(conversationId: string, messageId: string) {
    this.send({ type: "delivered", conversation_id: conversationId, message_id: messageId });
  }

  close() {
    this.shouldRun = false;
    this.ws?.close();
    this.ws = null;
  }
}
