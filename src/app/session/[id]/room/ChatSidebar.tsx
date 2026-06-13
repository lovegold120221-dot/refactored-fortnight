"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useLocalParticipant,
  useRoomContext,
  useDataChannel,
} from "@livekit/components-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";

type ChatMessage = {
  id: string;
  from: string;
  fromId: string;
  message: string;
  timestamp: number;
};

const CHAT_TOPIC = "orbit_chat";

export default function ChatSidebar({
  onClose,
  privateTo,
}: {
  onClose: () => void;
  privateTo?: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const { profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Listen for incoming chat messages
  useDataChannel(CHAT_TOPIC, useCallback((msg: { payload: Uint8Array }) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as ChatMessage;
      setMessages((prev) => [...prev, payload]);
    } catch {}
  }, []));

  // Auto-scroll
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    if (!text.trim() || !localParticipant) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: localParticipant.name || localParticipant.identity || "Unknown",
      fromId: localParticipant.identity,
      message: text.trim(),
      timestamp: Date.now(),
    };

    const encoder = new TextEncoder();
    localParticipant.publishData(encoder.encode(JSON.stringify(msg)), {
      topic: CHAT_TOPIC,
      reliable: true,
    });

    // Add locally
    setMessages((prev) => [...prev, msg]);
    setText("");

    // Save public chat to Supabase
    if (!privateTo && profile?.id) {
      supabase.from("chat_messages").insert({
        meeting_id: room.name,
        user_id: profile.id,
        message: msg.message,
      }).then(({ error }) => {
        if (error) console.error("Failed to save chat:", error);
      });
    }
  };

  const display = privateTo
    ? messages.filter((m) => m.fromId === privateTo || m.from === privateTo)
    : messages;

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>{privateTo ? `Chat to ${privateTo}` : "Chat"}</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div ref={bodyRef} className="sidebar-body chat-sidebar-body">
        {display.length === 0 ? (
          <div className="chat-sidebar-empty">No messages yet. Say hi!</div>
        ) : (
          display.map((msg) => (
            <div key={msg.id} className="chat-sidebar-msg-wrapper">
              <div className="chat-sidebar-msg-header">
                <strong>{msg.from}</strong>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="chat-sidebar-msg-content">{msg.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="chat-sidebar-footer">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="chat-sidebar-form"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="chat-sidebar-input"
          />
          <button type="submit" disabled={!text.trim()} className="chat-sidebar-btn">Send</button>
        </form>
      </div>
    </div>
  );
}
