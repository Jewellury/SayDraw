# Dev Server Runbook — Windows

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required keys:

| Variable | Required? | Purpose | How to get |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | No (mock fallback) | Text model (narration + story summary) — DeepSeek v4 Flash | https://platform.deepseek.com/api_keys |
| `DEEPSEEK_BASE_URL` | No (defaults to `https://api.deepseek.com`) | DeepSeek API endpoint | Leave as default unless using a proxy |
| `ANTHROPIC_API_KEY` | No (reserved for future dual-model mode) | SVG model (line-art generation) — Claude Sonnet 4, unused in current single-model mode | https://console.anthropic.com/settings/keys |
| `NEXT_PUBLIC_NOVUS_APP_ID` | No (reserved) | Novus Analytics SDK | Not yet integrated |

Both keys are **server-side only**. They are never exposed to the browser. The app is fully playable without any keys (mock text + fallback SVG).

```
# .env.local (example)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

> SayDraw Next.js dev server on port **3001**. This is a Windows-specific runbook.

## Critical: Start From Your Own Terminal

**Never start `npm run dev` through a tool, agent, or script that enforces a timeout.** When the tool/task session times out (e.g. a 15s / 120s limit on a shell command), the process tree — including the dev server and all its child processes — is killed. `localhost:3001` goes dark silently. No error, no crash log, just "connection refused."

Two reliable ways to start:

| Method | Command | Notes |
|--------|---------|-------|
| **Manual PowerShell window** | `npm run dev -- -p 3001` | Most predictable. Keep the window open. |
| **Script launcher** | `.\start-dev.cmd` (double-click or run from project root) | Opens a new persistent PowerShell window for you. Same effect. |

The server does **not** auto-open a browser. After starting, manually navigate to `http://localhost:3001`.

## Quick Start

```powershell
npm run dev -- -p 3001
```

This must run in a **persistent PowerShell window**. If the terminal closes, the server dies. Tool-invoked foreground commands can also time out and kill the process.

## Verify the Server is Running

### Method 1: netstat (is anything listening on 3001?)

```powershell
netstat -ano | findstr :3001
```

Look for a `LISTENING` line. The PID column tells you which process owns the port.

### Method 2: HTTP health check

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3001/ -UseBasicParsing -TimeoutSec 5
```

A `200` response means the dev server is healthy. A failure (timeout, connection refused) means the server is not running or is crashing on startup.

## How to Restart

### ⚠️ Process-tree caveat

`Stop-Process` only kills the process you point it at — **not its children**. Next.js dev server spawns webpack compilers, file watchers, and other child processes that hold port 3001 open. If you kill just the parent, the children remain and the port stays locked (`EADDRINUSE`).

Use `-IncludeChildProcess` on the parent, or iterate through ALL processes listening on the port:

### Step 1: Kill the whole process tree

```powershell
# Kill ALL processes holding port 3001 (loop in case >1)
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.OwningProcess
    # Kill the process AND its entire child tree
    Get-WmiObject Win32_Process -Filter "ProcessId = $id OR ParentProcessId = $id" | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
```

### Step 2: Verify the port is actually free

```powershell
netstat -ano | findstr :3001
# Should return nothing (no LISTENING line)
```

If a line still appears, repeat Step 1 or close the old PowerShell window that started the server.

### Step 3: Restart

```powershell
npm run dev -- -p 3001
```

### Real-world example (2026-06-07)

A tool/agent killed the main `node.exe` on port 3001 but the webpack watcher kept the port alive. The subsequent `npm run dev` failed with `EADDRINUSE`. After the tool session timed out and killed the whole tree by accident, the user restarted from their own PowerShell window — and it worked on the first try. The lesson: **start the server from your own terminal, close the old terminal to kill the server.**

## Common Startup Warnings (Non-Blocking)

- **`@next/swc-win32-x64-msvc is not a valid Win32 application`** — normal on this setup. Next falls back to WASM. Ignore. The server works fine.
- **`Warning: Built-in CSS support is being disabled`** when using PostCSS config — expected when `postcss.config.js` uses ESM syntax. CSS still compiles if config resolves.

## Common Misdiagnosis List

These are **not** the problem when the browser can't connect to `http://localhost:3001/`:

| Symptom | WRONG diagnosis | RIGHT diagnosis |
|---------|----------------|-----------------|
| Browser shows "connection refused" | DeepSeek API key missing or wrong | Dev server is not running |
| Browser shows "connection refused" | Code bug in a page component | Dev server is not running |
| Browser shows "connection refused" | `.next` cache corrupted | Dev server is not running |
| Browser shows "connection refused" | Missing npm dependency | Dev server is not running |
| Browser shows "connection refused" | Tailwind config wrong | Dev server is not running |

**Rule:** If `Invoke-WebRequest http://127.0.0.1:3001/` fails, the dev server is not listening. Start there. Don't chase code, keys, or config.

## Troubleshooting Checklist

Follow in order. Don't skip steps.

- [ ] **1. Is the dev server running?** Run `netstat -ano | findstr :3001`. If no LISTENING line, it's not running.
- [ ] **2. Can the server be reached?** Run `Invoke-WebRequest -Uri http://127.0.0.1:3001/ -UseBasicParsing`. If it fails with connection refused, the process died or never started.
- [ ] **3. Is another process holding port 3001?** If netstat shows LISTENING but `Invoke-WebRequest` gets a wrong response, another process may have grabbed the port. Kill the port (see "How to Restart") and restart.
- [ ] **4. Did the server start but crash?** Check the terminal output for a Next.js compilation error. Common causes: missing module (check `npm install`), TypeScript error blocking compilation, PostCSS config syntax error.
- [ ] **5. Is the server on a different port?** Confirm the start command used `-p 3001`. If no port flag, Next defaults to 3000.
- [ ] **6. Firewall or proxy?** On some corporate Windows setups, `localhost` may resolve to IPv6 `::1` while the server binds to IPv4 `0.0.0.0`. Use `127.0.0.1` explicitly.
- [ ] **7. Stale `.next` directory?** Rare, but if the server starts then immediately exits with a 500 or module-not-found, stop the server, run `npx next clean`, then restart.

## Running in Background (Windows)

Tool/terminal timeouts can kill foreground dev servers. Options:

- **Persistent PowerShell window** (recommended for development): Open a separate PowerShell window, run `npm run dev -- -p 3001`, and keep it open. The browser session will survive tool restarts.
- **Script launcher**: Run `.\start-dev.cmd` from the project root. This opens a new persistent PowerShell window with the dev server. See `start-dev.cmd` in the project root.
