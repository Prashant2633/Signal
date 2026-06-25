"use client";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { useToasts } from "@/lib/ui";
import type { User } from "@/lib/types";
import Avatar from "./Avatar";
import { Lock } from "./icons";

const COLORS = ["#3b7ddd", "#10a37f", "#e6618a", "#f0a500", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6"];

type Step = "identifier" | "otp";

export default function Onboarding({ onAuthed }: { onAuthed: (u: User, token: string) => void }) {
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const push = useToasts((s) => s.push);

  const isPhone = /^[+\d][\d\s]*$/.test(identifier.trim());

  async function requestOtp() {
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      const res = await api.requestOtp(identifier.trim());
      setIsNew(res.is_new_user);
      setDevOtp(res.dev_otp);
      setOtp(res.dev_otp); // pre-fill the demo OTP for convenience
      setStep("otp");
    } catch (e: any) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    try {
      const res = await api.verify({
        identifier: identifier.trim(),
        otp: otp.trim(),
        display_name: isNew ? displayName.trim() : undefined,
        username: isNew && !isPhone ? identifier.trim() : isNew ? username.trim() || undefined : undefined,
        avatar_color: isNew ? color : undefined,
      });
      setToken(res.access_token);
      onAuthed(res.user, res.access_token);
    } catch (e: any) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-blue text-white shadow-lg">
            <Lock width={30} height={30} />
          </div>
          <h1 className="text-2xl font-bold">Signal</h1>
          <p className="mt-1 text-sm text-muted">Speak freely. Privacy that fits in your pocket.</p>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-6 shadow-xl">
          {step === "identifier" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Phone number or username
                </label>
                <input
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                  placeholder="+1 555 000 0001  or  alice"
                  className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm outline-none focus:border-signal-blue"
                />
              </div>
              <button
                onClick={requestOtp}
                disabled={loading || !identifier.trim()}
                className="w-full rounded-lg bg-signal-blue py-2.5 text-sm font-semibold text-white transition hover:bg-signal-bluedark disabled:opacity-50"
              >
                {loading ? "Sending code…" : "Continue"}
              </button>
              <p className="text-center text-xs text-muted">
                Try a seeded account: <span className="font-medium text-ink">alice</span>,{" "}
                <span className="font-medium text-ink">bob</span>,{" "}
                <span className="font-medium text-ink">carol</span> — OTP is{" "}
                <span className="font-medium text-ink">123456</span>
              </p>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {isNew ? "Create your account" : "Welcome back!"} We sent a verification code to{" "}
                <span className="font-medium text-ink">{identifier}</span>.
              </p>

              {isNew && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-elevated p-4">
                  <Avatar name={displayName || "?"} color={color} size={64} />
                  <input
                    autoFocus
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-lg border border-border bg-panel px-3.5 py-2.5 text-center text-sm outline-none focus:border-signal-blue"
                  />
                  {isPhone && (
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username (optional)"
                      className="w-full rounded-lg border border-border bg-panel px-3.5 py-2.5 text-center text-sm outline-none focus:border-signal-blue"
                    />
                  )}
                  <div className="flex flex-wrap justify-center gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`h-7 w-7 rounded-full transition ${
                          color === c ? "ring-2 ring-offset-2 ring-offset-elevated ring-ink" : ""
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">Verification code</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="123456"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-signal-blue"
                />
                <p className="mt-1.5 text-center text-xs text-muted">Demo code: {devOtp}</p>
              </div>

              <button
                onClick={verify}
                disabled={loading || !otp.trim() || (isNew && !displayName.trim())}
                className="w-full rounded-lg bg-signal-blue py-2.5 text-sm font-semibold text-white transition hover:bg-signal-bluedark disabled:opacity-50"
              >
                {loading ? "Verifying…" : isNew ? "Create account" : "Verify & continue"}
              </button>
              <button
                onClick={() => setStep("identifier")}
                className="w-full text-center text-xs text-muted hover:text-ink"
              >
                ← Use a different number
              </button>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          🔒 End-to-end encryption is simulated for this demo.
        </p>
      </div>
    </div>
  );
}
