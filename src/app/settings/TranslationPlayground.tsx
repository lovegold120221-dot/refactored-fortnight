"use client";

import { useState, useCallback, useRef } from "react";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

/**
 * Voice-to-voice translation test playground.
 *
 * Captures raw 16 kHz mono PCM audio via the Web Audio API (matching how the
 * cookbook's PyAudio captures audio for the Gemini Live API), sends it to our
 * server which forwards it through the Live WebSocket with the
 * `gemini-3.5-live-translate-preview` model — the same engine running in
 * meetings — then reads the translation aloud via the browser's SpeechSynthesis.
 */
export default function TranslationPlayground({ voice }: { voice: string }) {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("fr");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AudioContext refs for raw PCM capture
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const recordingRef = useRef(false);

  const sourceName =
    SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.name ?? sourceLang;
  const targetName =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang;

  // ── Record raw PCM via AudioContext ────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscription(null);
    setTranslation(null);
    pcmChunksRef.current = [];
    recordingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create AudioContext at 16 kHz — same rate Gemini expects
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // ScriptProcessorNode: deprecated but universally supported.
      // bufferSize 4096 gives ~256 ms chunks @ 16 kHz.
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!recordingRef.current) return;
        const input = e.inputBuffer.getChannelData(0); // Float32
        // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
        }
        pcmChunksRef.current.push(int16);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setRecording(true);
    } catch (err) {
      recordingRef.current = false;
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic access in your browser."
          : err instanceof Error
            ? err.message
            : "Failed to access microphone.",
      );
    }
  }, []);

  // ── Send to Gemini Live proxy ──────────────────────────────────

  const sendForTranslation = useCallback(
    async (pcmBase64: string) => {
      setProcessing(true);
      setError(null);

      try {
        const res = await fetch("/api/translate-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: pcmBase64,
            sourceLang,
            targetLang,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const data = await res.json();
        setTranscription(data.transcription || null);
        setTranslation(data.translation || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Translation request failed",
        );
      } finally {
        setProcessing(false);
      }
    },
    [sourceLang, targetLang],
  );

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);

    // Close AudioContext and stop mic tracks
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    processorNodeRef.current = null;
    sourceNodeRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Combine all PCM chunks into one buffer
    const chunks = pcmChunksRef.current;
    if (chunks.length === 0) return;

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    pcmChunksRef.current = [];

    // Helper: Int16Array → base64
    const int16ToBase64 = (arr: Int16Array): string => {
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    // Trim trailing silence (samples below level 150)
    const MIN_LEVEL = 150;
    let endIdx = combined.length;
    while (endIdx > 0 && Math.abs(combined[endIdx - 1]) < MIN_LEVEL) {
      endIdx--;
    }
    const pcmBase64 =
      endIdx > combined.length / 2
        ? int16ToBase64(combined.slice(0, endIdx))
        : int16ToBase64(combined);

    sendForTranslation(pcmBase64);
  }, [sendForTranslation]);

  // ── Send to Gemini Live proxy ──────────────────────────────────



  // ── Play translation aloud ─────────────────────────────────────

  const handlePlayTranslation = useCallback(() => {
    if (!translation) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translation);
    utterance.lang = targetLang;
    if (targetLang === "en") utterance.lang = "en-US";
    else if (targetLang === "pt") utterance.lang = "pt-BR";
    else if (targetLang === "zh") utterance.lang = "zh-CN";

    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(targetLang));
    if (match) utterance.voice = match;

    utterance.rate = 0.9;
    utterance.onerror = () => setError("Speech playback failed.");
    window.speechSynthesis.speak(utterance);
  }, [translation, targetLang]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="settings-playground">
      <h3 className="settings-playground-title">
        🎤 Voice Translation Test
      </h3>
      <p className="settings-playground-desc">
        Speak into your mic and hear real-time translation powered by the same
        Gemini engine running in meetings. Record a short phrase and the system
        will transcribe it, translate it, and read it back to you.
      </p>

      {/* Language selectors */}
      <div className="settings-playground-row">
        <div className="settings-playground-field">
          <label className="settings-label" htmlFor="source-lang-select">I speak</label>
          <select
            id="source-lang-select"
            className="settings-select"
            title="Source language"
            aria-label="Source language"
            value={sourceLang}
            onChange={(e) => {
              setSourceLang(e.target.value);
              setTranscription(null);
              setTranslation(null);
              setError(null);
            }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-playground-arrow">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
        <div className="settings-playground-field">
          <label className="settings-label" htmlFor="target-lang-select">Translate to</label>
          <select
            id="target-lang-select"
            className="settings-select"
            title="Target language"
            aria-label="Target language"
            value={targetLang}
            onChange={(e) => {
              setTargetLang(e.target.value);
              setTranscription(null);
              setTranslation(null);
              setError(null);
            }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status + Record button */}
      <div className="settings-playground-voice-area">
        {processing ? (
          <div className="settings-playground-processing">
            <div className="settings-playground-spinner" />
            <span>Translating…</span>
          </div>
        ) : (
          <button
            className={`settings-playground-record-btn ${recording ? "is-recording" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
          >
            <span className="settings-playground-record-icon">
              {recording ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </span>
            {/* text label removed as requested */}
          </button>
        )}

        <p className="settings-playground-voice-hint">
          {recording
            ? "Speak now… click Stop when done."
            : "Click the mic and speak a short phrase (2–10 seconds)."}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="settings-playground-error">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {translation && (
        <div className="settings-playground-result">
          <div className="settings-playground-result-header">
            <span className="settings-label">
              Translation ({sourceName} → {targetName})
            </span>
            <button
              className="settings-playground-play-btn"
              onClick={handlePlayTranslation}
              title="Read translation aloud"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Play
            </button>
          </div>

          {transcription && (
            <div className="settings-playground-transcription">
              <span className="settings-playground-trans-label">
                You said ({sourceName}):
              </span>
              <p className="settings-playground-trans-text">
                {transcription}
              </p>
            </div>
          )}

          <div className="settings-playground-translation">
            <span className="settings-playground-trans-label">
              Translation ({targetName})
              <span className="settings-playground-voice-name">
                · Voice: {voice}
              </span>
            </span>
            <p className="settings-playground-trans-text">
              {translation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
