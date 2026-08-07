"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

// Hosted-edition (CABINET_CLOUD=1) affordance: until the tenant's Claude
// credentials are provisioned, agents can't run — so prompt the user to connect
// Claude. The action opens the panel's /connect flow, which walks them through
// `claude setup-token` and writes the credential into the container via the
// host agent. Mirrors DaemonHealthBanner's placement/styling (a rounded card on
// the desk gutter, aligned to the content sheet); accent-toned instead of
// destructive because this is a setup nudge, not an error.
//
// Renders nothing outside cloud mode or once Claude is connected, so it's inert
// for every local/desktop install.
//
// i18n: cloud is an English-first beta; copy is inline for now (extract to the
// locale bundles when the hosted UI is localized).

interface CloudStatus {
  cloud: boolean;
  aiConnected?: boolean;
  tier?: "free" | "pro";
}

export function CloudConnectClaudeBanner() {
  const [status, setStatus] = useState<CloudStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/cloud/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CloudStatus;
        if (!cancelled) setStatus(data);
      } catch {
        /* not cloud / offline — stay hidden */
      }
    };
    void check();
    // Re-check when the user returns from the panel's connect tab, so the banner
    // clears itself the moment the credential lands (no manual reload needed).
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Free tier can't run agents at all, so "connect Claude to power your agents" is both pointless and
  // contradicts the "AI is paused — upgrade" banner. Hide it; the upgrade nudge is the only CTA there.
  if (!status || !status.cloud || status.aiConnected || status.tier === "free") return null;

  return (
    <div
      role="status"
      className="mx-2.5 mt-2 mb-1.5 flex flex-col items-stretch gap-3 rounded-[var(--radius-card,var(--radius-xl))] border border-border bg-card px-4 py-3 text-[12px] text-foreground shadow-[var(--shadow-inset,none)] sm:flex-row sm:items-center"
    >
      <div className="flex-1 min-w-0">
        <span className="font-medium">Add an AI provider key to power your agents</span>
        <span className="ms-2 text-muted-foreground">
          Choose OpenAI, Anthropic, Gemini, or xAI. Cabinet sends requests directly to your provider.
        </span>
      </div>
      <button
        type="button"
        onClick={() =>
          useAppStore.getState().setSection({
            type: "integrations",
            slug: "api-keys",
          })
        }
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control,var(--radius-lg))] bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 active:translate-y-px"
      >
        Add API key
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
