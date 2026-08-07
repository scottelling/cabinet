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

## 2026-08-06 — Visual Tool Builder deployed

- Agent: Codex
- Scope: Added a visible **Build a tool** action to every room and a guided
  five-step builder for data fields, workspace views, agent workflows,
  automations, permissions, preview, and installation.
- Deploy mode: Git-connected Vercel through pull request 5.
- Production source: merge commit `e95035505bfb182ce3cd2e1f19abfdb714249c3f`.
- Production deployment: `dpl_46SsvM22kQVNTHQX6tbnsocLvRDw`.
- Verification:
  - All 433 unit tests passed; lint had no errors; TypeScript and the Next.js
    16.3 production build passed.
  - GitHub lint/unit, packaged install-flow, and end-to-end jobs passed.
  - The Vercel preview passed before merge.
  - Local browser proof created a Campaign Tracker with typed fields, a form,
    table, board, chart, metrics, starter agent action, queued automation, and
    explicit permissions, then installed and opened the generated workspace.
  - The builder at 320 CSS pixels had no page or dialog overflow and no visible
    interactive control smaller than 44 pixels.
- Live check:
  - `https://cabinet.scottelling.com/room/scott-cabinet` showed **Build a tool**
    without a login screen.
  - The live builder opened on desktop and phone, advanced from Basics to Data,
    and produced no browser console errors. No production tool was installed
    during verification.
- Open loops:
  - None for this release.

## 2026-08-06 — Animation Kit swap prepared

- Agent: Codex
- Scope: Replaced Cabinet's shared visual foundation with the published
  Animation Kit while preserving Cabinet's product behavior, data, routes,
  agents, tasks, Tools, providers, and storage boundaries.
- Branch: `agent/animation-kit-swap`, based on production `d423eb18`.
- Useful result:
  - Existing browsers migrate to Animation Kit once; later appearance choices
    remain authoritative.
  - The previous themes remain available as the visual undo path, and the
    Animation Kit card in Settings restores the new system.
  - Shared buttons, inputs, selects, dialogs, content sheets, composer,
    toolbars, Cabinet home, Tool shelf, task rail, editor overflow controls,
    status actions, and phone navigation now use the Kit's tactile language.
  - Phone navigation closes the sidebar drawer after selection and no longer
    lets phone drawer state overwrite the saved desktop rail.
- Verification:
  - All 435 automated tests passed on the clean rerun. One provider test
    intermittently failed during a parallel first run and passed both in
    isolation and in the clean complete rerun.
  - Repository lint completed with no errors; its existing warnings remain.
  - TypeScript and the Next.js production build passed. The build reported the
    repository's existing dynamic-file-tracing warnings.
  - Browser proof covered Cabinet home, room home, Agents, Tasks, Settings,
    theme switching and restoration, task creation, and the visual Tool
    Builder with no console errors.
  - Width checks at 320, 375, 414, 768, 1280, and 1440 CSS pixels found no
    page-level horizontal overflow. The Tool Builder fit inside a 375px phone.
- Remaining work: publish a preview, verify the hosted result, merge, and check
  `cabinet.scottelling.com` in production.

## 2026-08-06 — Animation Kit feedback follow-up prepared

- Agent: Codex
- Scope: Rebuilt the production feedback check-in as a solid Animation Kit
  dialog after live proof exposed the last old ambient treatment.
- Useful result:
  - The dialog no longer blurs the product behind it or adds floating emoji,
    glow, translucent controls, count-up movement, or a decorative star burst.
  - Rating controls, close action, fields, and the GitHub action use the Kit's
    full-size tactile controls and fit inside the phone viewport.
  - Feedback submission behavior, triggering rules, translations, and stored
    values are unchanged.
- Verification:
  - The focused feedback file passed lint and the complete TypeScript check.
  - All 435 automated tests passed in the deterministic clean run. Two existing
    command-adapter timing checks flickered under parallel load and passed in
    isolation; neither touches the feedback interface.
  - Repository lint completed with no errors; its existing warnings remain.
  - The Next.js production build passed with the repository's existing dynamic
    file-tracing warnings.
- Remaining work: publish this production correction and verify the real
  feedback window on phone and desktop.
