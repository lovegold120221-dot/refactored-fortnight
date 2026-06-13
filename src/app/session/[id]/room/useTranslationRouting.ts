"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import {
  ParticipantKind,
  RoomEvent,
  type RemoteParticipant,
  type RemoteTrackPublication,
  Track,
} from "livekit-client";
import { NATIVE_LANG, PARTICIPANT_LANG_ATTR } from "@/lib/config";

// Translator-track name format set by the Python agent in
// translator/src/session.py: f"tx:{speaker_identity}:{target_lang}"
const TRANSLATION_TRACK_PREFIX = "tx:";

function parseTranslationTrackName(
  name: string,
): { sourceIdentity: string; targetLang: string; trackSource: string } | null {
  if (!name.startsWith(TRANSLATION_TRACK_PREFIX)) return null;
  const parts = name.slice(TRANSLATION_TRACK_PREFIX.length).split(":");
  if (parts.length < 3) {
    // Fallback for old sessions that didn't have trackSource
    if (parts.length === 2) {
      return { sourceIdentity: parts[0], targetLang: parts[1], trackSource: "mic" };
    }
    return null;
  }
  const targetLang = parts.pop()!;
  const trackSource = parts.pop()!;
  const sourceIdentity = parts.join(":");
  if (!sourceIdentity || !targetLang || !trackSource) return null;
  return { sourceIdentity, targetLang, trackSource };
}

/**
 * Subscribes/unsubscribes to audio tracks based on the listener's chosen
 * language and preferences.
 *
 * Behavior matrix:
 *
 *   translationEnabled=false (passthrough):
 *     - all human mic + screen share tracks subscribed (hear everyone directly)
 *     - all agent translation tracks unsubscribed
 *
 *   translationEnabled=true:
 *     - for each remote human participant P:
 *         ALWAYS subscribe to mic + screen share audio
 *         Mic: If !hearNative AND muteOriginal: duck volume to 15%
 *              Else: set volume to 100%
 *         Screen share audio: If muteOriginal: duck volume to 15%
 *                             Else: set volume to 100%
 *     - for the agent:
 *         subscribe to a mic translation track IF
 *           target_lang === myLang AND
 *           source speaker's lang !== myLang
 *         subscribe to a screen_share_audio translation track IF
 *           target_lang === myLang
 *         (screen share content may be in a different language than
 *          the sharer's declared language, so we always translate it)
 */
export function useTranslationRouting(
  myLang: string,
  translationEnabled: boolean = true,
  muteOriginal: boolean = true,
) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const apply = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      const peerLangs = new Map<string, string | undefined>();
      for (const p of remotes) {
        if (p.kind === ParticipantKind.AGENT) continue;
        peerLangs.set(p.identity, p.attributes?.[PARTICIPANT_LANG_ATTR]);
      }

      for (const p of remotes) {
        if (p.kind === ParticipantKind.AGENT) {
          applyAgentSubscriptions(p, myLang, peerLangs, translationEnabled);
        } else {
          applyHumanSubscriptions(p, myLang, translationEnabled, muteOriginal);
        }
      }
    };

    apply();

    const handlers: Array<[Parameters<typeof room.on>[0], () => void]> = [
      [RoomEvent.ParticipantConnected, apply],
      [RoomEvent.ParticipantDisconnected, apply],
      [RoomEvent.ParticipantAttributesChanged, apply],
      [RoomEvent.TrackPublished, apply],
      [RoomEvent.TrackUnpublished, apply],
      [RoomEvent.LocalTrackPublished, apply],
    ];
    for (const [event, handler] of handlers) {
      room.on(event, handler);
    }
    return () => {
      for (const [event, handler] of handlers) {
        room.off(event, handler);
      }
    };
  }, [room, myLang, translationEnabled, muteOriginal]);
}

function applyHumanSubscriptions(
  p: RemoteParticipant,
  myLang: string,
  translationEnabled: boolean,
  muteOriginal: boolean,
) {
  const theirLang = p.attributes?.[PARTICIPANT_LANG_ATTR];
  const hearNative = myLang === NATIVE_LANG || theirLang === myLang;

  for (const pub of p.audioTrackPublications.values()) {
    if (pub.source !== Track.Source.Microphone && pub.source !== Track.Source.ScreenShareAudio) continue;
    
    // Always subscribe to human tracks so we can duck them instead of muting completely
    setSubscribed(pub, true);

    const isScreenShareAudio = pub.source === Track.Source.ScreenShareAudio;
    
    if (pub.track && pub.track instanceof Track) {
      const audioTrack = pub.track as Track & { setVolume?: (volume: number) => void };
      if (typeof audioTrack.setVolume === "function") {
        if (!translationEnabled || !muteOriginal) {
          audioTrack.setVolume(1.0);
        } else if (isScreenShareAudio) {
          // Screen share audio: duck to 15% when translation is on AND muteOriginal
          // is on, because the listener should hear the translated version instead.
          // If translation isn't producing audio (e.g., no listeners with a different
          // language exist), the translated track won't exist and this is the only
          // audio — so duck less aggressively (0.4 instead of 0.15).
          audioTrack.setVolume(0.4);
        } else if (!hearNative) {
          // Mic audio: duck only when the speaker's language differs from ours.
          audioTrack.setVolume(0.15);
        } else {
          audioTrack.setVolume(1.0);
        }
      }
    }
  }
}

function applyAgentSubscriptions(
  agent: RemoteParticipant,
  myLang: string,
  peerLangs: Map<string, string | undefined>,
  translationEnabled: boolean,
) {
  for (const pub of agent.audioTrackPublications.values()) {
    const parsed = parseTranslationTrackName(pub.trackName);
    if (!parsed) {
      // Not a translation track (e.g., agent state audio). Don't touch.
      continue;
    }

    // When translation is off or user wants native only: never agent tracks.
    if (!translationEnabled || myLang === NATIVE_LANG) {
      setSubscribed(pub, false);
      continue;
    }

    const matchesMe = parsed.targetLang === myLang;
    if (!matchesMe) {
      setSubscribed(pub, false);
      continue;
    }

    if (parsed.trackSource === "screen_share_audio") {
      // Screen share content (e.g. a video in a different language) doesn't
      // respect the sharer's declared language. Always translate it when
      // the user wants this target language.
      setSubscribed(pub, true);
    } else {
      // Mic translation: only subscribe when the speaker's declared language
      // differs from ours — same-language pairs hear each other natively.
      const speakerLang = peerLangs.get(parsed.sourceIdentity);
      setSubscribed(pub, speakerLang !== myLang);
    }
  }
}

function setSubscribed(pub: RemoteTrackPublication, desired: boolean) {
  if (pub.isSubscribed !== desired) {
    pub.setSubscribed(desired);
  }
}
