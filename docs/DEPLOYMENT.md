# Cabinet Deployment

## Production

- Mode: Git-connected Vercel
- Repository: `https://github.com/scottelling/cabinet`
- Production branch: `main`
- Live URL: `https://cabinet.scottelling.com`

Pushing or merging to `main` can deploy production. Review branches may create Vercel previews but must not be promoted automatically.

## Required Checks

```bash
npm ci
npm test
npm run lint
npm run build
```

The build runs project scripts and may use configured hosted services. Keep secrets in Vercel or the ScottAI environment control plane, never in Git.

## Environment Status

Check names and requirements without printing values:

```bash
npm --prefix /Users/scott/ScottAI/01_Active_Projects/projects run env -- status "$PWD"
```

`KB_PASSWORD` is intentionally absent while Scott wants public access. That expected absence must not be "fixed" without explicit direction.

## Upstream Updates

The scheduled checker only reports that official changes exist. It cannot merge, push source branches, or deploy. Prepare updates with:

```bash
node scripts/upstream-update.mjs check
node scripts/upstream-update.mjs prepare
```

The prepare command creates a separate branch and stages a merge for review. Inspect and verify it before committing or pushing.

Shared deployment and session rules: `/Users/scott/ScottAI/02_Operating_Layer/continuity/DEPLOYMENT_AND_SESSION_SOURCE_OF_TRUTH.md`.
