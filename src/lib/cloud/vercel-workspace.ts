import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzip, gzip } from "node:zlib";
import { promisify } from "node:util";
import {
  BlobPreconditionFailedError,
  del,
  get,
  list,
  put,
} from "@vercel/blob";
import { DATA_DIR } from "@/lib/storage/path-utils";
import matter from "gray-matter";
import {
  DIRECT_API_CONFIGS,
  isDirectApiProviderId,
} from "@/lib/agents/providers/direct-api";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const LEGACY_SNAPSHOT_PATH = "cabinet-runtime/workspace-v1.json.gz";
const SNAPSHOT_PREFIX = "cabinet-runtime/snapshots/";
const SNAPSHOT_HEAD_PATH = "cabinet-runtime/workspace-v1-head.json";
const SNAPSHOT_VERSION = 1;
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const SNAPSHOTS_TO_KEEP = 25;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SKIPPED_PATH_SEGMENTS = new Set([
  ".git",
  ".cabinet-backups",
  "node_modules",
]);

const SKIPPED_FILE_PATTERNS = [
  /(^|\/)\.cabinet-state\/logs(\/|$)/,
  /(^|\/)\.cabinet-state\/search\.db(?:-|$)/,
  /(^|\/)\.cabinet-state\/runtime-ports\.json$/,
  /(^|\/)\.DS_Store$/,
];

interface WorkspaceSnapshotFile {
  path: string;
  content: string;
}

interface WorkspaceSnapshot {
  version: number;
  savedAt: string;
  files: WorkspaceSnapshotFile[];
}

interface WorkspaceCache {
  snapshotPath: string | null;
  headEtag: string | null;
  initialized: boolean;
}

let cache: WorkspaceCache = {
  snapshotPath: null,
  headEtag: null,
  initialized: false,
};

let queue: Promise<unknown> = Promise.resolve();

interface WorkspaceBlobStore {
  get: typeof get;
  put: typeof put;
  list: typeof list;
  del: typeof del;
}

const productionBlobStore: WorkspaceBlobStore = { get, put, list, del };
let blobStore: WorkspaceBlobStore = productionBlobStore;

export class CloudWorkspaceConflictError extends Error {
  constructor() {
    super("Cabinet changed in another request. Please retry this action.");
    this.name = "CloudWorkspaceConflictError";
  }
}

export function isVercelWorkspaceRuntime(): boolean {
  return process.env.CABINET_VERCEL_RUNTIME === "1";
}

export function isCloudMutation(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function assertSafeCloudDataDir(): void {
  if (!isVercelWorkspaceRuntime()) return;
  const resolved = path.resolve(DATA_DIR);
  const tmpRoot = path.resolve("/tmp");
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative) {
    throw new Error(
      `CABINET_DATA_DIR must be a directory under /tmp in the Vercel runtime (received ${resolved}).`
    );
  }
}

