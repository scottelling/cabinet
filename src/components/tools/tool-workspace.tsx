"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, History, Loader2, Power, Trash2 } from "lucide-react";
import { CabinetTaskComposer } from "@/components/cabinets/cabinet-task-composer";
import { ContentSheet } from "@/components/layout/content-sheet";
import { HeaderActions } from "@/components/layout/header-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolIcon } from "@/components/tools/tool-icon";
import {
  useCabinetToolDetail,
  useCabinetTools,
} from "@/hooks/use-cabinet-tools";
import { ToolSurface } from "@/components/tools/tool-surface";
import { fetchCabinetOverviewClient } from "@/lib/cabinets/overview-client";
import { useAppStore } from "@/stores/app-store";
import type { CabinetOverview } from "@/types/cabinets";

export function ToolWorkspace({
  cabinetPath,
  toolId,
}: {
  cabinetPath: string;
  toolId: string;
}) {
  const setSection = useAppStore((state) => state.setSection);
  const { changingToolId, uninstall } = useCabinetTools(cabinetPath);
  const {
    detail,
    loading,
    changing,
    error,
    runCommand,
    setEnabled,
    rollback,
  } = useCabinetToolDetail(cabinetPath, toolId);
  const [overview, setOverview] = useState<CabinetOverview | null>(null);
  const [promptRequest, setPromptRequest] = useState<{
    key: number;
    prompt: string;
  }>({
    key: 0,
    prompt: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchCabinetOverviewClient(cabinetPath, "own", { force: true })
      .then((next) => {
        if (!cancelled) setOverview(next);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cabinetPath]);

  const installation = detail?.installation;
  const manifest = installation?.manifest;

  const remove = async () => {
    const confirmed = window.confirm(
      `Remove ${manifest?.name || "this tool"}? Cabinet will hide it from this room and keep a recoverable backup of its data.`,
    );
    if (!confirmed) return;
    try {
      await uninstall(toolId);
      setSection({ type: "cabinet", cabinetPath });
    } catch {
      // The hook already surfaces the actionable error in the workspace.
    }
  };

  if (loading && !manifest) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail || !installation || !manifest?.surfaces.workspace) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-background p-6 text-center shadow-sm">
          <h1 className="font-body-serif text-2xl text-foreground">
            Tool unavailable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "This tool is not installed in the current room."}
          </p>
          <button
            type="button"
            onClick={() => setSection({ type: "cabinet", cabinetPath })}
            className="mt-5 min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Return to room
          </button>
        </div>
      </div>
    );
  }

  const workspace = manifest.surfaces.workspace;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex min-h-12 items-center gap-2 px-3 py-2"
        style={{
          paddingInlineStart: `calc(0.75rem + var(--sidebar-toggle-offset, 0px))`,
        }}
      >
        <button
          type="button"
          onClick={() => setSection({ type: "cabinet", cabinetPath })}
          aria-label="Back to room"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <span className="flex size-9 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
          <ToolIcon icon={manifest.icon} className="size-4.5" />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {manifest.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={changingToolId === toolId}
            onClick={() => void remove()}
            title="Remove this tool from the room"
            aria-label="Remove this tool from the room"
            className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {changingToolId === toolId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </button>
          <HeaderActions />
        </div>
      </header>

      <ContentSheet>
        <ScrollArea className="min-h-0 flex-1">
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:py-8">
            <div className="mb-8 grid gap-3 sm:grid-cols-3">
              {workspace.starterPrompts.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() =>
                    setPromptRequest((current) => ({
                      key: current.key + 1,
                      prompt: starter.prompt,
                    }))
                  }
                  className="min-h-[124px] rounded-2xl bg-muted/35 p-4 text-left transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {starter.label}
                  </span>
                  {starter.description ? (
                    <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                      {starter.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      installation.enabled === false
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {installation.enabled === false ? "Disabled" : "Active"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Version {manifest.version}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {detail.events[0]
                    ? `Last activity: ${detail.events[0].type.replaceAll(".", " ")}`
                    : "No recorded activity yet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.versions.some((version) => version.version !== manifest.version) ? (
                  <label className="relative">
                    <span className="sr-only">Restore an earlier version</span>
                    <History className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      aria-label="Restore an earlier version"
                      disabled={changing}
                      value=""
                      onChange={(event) => {
                        const version = event.target.value;
                        if (version) void rollback(version);
                      }}
                      className="min-h-11 rounded-xl border border-border bg-background pl-9 pr-8 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <option value="">Restore version</option>
                      {detail.versions
                        .filter((version) => version.version !== manifest.version)
                        .map((version) => (
                          <option key={version.version} value={version.version}>
                            {version.version}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <button
                  type="button"
                  disabled={changing}
                  onClick={() => void setEnabled(installation.enabled === false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {changing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Power className="mr-2 size-4" />
                  )}
                  {installation.enabled === false ? "Enable tool" : "Disable tool"}
                </button>
              </div>
            </section>

            {error ? (
              <p className="mb-6 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {installation.enabled === false ? (
              <section className="mb-8 rounded-2xl border border-border bg-muted/35 p-5">
                <h2 className="text-base font-semibold text-foreground">This tool is paused</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Its data is preserved. Agents and automations cannot change it until you enable it.
                </p>
              </section>
            ) : (
              <>
                {detail.state.promptQueue.length ? (
                  <section className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
                    <h2 className="text-base font-semibold text-foreground">
                      Automation inbox
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Cabinet prepared these follow-up actions from activity in this room.
                    </p>
                    <div className="mt-3 grid gap-2">
                      {detail.state.promptQueue.slice(-3).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() =>
                            setPromptRequest((current) => ({
                              key: current.key + 1,
                              prompt: entry.prompt,
                            }))
                          }
                          className="min-h-11 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {entry.prompt}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                <ToolSurface
                  key={detail.state.revision}
                  manifest={manifest}
                  state={detail.state}
                  busy={changing}
                  onCommand={runCommand}
                />
              </>
            )}

            <div
              className={`[&_button]:min-h-11 [&_button]:min-w-11 ${
                installation.enabled === false ? "pointer-events-none opacity-45" : ""
              }`}
              aria-disabled={installation.enabled === false}
            >
              <CabinetTaskComposer
                key={`${toolId}:${promptRequest.key}`}
                cabinetPath={cabinetPath}
                agents={overview?.agents || []}
                displayName=""
                cabinetName={workspace.title}
                cabinetDescription={workspace.description}
                initialPrompt={promptRequest.prompt}
                onNavigate={(_agentSlug, agentCabinetPath, conversationId) =>
                  setSection({
                    type: "task",
                    taskId: conversationId,
                    cabinetPath: agentCabinetPath,
                  })
                }
              />
            </div>
          </main>
        </ScrollArea>
      </ContentSheet>
    </div>
  );
}
