"use client";

import React from "react";
import { type RemoteParticipant } from "livekit-client";
import ParticipantTile from "./ParticipantTile";
import LocalTile from "./LocalTile";

export default function GalleryView({
  remotes,
  myLang,
  isHost,
  roomName,
}: {
  remotes: RemoteParticipant[];
  myLang: string;
  isHost: boolean;
  roomName: string;
}) {
  const count = remotes.length + 1; // +1 for local
  
  let gridClass = "gallery-grid-1";
  let gridStyle: React.CSSProperties = {};
  
  if (count === 1) {
    gridClass = "gallery-grid-1";
    gridStyle = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  } else if (count === 2) {
    gridClass = "gallery-grid-2";
  } else if (count <= 4) {
    gridClass = "gallery-grid-4";
  } else if (count <= 6) {
    gridClass = "gallery-grid-6";
  } else if (count <= 9) {
    gridClass = "gallery-grid-9";
  } else {
    gridClass = "gallery-grid-n";
  }

  return (
    <div className={`gallery-view ${gridClass}`} style={gridStyle}>
      <div className="gallery-view-item">
        <LocalTile myLang={myLang} />
      </div>
      {remotes.map((p) => (
        <div key={p.identity} className="gallery-view-item">
          <ParticipantTile participant={p} myLang={myLang} isHost={isHost} roomName={roomName} />
        </div>
      ))}
    </div>
  );
}
