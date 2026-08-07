import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ROOT_CABINET_PATH, normalizeCabinetPath } from "@/lib/cabinets/paths";
import {
  ensureDirectory,
  fileExists,
  writeFileAtomic,
} from "@/lib/storage/fs-operations";
import { DATA_DIR, resolveContentPath } from "@/lib/storage/path-utils";
import { BUILT_IN_TOOLS } from "@/lib/tools/tool-catalog";
import { readJsonLinesTail } from "@/lib/tools/tool-storage";
import {
  ALLOWED_EVENT_TYPES,
  FIELD_ID_PATTERN,
  TOOL_ID_PATTERN,
  VERSION_PATTERN,
  assertNonEmptyString,
  isRecord,
  validateCabinetToolManifest,
} from "@/lib/tools/tool-manifest";
import {
  type CabinetToolActor,
  type CabinetToolAutomationOutcome,
  type CabinetToolCommand,
  type CabinetToolCommandResult,
  type CabinetToolDetail,
  type CabinetToolEvent,
  type CabinetToolInventory,
  type CabinetToolManifest,
  type CabinetToolProposal,
  type CabinetToolRecord,
  type CabinetToolSourceEvent,
  type CabinetToolState,
  type CabinetToolValue,
  type InstalledCabinetTool,
} from "@/types/tools";

const TOOLS_DIRECTORY = ".cabinet-tools";
const PROPOSALS_DIRECTORY = ".cabinet-tool-proposals";
const TRASH_DIRECTORY = ".cabinet-tool-trash";
const INSTALLATION_FILE = "installation.json";
const STATE_FILE = "state.json";
const EVENTS_FILE = "events.jsonl";
const VERSIONS_DIRECTORY = "versions";
const TRASH_ENTRIES_TO_KEEP = 10;

const toolMutationQueues = new Map<string, Promise<void>>();

function resolveCabinetDirectory(cabinetPath: string): string {
  const normalized = normalizeCabinetPath(cabinetPath, true);
  if (!normalized || normalized === ROOT_CABINET_PATH) {
    throw new Error("Cabinet Tools must be installed inside a room.");
  }
  return resolveContentPath(normalized);
}

async function assertCabinetExists(cabinetPath: string): Promise<string> {
  const directory = resolveCabinetDirectory(cabinetPath);
  if (!(await fileExists(path.join(directory, ".cabinet")))) {
    throw new Error(`Cabinet room does not exist: ${cabinetPath}.`);
  }
  return directory;
}

function installationPath(cabinetDirectory: string, toolId: string): string {
  if (!TOOL_ID_PATTERN.test(toolId)) {
    throw new Error("Invalid Cabinet Tool id.");
  }
  return path.join(
    cabinetDirectory,
    TOOLS_DIRECTORY,
    toolId,
    INSTALLATION_FILE,
  );
}

function toolDirectory(cabinetDirectory: string, toolId: string): string {
  return path.dirname(installationPath(cabinetDirectory, toolId));
}

function statePath(cabinetDirectory: string, toolId: string): string {
  return path.join(toolDirectory(cabinetDirectory, toolId), STATE_FILE);
}

function eventsPath(cabinetDirectory: string, toolId: string): string {
  return path.join(toolDirectory(cabinetDirectory, toolId), EVENTS_FILE);
}

function versionPath(
  cabinetDirectory: string,
  toolId: string,
  version: string,
): string {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("Invalid Cabinet Tool version.");
  }
  return path.join(
    toolDirectory(cabinetDirectory, toolId),
    VERSIONS_DIRECTORY,
    `${version}.json`,
  );
}

async function withToolMutation<T>(key: string, work: () => Promise<T>): Promise<T> {
  const prior = toolMutationQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = prior.then(() => current);
  toolMutationQueues.set(key, queued);
  await prior;
  try {
    return await work();
  } finally {
    release();
    if (toolMutationQueues.get(key) === queued) toolMutationQueues.delete(key);
  }
}

function proposalPath(cabinetDirectory: string, toolId: string): string {
  if (!TOOL_ID_PATTERN.test(toolId)) {
    throw new Error("Invalid Cabinet Tool id.");
  }
  return path.join(cabinetDirectory, PROPOSALS_DIRECTORY, `${toolId}.json`);
}

