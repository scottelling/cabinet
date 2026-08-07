# Cabinet Tools Platform

Status: Stateful, conversation-native platform implemented on
`agent/cabinet-tools-platform`.

## Product promise

Cabinet starts as your knowledge base and AI team, then grows the tools,
workspaces, and interfaces that your team needs without turning Cabinet into a
different product.

Cabinet Tools fulfill that promise through a small declarative contract. A tool
describes what it is, what it needs, where it appears, and which starter
workflows it offers. Cabinet owns rendering, mobile behavior, storage,
navigation, agents, tasks, and approvals.

## What works now

- Tools install independently inside one room.
- Installed tools appear on that room's homepage.
- People can open **Build a tool** from the room homepage and create a complete
  tool through five visual steps: basics, data, views, workflow, and review.
- The visual builder supports typed fields, forms, tables, boards, charts,
  summary metrics, starter agent actions, optional queued automations, and
  explicit permission choices. It previews the resulting workspace before
  installation and requires no manifest editing or application code.
- Each tool can open a room-scoped workspace at
  `/room/<room>/-/tools/<tool-id>`.
- Tool workspaces reuse Cabinet's shared agent composer, provider picker,
  mentions, attachments, task creation, and conversation viewer.
- Hosted direct-provider agents can propose a declarative tool.
- Agents can discover installed tools, inspect their manifests and state, and
  add, update, or delete tool records during an ordinary conversation.
- Agents can propose a new version of an installed tool. The active version
  does not change until a person approves it.
- Agent proposals remain uninstalled until a person approves them from the
  room homepage.
- Tool workspaces render Cabinet-owned forms, tables, boards, charts, and
  metrics from validated data. They remain accessible and responsive because
  generated code does not control the markup.
- Tool state is revisioned and room-local. Every user, agent, automation, and
  lifecycle mutation leaves an audit receipt.
- Tools can react to completed tasks, schedules, knowledge changes, and
  integration events. Deterministic actions run immediately; AI follow-up
  prompts enter a visible automation inbox for a person to start.
- People can disable, re-enable, upgrade, and roll back a tool without deleting
  its records.
- Removing a tool removes its interface without changing the room's knowledge,
  agents, tasks, or other tools.
- Tool installations and proposals are ordinary workspace files, so Scott's
  Vercel Blob snapshot includes them automatically.

The built-in `Research Brief` tool proves focused agent workflows. The built-in
`Content Studio` proves forms, metrics, a mobile board, a table, a chart,
record editing, lifecycle controls, and conversation-native agent access.

## Public contract

The source-of-truth types live in `src/types/tools.ts`. Version one is data-only
and does not accept executable JavaScript or React components.

```ts
interface CabinetToolManifest {
  schemaVersion: 1;
  id: string;
  version: string;
  name: string;
  description: string;
  icon: CabinetToolIcon;
  permissions: CabinetToolPermission[];
  surfaces: {
    home?: {
      title: string;
      description: string;
      actionLabel?: string;
    };
    workspace?: {
      title: string;
      description: string;
      starterPrompts: Array<{
        id: string;
        label: string;
        prompt: string;
        description?: string;
      }>;
      blocks?: CabinetToolBlock[];
    };
  };
  collections?: CabinetToolCollection[];
  automations?: CabinetToolAutomation[];
}
```

Collections declare typed fields. Workspace blocks bind to collections and may
render as a form, table, board, chart, or metric. Automations bind an approved
Cabinet event to either a validated record write or a queued agent prompt.

Supported permission declarations are:

- `knowledge:read` and `knowledge:write`
- `agents:run` and `tasks:manage`
- `schedules:manage`
- `integrations:use`

The validator rejects unknown schema versions, malformed identifiers, unknown
icons, duplicate workflow, collection, field, block, or automation identifiers,
broken field references, unsupported values, and undeclared permissions before
any file is written.

## One deep module

Callers use `src/lib/tools/tool-platform.ts` to:

- list the built-in catalog;
- list a room's installed tools and proposals;
- propose a validated custom tool;
- propose an update without applying it;
- install a built-in or custom manifest;
- inspect and mutate typed records;
- apply approved events and automations;
- read audit receipts and version history;
- disable, enable, and roll back a tool;
- remove a tool.

The module privately owns path safety, room validation, manifest validation,
atomic writes, installation idempotency, proposal approval, storage layout,
and corrupt-record containment. Without this module, every new tool would need
to understand and modify those concerns separately.

## Storage

Each room stores tools beneath hidden room-local directories:

```text
<room>/.cabinet-tools/<tool-id>/installation.json
<room>/.cabinet-tools/<tool-id>/state.json
<room>/.cabinet-tools/<tool-id>/events.jsonl
<room>/.cabinet-tools/<tool-id>/versions/<version>.json
<room>/.cabinet-tool-proposals/<tool-id>.json
```

Installing an approved proposal atomically writes the installation and removes
the proposal. Reinstalling the same tool preserves its original installation
timestamp. State revisions survive compatible upgrades and rollbacks. Removed
collection data stays recoverable for an older version. Uninstalling removes
only that tool's installation directory.

Tool manifests and state never store API keys. Tools request
`integrations:use`, while credentials remain in Cabinet's existing protected
integration and `.cabinet.env` systems. Agents receive the integration's
capability, not its raw secret.

## Human and agent flow

1. A person installs a built-in tool, builds one through **Build a tool**, or
   an agent calls
   `propose_cabinet_tool` with a manifest.
2. Cabinet validates the complete manifest before persisting it.
3. Agent-created tools and updates appear as `Proposed by AI`, including every
   requested permission and the reason for an update.
4. A person approves the proposal.
5. During any later chat, an agent may call `list_cabinet_tools` and
   `use_cabinet_tool` to inspect or change approved tool data.
6. If the workflow needs a new interface or data shape, the agent calls
   `propose_cabinet_tool_change`. The current version stays live until approval.
7. Tool workflows and existing Cabinet handoffs use ordinary conversations and
   child tasks, so their results remain visible in Tasks and room history.

## Safety boundary

The platform deliberately chooses constrained, declarative tools over arbitrary
generated application code. This keeps tools removable, mobile-compatible, and
compatible with official Cabinet upgrades. Cabinet-owned components provide the
shape-shifting interface without granting generated JavaScript access to the
application or authenticated browser state.

Permission declarations are currently an approval and disclosure boundary for
the shared workspace renderer. They are not yet a general-purpose sandbox for
CLI agents, which retain the permissions of the underlying Cabinet agent run.
Do not describe version one as isolating an agent from room files.

AI automations that would start a paid or externally connected agent run are
queued for a person. Deterministic approved record updates may run immediately.
This prevents an event loop from silently spending provider credits or sending
data outside Cabinet.

## Verification contract

A Cabinet Tool change is complete only when it proves:

- validation fails before storage for malformed or undeclared capabilities;
- installations and proposals remain isolated to one room;
- proposals do not render as installed tools before approval;
- agent updates do not alter the active manifest before approval;
- disabled tools reject agent writes and skip automations without losing data;
- event delivery is idempotent for a source event and leaves an audit receipt;
- earlier manifests remain available for rollback;
- clean URLs round-trip at any room depth;
- each declared block renders through the shared system and the workspace
  launches through the shared composer;
- 320, 375, 414, 768, and desktop layouts have no page overflow and interactive
  controls remain at least forty-four pixels high;
- existing tests, lint, build, and Vercel cloud-route generation pass.
