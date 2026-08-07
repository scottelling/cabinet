export const CABINET_TOOL_SCHEMA_VERSION = 1 as const;

export const CABINET_TOOL_PERMISSIONS = [
  "knowledge:read",
  "knowledge:write",
  "agents:run",
  "tasks:manage",
  "schedules:manage",
  "integrations:use",
] as const;

export type CabinetToolPermission = (typeof CABINET_TOOL_PERMISSIONS)[number];

export type CabinetToolIcon =
  | "book-open"
  | "briefcase"
  | "chart"
  | "list-checks"
  | "search"
  | "sparkles"
  | "workflow";

export interface CabinetToolStarterPrompt {
  id: string;
  label: string;
  prompt: string;
  description?: string;
}

export interface CabinetToolHomeSurface {
  title: string;
  description: string;
  actionLabel?: string;
}

export interface CabinetToolWorkspaceSurface {
  title: string;
  description: string;
  starterPrompts: CabinetToolStarterPrompt[];
  blocks?: CabinetToolBlock[];
}

export type CabinetToolValue = string | number | boolean | null;

export interface CabinetToolSelectOption {
  value: string;
  label: string;
}

export interface CabinetToolField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date";
  required?: boolean;
  placeholder?: string;
  options?: CabinetToolSelectOption[];
}

export interface CabinetToolCollection {
  id: string;
  name: string;
  fields: CabinetToolField[];
}

interface CabinetToolBlockBase {
  id: string;
  title: string;
  description?: string;
  collectionId: string;
}

export interface CabinetToolFormBlock extends CabinetToolBlockBase {
  type: "form";
  fields: string[];
  actionLabel?: string;
}

export interface CabinetToolTableBlock extends CabinetToolBlockBase {
  type: "table";
  fields: string[];
}

export interface CabinetToolBoardLane {
  value: string;
  label: string;
}

export interface CabinetToolBoardBlock extends CabinetToolBlockBase {
  type: "board";
  titleField: string;
  groupBy: string;
  lanes: CabinetToolBoardLane[];
}

export interface CabinetToolChartBlock extends CabinetToolBlockBase {
  type: "chart";
  chartType: "bar" | "line" | "donut";
  categoryField: string;
  valueField: string;
}

export interface CabinetToolMetricBlock extends CabinetToolBlockBase {
  type: "metric";
  calculation: "count" | "sum" | "average";
  valueField?: string;
}

export type CabinetToolBlock =
  | CabinetToolFormBlock
  | CabinetToolTableBlock
  | CabinetToolBoardBlock
  | CabinetToolChartBlock
  | CabinetToolMetricBlock;

export type CabinetToolEventType =
  | "conversation.completed"
  | "task.completed"
  | "knowledge.changed"
  | "schedule.fired"
  | "integration.received";

export interface CabinetToolAutomation {
  id: string;
  name: string;
  event: CabinetToolEventType;
  action:
    | {
        type: "add-record";
        collectionId: string;
        values: Record<string, CabinetToolValue>;
      }
    | {
        type: "queue-prompt";
        prompt: string;
      };
}

/**
 * The portable, declarative contract for a Cabinet Tool.
 *
 * Version one intentionally contains data rather than executable UI code. It
 * lets Cabinet render a useful, mobile-safe workspace while keeping generated
 * tools removable and unable to bypass Cabinet's storage, agent, or approval
 * systems.
 */
export interface CabinetToolManifest {
  schemaVersion: typeof CABINET_TOOL_SCHEMA_VERSION;
  id: string;
  version: string;
  name: string;
  description: string;
  icon: CabinetToolIcon;
  permissions: CabinetToolPermission[];
  surfaces: {
    home?: CabinetToolHomeSurface;
    workspace?: CabinetToolWorkspaceSurface;
  };
  collections?: CabinetToolCollection[];
  automations?: CabinetToolAutomation[];
}

export interface CabinetToolActor {
  type: "user" | "agent" | "automation" | "system";
  id?: string;
}

export interface CabinetToolRecord {
  id: string;
  values: Record<string, CabinetToolValue>;
  createdAt: string;
  updatedAt: string;
  createdBy: CabinetToolActor;
  updatedBy: CabinetToolActor;
}

export interface CabinetToolState {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  collections: Record<string, CabinetToolRecord[]>;
  promptQueue: Array<{
    id: string;
    prompt: string;
    automationId: string;
    createdAt: string;
  }>;
}

export type CabinetToolCommand =
  | {
      type: "inspect";
      toolId: string;
      actor: CabinetToolActor;
    }
  | {
      type: "add-record";
      toolId: string;
      collectionId: string;
      values: Record<string, CabinetToolValue>;
      actor: CabinetToolActor;
    }
  | {
      type: "update-record";
      toolId: string;
      collectionId: string;
      recordId: string;
      values: Record<string, CabinetToolValue>;
      actor: CabinetToolActor;
    }
  | {
      type: "delete-record";
      toolId: string;
      collectionId: string;
      recordId: string;
      actor: CabinetToolActor;
    };

export type CabinetToolCommandInput = CabinetToolCommand extends infer Command
  ? Command extends CabinetToolCommand
    ? Omit<Command, "toolId" | "actor">
    : never
  : never;

export interface CabinetToolCommandResult {
  installation: InstalledCabinetTool;
  state: CabinetToolState;
  record?: CabinetToolRecord;
  removedRecordId?: string;
}

export interface CabinetToolSourceEvent {
  type: CabinetToolEventType;
  sourceId?: string;
  payload?: Record<string, unknown>;
}

export interface CabinetToolAutomationOutcome {
  toolId: string;
  automationId: string;
  status: "completed" | "queued" | "failed";
  message: string;
}

export interface CabinetToolEvent {
  id: string;
  toolId: string;
  type:
    | "installed"
    | "updated"
    | "rolled-back"
    | "enabled"
    | "disabled"
    | "record.added"
    | "record.updated"
    | "record.deleted"
    | "automation.completed"
    | "automation.queued"
    | "automation.failed";
  createdAt: string;
  actor: CabinetToolActor;
  detail?: Record<string, unknown>;
}

export interface InstalledCabinetTool {
  manifest: CabinetToolManifest;
  source: "built-in" | "custom";
  installedAt: string;
  updatedAt?: string;
  enabled?: boolean;
}

export interface CabinetToolProposal {
  manifest: CabinetToolManifest;
  proposedAt: string;
  kind?: "install" | "update";
  baseVersion?: string;
  reason?: string;
}

export interface CabinetToolInventory {
  catalog: CabinetToolManifest[];
  installed: InstalledCabinetTool[];
  proposals: CabinetToolProposal[];
}

export interface CabinetToolDetail {
  installation: InstalledCabinetTool;
  state: CabinetToolState;
  events: CabinetToolEvent[];
  versions: CabinetToolManifest[];
}
