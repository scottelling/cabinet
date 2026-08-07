import {
  executeCabinetToolCommand,
  getCabinetToolInventory,
  proposeCabinetTool,
  proposeCabinetToolChange,
} from "@/lib/tools/tool-platform";
import type {
  CabinetToolCommand,
  CabinetToolManifest,
  CabinetToolValue,
} from "@/types/tools";

export interface CabinetAgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const manifestSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "number", enum: [1] },
    id: { type: "string" },
    version: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    icon: {
      type: "string",
      enum: [
        "book-open",
        "briefcase",
        "chart",
        "list-checks",
        "search",
        "sparkles",
        "workflow",
      ],
    },
    permissions: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "knowledge:read",
          "knowledge:write",
          "agents:run",
          "tasks:manage",
          "schedules:manage",
          "integrations:use",
        ],
      },
    },
    surfaces: {
      type: "object",
      properties: {
        home: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            actionLabel: { type: "string" },
          },
          required: ["title", "description"],
          additionalProperties: false,
        },
        workspace: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            starterPrompts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  prompt: { type: "string" },
                  description: { type: "string" },
                },
                required: ["id", "label", "prompt"],
                additionalProperties: false,
              },
            },
            blocks: {
              type: "array",
              description:
                "Declarative form, table, board, chart, or metric blocks bound to a collection.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["form", "table", "board", "chart", "metric"],
                  },
                  title: { type: "string" },
                  description: { type: "string" },
                  collectionId: { type: "string" },
                  fields: { type: "array", items: { type: "string" } },
                  actionLabel: { type: "string" },
                  titleField: { type: "string" },
                  groupBy: { type: "string" },
                  lanes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        value: { type: "string" },
                        label: { type: "string" },
                      },
                      required: ["value", "label"],
                      additionalProperties: false,
                    },
                  },
                  chartType: { type: "string", enum: ["bar", "line", "donut"] },
                  categoryField: { type: "string" },
                  valueField: { type: "string" },
                  calculation: {
                    type: "string",
                    enum: ["count", "sum", "average"],
                  },
                },
                required: ["id", "type", "title", "collectionId"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "description", "starterPrompts"],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: {
                  type: "string",
                  enum: ["text", "textarea", "number", "select", "checkbox", "date"],
                },
                required: { type: "boolean" },
                placeholder: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      label: { type: "string" },
                    },
                    required: ["value", "label"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["id", "label", "type"],
              additionalProperties: false,
            },
          },
        },
        required: ["id", "name", "fields"],
        additionalProperties: false,
      },
    },
    automations: {
      type: "array",
      items: {
        type: "object",
        description:
          "An approved reaction to a Cabinet event. Actions may add a record or queue an agent prompt.",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          event: {
            type: "string",
            enum: [
              "conversation.completed",
              "task.completed",
              "knowledge.changed",
              "schedule.fired",
              "integration.received",
            ],
          },
          action: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["add-record", "queue-prompt"] },
              collectionId: { type: "string" },
              values: { type: "object", additionalProperties: true },
              prompt: { type: "string" },
            },
            required: ["type"],
            additionalProperties: false,
          },
        },
        required: ["id", "name", "event", "action"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "schemaVersion",
    "id",
    "version",
    "name",
    "description",
    "icon",
    "permissions",
    "surfaces",
  ],
  additionalProperties: false,
} as const;