async function readInstallation(
  filePath: string,
): Promise<InstalledCabinetTool | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(filePath, "utf8"),
    ) as Partial<InstalledCabinetTool>;
    const manifest = validateCabinetToolManifest(raw.manifest);
    if (raw.source !== "built-in" && raw.source !== "custom") return null;
    assertNonEmptyString(raw.installedAt, "installedAt");
    if (Number.isNaN(Date.parse(raw.installedAt))) return null;
    return {
      manifest,
      source: raw.source,
      installedAt: raw.installedAt,
      updatedAt:
        typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))
          ? raw.updatedAt
          : raw.installedAt,
      enabled: raw.enabled !== false,
    };
  } catch {
    return null;
  }
}

function initialToolState(manifest: CabinetToolManifest): CabinetToolState {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: new Date().toISOString(),
    collections: Object.fromEntries(
      (manifest.collections ?? []).map((collection) => [collection.id, []]),
    ),
    promptQueue: [],
  };
}

function normalizeToolState(
  value: unknown,
  manifest: CabinetToolManifest,
): CabinetToolState | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) {
    return null;
  }
  if (!isRecord(value.collections) || !Array.isArray(value.promptQueue)) return null;
  const collections: CabinetToolState["collections"] = {};
  for (const [collectionId, records] of Object.entries(value.collections)) {
    if (!FIELD_ID_PATTERN.test(collectionId) || !Array.isArray(records)) continue;
    collections[collectionId] = records.filter((record): record is CabinetToolRecord => {
      if (!isRecord(record) || typeof record.id !== "string" || !isRecord(record.values)) {
        return false;
      }
      return (
        typeof record.createdAt === "string" &&
        typeof record.updatedAt === "string" &&
        isRecord(record.createdBy) &&
        isRecord(record.updatedBy)
      );
    });
  }
  for (const definition of manifest.collections ?? []) {
    collections[definition.id] ??= [];
  }
  const promptQueue = value.promptQueue.filter((entry): entry is CabinetToolState["promptQueue"][number] =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.prompt === "string" &&
    typeof entry.automationId === "string" &&
    typeof entry.createdAt === "string",
  );
  return {
    schemaVersion: 1,
    revision: Number(value.revision),
    updatedAt: value.updatedAt,
    collections,
    promptQueue,
  };
}

