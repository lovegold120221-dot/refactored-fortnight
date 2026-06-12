"use client";

import React, { useState, useRef } from "react";
import {
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  CamOffIcon,
  CamOnIcon,
  CaptionsIcon,
  MicOffIcon,
  MicOnIcon,
  SecurityIcon,
  ParticipantsIcon,
  ChatIcon,
  ShareScreenIcon,
  TranslateIcon,
  RecordIcon,
  ReactionsIcon,
  MoreIcon,
  PollIcon,
  BreakoutRoomsIcon,
  CaretUpIcon,
} from "./icons";

export default function ControlBar({
  onLeave,
  activeSidebar,
  onToggleSidebar,
}: {
  onLeave: () => void;
  activeSidebar: "participants" | "captions" | "translation" | "chat" | "breakout" | null;
  onToggleSidebar: (sidebar: "participants" | "captions" | "translation" | "chat" | "breakout") => void;
}) {
  const { localParticipant, microphoneTrack, cameraTrack } = useLocalParticipant();
  const room = useRoomContext();
  const [isLocalRecording, setIsLocalRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const micOn = !!microphoneTrack && !microphoneTrack.isMuted;
  const camOn =
    !!cameraTrack &&
    cameraTrack.source === Track.Source.Camera &&
    !cameraTrack.isMuted;
  const screenShareOn = localParticipant.isScreenShareEnabled;

  async function toggleMic() {
    await localParticipant.setMicrophoneEnabled(!micOn);
  }
  async function toggleCam() {
    await localParticipant.setCameraEnabled(!camOn);
  }
  async function toggleScreenShare() {
    await localParticipant.setScreenShareEnabled(!screenShareOn);
  }
  async function toggleRecording() {
    if (isLocalRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsLocalRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = `recording-${room.name}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
        setIsLocalRecording(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsLocalRecording(true);

      // Stop recording if the user closes the screen share via the browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Failed to start screen recording: " + msg);
      setIsLocalRecording(false);
    }
  }
  function toggleBreakout() {
    onToggleSidebar("breakout");
  }
  async function leave() {
    await room.disconnect();
    onLeave();
  }

  return (
    <div className="control-bar">
      {/* ——— Left: Audio / Video ——— */}
      <div className="control-bar-left">
        <CtrlButton
          active={micOn}
          onClick={toggleMic}
          label={micOn ? "Mute" : "Unmute"}
          icon={micOn ? <MicOnIcon /> : <MicOffIcon />}
          dataMobile="primary"
          muted={!micOn}
          hasCaret
        />
        <CtrlButton
          active={camOn}
          onClick={toggleCam}
          label={camOn ? "Stop Video" : "Start Video"}
          icon={camOn ? <CamOnIcon /> : <CamOffIcon />}
          dataMobile="primary"
          hasCaret
        />
      </div>

      {/* ——— Center: Features ——— */}
      <div className="control-bar-center">
        <CtrlButton
          active={false}
          onClick={() => {}}
          label="Security"
          icon={<SecurityIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={activeSidebar === "participants"}
          onClick={() => onToggleSidebar("participants")}
          label="Participants"
          icon={<ParticipantsIcon />}
          dataMobile="overflow"
          hasCaret
        />
        {/* Mobile "People" alias */}
        <CtrlButton
          active={activeSidebar === "participants"}
          onClick={() => onToggleSidebar("participants")}
          label="People"
          icon={<ParticipantsIcon />}
          dataMobile="primary-people"
        />
        <CtrlButton
          active={activeSidebar === "chat"}
          onClick={() => onToggleSidebar("chat")}
          label="Chat"
          icon={<ChatIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={screenShareOn}
          onClick={toggleScreenShare}
          label={screenShareOn ? "Stop Sharing" : "Share Screen"}
          icon={<ShareScreenIcon />}
          dataMobile="primary-share"
          hasCaret
          className="ctrl-share"
        />
        <CtrlButton
          active={activeSidebar === "translation"}
          onClick={() => onToggleSidebar("translation")}
          label="Translate"
          icon={<TranslateIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={activeSidebar === "captions"}
          onClick={() => onToggleSidebar("captions")}
          label="Captions"
          icon={<CaptionsIcon />}
          dataMobile="overflow"
          hasCaret
        />
        <CtrlButton
          active={false}
          onClick={() => {}}
          label="Polling"
          icon={<PollIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={isLocalRecording}
          onClick={toggleRecording}
          label="Record"
          icon={<RecordIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={activeSidebar === "breakout"}
          onClick={toggleBreakout}
          label="Breakout"
          icon={<BreakoutRoomsIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={false}
          onClick={() => {}}
          label="Reactions"
          icon={<ReactionsIcon />}
          dataMobile="overflow"
          hasCaret
        />
      </div>

      {/* ——— Right: Leave & More ——— */}
      <div className="control-bar-right">
        <button
          className="ctrl ctrl--warning ctrl-leave ctrl-desktop-leave"
          onClick={leave}
          title="Leave the call"
          aria-label="Leave"
        >
          Leave
        </button>
        {/* Mobile only */}
        <CtrlButton
          active={false}
          onClick={() => {}}
          label="More"
          icon={<MoreIcon />}
          dataMobile="more"
        />
      </div>
    </div>
  );
}

function CtrlButton({
  active,
  onClick,
  label,
  icon,
  dataMobile,
  hasCaret,
  muted,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  dataMobile?: string;
  hasCaret?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`ctrl${active ? " ctrl--active" : ""}${muted ? " ctrl--muted" : ""} ${className}`.trim()}
      onClick={onClick}
      title={label}
      aria-label={label}
      data-mobile={dataMobile}
    >
      <span className="ctrl-icon-row">
        <span className="ctrl-icon">{icon}</span>
        {hasCaret && <span className="ctrl-caret"><CaretUpIcon /></span>}
      </span>
      <span className="ctrl-label">{label}</span>
    </button>
  );
}
