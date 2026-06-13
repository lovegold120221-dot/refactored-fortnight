# 🛸 Orbit Meeting — by Eburon AI

**Real-time AI voice translation for video meetings.**  
Speak your language. Hear theirs. Translation spins up on demand — same-language pairs cost nothing.

Proudly built by [Eburon AI](https://eburon.ai) — founded by Joe Lernout.

![architecture](https://img.shields.io/badge/architecture-peer--call-1A1917) ![agent](https://img.shields.io/badge/agent-python-3776AB) ![web](https://img.shields.io/badge/web-nextjs-000000) ![pwa](https://img.shields.io/badge/pwa-ready-8B5CF6) ![android](https://img.shields.io/badge/android-capacitor-34D058)

---

## What it does

Anyone with the link joins as a peer. Each participant picks one language — that's what they speak **and** what they want to hear everyone else in. When someone speaks, a Gemini Live session translates their audio into every other distinct language present in the room, on demand.

- **8-person rooms** by default (configurable)
- **240+ languages** — pick yours from the world's most comprehensive language list
- **Mic + camera** default off; toggle when you're ready
- **Captions sidebar** with auto-scroll transcripts in each listener's language
- **Screen share with audio translation** — shared content is always translated regardless of the sharer's declared language
- **Start/stop translation** — toggle per meeting from the sidebar
- **Mute original audio** — hear only the translation when you want
- **Gallery View** — responsive grid layout, full-screen when alone, clean tiles as participants join
- **Host moderation** — mute, request camera, remove participants, manage breakout rooms
- **Breakout rooms** — real isolated LiveKit rooms with host assignment and one-click return
- **Local recording** — capture meeting audio/video to your device (File System Access API + download fallback)
- **Supabase auth** — email sign-up/login, password reset, anonymous fallback
- **Zoom-style Settings** — camera preview, virtual backgrounds, recording preferences persisted via Supabase
- **Electron desktop app** — native macOS/Windows/Linux with Ollama auto-install on first launch
- **PWA** — installable on mobile and desktop browsers with offline fallback
- **Android APK** — hybrid Capacitor app loading the production web app

## How it works

```mermaid
flowchart LR
    Alice(["Alice<br/>EN"])
    Bob(["Bob<br/>ES"])
    Agent["<b>Orbit Translator</b><br/>Python worker<br/>one per LiveKit room"]

    Alice -- mic --> Agent
    Bob -- mic --> Agent
    Agent -- "tx:bob:mic:en" --> Alice
    Agent -- "tx:alice:mic:es" --> Bob
```

Each participant's chosen language lives in their LiveKit `attributes.lang`. The agent watches `participantAttributesChanged` and reconciles a map of `(speaker, track_sid, target_lang)` sessions — one Gemini Live session per unique pair, **skipping pairs where source == target** (same-language pairs hear each other natively, zero Gemini cost).

**Screen share audio** is treated differently: since the shared content (e.g. a video in a browser tab) may be in any language regardless of the sharer's declared `lang`, the agent always translates it and the frontend always ducks the original.

For each active pair the agent publishes into the room:

- an audio track named **`tx:<speaker>:<track_source>:<target_lang>`** carrying the translated speech (`track_source` is `"mic"` or `"screen_share_audio"`)
- an **`lk.translation`** text-stream carrying the matching captions, tagged with `target_lang`

The frontend subscribes to either the native mic or the matching `tx:*` track for each peer, based on `(listener_lang, speaker_lang)` and the track source.

---

## Quick start

### Prerequisites

- Node.js 20+, [pnpm](https://pnpm.io/)
- Python 3.10+, [uv](https://docs.astral.sh/uv/)
- A [LiveKit Cloud](https://cloud.livekit.io) project (free tier works)
- A [Gemini API key](https://aistudio.google.com/apikey)

### Run locally

```bash
# 1. Install deps and seed env files
pnpm run setup

# 2. Fill credentials in .env.local and translator/.env.local
#    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (both files)
#    GEMINI_API_KEY (translator/.env.local only)

# 3. Run frontend + agent worker together
pnpm run dev
```

Open <http://localhost:3000>, click **Create session**, share the URL with another browser, pick different languages, unmute.

---

## Downloads & Distribution

| Platform | Format | Build command |
|----------|--------|---------------|
| **Web** (PWA) | Installable via browser | Auto-deployed to Vercel |
| **macOS** | `.dmg` / `.zip` | `pnpm electron:build:mac` |
| **Windows** | `.exe` (NSIS) / portable | `pnpm electron:build:win` |
| **Linux** | `.AppImage` / `.deb` | `pnpm electron:build:linux` |
| **Android** | `.apk` (debug) | `pnpm mobile:build` |
| **Android** | `.apk` / `.aab` (release) | `pnpm mobile:build:release` |

### Build the Android APK

Requires Android SDK. On any machine with it installed:

```bash
pnpm mobile:sync     # Sync web assets
cd android && ./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Repo layout

```text
root (pnpm, Next.js 16)
├── src/                              # Next.js 16 (Turbopack, React 19)
│   ├── app/
│   │   ├── page.tsx                  # Landing — create/join/schedule
│   │   ├── globals.css               # All styles (CSS custom properties theming)
│   │   ├── layout.tsx                # Root layout with AuthProvider + UserProvider
│   │   ├── ServiceWorkerRegister.tsx # PWA service worker registration
│   │   ├── api/
│   │   │   ├── token/route.ts        # Mints LiveKit token + dispatches translator agent
│   │   │   ├── translate-voice/      # One-shot Gemini voice translation
│   │   │   ├── translate-text/       # One-shot Gemini text translation
│   │   │   ├── breakout/             # Breakout room management
│   │   │   ├── moderate/             # Moderation actions
│   │   │   └── record/               # Recording control
│   │   ├── session/[id]/
│   │   │   ├── page.tsx              # Pre-flight: name + language picker
│   │   │   └── room/                 # In-call UI (all meeting components)
│   │   ├── auth/                     # Supabase email auth pages
│   │   │   ├── login/                # Sign in form
│   │   │   ├── signup/               # Sign up form
│   │   │   ├── callback/             # Auth code exchange + recovery redirect
│   │   │   ├── reset-password/       # Forgot password
│   │   │   └── update-password/      # Set new password
│   │   └── settings/                 # Zoom-style settings page
│   ├── lib/
│   │   ├── config.ts                # Frontend caps (MAX_PARTICIPANTS, etc.)
│   │   ├── languages.ts             # 240+ languages
│   │   ├── supabase.ts              # Client-side Supabase client
│   │   └── supabase-server.ts       # Server-side Supabase client (cookies)
│   └── context/
│       ├── AuthContext.tsx           # Supabase auth wrapper
│       └── UserContext.tsx           # Supabase-backed user profile
├── translator/                       # Python LiveKit Agents worker (uv)
│   ├── src/
│   │   ├── agent.py                 # @server.rtc_session("gemini-translator")
│   │   ├── router.py                # TranslationRouter: reconcile loop
│   │   ├── session.py               # GeminiSession: raw WebSocket → Live API
│   │   ├── audio.py                 # PCM frame plumbing
│   │   └── config.py                # Agent caps (mirror src/lib/config.ts)
│   ├── tests/
│   │   └── test_router.py           # 14 pure demand-computation tests
│   ├── Dockerfile                   # For LiveKit Cloud Agents deploy
│   └── .github/workflows/ci.yml     # Agent CI (pytest + ruff)
├── electron/                         # Electron desktop wrapper
│   ├── main.js                      # Next.js server lifecycle + BrowserWindow
│   └── preload.js                   # Context bridge for native dialogs
├── android/                          # Capacitor Android project
│   ├── app/                         # Android app with WebView
│   └── gradle/                      # Gradle wrapper
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service worker (network-first with cache fallback)
│   ├── icon.svg                     # Source icon (Orbit globe + speech bubbles)
│   └── icons/                       # Generated PNG icons (192px, 512px, etc.)
├── .github/workflows/
│   └── deploy.yml                   # Vercel auto-deploy on push to main
├── capacitor.config.ts              # Capacitor config (loads from production URL)
└── out/                             # Capacitor web fallback directory
```

## Commands

```bash
pnpm run setup              # Idempotent — seeds .env + installs both halves
pnpm run dev                # Frontend + agent concurrently
pnpm run dev:web            # Frontend only (next dev on :3000)
pnpm run dev:agent          # Agent only (uv run python src/agent.py dev)
pnpm run dev:electron       # Frontend + Electron desktop app
pnpm build                  # Production build (output: standalone)
pnpm start                  # Next.js production server
pnpm lint                   # ESLint

# Desktop (Electron)
pnpm electron:build:mac     # Build macOS .dmg
pnpm electron:build:win     # Build Windows .exe
pnpm electron:build:linux   # Build Linux .AppImage + .deb

# Mobile (Android APK via Capacitor)
pnpm mobile:sync            # Sync web assets to Android
pnpm mobile:build           # Build debug APK
pnpm mobile:build:release   # Build release APK/AAB
pnpm mobile:open            # Open Android project in Android Studio

# PWA
pnpm pwa:icons              # Regenerate PWA icons from SVG

# Deploy
pnpm deploy:vercel          # Manual Vercel deploy

# Agent (from translator/)
uv run pytest               # 14 router unit tests
uv run ruff check           # Lint
uv run ruff format          # Format
```

## Deploy

### Web app

Push to `main` → GitHub Actions builds and deploys to **Vercel** automatically.  
Requires these secrets on the GitHub repo:

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel project settings |
| `VERCEL_PROJECT_ID` | Vercel project settings |
| `LIVEKIT_URL` | LiveKit Cloud dashboard |
| `LIVEKIT_API_KEY` | LiveKit Cloud dashboard |
| `LIVEKIT_API_SECRET` | LiveKit Cloud dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings |

### Agent — to LiveKit Cloud Agents

```bash
cd translator
lk agent create --secrets-file .env.local .   # First time
lk agent deploy                                 # Subsequent deploys
```

## Configuration

Caps in `src/lib/config.ts` and `translator/src/config.py` — adjust together:

| Setting                   | Default                             | Where                                |
|---------------------------|-------------------------------------|--------------------------------------|
| Max participants per room | 8                                   | token route `MAX_PARTICIPANTS`       |
| Session TTL               | 4h                                  | token route `ttl`                    |
| Empty-room timeout        | 60s                                 | token route                          |
| Departure timeout         | 30s                                 | token route                          |
| Session grace on mute     | 10s                                 | `SESSION_GRACE_SEC` (agent)          |
| Reconcile debounce        | 250ms                               | `RECONCILE_DEBOUNCE_SEC` (agent)     |
| Gemini model              | `gemini-3.5-live-translate-preview` | `GEMINI_MODEL` (agent)               |

### Critical naming (must keep in sync)

The agent dispatch name `"gemini-translator"` is hardcoded in **two places** — change both if renamed:

| File                       | Location                                                |
|----------------------------|---------------------------------------------------------|
| `translator/src/agent.py`  | `@server.rtc_session(agent_name="gemini-translator")`   |
| `src/app/api/token/route.ts` | `const TRANSLATOR_AGENT_NAME = "gemini-translator"`     |

### Env files

| File                    | Variables                                                                | Used by                      |
|-------------------------|--------------------------------------------------------------------------|------------------------------|
| `.env.local`            | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`                   | Frontend token route         |
| `translator/.env.local` | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY` | Python agent                 |
| `.env` (not committed)  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`              | Settings persistence         |

## Tech stack

- **Frontend** — Next.js 16 (Turbopack), React 19, `@livekit/components-react`, `livekit-client`
- **Token mint** — `livekit-server-sdk` (`RoomAgentDispatch` + `RoomConfiguration`)
- **Agent runtime** — `livekit-agents` 1.5 with `AgentServer.rtc_session()`
- **Translation** — Gemini Live API (raw v1beta `BidiGenerateContent` WebSocket with `translationConfig`)
- **Audio I/O** — `livekit.rtc.AudioStream` (16 kHz mono in) + `AudioSource` (24 kHz mono out)
- **Auth** — Supabase email auth with `@supabase/ssr` cookie sessions
- **Desktop** — Electron 35 with `electron-builder` 26 (macOS/Windows/Linux)
- **Mobile** — Capacitor 8 (Android APK, iOS possible)
- **PWA** — Service worker (network-first) + manifest.json with 240+ language support
- **CI/CD** — GitHub Actions → Vercel (production on push, preview on PR)
- **Settings persistence** — Supabase (anon key, falls back silently if no `profiles` table)
- **Typography** — Instrument Serif (display), DM Sans (body), DM Mono (status)
- **Package management** — `pnpm` + `uv`
- **Testing** — `pytest` / `ruff` (Python), ESLint / TypeScript (frontend)

## Key gotchas

- **Session creation**: `sessionStorage` stores name + lang before navigating to `/room`. Hydration reads from `useEffect`, not `useState` initializer (prevents SSR mismatch).
- **Settings persistence**: Supabase upsert falls back silently if `profiles` table doesn't exist. User identity is a random UUID in `localStorage("orbitUserId")`.
- **TrackSource enum naming**: LiveKit protobuf uses `SOURCE_SCREENSHARE_AUDIO` (no underscore between SCREEN and SHARE). The spelling `SOURCE_SCREEN_SHARE_AUDIO` raises `AttributeError` — both occurrences in `router.py` must match.
- **Translator uses raw WebSockets** (not `@google/genai` SDK) to control the exact JSON shape sent to Gemini v1beta. See `session.py` docstring.
- **showSaveFilePicker()** requires a secure context (HTTPS or localhost) — on HTTP deploys falls back to `<a>` download.
- **Agent dependency pin**: `yarl<1.24` in `pyproject.toml` (cp310-only wheel issue).

---

## License

MIT — © 2026 [Eburon AI](https://eburon.ai)
