/* eslint-disable react/forbid-dom-props, react/forbid-component-props, react-native/no-inline-styles */
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { PICKER_LANGUAGES, getLanguageByCode } from "@/lib/languages";
import { useTextStream, useRemoteParticipants } from "@livekit/components-react";

const VOICES = [
  { id: "male1", name: "Male 1" },
  { id: "male2", name: "Male 2" },
  { id: "female1", name: "Female 1" },
  { id: "female2", name: "Female 2" },
];

const TRANSLATION_TOPIC = "lk.translation";

export default function OrbitTranslationPanel({
  onClose,
  myLang,
  onLangChange,
  translationEnabled,
  onToggleTranslation,
  peerLangs,
}: {
  onClose: () => void;
  myLang: string;
  onLangChange: (lang: string) => void;
  translationEnabled: boolean;
  onToggleTranslation: () => void;
  peerLangs: Map<string, string | undefined>;
}) {
  const [voice, setVoice] = useState("male1");
  const { textStreams } = useTextStream(TRANSLATION_TOPIC);
  const remotes = useRemoteParticipants();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of remotes) {
      map.set(p.identity, p.name || p.identity);
    }
    return map;
  }, [remotes]);

  const entries = useMemo(() => {
    const matching = textStreams
      .filter((s) => s.streamInfo.attributes?.target_lang === myLang)
      .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp);

    type Entry = {
      key: string;
      sourceIdentity: string;
      text: string;
      sourceLang: string | undefined;
    };
    const out: Entry[] = [];
    const openIdxBySource = new Map<string, number>();

    for (const s of matching) {
      const source = s.streamInfo.attributes?.source_identity ?? s.participantInfo.identity;
      const isFinal = s.streamInfo.attributes?.final === "true";
      const text = s.text.trim();

      if (isFinal) {
        if (text) {
          const idx = openIdxBySource.get(source);
          if (idx !== undefined) {
            out[idx].text = `${out[idx].text} ${text}`.trim();
          } else {
            out.push({
              key: s.streamInfo.id,
              sourceIdentity: source,
              text,
              sourceLang: peerLangs.get(source),
            });
          }
        }
        openIdxBySource.delete(source);
        continue;
      }

      if (!text) continue;

      const openIdx = openIdxBySource.get(source);
      if (openIdx !== undefined) {
        out[openIdx].text = `${out[openIdx].text} ${text}`.trim();
      } else {
        out.push({
          key: s.streamInfo.id,
          sourceIdentity: source,
          text,
          sourceLang: peerLangs.get(source),
        });
        openIdxBySource.set(source, out.length - 1);
      }
    }
    return out;
  }, [textStreams, myLang, peerLangs]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [entries]);

  return (
    <div className="sidebar-panel">
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

      <div ref={bodyRef} className="sidebar-body">
        {entries.length === 0 ? (
          <div className="captions-empty">
            No transcriptions yet. Translations will appear here as people speak...
          </div>
        ) : (
          entries.map((entry) => (
            <div className="captions-entry" key={entry.key}>
              <div className="captions-speaker">
                <span className="captions-speaker-name">
                  {names.get(entry.sourceIdentity) ?? entry.sourceIdentity}
                </span>
                {entry.sourceLang && (
                  <span className="captions-speaker-lang">
                    {getLanguageByCode(entry.sourceLang)?.name || entry.sourceLang} → {getLanguageByCode(myLang)?.name || myLang}
                  </span>
                )}
              </div>
              <p className="captions-text">{entry.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
