"use client";

import { ArrowRight, Loader2, Plus } from "lucide-react";
import { ToolIcon } from "@/components/tools/tool-icon";
import { useCabinetTools } from "@/hooks/use-cabinet-tools";

export function CabinetToolsShelf({
  cabinetPath,
  onOpen,
}: {
  cabinetPath: string;
  onOpen: (toolId: string) => void;
}) {
  const { inventory, loading, changingToolId, error, install } =
    useCabinetTools(cabinetPath);
  const installedIds = new Set(
    inventory.installed.map((entry) => entry.manifest.id),
  );
  const proposalIds = new Set(
    inventory.proposals.map((entry) => entry.manifest.id),
  );
  const available = inventory.catalog.filter(
    (tool) => !installedIds.has(tool.id) && !proposalIds.has(tool.id),
  );

  if (loading && inventory.catalog.length === 0) {
    return (
      <section
        aria-label="Cabinet Tools"
        className="mb-8 flex min-h-20 items-center justify-center"
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section aria-labelledby="cabinet-tools-title" className="mb-8 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            id="cabinet-tools-title"
            className="text-[15px] font-semibold tracking-tight text-foreground"
          >
            Tools for this room
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add focused workspaces without changing the rest of Cabinet.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {inventory.installed.map(({ manifest }) => {
          const home = manifest.surfaces.home;
          if (!home) return null;
          return (
            <button
              key={manifest.id}
              type="button"
              onClick={() => onOpen(manifest.id)}
              className="group min-h-[132px] rounded-2xl bg-muted/35 p-4 text-left shadow-[0_1px_3px_rgb(0_0_0/0.06)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-muted/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                <ToolIcon icon={manifest.icon} className="size-5" />
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {home.title}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {home.description}
              </span>
            </button>
          );
        })}

        {inventory.proposals.map(({ manifest, kind, baseVersion, reason }) => (
          <button
            key={manifest.id}
            type="button"
            disabled={changingToolId === manifest.id}
            onClick={() => void install(manifest).catch(() => {})}
            className="min-h-[148px] rounded-2xl bg-primary/7 p-4 text-left shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)] transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <span className="mb-4 flex items-center justify-between gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                {changingToolId === manifest.id ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ToolIcon icon={manifest.icon} className="size-5" />
                )}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Proposed by AI
              </span>
            </span>
            <span className="block text-sm font-semibold text-foreground">
              {kind === "update" ? `Approve update to ${manifest.name}` : `Approve ${manifest.name}`}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {kind === "update" && baseVersion
                ? `Changes version ${baseVersion} to ${manifest.version}. `
                : ""}
              Requests: {manifest.permissions.join(", ") || "no additional permissions"}
            </span>
            {reason ? (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {reason}
              </span>
            ) : null}
          </button>
        ))}

        {available.map((manifest) => (
          <button
            key={manifest.id}
            type="button"
            disabled={changingToolId === manifest.id}
            onClick={() => void install(manifest.id).catch(() => {})}
            className="min-h-[132px] rounded-2xl bg-background/65 p-4 text-left shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]"
          >
            <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {changingToolId === manifest.id ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
            </span>
            <span className="block text-sm font-semibold text-foreground">
              Add {manifest.name}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {manifest.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
