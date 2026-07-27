import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PROJECT_ROOT } from "./runtime-config";
import { getManagedDataDir } from "./runtime-config";

/**
 * `.cabinet.env` is a plain `KEY=value`-per-line file at the cabinet root,
 * editable both from the Settings → Integrations UI and directly on disk.
 * Values typed in the UI land here with `chmod 0600`; values pre-existing in
 * the file appear in the UI on load. The spawn helpers in
 * `src/lib/agents/adapters/utils.ts` and `server/pty/manager.ts` merge these
 * values into every CLI subprocess's env so skills like `imagegen` can read
 * `os.environ["OPENAI_API_KEY"]` without per-spawn plumbing.
 *
 * Trade-offs:
 *   - Not encrypted at rest. "Relatively secure" here means: gitignored
 *     (an explicit `.cabinet.env` rule lives in .gitignore — note that the
 *     `.env*` glob does NOT match `.cabinet.env`, since the glob anchors at
 *     the basename's start), file perms 0600, masked in the UI, and never
 *     serialized in plaintext over the local API after first save.
 *   - Single file per project root (matches `.cabinet-install.json`), not
 *     per-cabinet — simpler and matches every existing top-level convention.
 */

const CABINET_ENV_FILENAME = ".cabinet.env";
const CLOUD_SECRET_PATH = path.join(
  ".cabinet-state",
  "secrets",
  "api-keys.enc"
);
const CLOUD_SECRET_AAD = Buffer.from("cabinet-cloud-api-keys-v1");

function isCloudRuntime(): boolean {
  return process.env.CABINET_VERCEL_RUNTIME === "1";
}

export function cabinetEnvPath(): string {
  if (isCloudRuntime()) {
    return path.join(getManagedDataDir(), CLOUD_SECRET_PATH);
  }
  return path.join(PROJECT_ROOT, CABINET_ENV_FILENAME);
}

interface ParsedFile {
  values: Record<string, string>;
  /** Mtime in ms; null when the file doesn't exist. */
  mtime: number | null;
}

let cache: ParsedFile | null = null;

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!isValidKey(key)) continue;
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes (single or double). Don't unescape —
    // dotenv's escape rules are a swamp; cabinet only ever writes plain values.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function cloudEncryptionKey(): Buffer {
  const secret = process.env.CABINET_SECRETS_KEY?.trim();
  if (!secret) {
    throw new Error(
      "CABINET_SECRETS_KEY is required to store API keys in the hosted edition."
    );
  }
  return crypto.scryptSync(secret, "cabinet-cloud-api-keys", 32);
}

