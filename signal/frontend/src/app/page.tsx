"use client";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/ui";
import type { User } from "@/lib/types";
import Onboarding from "@/components/Onboarding";
import Messenger from "@/components/Messenger";
import Toasts from "@/components/Toasts";

/**
 * Entry point. Restores the session from the stored JWT (if any), otherwise
 * shows onboarding. Once authenticated it boots the store (which opens the
 * WebSocket and loads conversations) and renders the messenger.
 */
export default function Home() {
  const me = useStore((s) => s.me);
  const bootstrap = useStore((s) => s.bootstrap);
  const initTheme = useTheme((s) => s.init);
  const [loading, setLoading] = useState(true);

  async function authed(user: User, token: string) {
    await bootstrap(user, token);
  }

  useEffect(() => {
    initTheme();
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Restore session: validate token, then boot.
    api
      .me()
      .then((user) => bootstrap(user, token))
      .catch(() => {
        /* invalid token — fall through to onboarding */
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-muted">
        <div className="animate-pulse text-sm">Loading Signal…</div>
      </div>
    );
  }

  return (
    <>
      {me ? <Messenger /> : <Onboarding onAuthed={authed} />}
      <Toasts />
    </>
  );
}
