# Start Here — Cabinet

Read this after the root `AGENTS.md`.

## Read Every Session

1. `PROJECT_BRAIN.md` for the current customized product state.
2. `CUSTOMIZATIONS.md` for behavior that an official update must preserve.
3. `AGENT_LEDGER.md` for recent work and open loops.

## Route By Task

| Task | Read |
|---|---|
| Official Cabinet update | `CUSTOMIZATIONS.md`, `DEPLOYMENT.md`, `.github/workflows/upstream-update-check.yml` |
| Deployment or environment | `DEPLOYMENT.md`, `/Users/scott/ScottAI/02_Operating_Layer/continuity/DEPLOYMENT_AND_SESSION_SOURCE_OF_TRUTH.md` |
| Authentication or public access | `AUTH.md`, `PROJECT_BRAIN.md` |
| Mobile interface | `MOBILE_RESPONSIVE_PRD.md`, `DESIGN_PRD.md` |
| Agents, tasks, or providers | `PROVIDER-CLI.md`, `TASKS.md`, `TASKS_CONVERSATIONS_PRD.md` |
| Agent web research or remote browser | `AGENT_BROWSER.md`, `CUSTOMIZATIONS.md` |
| Storage or hosted runtime | `CLOUD_PRD.md`, `CUSTOMIZATIONS.md` |

## Validation

```bash
npm test
npm run lint
npm run build
```

An upstream update is not complete until Scott-specific behavior is checked in a preview and the relevant automated checks pass.
