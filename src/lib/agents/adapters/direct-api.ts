import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import {
  DIRECT_API_CONFIGS,
  DIRECT_API_PROVIDER_IDS,
  readDirectApiKey,
  type DirectApiProviderConfig,
} from "../providers/direct-api";
import type {
  AdapterEnvironmentTestResult,
  AgentExecutionAdapter,
} from "./types";

const MAX_TOOL_ROUNDS = 12;
const MAX_READ_BYTES = 240_000;
const MAX_LIST_ENTRIES = 500;

type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ApiToolCall[];
};

type ApiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  [key: string]: unknown;
};

type ApiResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ApiToolCall[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { message?: string; code?: string };
};

const cabinetTools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and folders in the current Cabinet.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Cabinet-relative directory, or ." },
          recursive: { type: "boolean", description: "List descendants recursively" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file from the current Cabinet.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Cabinet-relative file path" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace a UTF-8 text file in the current Cabinet.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Cabinet-relative file path" },
          content: { type: "string", description: "Complete file contents" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "make_directory",
      description: "Create a directory in the current Cabinet.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Cabinet-relative directory" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_path",
      description: "Delete a file or directory from the current Cabinet.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Cabinet-relative path" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search UTF-8 files in the current Cabinet for literal text.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Literal text to find" },
          path: { type: "string", description: "Cabinet-relative directory, or ." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
] as const;

function safeWorkspacePath(input: unknown, cwd: string): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("A workspace path is required.");
  }
  const root = path.resolve(DATA_DIR);
  const runRoot = path.resolve(cwd);
  const normalized = input.trim().replace(/\\/g, "/");
  const candidate = normalized === "/data"
    ? root
    : normalized.startsWith("/data/")
      ? path.resolve(root, normalized.slice("/data/".length))
      : path.isAbsolute(normalized)
        ? path.resolve(normalized)
        : path.resolve(runRoot, normalized.replace(/^\.\//, ""));
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the Cabinet workspace.");
  }
  const relativeToRun = path.relative(runRoot, candidate);
  if (relativeToRun.startsWith("..") || path.isAbsolute(relativeToRun)) {
    throw new Error("Path is outside the current Cabinet.");
  }
  return candidate;
}

function relativeWorkspacePath(absolutePath: string): string {
  return path.relative(path.resolve(DATA_DIR), absolutePath).split(path.sep).join("/") || ".";
}

async function listWorkspace(
  directory: string,
  recursive: boolean,
  output: string[] = []
): Promise<string[]> {
  if (output.length >= MAX_LIST_ENTRIES) return output;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (output.length >= MAX_LIST_ENTRIES) break;
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    output.push(`${entry.isDirectory() ? "dir" : "file"}\t${relativeWorkspacePath(absolute)}`);
    if (recursive && entry.isDirectory()) await listWorkspace(absolute, true, output);
  }
  return output;
}

