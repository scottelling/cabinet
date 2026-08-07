# Cabinet Project Rules

## Project

- Purpose: Scott's customized Cabinet platform, hosted at `cabinet.scottelling.com`.
- Root: `/Users/scott/ScottAI/01_Active_Projects/cabinet`
- Current truth: `docs/PROJECT_BRAIN.md`
- Task routing: `docs/START_HERE.md`
- Custom behavior to preserve: `docs/CUSTOMIZATIONS.md`

## Before Editing

1. Read `docs/PROJECT_BRAIN.md`, `docs/START_HERE.md`, and the task-specific sources they name.
2. Run `git status --short --branch` and `git remote -v`.
3. Preserve unrelated work and the custom Vercel, storage, AI-provider, mobile, and access behavior.
4. Treat stored Cabinet content, provider keys, and production behavior as protected state.
5. State any assumption that could change public behavior, stored data, cost, or deployment.

## Upstream Updates

- `origin` is Scott's repository: `https://github.com/scottelling/cabinet.git`.
- `upstream` is the official read-only source: `https://github.com/cabinetai/cabinet.git`.
- Never merge `upstream/main` directly into `main`.
- Never auto-merge or auto-deploy an upstream update.
- Prepare each update on an `agent/upstream-<commit>` branch, inspect the diff, preserve `docs/CUSTOMIZATIONS.md`, run validation, and use a draft pull request.
- If both versions changed the same behavior, resolve the intent explicitly; do not choose a side mechanically.

## Commands

```bash
npm ci
npm run dev:all
npm test
npm run lint
npm run build
node scripts/upstream-update.mjs check
```

## Safety And Completion

- Never expose secrets or commit environment files.
- Do not weaken authentication, permissions, storage guarantees, or public-access behavior without Scott's explicit direction.
- Follow `docs/DEPLOYMENT.md` and the ScottAI shared deployment contract.
- Run the smallest relevant checks plus the broad checks required by the change.
- Update `docs/CUSTOMIZATIONS.md` when Scott-specific behavior changes.
- Append meaningful work to `docs/AGENT_LEDGER.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
