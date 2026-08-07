# Agent Ledger — Cabinet

Append meaningful work receipts. Preserve prior entries.

## 2026-08-06 — Safe official-update foundation

- Agent: Codex
- Objective: Preserve Scott's customized Cabinet while making official improvements discoverable and reviewable.
- Starting state: `origin/main` at `f132d32f`; official `upstream/main` had newer changes not yet reviewed.
- Authority: Configure update discovery and review tooling only; do not merge official code or deploy production.
- Behavior changed: No product behavior changed. The repository gained durable project guidance and a review-first upstream update process.
- Decisions:
  - `origin` remains Scott's writable repository.
  - `upstream` is fetch-only.
  - Scheduled checks may report updates but cannot merge or deploy them.
- Validation:
  - `node --check scripts/upstream-update.mjs` passed.
  - The read-only checker found official changes and confirmed that nothing was merged, pushed, or deployed.
  - The workflow YAML parsed successfully, documentation links exist, and `git diff --check` passed.
- Remaining risk: Scott-specific development branches still need separate review and consolidation.
- Next action: Validate and publish this setup as a draft pull request.

## 2026-08-06 — Cabinet Tools platform foundation

- Agent: Codex
- Objective: Let Cabinet rooms grow removable tools and interfaces while
  preserving Cabinet's knowledge, agents, tasks, mobile shell, Vercel runtime,
  and direct provider keys.
- Branch: `agent/cabinet-tools-platform`, based on the safe-upstream foundation.
- Behavior changed:
  - Rooms can install and remove validated declarative Cabinet Tools.
  - Installed tools appear on the room homepage and open at a clean room-scoped
    URL through a shared mobile-safe workspace.
  - Hosted direct-provider agents can propose tools, but proposals remain
    uninstalled until a person approves the requested permissions.
  - The built-in Research Brief tool proves starter workflows through Cabinet's
    existing composer and conversation system.
- Protected behavior preserved: no authentication, provider-key, production
  deployment, or workspace-storage decision changed. Tool records live inside
  the room and are included in the existing Vercel Blob snapshot.
- Validation:
  - Contract tests observed missing behavior fail before implementation, then
    passed after each storage, routing, and agent-proposal slice.
  - The complete unit suite passed all 419 tests.
  - TypeScript passed; lint reported no errors; the production build passed and
    included `/api/tools` in the Vercel cloud route bundle.
  - Browser proof covered install, clean navigation, starter prompt handoff,
    agent proposal approval, removal boundaries, and a 390-by-844 phone layout.
- Remaining boundary: version one renders declarative tools only. Permission
  declarations inform approval but are not a general sandbox for CLI agents.
- Next action: Review the feature branch in a Vercel preview before merging it
  into production.

## 2026-08-06 — Conversation-native, stateful Cabinet Tools

- Agent: Codex
- Objective: Complete the bb-inspired loop where an agent can use and evolve a
  Cabinet Tool during chat while Cabinet remains the trusted host.
- Branch: `agent/cabinet-tools-platform`; this extends the uncommitted platform
  foundation already on the branch.
- Behavior changed:
  - Direct-provider agents can list and inspect installed tools, change typed
    records, and propose new tool versions without silently installing them.
  - Declarative workspaces now render forms, tables, boards, charts, and metrics
    backed by revisioned room-local data.
  - Tools keep version history and audit receipts and can be disabled, enabled,
    upgraded, rolled back, or removed without affecting other room data.
  - Approved deterministic automations react to completed tasks, schedules,
    knowledge changes, and integration events. AI prompts enter a visible inbox
    rather than spending provider credits automatically.
  - Content Studio is the end-to-end built-in example.
- Architecture decision: one Tools service owns validation, paths, versions,
  state, events, locking, approvals, and rollback. The web API, UI, and agent
  bridge all call that service. Tool files never contain API secrets; tools use
  Cabinet's existing integration boundary.
- Validation:
  - Test-first slices observed the missing state, agent bridge, update, rollback,
    automation, and disable behavior fail before implementation.
  - The complete repository suite passed all 426 tests after implementation.
  - TypeScript and targeted lint passed with no new errors.
  - Browser proof installed Content Studio, added and moved a record, updated
    metrics, table, board, and chart, and preserved data across disable/enable.
  - Browser proof covered 320, 375, 390, 414, 768, and desktop widths with no
    page overflow or undersized controls and no console errors.
  - The final production build passed and included `/api/tools` in the Vercel
    cloud route bundle. It reported only Cabinet's three existing Next.js
    file-tracing warnings.
- Remaining boundary: arbitrary third-party JavaScript stays excluded. Existing
  Cabinet child-task handoffs are reused rather than replaced. This work is not
  merged, pushed, previewed, or deployed.
- Next action: Publish a Vercel preview for review before merging.

## 2026-08-06 — Integrity release deployed

- Agent: Codex
- Scope: Completed the approved renovation and dependency-security batches,
  merged the reviewed official Cabinet update, and released the stateful
  Cabinet Tools platform with the mobile room-navigation repairs.
- Deploy mode: Git-connected Vercel through pull request 4.
- Production source: merge commit `8461fce41ec7710a3489a95db5f7d5ababe39aca`.
- Production deployment: `dpl_BiD4PXd3Zgv64uWL1AacAndVrCpu`.
- Verification:
  - The hosted dependency audit has no high- or critical-severity findings.
  - All 430 unit tests passed; lint had no errors; the Next.js 16.3 production
    build passed.
  - GitHub lint/unit, packaged install-flow, and end-to-end jobs passed.
  - The Vercel preview passed before merge.
  - Local browser proof covered onboarding, room home, Agents, Tasks, Cabinet
    Tools, no-login behavior, and phone, tablet, and desktop widths.
- Live check:
  - `https://cabinet.scottelling.com` returned 200 and opened the existing
    Scott Cabinet room without a login screen.
  - The Tools shelf, Agents route, Tasks route, and `/api/health` loaded without
    browser console errors.
- Open loops:
  - Build and release the visual Tool Builder as the next independent change.