function encryptCloudText(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cloudEncryptionKey(), iv);
  cipher.setAAD(CLOUD_SECRET_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

function decryptCloudText(text: string): string {
  const envelope = JSON.parse(text) as {
    version?: number;
    iv?: string;
    tag?: string;
    ciphertext?: string;
  };
  if (
    envelope.version !== 1 ||
    !envelope.iv ||
    !envelope.tag ||
    !envelope.ciphertext
  ) {
    throw new Error("Unsupported hosted API-key store format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    cloudEncryptionKey(),
    Buffer.from(envelope.iv, "base64")
  );
  decipher.setAAD(CLOUD_SECRET_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function statMtime(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Read the file (mtime-cached). Cheap to call on every spawn — when the
 * file hasn't changed since the last read we return the cached parse.
 */
export function readCabinetEnvFile(): ParsedFile {
  const file = cabinetEnvPath();
  const mtime = statMtime(file);
  if (cache && cache.mtime === mtime) return cache;
  if (mtime === null) {
    cache = { values: {}, mtime: null };
    return cache;
  }
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const plaintext = isCloudRuntime() ? decryptCloudText(raw) : raw;
    cache = { values: parseEnvText(plaintext), mtime };
  } catch {
    cache = { values: {}, mtime };
  }
  return cache;
}

function invalidateCache(): void {
  cache = null;
}

/**
 * Load the file and merge values into `process.env`. Idempotent. File values
 * never overwrite something already present in `process.env` — shell-supplied
 * env wins, so users can debug-override without editing the file.
 */
export function loadCabinetEnv(): void {
  const { values } = readCabinetEnvFile();
  if (isCloudRuntime()) return;
  for (const [key, value] of Object.entries(values)) {
    if (typeof process.env[key] === "string" && process.env[key] !== "") continue;
    process.env[key] = value;
  }
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

function serialize(values: Record<string, string>): string {
  const lines: string[] = [];
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    // Quote if value has whitespace, `=`, or `#`. Otherwise keep bare.
    const needsQuote = /[\s="'#]/.test(value);
    const escaped = needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value;
    lines.push(`${key}=${escaped}`);
  }
  return lines.join("\n") + "\n";
}

function ensureGitignoreCovers(): void {
  // .gitignore must explicitly cover `.cabinet.env` (the `.env*` glob does
  // NOT match it; globs anchor at the basename's start). Warn loudly if a
  // future edit removes the explicit rule — secrets in the repo would be
  // much worse than a noisy log line. Best-effort; never throws.
  try {
    const gi = path.join(PROJECT_ROOT, ".gitignore");
    const text = fs.readFileSync(gi, "utf-8");
    // Match any of: an explicit `.cabinet.env` line, or `.cabinet.env*` glob,
    // or a leading `**/` form. NOT `.env*` — that pattern doesn't match
    // `.cabinet.env` (the glob anchors at the start of the basename).
    if (!/(^|\n)\s*(\.cabinet\.env\b|\*\*\/\.cabinet\.env\b)/.test(text)) {
      console.warn(
        "[cabinet-env] WARNING: .gitignore doesn't appear to cover .cabinet.env. " +
          "Add `.cabinet.env` (or `.env*`) to .gitignore to keep keys out of git.",
      );
    }
  } catch {
    /* .gitignore missing or unreadable — let the user discover */
  }
}

function atomicWrite(file: string, contents: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.cabinet.env.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, contents, { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best-effort on Windows / weird FS */
  }
}

function persist(values: Record<string, string>): void {
  const file = cabinetEnvPath();
  if (isCloudRuntime() && Object.keys(values).length === 0) {
    fs.rmSync(file, { force: true });
    invalidateCache();
    return;
  }
  if (!isCloudRuntime()) ensureGitignoreCovers();
  const serialized = serialize(values);
  atomicWrite(file, isCloudRuntime() ? encryptCloudText(serialized) : serialized);
  invalidateCache();
}

export function upsertCabinetEnv(key: string, value: string): void {
  if (!isValidKey(key)) {
    throw new Error(
      `Invalid env var name: "${key}". Use uppercase letters, digits, and underscores; must start with a letter.`,
    );
  }
  if (typeof value !== "string") {
    throw new Error("Value must be a string.");
  }
  const { values } = readCabinetEnvFile();
  const next = { ...values, [key]: value };
  persist(next);
  // Live update for the current process (Cabinet's own `process.env.X`
  // reads pick this up immediately — no restart needed).
  if (!isCloudRuntime()) process.env[key] = value;
}

export function removeCabinetEnv(key: string): void {
  if (!isValidKey(key)) return;
  const { values } = readCabinetEnvFile();
  if (!(key in values)) return;
  const next = { ...values };
  delete next[key];
  persist(next);
  if (!isCloudRuntime() && key in process.env) delete process.env[key];
}

export interface CabinetEnvSnapshotEntry {
  key: string;
  hasValue: boolean;
  /** Up to last 4 chars of the value. Empty when the value is too short to be safe to leak. */
  lastFour: string;
}

export function getCabinetEnvSnapshot(): CabinetEnvSnapshotEntry[] {
  const { values } = readCabinetEnvFile();
  const entries = Object.entries(values).map(([key, value]) => ({
    key,
    hasValue: value.length > 0,
    // Showing the last 4 of an 8+ char secret is the same convention every
    // dev tool uses (Stripe, GitHub, etc.). Skip when shorter — small
    // secrets shouldn't leak even partial bytes.
    lastFour: value.length >= 8 ? value.slice(-4) : "",
  }));
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}
