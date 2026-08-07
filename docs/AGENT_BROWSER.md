# Cabinet Agent Browser

Cabinet's hosted direct-provider agents can use a read-only remote browser for
current public-web research. The browser is a Cabinet capability, not a model
provider feature, so OpenAI, Anthropic, Gemini, and xAI agents receive the same
tool and safety rules.

## What Agents Can Do

- Read a public JavaScript-rendered page as Markdown.
- Collect the visible public links on a page.
- Capture a page screenshot into the active room's `Browser Research` folder.
- Cite every source in the conversation's **Browser activity** panel.

Agents cannot use this tool to sign in, supply cookies, submit forms, upload
files, send messages, purchase, publish, or delete external data. Those actions
are deliberately absent from the tool contract rather than controlled only by
prompt text.

## Connect Cloudflare

Open **Integrations → API Keys** and add both values:

1. `CLOUDFLARE_ACCOUNT_ID`
2. `CLOUDFLARE_BROWSER_RUN_API_TOKEN`

The token must be a custom Cloudflare API token with **Browser Rendering -
Edit** permission. Cabinet masks both values in the interface. In the hosted
edition they are encrypted inside private Cabinet storage; they are never
written into source control or returned to the browser client.

## Engine Selection

`auto` is the default:

1. Cabinet attempts the request with Kitesurf.
2. When Kitesurf reports a page-compatibility or rendering failure, Cabinet
   retries once with Cloudflare Browser Run's Chromium engine.
3. Authentication, authorization, and rate-limit failures do not trigger a
   fallback because the second engine would not correct the account problem.

An agent may explicitly request Kitesurf or Chromium when the task calls for a
particular engine.

## Safety And Audit

- Only public `http` and `https` URLs are accepted.
- Loopback, private-address, reserved-address, and credential-bearing URLs are
  rejected before Cloudflare is called.
- Website content is wrapped as untrusted evidence before it returns to the
  model. The agent system prompt repeats that website instructions must not be
  followed.
- Markdown is capped before it enters model context, link lists are capped, and
  screenshots have a file-size ceiling.
- Every successful or failed request appends a secret-free JSON receipt to
  `.agents/.browser/audit.jsonl` inside the active room.
- Conversation metadata stores URL, action, engine, fallback status, retrieval
  time, provider-reported browser usage, and any screenshot path. It never
  stores Cloudflare tokens, headers, cookies, or page content.

## Architecture

`src/lib/browser/browser-service.ts` is the single public service boundary. It
owns configuration, URL policy, Cloudflare requests, engine fallback, response
normalization, screenshot storage, and audit receipts. The direct-provider
adapter knows only the `browse_web` tool contract and the returned evidence.

This boundary is intentionally native to Cabinet. Registering only a Browser
Run MCP server would help local CLI environments but would not give the
Vercel-hosted direct-provider agents a browser.

## Current Boundary

This release covers short, public, read-only research. Persistent authenticated
sessions, clicking, form filling, and human takeover are not built. If those
capabilities are added later, consequential actions must enter Cabinet's human
approval flow rather than extending this read-only tool silently.
