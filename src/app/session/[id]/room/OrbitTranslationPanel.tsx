"use client";

import { useState } from "react";
import { PICKER_LANGUAGES } from "@/lib/languages";

const VOICES = [
  { id: "male1", name: "Male 1" },
  { id: "male2", name: "Male 2" },
  { id: "female1", name: "Female 1" },
  { id: "female2", name: "Female 2" },
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
  translateScreenShare,
  onToggleTranslateScreenShare,
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
  translateScreenShare: boolean;
  onToggleTranslateScreenShare: () => void;
}) {
  const [voice, setVoice] = useState("male1");

  return (
    <div className="sidebar-panel">
      {/* Header: language dropdown + voice dropdown + radio toggle + close */}
      <div className="sidebar-header otp-header-row">
        <select
          value={myLang}
          onChange={(e) => onLangChange(e.target.value)}
          className="otp-header-select"
          aria-label="Target language"
        >
          {PICKER_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>

        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="otp-header-select"
          aria-label="Voice"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <button
          className={`otp-radio-toggle ${translationEnabled ? "otp-radio-toggle--on" : ""}`}
          onClick={onToggleTranslation}
          title={translationEnabled ? "Stop translation" : "Start translation"}
          aria-label={translationEnabled ? "Stop translation" : "Start translation"}
        >
          <span className="otp-radio-dot" />
        </button>

        <button className="sidebar-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body: transcription + translation text area */}
      <div className="sidebar-body">
        <div className="otp-transcript-area">
          <div className="otp-transcript-box otp-transcript-source">
            <span className="otp-transcript-label">Speaker</span>
            <p className="otp-transcript-text">
              Source transcription will appear here as people speak...
            </p>
          </div>
          <div className="otp-transcript-box otp-transcript-target">
            <span className="otp-transcript-label">
              {PICKER_LANGUAGES.find((l) => l.code === myLang)?.name || myLang}
            </span>
            <p className="otp-transcript-text">
              Translation will appear here...
            </p>
          </div>
        </div>

        <hr className="otp-divider" />

        <div className="otp-section">
          <h4 className="otp-label">Output</h4>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={captionsOpen} onChange={onToggleCaptions} />
            <span>Show captions</span>
          </label>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={muteOriginal} onChange={onToggleMuteOriginal} />
            <span>Duck original audio {muteOriginal ? "15%" : "Off"}</span>
          </label>
          <label className="otp-checkbox-label">
            <input type="checkbox" checked={translateScreenShare} onChange={onToggleTranslateScreenShare} />
            <span>Translate shared screen audio</span>
          </label>
        </div>
      </div>
    </div>
  );
}
