"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import NavRail, { View } from "./NavRail";
import ConversationList from "./ConversationList";
import ChatPane from "./ChatPane";
import ComingSoon from "./ComingSoon";
import NewChatModal from "./NewChatModal";
import NewGroupModal from "./NewGroupModal";
import SettingsModal from "./SettingsModal";
import { Phone, Video } from "./icons";

/** Top-level three-column messenger shell with responsive mobile behaviour. */
export default function Messenger() {
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectConversation);
  const [view, setView] = useState<View>("chats");
  const [newChat, setNewChat] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [settings, setSettings] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
      <NavRail view={view} setView={setView} onSettings={() => setSettings(true)} />

      {view === "chats" ? (
        <div className="flex min-w-0 flex-1">
          {/* List column — hidden on mobile when a chat is open */}
          <div
            className={`${activeId ? "hidden md:flex" : "flex"} w-full flex-col md:w-[340px] md:shrink-0`}
          >
            <ConversationList onCompose={() => setNewChat(true)} />
          </div>
          {/* Chat pane — hidden on mobile when no chat is open */}
          <div className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1`}>
            <ChatPane onBack={() => select(null)} />
          </div>
        </div>
      ) : view === "calls" ? (
        <ComingSoon
          title="Calls"
          description="Voice and video calls will appear here. Make secure, private calls to your contacts."
          icon={<Phone width={36} height={36} />}
        />
      ) : (
        <ComingSoon
          title="Stories"
          description="Share photo and video updates that disappear after 24 hours with your connections."
          icon={<Video width={36} height={36} />}
        />
      )}

      <NewChatModal
        open={newChat}
        onClose={() => setNewChat(false)}
        onNewGroup={() => {
          setNewChat(false);
          setNewGroup(true);
        }}
      />
      <NewGroupModal open={newGroup} onClose={() => setNewGroup(false)} />
      <SettingsModal open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
