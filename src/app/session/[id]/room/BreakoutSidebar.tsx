/* eslint-disable react/forbid-dom-props, react/forbid-component-props, react-native/no-inline-styles */
"use client";

import { useParticipants, useRoomContext } from "@livekit/components-react";
import { useState } from "react";

export default function BreakoutSidebar({ onClose }: { onClose: () => void }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [loading, setLoading] = useState(false);

  const handleStartBreakout = async () => {
    setLoading(true);
    try {
      // Simple auto-assign: divide into 2 rooms
      const assignments: { identity: string; newRoom: string }[] = [];
      
      // Exclude local participant (host) if you want them to stay in main room,
      // but for testing, let's just assign everyone except maybe the host?
      // We'll just assign everyone.
      participants.forEach((p, index) => {
        const roomSuffix = (index % 2) + 1; // 1 or 2
        assignments.push({
          identity: p.identity,
          newRoom: `${room.name}-breakout-${roomSuffix}`,
        });
      });

      const res = await fetch("/api/breakout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          originalRoom: room.name,
          assignments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Breakout rooms started! Participants are being moved.");
    } catch (e: any) {
      alert("Failed to start breakouts: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreakout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/breakout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          originalRoom: room.name,
          breakoutRooms: [`${room.name}-breakout-1`, `${room.name}-breakout-2`],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Breakout rooms ended! Participants are returning.");
    } catch (e: any) {
      alert("Failed to end breakouts: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>Breakout Rooms</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      
      <div className="sidebar-body sidebar-body-breakout">
        <p className="breakout-desc">
          Automatically divide the {participants.length} current participants into 2 breakout rooms.
        </p>

        <button 
          onClick={handleStartBreakout}
          disabled={loading || participants.length === 0}
          className="btn btn-accent breakout-btn"
          data-loading={loading ? "true" : "false"}
          data-disabled={participants.length === 0 ? "true" : "false"}
        >
          Start Breakout Rooms
        </button>

        <button 
          onClick={handleEndBreakout}
          disabled={loading}
          className="btn btn-dark breakout-btn"
          data-loading={loading ? "true" : "false"}
        >
          End Breakout Rooms
        </button>
      </div>
    </div>
  );
}