export const CABINET_AGENT_TOOL_DEFINITIONS: readonly CabinetAgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_cabinet_tools",
      description:
        "List installed Cabinet Tools and pending proposals in the current Cabinet.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "use_cabinet_tool",
      description:
        "Inspect an installed Cabinet Tool or add, update, or delete one of its records. Inspect first when you do not already know its collections and fields.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["inspect", "add-record", "update-record", "delete-record"],
          },
          toolId: { type: "string" },
          collectionId: { type: "string" },
          recordId: { type: "string" },
          values: { type: "object", additionalProperties: true },
        },
        required: ["action", "toolId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_cabinet_tool",
      description:
        "Propose a declarative Cabinet Tool. It remains uninstalled until a person approves it.",
      parameters: {
        type: "object",
        properties: { manifest: manifestSchema },
        required: ["manifest"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_cabinet_tool_change",
      description:
        "Propose a new version of an installed Cabinet Tool. The current version stays active until a person approves the change.",
      parameters: {
        type: "object",
        properties: {
          toolId: { type: "string" },
          manifest: manifestSchema,
          reason: { type: "string" },
        },
        required: ["toolId", "manifest", "reason"],
        additionalProperties: false,
      },
    },
  },
];

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function toolOpenPath(cabinetPath: string, toolId: string): string {
  const encodePath = (value: string) =>
    value.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/room/${encodePath(cabinetPath)}/-/tools/${encodeURIComponent(toolId)}`;
}

export async function executeCabinetAgentTool(
  cabinetPath: string,
  name: string,
  args: Record<string, unknown>,
  agentId = "cabinet-agent",
): Promise<string> {
  if (name === "list_cabinet_tools") {
    const inventory = await getCabinetToolInventory(cabinetPath);
    return JSON.stringify({
      tools: inventory.installed.map((entry) => ({
        id: entry.manifest.id,
        name: entry.manifest.name,
        description: entry.manifest.description,
        version: entry.manifest.version,
        enabled: entry.enabled !== false,
        permissions: entry.manifest.permissions,
        collections: (entry.manifest.collections ?? []).map((collection) => ({
          id: collection.id,
          name: collection.name,
          fields: collection.fields,
        })),
        openPath: toolOpenPath(cabinetPath, entry.manifest.id),
      })),
      proposals: inventory.proposals.map((proposal) => ({
        id: proposal.manifest.id,
        name: proposal.manifest.name,
        version: proposal.manifest.version,
        kind: proposal.kind ?? "install",
      })),
    });
  }

  if (name === "use_cabinet_tool") {
    const action = requiredString(args.action, "action") as CabinetToolCommand["type"];
    const toolId = requiredString(args.toolId, "toolId");
    const actor = { type: "agent" as const, id: agentId };
    const command: CabinetToolCommand =
      action === "inspect"
        ? { type: "inspect", toolId, actor }
        : action === "add-record"
          ? {
              type: "add-record",
              toolId,
              collectionId: requiredString(args.collectionId, "collectionId"),
              values: (args.values ?? {}) as Record<string, CabinetToolValue>,
              actor,
            }
          : action === "update-record"
            ? {
                type: "update-record",
                toolId,
                collectionId: requiredString(args.collectionId, "collectionId"),
                recordId: requiredString(args.recordId, "recordId"),
                values: (args.values ?? {}) as Record<string, CabinetToolValue>,
                actor,
              }
            : action === "delete-record"
              ? {
                  type: "delete-record",
                  toolId,
                  collectionId: requiredString(args.collectionId, "collectionId"),
                  recordId: requiredString(args.recordId, "recordId"),
                  actor,
                }
              : (() => {
                  throw new Error(`Unsupported Cabinet Tool action: ${action}.`);
                })();
    const result = await executeCabinetToolCommand(cabinetPath, command);
    return JSON.stringify({
      manifest: result.installation.manifest,
      state: result.state,
      revision: result.state.revision,
      record: result.record,
      removedRecordId: result.removedRecordId,
      openPath: toolOpenPath(cabinetPath, toolId),
    });
  }

  if (name === "propose_cabinet_tool") {
    if (!args.manifest || typeof args.manifest !== "object") {
      throw new Error("manifest is required.");
    }
    const proposal = await proposeCabinetTool(
      cabinetPath,
      args.manifest as CabinetToolManifest,
    );
    return JSON.stringify({ proposal });
  }

  if (name === "propose_cabinet_tool_change") {
    if (!args.manifest || typeof args.manifest !== "object") {
      throw new Error("manifest is required.");
    }
    const proposal = await proposeCabinetToolChange(
      cabinetPath,
      requiredString(args.toolId, "toolId"),
      args.manifest as CabinetToolManifest,
      requiredString(args.reason, "reason"),
    );
    return JSON.stringify({ proposal });
  }

  throw new Error(`Unknown Cabinet agent tool: ${name}.`);
}