async function writeToolState(
  cabinetDirectory: string,
  toolId: string,
  state: CabinetToolState,
): Promise<void> {
  const filePath = statePath(cabinetDirectory, toolId);
  await ensureDirectory(path.dirname(filePath));
  await writeFileAtomic(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function appendToolEvent(
  cabinetDirectory: string,
  toolId: string,
  event: Omit<CabinetToolEvent, "id" | "toolId" | "createdAt">,
): Promise<CabinetToolEvent> {
  const receipt: CabinetToolEvent = {
    id: randomUUID(),
    toolId,
    createdAt: new Date().toISOString(),
    ...event,
  };
  const filePath = eventsPath(cabinetDirectory, toolId);
  await ensureDirectory(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(receipt)}\n`, "utf8");
  return receipt;
}

function findCollection(manifest: CabinetToolManifest, collectionId: string) {
  const collection = (manifest.collections ?? []).find(
    (entry) => entry.id === collectionId,
  );
  if (!collection) {
    throw new Error(`Cabinet Tool collection does not exist: ${collectionId}.`);
  }
  return collection;
}

function validateRecordValues(
  manifest: CabinetToolManifest,
  collectionId: string,
  values: Record<string, CabinetToolValue>,
  options: { partial?: boolean } = {},
): Record<string, CabinetToolValue> {
  if (!isRecord(values)) throw new Error("Cabinet Tool record values must be an object.");
  const collection = findCollection(manifest, collectionId);
  const definitions = new Map(collection.fields.map((field) => [field.id, field]));
  for (const fieldId of Object.keys(values)) {
    if (!definitions.has(fieldId)) {
      throw new Error(`Unknown field ${fieldId} in collection ${collectionId}.`);
    }
  }
  if (!options.partial) {
    for (const field of collection.fields) {
      if (field.required && (values[field.id] === undefined || values[field.id] === null || values[field.id] === "")) {
        throw new Error(`${field.label} is required.`);
      }
    }
  }
  for (const [fieldId, value] of Object.entries(values)) {
    if (value === null) continue;
    const field = definitions.get(fieldId)!;
    if (field.type === "number" && typeof value !== "number") {
      throw new Error(`${field.label} must be a number.`);
    }
    if (field.type === "checkbox" && typeof value !== "boolean") {
      throw new Error(`${field.label} must be true or false.`);
    }
    if (
      field.type !== "number" &&
      field.type !== "checkbox" &&
      typeof value !== "string"
    ) {
      throw new Error(`${field.label} must be text.`);
    }
    if (
      field.type === "select" &&
      typeof value === "string" &&
      !(field.options ?? []).some((option) => option.value === value)
    ) {
      throw new Error(`${field.label} has an unsupported option.`);
    }
  }
  return { ...values };
}

export function getCabinetToolCatalog(): CabinetToolManifest[] {
  return Array.from(BUILT_IN_TOOLS.values(), (manifest) =>
    validateCabinetToolManifest(manifest),
  );
}

export async function listInstalledCabinetTools(
  cabinetPath: string,
): Promise<InstalledCabinetTool[]> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const toolsDirectory = path.join(cabinetDirectory, TOOLS_DIRECTORY);
  const entries = await fs
    .readdir(toolsDirectory, { withFileTypes: true })
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
  const installed = await Promise.all(
    entries
      .filter(
        (entry) => entry.isDirectory() && TOOL_ID_PATTERN.test(entry.name),
      )
      .map((entry) =>
        readInstallation(installationPath(cabinetDirectory, entry.name)),
      ),
  );
  return installed
    .filter((entry): entry is InstalledCabinetTool => entry !== null)
    .sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );
}

export async function getCabinetToolInventory(
  cabinetPath: string,
): Promise<CabinetToolInventory> {
  return {
    catalog: getCabinetToolCatalog(),
    installed: await listInstalledCabinetTools(cabinetPath),
    proposals: await listCabinetToolProposals(cabinetPath),
  };
}

export async function listCabinetToolProposals(
  cabinetPath: string,
): Promise<CabinetToolProposal[]> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const directory = path.join(cabinetDirectory, PROPOSALS_DIRECTORY);
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
  const proposals = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry): Promise<CabinetToolProposal | null> => {
        try {
          const parsed = JSON.parse(
            await fs.readFile(path.join(directory, entry.name), "utf8"),
          ) as Partial<CabinetToolProposal>;
          const manifest = validateCabinetToolManifest(parsed.manifest);
          assertNonEmptyString(parsed.proposedAt, "proposedAt");
          if (Number.isNaN(Date.parse(parsed.proposedAt))) return null;
          return {
            manifest,
            proposedAt: parsed.proposedAt,
            kind: parsed.kind === "update" ? "update" : "install",
            baseVersion:
              typeof parsed.baseVersion === "string" ? parsed.baseVersion : undefined,
            reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
          };
        } catch {
          return null;
        }
      }),
  );
  return proposals
    .filter((entry): entry is CabinetToolProposal => entry !== null)
    .sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );
}

/**
 * Save an agent-authored tool for human review. Proposals never register a
 * surface or grant a permission; installation is the separate approval step.
 */
export async function proposeCabinetTool(
  cabinetPath: string,
  requested: CabinetToolManifest,
): Promise<CabinetToolProposal> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const manifest = validateCabinetToolManifest(requested);
  const filePath = proposalPath(cabinetDirectory, manifest.id);
  const existing = await fs.readFile(filePath, "utf8").then(
    (raw) => JSON.parse(raw) as Partial<CabinetToolProposal>,
    () => null,
  );
  const proposal: CabinetToolProposal = {
    manifest,
    kind: "install",
    proposedAt:
      existing && typeof existing.proposedAt === "string"
        ? existing.proposedAt
        : new Date().toISOString(),
  };
  await ensureDirectory(path.dirname(filePath));
  await writeFileAtomic(filePath, `${JSON.stringify(proposal, null, 2)}\n`);
  return proposal;
}

export async function proposeCabinetToolChange(
  cabinetPath: string,
  toolId: string,
  requested: CabinetToolManifest,
  reason?: string,
): Promise<CabinetToolProposal> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const current = await readInstallation(installationPath(cabinetDirectory, toolId));
  if (!current) throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
  const manifest = validateCabinetToolManifest(requested);
  if (manifest.id !== toolId) {
    throw new Error("A Cabinet Tool update cannot change its id.");
  }
  if (manifest.version === current.manifest.version) {
    throw new Error("A Cabinet Tool update must declare a new version.");
  }
  const proposal: CabinetToolProposal = {
    manifest,
    kind: "update",
    baseVersion: current.manifest.version,
    proposedAt: new Date().toISOString(),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  };
  const filePath = proposalPath(cabinetDirectory, toolId);
  await ensureDirectory(path.dirname(filePath));
  await writeFileAtomic(filePath, `${JSON.stringify(proposal, null, 2)}\n`);
  return proposal;
}

export async function installCabinetTool(
  cabinetPath: string,
  tool: string | CabinetToolManifest,
): Promise<InstalledCabinetTool> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const source = typeof tool === "string" ? "built-in" : "custom";
  const requested = typeof tool === "string" ? BUILT_IN_TOOLS.get(tool) : tool;
  if (!requested) {
    throw new Error(`Unknown Cabinet Tool: ${String(tool)}.`);
  }
  const manifest = validateCabinetToolManifest(requested);
  return withToolMutation(`${cabinetDirectory}:${manifest.id}`, async () => {
    const filePath = installationPath(cabinetDirectory, manifest.id);
    const existing = await readInstallation(filePath);
    if (
      existing?.manifest.version === manifest.version &&
      JSON.stringify(existing.manifest) !== JSON.stringify(manifest)
    ) {
      throw new Error("Cabinet Tool content changed without a new version.");
    }
    const now = new Date().toISOString();
    const changed = !existing || existing.manifest.version !== manifest.version;
    const installation: InstalledCabinetTool = {
      manifest,
      source,
      installedAt: existing?.installedAt || now,
      updatedAt: changed ? now : existing.updatedAt || existing.installedAt,
      enabled: existing?.enabled !== false,
    };
    await ensureDirectory(path.dirname(filePath));
    if (existing) {
      const oldVersionPath = versionPath(
        cabinetDirectory,
        manifest.id,
        existing.manifest.version,
      );
      await ensureDirectory(path.dirname(oldVersionPath));
      await writeFileAtomic(
        oldVersionPath,
        `${JSON.stringify(existing.manifest, null, 2)}\n`,
      );
    }
    const currentVersionPath = versionPath(
      cabinetDirectory,
      manifest.id,
      manifest.version,
    );
    await ensureDirectory(path.dirname(currentVersionPath));
    await writeFileAtomic(
      currentVersionPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeFileAtomic(filePath, `${JSON.stringify(installation, null, 2)}\n`);

    const existingState = await fs
      .readFile(statePath(cabinetDirectory, manifest.id), "utf8")
      .then((raw) => normalizeToolState(JSON.parse(raw), manifest))
      .catch(() => null);
    await writeToolState(
      cabinetDirectory,
      manifest.id,
      existingState ?? initialToolState(manifest),
    );
    await fs.rm(proposalPath(cabinetDirectory, manifest.id), { force: true });
    if (changed) {
      await appendToolEvent(cabinetDirectory, manifest.id, {
        type: existing ? "updated" : "installed",
        actor: { type: "user" },
        detail: { version: manifest.version, previousVersion: existing?.manifest.version },
      });
    }
    return installation;
  });
}

async function readCurrentToolState(
  cabinetDirectory: string,
  installation: InstalledCabinetTool,
): Promise<CabinetToolState> {
  const filePath = statePath(cabinetDirectory, installation.manifest.id);
  const state = await fs
    .readFile(filePath, "utf8")
    .then((raw) => normalizeToolState(JSON.parse(raw), installation.manifest))
    .catch(() => null);
  if (state) return state;
  const initial = initialToolState(installation.manifest);
  await writeToolState(cabinetDirectory, installation.manifest.id, initial);
  return initial;
}

export async function getCabinetToolState(
  cabinetPath: string,
  toolId: string,
): Promise<CabinetToolState> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const installation = await readInstallation(
    installationPath(cabinetDirectory, toolId),
  );
  if (!installation) throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
  return readCurrentToolState(cabinetDirectory, installation);
}

export async function getCabinetToolDetail(
  cabinetPath: string,
  toolId: string,
): Promise<CabinetToolDetail> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const installation = await readInstallation(
    installationPath(cabinetDirectory, toolId),
  );
  if (!installation) throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
  const [state, events, versions] = await Promise.all([
    readCurrentToolState(cabinetDirectory, installation),
    listCabinetToolEvents(cabinetPath, toolId),
    listCabinetToolVersions(cabinetPath, toolId),
  ]);
  return { installation, state, events, versions };
}

export async function listCabinetToolEvents(
  cabinetPath: string,
  toolId: string,
  limit = 100,
): Promise<CabinetToolEvent[]> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  if (!TOOL_ID_PATTERN.test(toolId)) throw new Error("Invalid Cabinet Tool id.");
  const normalizedLimit = Math.max(1, Math.min(limit, 500));
  const raw = await readJsonLinesTail(
    eventsPath(cabinetDirectory, toolId),
    normalizedLimit,
    (line) => {
      try {
        const event = JSON.parse(line) as CabinetToolEvent;
        return event.toolId === toolId && typeof event.type === "string";
      } catch {
        return false;
      }
    },
  );
  return raw
    .split("\n")
    .filter(Boolean)
    .flatMap((line): CabinetToolEvent[] => {
      try {
        const event = JSON.parse(line) as CabinetToolEvent;
        return event.toolId === toolId && typeof event.type === "string" ? [event] : [];
      } catch {
        return [];
      }
    })
    .slice(-normalizedLimit)
    .reverse();
}

export async function executeCabinetToolCommand(
  cabinetPath: string,
  command: CabinetToolCommand,
): Promise<CabinetToolCommandResult> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  if (!TOOL_ID_PATTERN.test(command.toolId)) throw new Error("Invalid Cabinet Tool id.");
  const key = `${cabinetDirectory}:${command.toolId}`;
  if (command.type === "inspect") {
    const installation = await readInstallation(
      installationPath(cabinetDirectory, command.toolId),
    );
    if (!installation) throw new Error(`Cabinet Tool is not installed: ${command.toolId}.`);
    return {
      installation,
      state: await readCurrentToolState(cabinetDirectory, installation),
    };
  }
  return withToolMutation(key, async () => {
    const installation = await readInstallation(
      installationPath(cabinetDirectory, command.toolId),
    );
    if (!installation) throw new Error(`Cabinet Tool is not installed: ${command.toolId}.`);
    if (installation.enabled === false) {
      throw new Error(`Cabinet Tool is disabled: ${command.toolId}.`);
    }
    const state = await readCurrentToolState(cabinetDirectory, installation);
    const records = state.collections[command.collectionId];
    if (!records) {
      throw new Error(`Cabinet Tool collection does not exist: ${command.collectionId}.`);
    }
    const now = new Date().toISOString();
    if (command.type === "add-record") {
      const values = validateRecordValues(
        installation.manifest,
        command.collectionId,
        command.values,
      );
      const record: CabinetToolRecord = {
        id: randomUUID(),
        values,
        createdAt: now,
        updatedAt: now,
        createdBy: command.actor,
        updatedBy: command.actor,
      };
      records.push(record);
      state.revision += 1;
      state.updatedAt = now;
      await writeToolState(cabinetDirectory, command.toolId, state);
      await appendToolEvent(cabinetDirectory, command.toolId, {
        type: "record.added",
        actor: command.actor,
        detail: { collectionId: command.collectionId, recordId: record.id },
      });
      return { installation, state, record };
    }

    const recordIndex = records.findIndex((record) => record.id === command.recordId);
    if (recordIndex < 0) throw new Error(`Cabinet Tool record does not exist: ${command.recordId}.`);
    if (command.type === "update-record") {
      const values = validateRecordValues(
        installation.manifest,
        command.collectionId,
        command.values,
        { partial: true },
      );
      const prior = records[recordIndex]!;
      const record: CabinetToolRecord = {
        ...prior,
        values: { ...prior.values, ...values },
        updatedAt: now,
        updatedBy: command.actor,
      };
      validateRecordValues(
        installation.manifest,
        command.collectionId,
        record.values,
      );
      records[recordIndex] = record;
      state.revision += 1;
      state.updatedAt = now;
      await writeToolState(cabinetDirectory, command.toolId, state);
      await appendToolEvent(cabinetDirectory, command.toolId, {
        type: "record.updated",
        actor: command.actor,
        detail: { collectionId: command.collectionId, recordId: record.id },
      });
      return { installation, state, record };
    }

    records.splice(recordIndex, 1);
    state.revision += 1;
    state.updatedAt = now;
    await writeToolState(cabinetDirectory, command.toolId, state);
    await appendToolEvent(cabinetDirectory, command.toolId, {
      type: "record.deleted",
      actor: command.actor,
      detail: { collectionId: command.collectionId, recordId: command.recordId },
    });
    return { installation, state, removedRecordId: command.recordId };
  });
}

export async function setCabinetToolEnabled(
  cabinetPath: string,
  toolId: string,
  enabled: boolean,
): Promise<InstalledCabinetTool> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  return withToolMutation(`${cabinetDirectory}:${toolId}`, async () => {
    const filePath = installationPath(cabinetDirectory, toolId);
    const installation = await readInstallation(filePath);
    if (!installation) throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
    if (installation.enabled === enabled) return installation;
    const updated: InstalledCabinetTool = {
      ...installation,
      enabled,
      updatedAt: new Date().toISOString(),
    };
    await writeFileAtomic(filePath, `${JSON.stringify(updated, null, 2)}\n`);
    await appendToolEvent(cabinetDirectory, toolId, {
      type: enabled ? "enabled" : "disabled",
      actor: { type: "user" },
    });
    return updated;
  });
}

export async function listCabinetToolVersions(
  cabinetPath: string,
  toolId: string,
): Promise<CabinetToolManifest[]> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  if (!TOOL_ID_PATTERN.test(toolId)) throw new Error("Invalid Cabinet Tool id.");
  const directory = path.dirname(versionPath(cabinetDirectory, toolId, "0.0.0"));
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  const manifests = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry): Promise<CabinetToolManifest | null> => {
        try {
          return validateCabinetToolManifest(
            JSON.parse(await fs.readFile(path.join(directory, entry.name), "utf8")),
          );
        } catch {
          return null;
        }
      }),
  );
  return manifests
    .filter((manifest): manifest is CabinetToolManifest => manifest !== null)
    .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }));
}

export async function rollbackCabinetTool(
  cabinetPath: string,
  toolId: string,
  version: string,
): Promise<InstalledCabinetTool> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const current = await readInstallation(installationPath(cabinetDirectory, toolId));
  if (!current) throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
  const manifest = validateCabinetToolManifest(
    JSON.parse(await fs.readFile(versionPath(cabinetDirectory, toolId, version), "utf8")),
  );
  if (manifest.id !== toolId) throw new Error("Stored Cabinet Tool version has the wrong id.");
  const installed = await installCabinetTool(cabinetPath, manifest);
  await appendToolEvent(cabinetDirectory, toolId, {
    type: "rolled-back",
    actor: { type: "user" },
    detail: { fromVersion: current.manifest.version, toVersion: version },
  });
  return installed;
}

export async function applyCabinetToolEvent(
  cabinetPath: string,
  sourceEvent: CabinetToolSourceEvent,
): Promise<CabinetToolAutomationOutcome[]> {
  if (!ALLOWED_EVENT_TYPES.has(sourceEvent.type)) {
    throw new Error(`Unsupported Cabinet Tool event: ${sourceEvent.type}.`);
  }
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  const installations = await listInstalledCabinetTools(cabinetPath);
  const outcomes: CabinetToolAutomationOutcome[] = [];
  for (const installation of installations) {
    if (installation.enabled === false) continue;
    const priorEvents = sourceEvent.sourceId
      ? await listCabinetToolEvents(cabinetPath, installation.manifest.id, 500)
      : [];
    for (const automation of installation.manifest.automations ?? []) {
      if (automation.event !== sourceEvent.type) continue;
      if (
        sourceEvent.sourceId &&
        priorEvents.some(
          (event) =>
            event.actor.id === automation.id &&
            event.detail?.sourceType === sourceEvent.type &&
            event.detail?.sourceId === sourceEvent.sourceId &&
            (event.type === "automation.completed" || event.type === "automation.queued"),
        )
      ) {
        continue;
      }
      const actor: CabinetToolActor = { type: "automation", id: automation.id };
      const action = automation.action;
      try {
        if (action.type === "add-record") {
          await executeCabinetToolCommand(cabinetPath, {
            type: "add-record",
            toolId: installation.manifest.id,
            collectionId: action.collectionId,
            values: action.values,
            actor,
          });
          await appendToolEvent(cabinetDirectory, installation.manifest.id, {
            type: "automation.completed",
            actor,
            detail: {
              automationId: automation.id,
              sourceType: sourceEvent.type,
              sourceId: sourceEvent.sourceId,
            },
          });
          outcomes.push({
            toolId: installation.manifest.id,
            automationId: automation.id,
            status: "completed",
            message: `${automation.name} added a record.`,
          });
          continue;
        }

        await withToolMutation(
          `${cabinetDirectory}:${installation.manifest.id}`,
          async () => {
            const state = await readCurrentToolState(cabinetDirectory, installation);
            const now = new Date().toISOString();
            state.promptQueue.push({
              id: randomUUID(),
              prompt: action.prompt,
              automationId: automation.id,
              createdAt: now,
            });
            state.revision += 1;
            state.updatedAt = now;
            await writeToolState(
              cabinetDirectory,
              installation.manifest.id,
              state,
            );
          },
        );
        await appendToolEvent(cabinetDirectory, installation.manifest.id, {
          type: "automation.queued",
          actor,
          detail: {
            automationId: automation.id,
            sourceType: sourceEvent.type,
            sourceId: sourceEvent.sourceId,
          },
        });
        outcomes.push({
          toolId: installation.manifest.id,
          automationId: automation.id,
          status: "queued",
          message: `${automation.name} queued an agent prompt.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendToolEvent(cabinetDirectory, installation.manifest.id, {
          type: "automation.failed",
          actor,
          detail: { automationId: automation.id, message },
        });
        outcomes.push({
          toolId: installation.manifest.id,
          automationId: automation.id,
          status: "failed",
          message,
        });
      }
    }
  }
  return outcomes;
}

