"use client";

import {
  Component,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import type {
  CabinetToolBlock,
  CabinetToolCommandInput,
  CabinetToolField,
  CabinetToolManifest,
  CabinetToolRecord,
  CabinetToolState,
  CabinetToolValue,
} from "@/types/tools";

type ToolCommandInput = CabinetToolCommandInput;

class ToolSurfaceBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
          <h2 className="text-base font-semibold text-foreground">
            {this.props.name} could not render
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The rest of Cabinet is still available. Disable or roll back this tool from
            its controls, then reload the workspace.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}

function fieldValueFromForm(field: CabinetToolField, form: FormData): CabinetToolValue {
  if (field.type === "checkbox") return form.get(field.id) === "on";
  const raw = String(form.get(field.id) ?? "").trim();
  if (!raw) return null;
  if (field.type === "number") return Number(raw);
  return raw;
}

function FieldControl({ field }: { field: CabinetToolField }) {
  const shared =
    "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";
  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id}
        name={field.id}
        required={field.required}
        placeholder={field.placeholder}
        rows={3}
        className={`${shared} resize-y py-2.5`}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select id={field.id} name={field.id} required={field.required} className={shared}>
        <option value="">Choose an option</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <input
        id={field.id}
        name={field.id}
        type="checkbox"
        className="mt-2 size-6 rounded border-border accent-primary"
      />
    );
  }
  return (
    <input
      id={field.id}
      name={field.id}
      required={field.required}
      placeholder={field.placeholder}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      step={field.type === "number" ? "any" : undefined}
      className={shared}
    />
  );
}

