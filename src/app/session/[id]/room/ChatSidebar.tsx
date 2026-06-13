/* eslint-disable react/forbid-dom-props, react/forbid-component-props, react-native/no-inline-styles */
"use client";

import { useChat, useRoomContext } from "@livekit/components-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import { useState, useRef, useEffect } from "react";

export default function ChatSidebar({
  onClose,
  privateTo,
}: {
  onClose: () => void;
  privateTo?: string;
}) {
  const { send, chatMessages } = useChat();
  const room = useRoomContext();
  const { profile } = useUser();
  const [message, setMessage] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const text = message.trim();
      send(text);
      
      // Save to Supabase if it is a public chat
      if (!privateTo && profile?.id) {
        supabase.from("chat_messages").insert({
          meeting_id: room.name,
          user_id: profile.id,
          message: text
        }).then(({ error }) => {
          if (error) console.error("Failed to save chat message to Supabase:", error);
        });
      }
      
      setMessage("");
    }
  };

  const filtered = privateTo
    ? chatMessages.filter((m) => m.from?.identity === privateTo || m.from?.name === privateTo)
    : chatMessages;

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
        {filtered.length === 0 ? (
          <div className="chat-sidebar-empty">No messages yet. Say hi!</div>
        ) : (
          filtered.map((msg, i) => (
            <div key={i} className="chat-sidebar-msg-wrapper">
              <div className="chat-sidebar-msg-header">
                <strong>{msg.from?.name || msg.from?.identity || "Unknown"}</strong>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="chat-sidebar-msg-content">{msg.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="chat-sidebar-footer">
        <form onSubmit={handleSubmit} className="chat-sidebar-form">
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="chat-sidebar-input" />
          <button type="submit" disabled={!message.trim()} className="chat-sidebar-btn">Send</button>
        </form>
      </div>
    </div>
  );
}