export async function uninstallCabinetTool(
  cabinetPath: string,
  toolId: string,
): Promise<void> {
  const cabinetDirectory = await assertCabinetExists(cabinetPath);
  await withToolMutation(`${cabinetDirectory}:${toolId}`, async () => {
    const directory = toolDirectory(cabinetDirectory, toolId);
    if (!(await fileExists(path.join(directory, INSTALLATION_FILE)))) {
      throw new Error(`Cabinet Tool is not installed: ${toolId}.`);
    }
    const trashRoot = path.join(cabinetDirectory, TRASH_DIRECTORY);
    await ensureDirectory(trashRoot);
    const timestamp = String(Date.now()).padStart(13, "0");
    const destination = path.join(
      trashRoot,
      `${timestamp}-${toolId}-${randomUUID()}`,
    );
    await fs.rename(directory, destination);

    const entries = await fs.readdir(trashRoot, { withFileTypes: true });
    const stale = entries
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => right.name.localeCompare(left.name))
      .slice(TRASH_ENTRIES_TO_KEEP);
    await Promise.all(
      stale.map((entry) =>
        fs.rm(path.join(trashRoot, entry.name), {
          recursive: true,
          force: true,
        }),
      ),
    );
  });
}

/** Exposed only for documentation and migration tooling. */
export function cabinetToolsDirectory(cabinetPath: string): string {
  const resolved = resolveCabinetDirectory(cabinetPath);
  const relative = path.relative(
    DATA_DIR,
    path.join(resolved, TOOLS_DIRECTORY),
  );
  return relative.split(path.sep).join("/");
}
