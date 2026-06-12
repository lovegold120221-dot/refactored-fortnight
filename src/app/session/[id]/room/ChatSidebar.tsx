/* eslint-disable react/forbid-dom-props, react/forbid-component-props, react-native/no-inline-styles */
"use client";

import { useChat } from "@livekit/components-react";
import { useState, useRef, useEffect } from "react";

export default function ChatSidebar({ onClose }: { onClose: () => void }) {
  const { send, chatMessages } = useChat();
  const [message, setMessage] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      send(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>Chat</span>
        <button
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      
      <div ref={bodyRef} className="sidebar-body chat-sidebar-body">
        {chatMessages.length === 0 ? (
          <div className="chat-sidebar-empty">
            No messages yet. Say hi!
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="chat-sidebar-msg-wrapper">
              <div className="chat-sidebar-msg-header">
                <strong>{msg.from?.name || msg.from?.identity || "Unknown"}</strong>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="chat-sidebar-msg-content">
                {msg.message}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-sidebar-footer">
        <form onSubmit={handleSubmit} className="chat-sidebar-form">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="chat-sidebar-input"
          />
          <button 
            type="submit"
            disabled={!message.trim()}
            className="chat-sidebar-btn"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
