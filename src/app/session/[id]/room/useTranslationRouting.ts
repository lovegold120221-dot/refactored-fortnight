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
 * language. Encodes the routing predicate from *   translationEnabled=true:
 *     - for each remote human participant P:
 *         hearNative = (myLang === 'none' OR P.lang === myLang)
 *         ALWAYS subscribe to mic and screen share audio
 *         If !hearNative AND muteOriginal (which now acts as duckOriginal):
 *           → lower volume of the source track to 15% (ducking)
 *         Else:
 *           → set volume to 100%
 * language and preferences.
 *
 * Behavior matrix:
 *
 *   translationEnabled=false (passthrough):
 *     - all human mic tracks subscribed (hear everyone directly)
 *     - all agent translation tracks unsubscribed
 *
 *   translationEnabled=true:
 *     - for each remote human participant P:
 *         hearNative = (myLang === 'none' OR P.lang === myLang)
 *         subscribe to mic IF hearNative OR !muteOriginal
 *           → hearNative: same language → no filter needed
 *           → !muteOriginal: user wants to hear original + translation
 *         unsubscribe from mic IF !hearNative AND muteOriginal
 *           → user hears only the translated version
 *     - for the agent:
 *         subscribe to a translation track IF
 *           target_lang === myLang AND
 *           source speaker's lang !== myLang
 *         else unsubscribe
 */
export function useTranslationRouting(myLang: string, translationEnabled: boolean = true, muteOriginal: boolean = true) {
export function useTranslationRouting(
  myLang: string,
  translationEnabled: boolean,
  muteOriginal: boolean,
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
  if (!translationEnabled) {
    // Passthrough: subscribe to all human mic tracks.
    for (const pub of p.audioTrackPublications.values()) {
      if (pub.source !== Track.Source.Microphone) continue;
      setSubscribed(pub, true);
    }
    return;
  }

  // Translation is on: subscribe based on language match + muteOriginal.
  const theirLang = p.attributes?.[PARTICIPANT_LANG_ATTR];
  const hearNative = myLang === NATIVE_LANG || theirLang === myLang;
  const shouldSubscribe = hearNative || !muteOriginal;

  for (const pub of p.audioTrackPublications.values()) {
    if (pub.source !== Track.Source.Microphone && pub.source !== Track.Source.ScreenShareAudio) continue;
    
    // Always subscribe to human tracks so we can duck them instead of muting completely
    setSubscribed(pub, true);
    
    if (pub.track && pub.track instanceof Track) {
      // livekit-client Track class has a setVolume method (inherited or directly on RemoteAudioTrack)
      // Since it's an audio track, we cast and call it if it exists.
      const audioTrack = pub.track as any;
      if (typeof audioTrack.setVolume === "function") {
        if (!translationEnabled || hearNative || !muteOriginal) {
          audioTrack.setVolume(1.0);
        } else {
          audioTrack.setVolume(0.15); // Duck the volume
        }
      }
    }
    if (pub.source !== Track.Source.Microphone) continue;
    setSubscribed(pub, shouldSubscribe);
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
    const speakerLang = peerLangs.get(parsed.sourceIdentity);
    const speakerNotMyLang = speakerLang !== myLang;

    setSubscribed(pub, matchesMe && speakerNotMyLang);
  }
}

function setSubscribed(pub: RemoteTrackPublication, desired: boolean) {
  if (pub.isSubscribed !== desired) {
    pub.setSubscribed(desired);
  }
}