async function collectTextFiles(directory: string, output: string[] = []): Promise<string[]> {
  if (output.length >= MAX_LIST_ENTRIES) return output;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (output.length >= MAX_LIST_ENTRIES) break;
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectTextFiles(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

async function executeTool(
  name: string,
  rawArguments: string,
  cwd: string
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArguments || "{}") as Record<string, unknown>;
  } catch {
    return "Error: tool arguments were not valid JSON.";
  }

  try {
    if (name === "list_files") {
      const directory = safeWorkspacePath(args.path || ".", cwd);
      const items = await listWorkspace(directory, args.recursive === true);
      return items.length ? items.join("\n") : "(empty directory)";
    }
    if (name === "read_file") {
      const filename = safeWorkspacePath(args.path, cwd);
      const stat = await fs.stat(filename);
      if (!stat.isFile()) return "Error: path is not a file.";
      if (stat.size > MAX_READ_BYTES) return `Error: file is larger than ${MAX_READ_BYTES} bytes.`;
      return await fs.readFile(filename, "utf8");
    }
    if (name === "write_file") {
      const filename = safeWorkspacePath(args.path, cwd);
      if (typeof args.content !== "string") return "Error: content must be a string.";
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, args.content, "utf8");
      return `Saved ${relativeWorkspacePath(filename)} (${Buffer.byteLength(args.content)} bytes).`;
    }
    if (name === "make_directory") {
      const directory = safeWorkspacePath(args.path, cwd);
      await fs.mkdir(directory, { recursive: true });
      return `Created ${relativeWorkspacePath(directory)}.`;
    }
    if (name === "delete_path") {
      const target = safeWorkspacePath(args.path, cwd);
      if (
        path.resolve(target) === path.resolve(DATA_DIR) ||
        path.resolve(target) === path.resolve(cwd)
      ) {
        return "Error: the Cabinet root cannot be deleted.";
      }
      await fs.rm(target, { recursive: true, force: true });
      return `Deleted ${relativeWorkspacePath(target)}.`;
    }
    if (name === "search_files") {
      const query = typeof args.query === "string" ? args.query : "";
      if (!query) return "Error: query is required.";
      const directory = safeWorkspacePath(args.path || ".", cwd);
      const files = await collectTextFiles(directory);
      const matches: string[] = [];
      for (const filename of files) {
        if (matches.length >= 100) break;
        try {
          const stat = await fs.stat(filename);
          if (stat.size > MAX_READ_BYTES) continue;
          const lines = (await fs.readFile(filename, "utf8")).split("\n");
          lines.forEach((line, index) => {
            if (matches.length < 100 && line.includes(query)) {
              matches.push(`${relativeWorkspacePath(filename)}:${index + 1}: ${line.slice(0, 300)}`);
            }
          });
        } catch {
          // Binary or transient file; skip it.
        }
      }
      return matches.length ? matches.join("\n") : "No matches.";
    }
    return `Error: unknown tool ${name}.`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function environmentResult(config: DirectApiProviderConfig): AdapterEnvironmentTestResult {
  const ready = Boolean(readDirectApiKey(config));
  return {
    adapterType: config.adapterType,
    status: ready ? "pass" : "fail",
    checks: [
      {
        code: "api_key_configured",
        level: ready ? "info" : "error",
        message: ready
          ? `${config.name} key is configured.`
          : `${config.name} key is missing.`,
        hint: ready ? null : `Add ${config.keyEnvVars[0]} in Integrations → API Keys.`,
      },
    ],
    testedAt: new Date().toISOString(),
  };
}

function createDirectApiAdapter(config: DirectApiProviderConfig): AgentExecutionAdapter {
  return {
    type: config.adapterType,
    name: config.name,
    description: `Direct ${config.name} execution with persistent Cabinet file tools.`,
    providerId: config.id,
    executionEngine: "api",
    supportsDetachedRuns: false,
    supportsSessionResume: false,
    models: config.models,
    effortLevels: [
      { id: "low", name: "Low" },
      { id: "medium", name: "Medium" },
      { id: "high", name: "High" },
    ],
    async testEnvironment() {
      return environmentResult(config);
    },
    classifyError(stderr) {
      const lower = stderr.toLowerCase();
      if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
        return { kind: "auth_expired", hint: `Check the ${config.name} key in Integrations → API Keys.` };
      }
      if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
        return { kind: "rate_limited", hint: `${config.name} is rate-limited or out of quota. Check the provider account, then retry.` };
      }
      if (lower.includes("model") && (lower.includes("not found") || lower.includes("unavailable"))) {
        return { kind: "model_unavailable", hint: `Choose a model available to this ${config.name} account.` };
      }
      if (lower.includes("timeout") || lower.includes("aborted")) {
        return { kind: "timeout", hint: "The model call timed out. Retry the task." };
      }
      return { kind: "transport", hint: `${config.name} failed to answer. Check the key, billing, and provider status, then retry.` };
    },
    async execute(ctx) {
      const apiKey = readDirectApiKey(config);
      if (!apiKey) {
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: `Add ${config.keyEnvVars[0]} in Integrations → API Keys before running this agent.`,
          provider: config.id,
          model: null,
          billingType: "metered_api",
        };
      }

      const model =
        (typeof ctx.config.model === "string" && ctx.config.model.trim()) ||
        config.defaultModel;
      await ctx.onMeta?.({
        adapterType: ctx.adapterType,
        command: config.endpoint,
        cwd: ctx.cwd,
        commandArgs: [model],
      });

      const messages: ApiMessage[] = [
        {
          role: "system",
          content:
            "You are running inside Cabinet's hosted edition. Use the provided file tools whenever the request asks you to create, update, organize, inspect, or delete Cabinet knowledge. Relative paths resolve inside the current Cabinet. Work only inside the Cabinet workspace. After tool work, explain the outcome concisely and name every file changed.",
        },
        { role: "user", content: ctx.prompt },
      ];
      let inputTokens = 0;
      let outputTokens = 0;
      let cachedInputTokens = 0;
      let finalText = "";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs || 280_000);

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages,
              tools: cabinetTools,
              tool_choice: "auto",
              stream: false,
            }),
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => null)) as ApiResponse | null;
          if (!response.ok || !data) {
            const detail = data?.error?.message || "No JSON error details returned.";
            throw new Error(`${config.name} returned HTTP ${response.status}: ${detail}`);
          }
          if (data.error?.message) throw new Error(data.error.message);

          inputTokens += data.usage?.prompt_tokens || 0;
          outputTokens += data.usage?.completion_tokens || 0;
          cachedInputTokens +=
            data.usage?.prompt_tokens_details?.cached_tokens ||
            data.usage?.cached_tokens ||
            0;

          const assistant = data.choices?.[0]?.message;
          if (!assistant) throw new Error(`${config.name} returned no assistant message.`);
          const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
          messages.push({
            role: "assistant",
            content: assistant.content || null,
            ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
          });
          if (toolCalls.length === 0) {
            finalText = (assistant.content || "").trim();
            break;
          }
          for (const toolCall of toolCalls) {
            const result = await executeTool(
              toolCall.function.name,
              toolCall.function.arguments,
              ctx.cwd
            );
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        }

        if (!finalText) {
          finalText = "The agent completed its file operations but did not return a final summary.";
        }
        await ctx.onLog("stdout", finalText);
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          usage: {
            inputTokens,
            outputTokens,
            ...(cachedInputTokens ? { cachedInputTokens } : {}),
          },
          provider: config.id,
          model,
          billingType: "metered_api",
          summary: finalText.split("\n").find((line) => line.trim())?.slice(0, 300) || null,
          output: finalText,
        };
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError";
        const message = timedOut
          ? `${config.name} request timed out.`
          : error instanceof Error
            ? error.message
            : String(error);
        await ctx.onLog("stderr", message);
        return {
          exitCode: 1,
          signal: null,
          timedOut,
          errorMessage: message,
          usage: {
            inputTokens,
            outputTokens,
            ...(cachedInputTokens ? { cachedInputTokens } : {}),
          },
          provider: config.id,
          model,
          billingType: "metered_api",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export const directApiAdapters = DIRECT_API_PROVIDER_IDS.map((id) =>
  createDirectApiAdapter(DIRECT_API_CONFIGS[id])
);