function shouldSkip(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  const segments = normalized.split("/");
  if (segments.some((segment) => SKIPPED_PATH_SEGMENTS.has(segment))) {
    return true;
  }
  return SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function resolveSnapshotPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(DATA_DIR, normalized);
  const relative = path.relative(path.resolve(DATA_DIR), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid path in Cabinet cloud snapshot: ${relativePath}`);
  }
  return resolved;
}

async function collectSnapshotFiles(
  directory: string,
  prefix = ""
): Promise<WorkspaceSnapshotFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw error;
  });

  const files: WorkspaceSnapshotFile[] = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (shouldSkip(relativePath)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSnapshotFiles(absolutePath, relativePath)));
      continue;
    }
    if (!entry.isFile()) continue;
    const content = await fs.readFile(absolutePath);
    files.push({ path: relativePath, content: content.toString("base64") });
  }
  return files;
}

async function packWorkspace(): Promise<Buffer> {
  const snapshot: WorkspaceSnapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    files: await collectSnapshotFiles(DATA_DIR),
  };
  const encoded = Buffer.from(JSON.stringify(snapshot));
  const compressed = await gzipAsync(encoded, { level: 6 });
  if (compressed.length > MAX_SNAPSHOT_BYTES) {
    throw new Error(
      "Cabinet cloud snapshot exceeds 64 MB. Remove large generated files or attachments and retry."
    );
  }
  return compressed;
}

async function unpackWorkspace(buffer: Buffer): Promise<void> {
  const decoded = await gunzipAsync(buffer);
  const snapshot = JSON.parse(decoded.toString("utf8")) as WorkspaceSnapshot;
  if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.files)) {
    throw new Error("Unsupported Cabinet cloud snapshot format.");
  }

  await fs.rm(DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (const file of snapshot.files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
      continue;
    }
    const destination = resolveSnapshotPath(file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, Buffer.from(file.content, "base64"));
  }
}

async function migrateHostedPersonas(directory: string): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await migrateHostedPersonas(absolute);
      continue;
    }
    if (!entry.isFile() || entry.name !== "persona.md") continue;
    const normalized = absolute.split(path.sep).join("/");
    if (!normalized.includes("/.agents/") || normalized.includes("/.agents/.config/")) {
      continue;
    }
    try {
      const raw = await fs.readFile(absolute, "utf8");
      const parsed = matter(raw);
      const currentProvider =
        typeof parsed.data.provider === "string" ? parsed.data.provider : "";
      const provider = isDirectApiProviderId(currentProvider)
        ? currentProvider
        : "openai-api";
      const adapterType = DIRECT_API_CONFIGS[provider].adapterType;
      if (
        parsed.data.provider === provider &&
        parsed.data.adapterType === adapterType
      ) {
        continue;
      }
      await fs.writeFile(
        absolute,
        matter.stringify(parsed.content, {
          ...parsed.data,
          provider,
          adapterType,
        }),
        "utf8"
      );
    } catch {
      // A malformed persona should not prevent the rest of the Cabinet loading.
    }
  }
}

async function migrateHostedRuntime(): Promise<void> {
  await migrateHostedPersonas(DATA_DIR);
  const settingsPath = path.join(DATA_DIR, ".agents", ".config", "providers.json");
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath, "utf8")) as Record<string, unknown>;
    if (isDirectApiProviderId(String(raw.defaultProvider || ""))) return;
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          ...raw,
          defaultProvider: "openai-api",
          defaultModel: DIRECT_API_CONFIGS["openai-api"].defaultModel,
          disabledProviderIds: Array.isArray(raw.disabledProviderIds)
            ? raw.disabledProviderIds.filter(
                (value): value is string =>
                  typeof value === "string" && isDirectApiProviderId(value)
              )
            : [],
        },
        null,
        2
      ),
      "utf8"
    );
  } catch {
    // Missing settings are normalized by provider-settings at read time.
  }
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function listSnapshots() {
  const result = await blobStore.list({ prefix: SNAPSHOT_PREFIX, limit: 1000 });
  return result.blobs.sort((left, right) => {
    const time = right.uploadedAt.getTime() - left.uploadedAt.getTime();
    return time || right.pathname.localeCompare(left.pathname);
  });
}

interface WorkspaceHead {
  version: 1;
  snapshotPath: string;
}

async function readWorkspaceHead(): Promise<{
  snapshotPath: string | null;
  etag: string | null;
}> {
  const result = await blobStore
    .get(SNAPSHOT_HEAD_PATH, { access: "private", useCache: false })
    .catch(() => null);
  if (!result?.stream) return { snapshotPath: null, etag: null };
  try {
    const parsed = JSON.parse(
      (await streamToBuffer(result.stream)).toString("utf8"),
    ) as Partial<WorkspaceHead>;
    if (
      parsed.version !== 1 ||
      typeof parsed.snapshotPath !== "string" ||
      !parsed.snapshotPath.startsWith(SNAPSHOT_PREFIX)
    ) {
      throw new Error("Invalid Cabinet cloud workspace head.");
    }
    return {
      snapshotPath: parsed.snapshotPath,
      etag: result.blob.etag,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid Cabinet cloud workspace head.");
    }
    throw error;
  }
}

async function latestSnapshotPath(): Promise<string | null> {
  const snapshots = await listSnapshots();
  return snapshots[0]?.pathname || null;
}

async function refreshWorkspace(): Promise<void> {
  assertSafeCloudDataDir();
  await fs.mkdir(DATA_DIR, { recursive: true });

  const head = await readWorkspaceHead();
  const versionedPath = head.snapshotPath || (await latestSnapshotPath());
  const snapshotPath = versionedPath || LEGACY_SNAPSHOT_PATH;
  if (
    cache.initialized &&
    cache.snapshotPath === snapshotPath &&
    cache.headEtag === head.etag
  ) {
    return;
  }

  const result = await blobStore.get(snapshotPath, { access: "private", useCache: false });

  if (!result) {
    if (!cache.initialized) {
      await fs.rm(DATA_DIR, { recursive: true, force: true });
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
    cache = { snapshotPath: null, headEtag: head.etag, initialized: true };
    return;
  }

  if (!result.stream) {
    throw new Error("Unable to load Cabinet cloud snapshot.");
  }

  await unpackWorkspace(await streamToBuffer(result.stream));
  await migrateHostedRuntime();
  cache = {
    snapshotPath: result.blob.pathname,
    headEtag: head.etag,
    initialized: true,
  };
}

function isWorkspaceHeadConflict(error: unknown): boolean {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error &&
      /precondition|already exists|overwrite/i.test(error.message))
  );
}

async function commitWorkspaceHead(
  snapshotPath: string,
  expectedEtag: string | null,
): Promise<string> {
  const head: WorkspaceHead = { version: 1, snapshotPath };
  try {
    const savedHead = await blobStore.put(
      SNAPSHOT_HEAD_PATH,
      JSON.stringify(head),
      {
        access: "private",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: expectedEtag !== null,
        ...(expectedEtag ? { ifMatch: expectedEtag } : {}),
      },
    );
    return savedHead.etag;
  } catch (error) {
    if (isWorkspaceHeadConflict(error)) throw new CloudWorkspaceConflictError();
    throw error;
  }
}

async function saveWorkspace(): Promise<void> {
  const snapshot = await packWorkspace();
  const timestamp = String(Date.now()).padStart(13, "0");
  const pathname = `${SNAPSHOT_PREFIX}${timestamp}-${randomUUID()}.json.gz`;
  const saved = await blobStore.put(pathname, snapshot, {
    access: "private",
    contentType: "application/gzip",
    cacheControlMaxAge: 60,
    allowOverwrite: false,
  });

  try {
    const headEtag = await commitWorkspaceHead(saved.pathname, cache.headEtag);
    cache = {
      snapshotPath: saved.pathname,
      headEtag,
      initialized: true,
    };
  } catch (error) {
    await blobStore.del(saved.pathname).catch(() => {});
    cache = { snapshotPath: null, headEtag: null, initialized: false };
    throw error;
  }

  const snapshots = await listSnapshots();
  const stale = snapshots.slice(SNAPSHOTS_TO_KEEP).map((blob) => blob.pathname);
  if (stale.length) {
    await blobStore.del(stale).catch(() => {});
  }
  await blobStore.del(LEGACY_SNAPSHOT_PATH).catch(() => {});
}

async function runWorkspaceOperation<T>(
  method: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!isVercelWorkspaceRuntime()) return operation();
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error(
      "Cabinet cloud storage is not connected. Create and attach a private Vercel Blob store."
    );
  }

  if (!isCloudMutation(method)) {
    await refreshWorkspace();
    return operation();
  }

  // A single function instance serializes requests through `queue` below.
  // Across instances, the snapshot ETag provides optimistic concurrency: a
  // stale writer gets a 409 instead of silently overwriting newer work.
  cache = { snapshotPath: null, headEtag: null, initialized: false };
  await refreshWorkspace();
  const result = await operation();
  await saveWorkspace();
  return result;
}

export function withVercelWorkspace<T>(
  method: string,
  operation: () => Promise<T>
): Promise<T> {
  const run = queue.then(
    () => runWorkspaceOperation(method, operation),
    () => runWorkspaceOperation(method, operation)
  );
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function resetVercelWorkspaceForTests(): Promise<void> {
  cache = { snapshotPath: null, headEtag: null, initialized: false };
  queue = Promise.resolve();
  blobStore = productionBlobStore;
}

export function setVercelWorkspaceBlobStoreForTests(
  store: WorkspaceBlobStore,
): void {
  blobStore = store;
  cache = { snapshotPath: null, headEtag: null, initialized: false };
  queue = Promise.resolve();
}

export async function commitVercelWorkspaceHeadForTests(
  snapshotPath: string,
  expectedEtag: string | null,
): Promise<string> {
  return commitWorkspaceHead(snapshotPath, expectedEtag);
}
