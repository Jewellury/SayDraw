# SayDraw / 画话本

Voice-powered story sketchpad for parents and preschoolers to co-create stories.

Built for **World Product Day "Everyone Ships Now" Hackathon** (deadline 2026-06-20 17:00 BST).

## Status

**Pre-MVP skeleton.** The project has a clean Next.js scaffold with warm paper design tokens. Story logic, DeepSeek integration, SVG generation, and voice input are not yet implemented.

## Quick Start

```bash
npm install
npm run dev -- -p 3001
```

Open `http://localhost:3001`.

## Project Structure

- `docs/00_design/` — Design source of truth (hi-fi mockup, design spec, prototype reference, product brief)
- `docs/tasks/` — AI-friendly task management system
- `docs/agent-charters/` — Agent role definitions
- `AGENTS.md` — Rules and context for AI agents

## Design Tokens

See `docs/00_design/frontend_design_spec.md`. Warm paper sketchbook: cream paper background, black ink lines, warm orange accents.

## Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | No | DeepSeek API key (mock data used if empty) |
| `DEEPSEEK_BASE_URL` | No | Defaults to `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | No | Defaults to `deepseek-v4-flash` |
| `DEEPSEEK_FALLBACK_MODEL` | No | Defaults to `deepseek-v4-pro` |

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel, set environment variables.
3. Deploy.
