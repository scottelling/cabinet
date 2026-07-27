import type { AgentProvider, ProviderModel } from "../provider-interface";
import { readCabinetEnvFile } from "@/lib/runtime/cabinet-env";

export const DIRECT_API_PROVIDER_IDS = [
  "openai-api",
  "anthropic-api",
  "google-ai-api",
  "xai-api",
] as const;

export type DirectApiProviderId = (typeof DIRECT_API_PROVIDER_IDS)[number];

export interface DirectApiProviderConfig {
  id: DirectApiProviderId;
  adapterType: string;
  name: string;
  icon: string;
  endpoint: string;
  keyEnvVars: string[];
  defaultModel: string;
  models: ProviderModel[];
  keyUrl: string;
}

const COMMON_EFFORT_LEVELS = [
  { id: "low", name: "Low", description: "Faster, lighter reasoning" },
  { id: "medium", name: "Medium", description: "Balanced reasoning" },
  { id: "high", name: "High", description: "Deeper reasoning" },
];

export const DIRECT_API_CONFIGS: Record<DirectApiProviderId, DirectApiProviderConfig> = {
  "openai-api": {
    id: "openai-api",
    adapterType: "openai_api",
    name: "OpenAI API",
    icon: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    keyEnvVars: ["OPENAI_API_KEY"],
    defaultModel: "gpt-5.6-terra",
    models: [
      { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", description: "Balanced intelligence and cost" },
      { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", description: "Frontier model for complex work" },
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", description: "Cost-sensitive, high-volume model" },
    ],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  "anthropic-api": {
    id: "anthropic-api",
    adapterType: "anthropic_api",
    name: "Anthropic API",
    icon: "anthropic",
    endpoint: "https://api.anthropic.com/v1/chat/completions",
    keyEnvVars: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-sonnet-5",
    models: [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "Agentic work with a strong speed/capability balance" },
      { id: "claude-opus-5", name: "Claude Opus 5", description: "Anthropic's most capable model" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Pinned previous-generation Sonnet" },
    ],
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  "google-ai-api": {
    id: "google-ai-api",
    adapterType: "google_ai_api",
    name: "Google Gemini API",
    icon: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnvVars: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_API_KEY"],
    defaultModel: "gemini-3.6-flash",
    models: [
      { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Fast frontier model for agentic work" },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", description: "Strong sustained agentic performance" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", description: "Fast, cost-effective execution" },
    ],
    keyUrl: "https://aistudio.google.com/apikey",
  },
  "xai-api": {
    id: "xai-api",
    adapterType: "xai_api",
    name: "xAI API",
    icon: "grok",
    endpoint: "https://api.x.ai/v1/chat/completions",
    keyEnvVars: ["XAI_API_KEY"],
    defaultModel: "grok-4.3",
    models: [
      { id: "grok-4.5", name: "Grok 4.5", description: "Flagship agentic model" },
      { id: "grok-4.3", name: "Grok 4.3", description: "Fast model with strong tool calling" },
      { id: "grok-build-0.1", name: "Grok Build 0.1", description: "Coding and agentic engineering model" },
    ],
    keyUrl: "https://console.x.ai/",
  },
};

export function isDirectApiProviderId(value: string): value is DirectApiProviderId {
  return DIRECT_API_PROVIDER_IDS.includes(value as DirectApiProviderId);
}

export function getDirectApiConfig(id: string): DirectApiProviderConfig | null {
  return isDirectApiProviderId(id) ? DIRECT_API_CONFIGS[id] : null;
}

export function readDirectApiKey(config: DirectApiProviderConfig): string | null {
  const saved = readCabinetEnvFile().values;
  for (const envVar of config.keyEnvVars) {
    const value = saved[envVar]?.trim() || process.env[envVar]?.trim();
    if (value) return value;
  }
  return null;
}

function createProvider(config: DirectApiProviderConfig): AgentProvider {
  return {
    id: config.id,
    name: config.name,
    type: "api",
    icon: config.icon,
    apiKeyEnvVar: config.keyEnvVars[0],
    installMessage: `Add ${config.keyEnvVars[0]} in Integrations → API Keys.`,
    installSteps: [
      {
        title: "Create an API key",
        detail: `Create a key with ${config.name}, then save it in Cabinet's API Keys screen.`,
        link: { label: `Open ${config.name}`, url: config.keyUrl },
      },
    ],
    models: config.models,
    effortLevels: COMMON_EFFORT_LEVELS,
    async isAvailable() {
      return Boolean(readDirectApiKey(config));
    },
    async healthCheck() {
      const ready = Boolean(readDirectApiKey(config));
      return ready
        ? { available: true, authenticated: true, version: "API key configured" }
        : {
            available: false,
            authenticated: false,
            error: `Add ${config.keyEnvVars[0]} in Integrations → API Keys.`,
          };
    },
  };
}

export const directApiProviders = DIRECT_API_PROVIDER_IDS.map(
  (id) => createProvider(DIRECT_API_CONFIGS[id])
);

