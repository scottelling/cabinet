# Scott's Cabinet Customizations

This file lists behavior that must survive official Cabinet updates. Update it whenever Scott-specific behavior changes.

## Shipped On `main`

- Vercel-native hosted runtime rather than a required persistent local daemon.
- Direct Anthropic, OpenAI, Google, and other supported provider keys entered through Cabinet settings.
- Hosted workspace persistence through Vercel Blob.
- Cloud-compatible agent conversations and API routes.
- No Cabinet password gate while `KB_PASSWORD` remains unset.
- Production source is `scottelling/cabinet`, not `cabinetai/cabinet`.
- Larger mobile controls, type, icons, and touch targets.
- Mobile navigation that keeps Agents and Tasks inside the active Cabinet room.
- A Cabinet Tools platform that lets rooms install removable declarative
  workspaces; lets hosted agents use tool data and propose new tools or
  versions during chat; renders stateful forms, tables, boards, charts, and
  metrics; lets people build those tools through a visual guided interface;
  and provides approved automations, audit history, disable/enable,
  recoverable removal, and rollback controls.
- A hosted agent browser shared by the direct OpenAI, Anthropic, Gemini, and
  xAI adapters: read-only public page extraction, visible links, screenshots,
  Kitesurf-first execution, Chromium compatibility fallback, prompt-injection
  boundaries, room-local audit receipts, and visible conversation evidence.
- The shared Animation Kit as Cabinet's default visual system: exact published
  colors, Outfit interface type, JetBrains Mono technical type, solid tactile
  surfaces, purposeful motion, and full-size controls. The existing Appearance
  picker is the reversible visual rollback and must remain usable.
- Phone navigation closes the sidebar drawer after choosing a destination and
  never overwrites the saved desktop sidebar preference.

## In Development Branches

- Additional Vercel support for CLI-backed agent providers.

These items are not considered production behavior until their branches are reviewed and merged into `main`.

## Upstream Review Checklist

Before accepting an official update, verify:

1. The homepage loads at `cabinet.scottelling.com` without an unexpected login screen.
2. Provider keys can still be entered and direct provider requests still work.
3. Cabinet workspace content survives a fresh deployment and can still be read and written.
4. Agents and Tasks remain in the active room on mobile, with usable touch targets.
5. The Vercel build, automated tests, and preview all pass before production merge.
6. Animation Kit remains the one-time default for existing browsers, older
   themes can still be selected, and choosing Animation Kit restores it.

## Conflict Rule

When official code and Scott's code touch the same behavior, preserve both where compatible. If they represent different product decisions, stop and present the concrete choice to Scott before resolving the conflict.
