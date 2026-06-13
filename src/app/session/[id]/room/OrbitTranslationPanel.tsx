"use client";

import { useState } from "react";
import { PICKER_LANGUAGES } from "@/lib/languages";

const VOICES = [
  { id: "orus", name: "Orus", type: "Formal" },
  { id: "aoede", name: "Aoede", type: "Female" },
  { id: "kore", name: "Kore", type: "" },
  { id: "puck", name: "Puck", type: "" },
  { id: "charon", name: "Charon", type: "" },
  { id: "fenrir", name: "Fenrir", type: "" },
  { id: "leda", name: "Leda", type: "" },
];

export default function OrbitTranslationPanel({
  onClose,
  myLang,
  onLangChange,
  translationEnabled,
  muteOriginal,
  onToggleTranslation,
  onToggleMuteOriginal,
  captionsOpen,
  onToggleCaptions,
}: {
  onClose: () => void;
  myLang: string;
  onLangChange: (lang: string) => void;
  translationEnabled: boolean;
  muteOriginal: boolean;
  onToggleTranslation: () => void;
  onToggleMuteOriginal: () => void;
  captionsOpen: boolean;
  onToggleCaptions: () => void;
}) {
  const [voice, setVoice] = useState("orus");

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <span>Orbit Translation</span>
          <span
            className={`otp-status ${translationEnabled ? "otp-status-on" : "otp-status-off"}`}
            title={translationEnabled ? "Translation active" : "Translation off"}
          >
            {translationEnabled ? "Active" : "Off"}
          </span>
        </div>
        <div className="sidebar-header-right">
          <button
            className={`otp-start-btn ${translationEnabled ? "otp-start-btn-on" : ""}`}
            onClick={onToggleTranslation}
            title={translationEnabled ? "Stop translation" : "Start translation"}
          >
            {translationEnabled ? "Stop" : "Start"}
          </button>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        <div className="otp-section">
          <label className="otp-label" htmlFor="otp-lang-select">Target Language</label>
          <select
            id="otp-lang-select"
            value={myLang}
            onChange={(e) => onLangChange(e.target.value)}
            className="select-field otp-select"
            aria-label="Target language"
          >
            {PICKER_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="otp-section">
          <label className="otp-label" htmlFor="otp-voice-select">Voice</label>
          <select
            id="otp-voice-select"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="select-field otp-select"
            aria-label="Voice"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.type ? `· ${v.type}` : ""}
              </option>
            ))}
          </select>
        </div>

        <hr className="otp-divider" />

        <div className="otp-section">
          <h4 className="otp-label">Audio Source</h4>
          <label className="otp-radio-label">
            <input type="radio" name="audio-source" defaultChecked />
            <span>Auto</span>
          </label>
          <label className="otp-radio-label otp-disabled">
            <input type="radio" name="audio-source" disabled />
            <span>Participants</span>
          </label>
          <label className="otp-radio-label otp-disabled">
            <input type="radio" name="audio-source" disabled />
            <span>Shared Screen</span>
          </label>
          <label className="otp-radio-label otp-disabled">
            <input type="radio" name="audio-source" disabled />
            <span>System Audio</span>
          </label>
        </div>

        <hr className="otp-divider" />

        <div className="otp-section">
          <h4 className="otp-label">Output</h4>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={translationEnabled} onChange={onToggleTranslation} />
            <span>Play translated audio to me</span>
          </label>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={captionsOpen} onChange={onToggleCaptions} />
            <span>Show captions</span>
          </label>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={muteOriginal} onChange={onToggleMuteOriginal} />
            <span>Mute original audio: {muteOriginal ? "On" : "Off"}</span>
          </label>
        </div>

      </div>
    </div>
  );
}