function FormBlock({
  block,
  manifest,
  busy,
  onCommand,
}: {
  block: Extract<CabinetToolBlock, { type: "form" }>;
  manifest: CabinetToolManifest;
  busy: boolean;
  onCommand: (command: ToolCommandInput) => Promise<unknown>;
}) {
  const [saved, setSaved] = useState(false);
  const collection = manifest.collections?.find((entry) => entry.id === block.collectionId);
  if (!collection) return null;
  const fields = block.fields.flatMap((id) => {
    const field = collection.fields.find((entry) => entry.id === id);
    return field ? [field] : [];
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = Object.fromEntries(
      fields.map((field) => [field.id, fieldValueFromForm(field, data)]),
    );
    await onCommand({
      type: "add-record",
      collectionId: block.collectionId,
      values,
    });
    form.reset();
    setSaved(true);
  };

  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
      {block.description ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
      ) : null}
      <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.id}
            htmlFor={field.id}
            className={field.type === "textarea" ? "sm:col-span-2" : undefined}
          >
            <span className="text-sm font-medium text-foreground">
              {field.label}
              {field.required ? <span aria-hidden="true"> *</span> : null}
            </span>
            <FieldControl field={field} />
          </label>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {block.actionLabel || "Save"}
          </button>
          {saved && !busy ? (
            <span role="status" className="text-sm text-muted-foreground">
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function displayValue(value: CabinetToolValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function TableBlock({
  block,
  manifest,
  records,
  busy,
  onCommand,
}: {
  block: Extract<CabinetToolBlock, { type: "table" }>;
  manifest: CabinetToolManifest;
  records: CabinetToolRecord[];
  busy: boolean;
  onCommand: (command: ToolCommandInput) => Promise<unknown>;
}) {
  const collection = manifest.collections?.find((entry) => entry.id === block.collectionId);
  if (!collection) return null;
  const fields = block.fields.flatMap((id) => {
    const field = collection.fields.find((entry) => entry.id === id);
    return field ? [field] : [];
  });
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
        {block.description ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
        ) : null}
      </div>
      {records.length === 0 ? (
        <p className="border-t border-border px-5 py-6 text-sm text-muted-foreground">
          No {collection.name.toLowerCase()} yet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/45 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                {fields.map((field) => (
                  <th key={field.id} className="px-4 py-3">{field.label}</th>
                ))}
                <th className="w-14 px-2 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-border first:border-t-0">
                  {fields.map((field) => (
                    <td key={field.id} className="px-4 py-3 text-foreground">
                      {displayValue(record.values[field.id])}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      aria-label="Delete record"
                      onClick={() =>
                        void onCommand({
                          type: "delete-record",
                          collectionId: block.collectionId,
                          recordId: record.id,
                        })
                      }
                      className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BoardBlock({
  block,
  records,
  busy,
  onCommand,
}: {
  block: Extract<CabinetToolBlock, { type: "board" }>;
  records: CabinetToolRecord[];
  busy: boolean;
  onCommand: (command: ToolCommandInput) => Promise<unknown>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
        {block.lanes.map((lane, laneIndex) => {
          const laneRecords = records.filter(
            (record) => String(record.values[block.groupBy] ?? "") === lane.value,
          );
          return (
            <div key={lane.value} className="w-[82vw] max-w-72 shrink-0 snap-start rounded-xl bg-muted/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{lane.label}</h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {laneRecords.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {laneRecords.map((record) => (
                  <article key={record.id} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-medium text-foreground">
                      {displayValue(record.values[block.titleField])}
                    </p>
                    <div className="mt-3 flex justify-between gap-2">
                      <button
                        type="button"
                        disabled={busy || laneIndex === 0}
                        aria-label={`Move to ${block.lanes[laneIndex - 1]?.label || "previous lane"}`}
                        onClick={() =>
                          void onCommand({
                            type: "update-record",
                            collectionId: block.collectionId,
                            recordId: record.id,
                            values: { [block.groupBy]: block.lanes[laneIndex - 1]!.value },
                          })
                        }
                        className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-25"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || laneIndex === block.lanes.length - 1}
                        aria-label={`Move to ${block.lanes[laneIndex + 1]?.label || "next lane"}`}
                        onClick={() =>
                          void onCommand({
                            type: "update-record",
                            collectionId: block.collectionId,
                            recordId: record.id,
                            values: { [block.groupBy]: block.lanes[laneIndex + 1]!.value },
                          })
                        }
                        className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-25"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChartBlock({
  block,
  records,
}: {
  block: Extract<CabinetToolBlock, { type: "chart" }>;
  records: CabinetToolRecord[];
}) {
  const values = useMemo(() => {
    const totals = new Map<string, number>();
    for (const record of records) {
      const label = displayValue(record.values[block.categoryField]);
      const value = Number(record.values[block.valueField] ?? 0);
      totals.set(label, (totals.get(label) ?? 0) + (Number.isFinite(value) ? value : 0));
    }
    return Array.from(totals, ([label, value]) => ({ label, value }));
  }, [block.categoryField, block.valueField, records]);
  const max = Math.max(1, ...values.map((entry) => entry.value));
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
      <div className="mt-5 space-y-3" role="img" aria-label={`${block.title} chart`}>
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chart data yet.</p>
        ) : (
          values.map((entry) => (
            <div key={entry.label} className="grid grid-cols-[minmax(5rem,8rem)_1fr_3rem] items-center gap-3">
              <span className="truncate text-sm text-foreground">{entry.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(3, (entry.value / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-muted-foreground">{entry.value}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MetricBlock({
  block,
  records,
}: {
  block: Extract<CabinetToolBlock, { type: "metric" }>;
  records: CabinetToolRecord[];
}) {
  const numeric = block.valueField
    ? records.map((record) => Number(record.values[block.valueField!] ?? 0)).filter(Number.isFinite)
    : [];
  const value =
    block.calculation === "count"
      ? records.length
      : block.calculation === "sum"
        ? numeric.reduce((total, item) => total + item, 0)
        : numeric.length
          ? numeric.reduce((total, item) => total + item, 0) / numeric.length
          : 0;
  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <p className="text-sm font-medium text-muted-foreground">{block.title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </p>
    </section>
  );
}

export function ToolSurface({
  manifest,
  state,
  busy,
  onCommand,
}: {
  manifest: CabinetToolManifest;
  state: CabinetToolState;
  busy: boolean;
  onCommand: (command: ToolCommandInput) => Promise<unknown>;
}) {
  const blocks = manifest.surfaces.workspace?.blocks ?? [];
  if (blocks.length === 0) return null;
  return (
    <ToolSurfaceBoundary name={manifest.name}>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {blocks.map((block) => {
          const records = state.collections[block.collectionId] ?? [];
          const wide = block.type !== "metric" && block.type !== "form";
          return (
            <div key={block.id} className={wide ? "lg:col-span-2" : undefined}>
              {block.type === "form" ? (
                <FormBlock block={block} manifest={manifest} busy={busy} onCommand={onCommand} />
              ) : block.type === "table" ? (
                <TableBlock
                  block={block}
                  manifest={manifest}
                  records={records}
                  busy={busy}
                  onCommand={onCommand}
                />
              ) : block.type === "board" ? (
                <BoardBlock block={block} records={records} busy={busy} onCommand={onCommand} />
              ) : block.type === "chart" ? (
                <ChartBlock block={block} records={records} />
              ) : (
                <MetricBlock block={block} records={records} />
              )}
            </div>
          );
        })}
      </div>
    </ToolSurfaceBoundary>
  );
}
