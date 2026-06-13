<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Orbit Meeting / Live Translate — Agent Guide

## Repo layout

```
root (pnpm, Next.js 16)
├── src/                        # Next.js 16 frontend (Turbopack, React 19)
│   ├── app/
│   │   ├── page.tsx            # Landing → Create/Join/Schedule
│   │   ├── api/token/route.ts  # Mints LiveKit token + dispatches agent
│   │   ├── api/translate-voice/  # One-shot Gemini voice translation
│   │   ├── api/translate-text/   # One-shot Gemini text translation
│   │   ├── api/breakout/         # Breakout room management
│   │   ├── api/moderate/         # Moderation actions
│   │   ├── api/record/           # Recording control
│   │   ├── session/[id]/
│   │   │   ├── page.tsx          # Pre-flight (name + language picker)
│   │   │   └── room/             # In-call UI (InCall, ControlBar,
│   │   │                         #   Filmstrip, Sidebars, etc.)
│   │   ├── settings/             # Zoom-style settings page
│   │   └── layout.tsx            # Root layout with UserProvider
│   ├── lib/
│   │   ├── config.ts             # Frontend caps (MAX_PARTICIPANTS, etc.)
│   │   ├── languages.ts          # 16 langs + "none" + Belgium variants
│   │   ├── supabase.ts           # Supabase client (anon key)
│   │   └── gemini-fetch.ts       # Retry wrapper for Gemini REST calls
│   └── context/
│       └── UserContext.tsx        # Supabase-backed user profile
└── translator/                   # Python LiveKit Agents worker (uv)
    ├── src/
    │   ├── agent.py              # @server.rtc_session("gemini-translator")
    │   ├── router.py             # Reconciliation loop
    │   ├── session.py            # Raw WebSocket to Gemini Live API
    │   ├── config.py             # Agent caps (mirror of src/lib/config.ts)
    │   └── audio.py              # PCM glue
    └── tests/
        └── test_router.py        # Demand-computation unit tests
```

Two independent projects in one monorepo. Frontend in `src/`, agent in `translator/`.

## Critical naming (must keep in sync)

The agent dispatch name `"gemini-translator"` is hardcoded in **two places** — if you rename it, change both:

| File | Line |
|------|------|
| `translator/src/agent.py` | `@server.rtc_session(agent_name="gemini-translator")` |
| `src/app/api/token/route.ts` | `const TRANSLATOR_AGENT_NAME = "gemini-translator"` |

The unique name avoids collisions with stale Cloud Agents registered under common names.

## Config pairing (must mirror)

`src/lib/config.ts` and `translator/src/config.py` share overlapping constants. Keep them in sync:

| Constant | Frontend | Agent |
|----------|----------|-------|
| Max participants | `MAX_PARTICIPANTS = 40` | (token route, hardcoded) |
| Native sentinel | `NATIVE_LANG = "none"` | `NATIVE_LANG = "none"` |
| Lang attribute key | `PARTICIPANT_LANG_ATTR = "lang"` | `PARTICIPANT_LANG_ATTR = "lang"` |
| Gemini model | (varies per route) | `GEMINI_MODEL = "gemini-3.5-live-translate-preview"` |

## Commands

```bash
# Setup (idempotent — seeds .env files + installs both halves)
pnpm run setup

# Dev (runs frontend + agent concurrently)
pnpm run dev

# One half at a time
pnpm run dev:web       # next dev on :3000
pnpm run dev:agent     # uv run python src/agent.py dev (from translator/)

# Frontend
pnpm build          # next build (output: standalone)
pnpm lint           # eslint
pnpm start          # next start

# Agent only (from translator/)
uv run pytest              # tests
uv run ruff check           # lint
uv run ruff format          # format
```

## Env files

| File | Variables | Used by |
|------|-----------|---------|
| `.env.local` | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Frontend token route |
| `translator/.env.local` | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY` | Python agent |
| `.env` (not committed) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings persistence |

## Translation track routing

Agent publishes tracks named `tx:<speaker_identity>:<track_source>:<target_lang>`.
- `track_source` is `"mic"` or `"screen_share_audio"`
- Frontend parses this in `useTranslationRouting.ts` to subscribe/unsubscribe
- Agent-published tracks carry `lk.translation` text-stream for captions

The router uses a demand model: a translation session exists iff at least one listener wants language `T` AND speaker `S` has an enabled mic AND `S.lang != T`. Grace teardown is 10s to avoid thrash on brief mutes.

## Key gotchas

- **Session creation**: `sessionStorage` stores name + lang before navigating to `/room`. Hydration reads from `useEffect`, not `useState` initializer (prevents mismatch).
- **Settings persistence**: Supabase upsert. Falls back silently if the `profiles` table doesn't exist. User identity is a random UUID in `localStorage("orbitUserId")`.
- **Language picker**: 16 languages + `"none"` sentinel + 3 Belgium regional variants (`be-nl`, `be-fr`, `be-de`).
- **API routes** (`/api/token`, `/api/translate-voice`, `/api/translate-text`) are stateless — Vercel-friendly.
- **Translator uses raw WebSockets** (not `@google/genai` SDK's `live.connect()`) to control exact JSON shape sent to Gemini v1beta. See session.py docstring.
- **TrackSource enum name trap**: LiveKit protobuf defines `SOURCE_SCREENSHARE_AUDIO` (no underscore between SCREEN and SHARE). The spelling `SOURCE_SCREEN_SHARE_AUDIO` silently raises `AttributeError` — fix both occurrences in `router.py` if they don't match.
- **Agent dependency pin**: `yarl<1.24` in pyproject.toml — cp310-only wheel issue.
- **Docker**: Frontend uses `output: "standalone"` with server on port 8080. Agent uses `ghcr.io/astral-sh/uv` base image.

## Testing

- Agent has unit tests only (`translator/tests/test_router.py`): pure logic, no LiveKit/Gemini connectivity.
- Run: `cd translator && uv run pytest`
- No frontend tests exist in the repo.
- CI runs on `translator/.github/workflows/` only (pytest + ruff check/format).

## When working on the Python agent

Read `translator/AGENTS.md` — it includes detailed guidance on using `lk docs` / LiveKit MCP server, handoffs/tasks patterns, and TDD for agent behavior changes.
