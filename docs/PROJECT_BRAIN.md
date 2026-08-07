# Cabinet Project Brain

Version: 1
Status: Customized existing product
Last reviewed: 2026-08-06

## Purpose And Intended Outcome

This repository adapts the open-source Cabinet platform for Scott's hosted use at `cabinet.scottelling.com`. It should retain useful improvements from the official project while preserving Scott's deployment, storage, AI-provider, mobile, and access decisions.

## Current Implemented State

- `main` contains the Vercel-native version with direct AI-provider keys and Vercel Blob-backed workspace persistence.
- `main` contains Cabinet Tools: removable room workspaces that agents can use
  and propose during chat. People can also create them through the visual Tool
  Builder without editing code or manifests.
- The current release branch makes the shared Animation Kit Cabinet's default
  visual system while keeping the previous themes as a one-click rollback.
- Production is expected to deploy from `scottelling/cabinet` through Vercel.
- `KB_PASSWORD` is intentionally unset, so the current site has no Cabinet password gate.
- The official Cabinet project remains an update source, not the deployment source.
- Additional mobile and cloud CLI-agent work exists on development branches and is not automatically treated as production behavior.

## Users And Core Workflows

- Scott opens the hosted Cabinet homepage, manages agents, tasks, and room
  tools, and supplies his own AI-provider keys through Cabinet settings.
- Cabinet reads and writes durable workspace content through the hosted storage adapter.
- GitHub branches and Vercel previews are used to review changes before production.

## Durable Objects And Relationships

- Scott's GitHub repository owns the customized application source.
- The official Cabinet repository supplies optional upstream improvements.
- Vercel runs the hosted application.
- Vercel Blob stores hosted Cabinet workspace files.
- Provider credentials remain environment or settings data and must never be committed.

## Decisions Already Made

- Keep Scott's repository independent and deploy only from it.
- Track the official repository through a read-only `upstream` remote.
- Review upstream changes on isolated branches; never auto-merge or auto-deploy them.
- Use direct provider keys rather than requiring Vercel AI models.
- Keep the Cabinet password gate disabled unless Scott explicitly changes that decision.
- Treat the published Animation Kit tokens as visual authority. Preserve
  Cabinet's product structure and specialist layouts; do not force Animation
  Studio-specific timeline or canvas patterns into unrelated Cabinet screens.

## Known Gaps And Risks

- The workspace environment checker reports `KB_PASSWORD` as missing even though it is intentionally disabled; do not create a password merely to make that checker green.
- Official changes can conflict with Scott-specific Vercel and provider code, especially when both versions edit the same routes or runtime modules.
- Development branches contain changes not yet consolidated into `main`.
- Upstream updates still require human review, tests, and a preview before production.

## Current Priorities

1. Preserve Scott-specific behavior while reviewing official improvements.
2. Consolidate approved development branches into `main` through review requests.
3. Keep mobile navigation, touch targets, agents, storage, and provider settings covered by tests.
4. Keep Kit adoption reversible and prove changed screens at phone, tablet,
   and desktop widths before release.

## Sources Of Truth

- Binding project rules: `../AGENTS.md`
- Custom behavior inventory: `CUSTOMIZATIONS.md`
- Task routing: `START_HERE.md`
- Deployment: `DEPLOYMENT.md`
- Recent work: `AGENT_LEDGER.md`
- Official product documentation: `../README.md` and the task-specific files under `docs/`
- Live code and tests outrank stale prose when they disagree.
