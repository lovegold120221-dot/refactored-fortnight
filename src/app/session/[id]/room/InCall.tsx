"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useDataChannel,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, ParticipantKind, RoomEvent } from "livekit-client";
import { useRouter } from "next/navigation";
import { PARTICIPANT_LANG_ATTR } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";
import { useTranslationRouting } from "./useTranslationRouting";
import SelfView from "./SelfView";
import ControlBar from "./ControlBar";
import CaptionsSidebar from "./CaptionsSidebar";
import ParticipantsPanel from "./ParticipantsPanel";
import ChatSidebar from "./ChatSidebar";
import BreakoutSidebar from "./BreakoutSidebar";
import ActiveSpeaker from "./ActiveSpeaker";
import Filmstrip from "./Filmstrip";
import OrbitTranslationPanel from "./OrbitTranslationPanel";
import { SpeakerIcon, ChevronDownIcon, GridViewIcon } from "./icons";

export default function InCall({
  initialLang,
  onLeave,
}: {
  initialLang: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [lang, setLang] = useState(initialLang);
  const [activeSidebar, setActiveSidebar] = useState<"participants" | "captions" | "translation" | "chat" | "breakout" | null>("participants");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = typeof window !== 'undefined' && window.localStorage.getItem("orbitHostRoom") === room.name;

  useDataChannel("moderate", (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      if (payload.type === "REQUEST_VIDEO" && payload.targetIdentity === localParticipant.identity) {
        if (confirm("The host has requested you to turn on your camera. Turn it on now?")) {
          localParticipant.setCameraEnabled(true);
        }
      }
    } catch (e) {}
  });

  useDataChannel("breakout", (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      if (payload.type === "BREAKOUT_JOIN" && payload.newRoom) {
        alert("You have been assigned to a breakout room. Moving now...");
        router.push(`/session/${payload.newRoom}/room?returnTo=${payload.originalRoom}`);
      } else if (payload.type === "BREAKOUT_END" && payload.originalRoom) {
        alert("Breakout session ended. Returning to main room...");
        router.push(`/session/${payload.originalRoom}/room`);
      }
    } catch (e) {
      // Ignore non-JSON or unrelated messages
    }
  });

  const toggleSidebar = (sidebar: "participants" | "captions" | "translation" | "chat" | "breakout") => {
    setActiveSidebar((current) => (current === sidebar ? null : sidebar));
  };

  // Push the local lang into participant attributes so the agent + peers see
  // it. setAttributes is silently dropped before the room is connected, so we
  // both fire on `lang` change and re-fire when the connection becomes ready.
  useEffect(() => {
    if (!localParticipant || !room) return;
    const apply = () => {
      if (room.state === ConnectionState.Connected) {
        localParticipant.setAttributes({ [PARTICIPANT_LANG_ATTR]: lang });
      }
    };
    apply();
    room.on(RoomEvent.Connected, apply);
    return () => {
      room.off(RoomEvent.Connected, apply);
    };
  }, [room, localParticipant, lang]);

  useTranslationRouting(lang);

  const humanRemotes = useMemo(
    () => remotes.filter((p) => p.kind !== ParticipantKind.AGENT),
    [remotes],
  );
  const peerLangs = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const p of humanRemotes) {
      map.set(p.identity, p.attributes?.[PARTICIPANT_LANG_ATTR]);
    }
    return map;
  }, [humanRemotes]);

  const langInfo = getLanguageByCode(lang);

  const activeSpeaker = humanRemotes.find(p => p.isSpeaking) || humanRemotes[0] || localParticipant;

  return (
    <div className="room-shell">
      <div className="room">
        {/* Top chrome */}
        <header className="orbit-header">
          {/* Row 1: Title bar */}
          <div className="orbit-titlebar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="orbit-titlebar-title">Orbit Meeting</span>
            <button 
              onClick={handleCopyLink} 
              title="Copy Meeting Link"
              style={{ background: 'transparent', border: 'none', color: 'var(--fg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
            {copied && <span style={{fontSize: '11px', color: 'var(--success)'}}>Copied!</span>}
          </div>
          {/* Row 2: Sub-bar with controls */}
          <div className="orbit-subbar">
            <div className="orbit-subbar-left">
              <span className="orbit-sound-badge">
                <span className="orbit-sound-dot" />
                Original Sound: Off
              </span>
              <ChevronDownIcon />
              <span className="orbit-subbar-divider">·</span>
              <span className="orbit-translation-status">
                Translation: {langInfo?.name || lang} &middot; Voice: Orus
              </span>
            </div>
            <div className="orbit-subbar-right">
              <button className="orbit-view-btn">
                <GridViewIcon />
                <span>View</span>
              </button>
            </div>
          </div>

          {/* Mobile topbar content — hidden on desktop */}
          <div className="orbit-topbar-mobile">
            <button className="orbit-mobile-audio" aria-label="Audio">
              <SpeakerIcon />
            </button>
            <button className="orbit-mobile-brand">
              <span className="orbit-mobile-badge">✓</span>
              <span>Orbit</span>
              <ChevronDownIcon />
            </button>
            <button className="orbit-mobile-leave" onClick={async () => { await room.disconnect(); onLeave(); }}>
              Leave
            </button>
          </div>
        </header>

        {/* Stage */}
        <main className="room-stage orbit-stage">
          {/* Participant filmstrip across the top */}
          <Filmstrip participants={humanRemotes} myLang={lang} />
          <div className="orbit-stage-center">
            <ActiveSpeaker participant={activeSpeaker} myLang={lang} />
            {/* We hide the self view if we are the only one, since we're the active speaker */}
            {humanRemotes.length > 0 && <SelfView />}
          </div>
          {/* Right Sidebar Panel */}
          {activeSidebar === "participants" && (
            <ParticipantsPanel 
              participants={humanRemotes} 
              myLang={lang} 
              isHost={isHost}
              roomName={room.name}
              onClose={() => setActiveSidebar(null)}
            />
          )}
          {activeSidebar === "captions" && (
            <CaptionsSidebar
              open={true}
              onClose={() => setActiveSidebar(null)}
              myLang={lang}
              peerLangs={peerLangs}
            />
          )}
          {activeSidebar === "translation" && (
            <OrbitTranslationPanel
              onClose={() => setActiveSidebar(null)}
              myLang={lang}
              onLangChange={setLang}
            />
          )}
          {activeSidebar === "chat" && (
            <ChatSidebar onClose={() => setActiveSidebar(null)} />
          )}
          {activeSidebar === "breakout" && (
            <BreakoutSidebar onClose={() => setActiveSidebar(null)} />
          )}
        </main>

        {/* Control bar */}
        <ControlBar
          onLeave={onLeave}
          activeSidebar={activeSidebar}
          onToggleSidebar={toggleSidebar}
        />
      </div>

    </div>
  );
}
