"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  ExternalLink,
  FileSearch,
  Globe2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationBrowserEvidence } from "@/types/conversations";

const COLLAPSED_COUNT = 5;

function hostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

function actionLabel(action: ConversationBrowserEvidence["action"]): string {
  if (action === "screenshot") return "Captured screenshot";
  if (action === "links") return "Collected links";
  return "Read page";
}

function EvidenceIcon({ action }: { action: ConversationBrowserEvidence["action"] }) {
  if (action === "screenshot") return <Camera className="size-4" />;
  if (action === "links") return <Link2 className="size-4" />;
  return <FileSearch className="size-4" />;
}

export function BrowserEvidencePanel({
  evidence,
  onOpenArtifact,
}: {
  evidence: ConversationBrowserEvidence[];
  onOpenArtifact?: (path: string) => void;
}): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const ordered = useMemo(() => [...evidence].reverse(), [evidence]);
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);
  if (evidence.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe2 className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-foreground">Browser activity</h4>
            <p className="text-[12px] text-muted-foreground">
              Read-only sources used by this agent
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {evidence.length} {evidence.length === 1 ? "action" : "actions"}
        </span>
      </div>

      <div className="space-y-2">
        {visible.map((item) => (
          <div
            key={item.id}
            className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/15 p-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                <EvidenceIcon action={item.action} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-medium text-foreground">
                    {actionLabel(item.action)}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {item.engine === "kitesurf" ? "Kitesurf" : "Chromium"}
                  </span>
                  {item.fallbackUsed ? (
                    <span className="text-[10px] text-muted-foreground">automatic fallback</span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {hostname(item.url)}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              {item.artifactPath && onOpenArtifact ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 px-3 text-[12px] sm:flex-none"
                  onClick={() => onOpenArtifact(item.artifactPath!)}
                >
                  <Camera className="me-2 size-4" />
                  Open capture
                </Button>
              ) : null}
              <Button
                render={
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${hostname(item.url)} in a new tab`}
                  />
                }
                variant="outline"
                className="min-h-11 flex-1 px-3 text-[12px] sm:flex-none"
              >
                Open source
                <ExternalLink className="ms-2 size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {evidence.length > COLLAPSED_COUNT ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 min-h-11 w-full text-[12px]"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show recent activity" : `Show all ${evidence.length} browser actions`}
        </Button>
      ) : null}
    </section>
  );
}
