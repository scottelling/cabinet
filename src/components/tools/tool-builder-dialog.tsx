"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Columns3,
  FileInput,
  Gauge,
  LayoutTemplate,
  List,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToolIcon } from "@/components/tools/tool-icon";
import {
  CABINET_TOOL_BUILDER_PERMISSION_COPY,
  CABINET_TOOL_BUILDER_PERMISSIONS,
  createCabinetToolManifestFromDraft,
  createInitialCabinetToolBuilderDraft,
  type CabinetToolBuilderDraft,
  type CabinetToolBuilderField,
  type CabinetToolBuilderFieldType,
} from "@/lib/tools/tool-builder";
import { cn } from "@/lib/utils";
import type {
  CabinetToolEventType,
  CabinetToolIcon,
  CabinetToolManifest,
  CabinetToolPermission,
} from "@/types/tools";

const STEPS = ["Basics", "Data", "Views", "Workflow", "Review"] as const;

const ICONS: Array<{ value: CabinetToolIcon; label: string }> = [
  { value: "workflow", label: "Workflow" },
  { value: "list-checks", label: "Tracker" },
  { value: "chart", label: "Analytics" },
  { value: "search", label: "Research" },
  { value: "briefcase", label: "Business" },
  { value: "book-open", label: "Knowledge" },
  { value: "sparkles", label: "Creative" },
];

const FIELD_TYPES: Array<{
  value: CabinetToolBuilderFieldType;
  label: string;
}> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Choices" },
  { value: "checkbox", label: "Yes / no" },
  { value: "date", label: "Date" },
];

const VIEW_OPTIONS = [
  {
    key: "form" as const,
    title: "Entry form",
    description: "Add new records through a simple form.",
    icon: FileInput,
  },
  {
    key: "table" as const,
    title: "Table",
    description: "Scan and edit every record in a list.",
    icon: List,
  },
  {
    key: "board" as const,
    title: "Board",
    description: "Move work between columns such as Idea, Review, and Done.",
    icon: Columns3,
  },
  {
    key: "chart" as const,
    title: "Chart",
    description: "Compare a number across categories.",
    icon: BarChart3,
  },
  {
    key: "metrics" as const,
    title: "Summary metrics",
    description: "Show totals and numeric summaries at a glance.",
    icon: Gauge,
  },
];

const EVENTS: Array<{ value: CabinetToolEventType; label: string }> = [
  { value: "task.completed", label: "A task is completed" },
  { value: "conversation.completed", label: "A conversation is completed" },
  { value: "knowledge.changed", label: "Room knowledge changes" },
  { value: "schedule.fired", label: "A schedule runs" },
  { value: "integration.received", label: "An integration receives something" },
];

const inputClass =
  "h-11 rounded-xl border-border/80 bg-background px-3 text-base md:text-sm";
const textareaClass =
  "min-h-28 w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-base leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function nextFieldKey() {
  return `field-${crypto.randomUUID()}`;
}

function CheckboxCard({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
  icon?: typeof LayoutTemplate;
}) {
  return (
    <label
      className={cn(
        "flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
        checked
          ? "border-primary/45 bg-primary/7"
          : "border-border/80 bg-background hover:bg-muted/35",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-primary"
      />
      {Icon ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function BasicsStep({
  draft,
  setDraft,
}: {
  draft: CabinetToolBuilderDraft;
  setDraft: React.Dispatch<React.SetStateAction<CabinetToolBuilderDraft>>;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="What should this tool help you do?"
        description="Give it a clear job. Cabinet will turn your choices into a working room workspace without generated application code."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Tool name</span>
            <Input
              autoFocus
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Launch Planner"
              className={inputClass}
              maxLength={60}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">What it helps you accomplish</span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Plan a launch, move work through review, and see what needs attention."
              className={textareaClass}
              maxLength={240}
            />
          </label>
        </div>
        <div className="space-y-3">
          <span className="text-sm font-medium">Choose an icon</span>
          <div className="grid grid-cols-2 gap-2">
            {ICONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, icon: option.value }))
                }
                aria-pressed={draft.icon === option.value}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  draft.icon === option.value
                    ? "border-primary/45 bg-primary/8 text-primary"
                    : "border-border/80 hover:bg-muted/40",
                )}
              >
                <ToolIcon icon={option.value} className="size-5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataStep({
  draft,
  setDraft,
}: {
  draft: CabinetToolBuilderDraft;
  setDraft: React.Dispatch<React.SetStateAction<CabinetToolBuilderDraft>>;
}) {
  const updateField = (
    key: string,
    update: Partial<CabinetToolBuilderField>,
  ) => {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.key === key ? { ...field, ...update } : field,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="What information should it track?"
        description="Start with one useful list. You can add text, choices, numbers, dates, and yes-or-no fields."
      />
      <label className="block max-w-md space-y-2">
        <span className="text-sm font-medium">Name this information</span>
        <Input
          value={draft.collectionName}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              collectionName: event.target.value,
            }))
          }
          placeholder="Launch items"
          className={inputClass}
          maxLength={60}
        />
      </label>
      <div className="space-y-3">
        {draft.fields.map((field, index) => (
          <div
            key={field.key}
            className="rounded-2xl border border-border/80 bg-background p-4"
          >
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
              <label className="space-y-2">
                <span className="text-sm font-medium">Field {index + 1}</span>
                <Input
                  value={field.label}
                  onChange={(event) =>
                    updateField(field.key, { label: event.target.value })
                  }
                  placeholder="Title"
                  className={inputClass}
                  maxLength={60}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Type</span>
                <select
                  value={field.type}
                  onChange={(event) => {
                    const type = event.target.value as CabinetToolBuilderFieldType;
                    updateField(field.key, {
                      type,
                      options:
                        type === "select" && field.options.length === 0
                          ? ["Option one", "Option two"]
                          : field.options,
                    });
                  }}
                  className={selectClass}
                >
                  {FIELD_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${field.label || `field ${index + 1}`}`}
                disabled={draft.fields.length === 1}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    fields: current.fields.filter((item) => item.key !== field.key),
                  }))
                }
              >
                <Trash2 className="size-5" />
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    updateField(field.key, { required: event.target.checked })
                  }
                  className="size-5 accent-primary"
                />
                Required
              </label>
              {field.type === "select" ? (
                <label className="min-w-0 flex-1 space-y-2">
                  <span className="text-sm font-medium">
                    Choices <span className="font-normal text-muted-foreground">(comma separated)</span>
                  </span>
                  <Input
                    value={field.options.join(", ")}
                    onChange={(event) =>
                      updateField(field.key, {
                        options: event.target.value.split(","),
                      })
                    }
                    placeholder="Idea, In progress, Done"
                    className={inputClass}
                  />
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={() =>
          setDraft((current) => ({
            ...current,
            fields: [
              ...current.fields,
              {
                key: nextFieldKey(),
                label: "",
                type: "text",
                required: false,
                options: [],
              },
            ],
          }))
        }
      >
        <Plus className="size-4" />
        Add a field
      </Button>
    </div>
  );
}

function ViewsStep({
  draft,
  setDraft,
}: {
  draft: CabinetToolBuilderDraft;
  setDraft: React.Dispatch<React.SetStateAction<CabinetToolBuilderDraft>>;
}) {
  const selectFields = draft.fields.filter((field) => field.type === "select");
  const numberFields = draft.fields.filter((field) => field.type === "number");

  return (
    <div className="space-y-6">
      <SectionHeading
        title="How should the workspace look?"
        description="Choose the views that make this work easiest. Cabinet owns the interface so every view stays mobile-safe and upgradeable."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {VIEW_OPTIONS.map((view) => {
          const disabled =
            (view.key === "board" && selectFields.length === 0) ||
            (view.key === "chart" && numberFields.length === 0);
          const missing =
            view.key === "board" && selectFields.length === 0
              ? " Add a Choices field first."
              : view.key === "chart" && numberFields.length === 0
                ? " Add a Number field first."
                : "";
          return (
            <CheckboxCard
              key={view.key}
              checked={draft.views[view.key]}
              disabled={disabled && !draft.views[view.key]}
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  views: { ...current.views, [view.key]: checked },
                }))
              }
              title={view.title}
              description={`${view.description}${missing}`}
              icon={view.icon}
            />
          );
        })}
      </div>
      {draft.views.board && selectFields.length > 0 ? (
        <label className="block max-w-md space-y-2 rounded-2xl bg-muted/35 p-4">
          <span className="text-sm font-medium">Board columns come from</span>
          <select
            value={draft.boardFieldKey}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                boardFieldKey: event.target.value,
              }))
            }
            className={selectClass}
          >
            <option value="">Choose a field</option>
            {selectFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label || "Untitled field"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {draft.views.chart && numberFields.length > 0 ? (
        <div className="grid max-w-2xl gap-4 rounded-2xl bg-muted/35 p-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Chart categories</span>
            <select
              value={draft.chartCategoryFieldKey}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  chartCategoryFieldKey: event.target.value,
                }))
              }
              className={selectClass}
            >
              <option value="">Choose a field</option>
              {draft.fields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label || "Untitled field"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Number to measure</span>
            <select
              value={draft.chartValueFieldKey}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  chartValueFieldKey: event.target.value,
                }))
              }
              className={selectClass}
            >
              <option value="">Choose a number field</option>
              {numberFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label || "Untitled field"}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function WorkflowStep({
  draft,
  setDraft,
}: {
  draft: CabinetToolBuilderDraft;
  setDraft: React.Dispatch<React.SetStateAction<CabinetToolBuilderDraft>>;
}) {
  const togglePermission = (
    permission: CabinetToolPermission,
    checked: boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      permissions: checked
        ? Array.from(new Set([...current.permissions, permission]))
        : current.permissions.filter((item) => item !== permission),
    }));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SectionHeading
          title="Give the agent a useful starting action"
          description="This appears at the top of the workspace. You can still write any custom request in the shared Cabinet composer."
        />
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Button label</span>
            <Input
              value={draft.starterLabel}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  starterLabel: event.target.value,
                }))
              }
              placeholder="Plan the next steps"
              className={inputClass}
              maxLength={60}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">What the agent should do</span>
            <textarea
              value={draft.starterPrompt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  starterPrompt: event.target.value,
                }))
              }
              className={cn(textareaClass, "min-h-24")}
              placeholder="Review this tool and recommend the next three actions."
            />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Optional automation"
          description="Queue an agent follow-up when something changes. Cabinet leaves it visible for you to start, so it cannot silently spend provider credits."
        />
        <CheckboxCard
          checked={draft.automationEnabled}
          onChange={(checked) =>
            setDraft((current) => ({
              ...current,
              automationEnabled: checked,
            }))
          }
          title="Add an agent follow-up"
          description="Place a suggested prompt in the tool's automation inbox after an event."
          icon={Sparkles}
        />
        {draft.automationEnabled ? (
          <div className="grid gap-4 rounded-2xl bg-muted/35 p-4 md:grid-cols-[260px_minmax(0,1fr)]">
            <label className="space-y-2">
              <span className="text-sm font-medium">When</span>
              <select
                value={draft.automationEvent}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    automationEvent: event.target.value as CabinetToolEventType,
                  }))
                }
                className={selectClass}
              >
                {EVENTS.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Queue this request</span>
              <textarea
                value={draft.automationPrompt}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    automationPrompt: event.target.value,
                  }))
                }
                className={cn(textareaClass, "min-h-24")}
                placeholder="Review what changed and recommend the next action."
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="What may this tool use?"
          description="These permissions are shown before installation and remain part of the tool's portable definition."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {CABINET_TOOL_BUILDER_PERMISSIONS.map((permission) => {
            const copy = CABINET_TOOL_BUILDER_PERMISSION_COPY[permission];
            return (
              <CheckboxCard
                key={permission}
                checked={draft.permissions.includes(permission)}
                onChange={(checked) =>
                  togglePermission(permission, checked)
                }
                title={copy.label}
                description={copy.description}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  manifest,
  onEdit,
}: {
  manifest: CabinetToolManifest | null;
  onEdit: (step: number) => void;
}) {
  if (!manifest) return null;
  const fields = manifest.collections?.[0]?.fields ?? [];
  const blocks = manifest.surfaces.workspace?.blocks ?? [];

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Review your working tool"
        description="Cabinet will install this in the current room. It remains removable, versioned, mobile-safe, and available to approved agents."
      />
      <div className="rounded-3xl border border-primary/25 bg-primary/6 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
            <ToolIcon icon={manifest.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">
                {manifest.name}
              </h3>
              <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                Version {manifest.version}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {manifest.description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => onEdit(0)}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Information</h4>
            <Button type="button" variant="ghost" className="h-11" onClick={() => onEdit(1)}>
              Edit
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {manifest.collections?.[0]?.name}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {fields.map((field) => (
              <span
                key={field.id}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
              >
                {field.label} · {FIELD_TYPES.find((item) => item.value === field.type)?.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Workspace views</h4>
            <Button type="button" variant="ghost" className="h-11" onClick={() => onEdit(2)}>
              Edit
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {blocks.map((block) => (
              <span
                key={block.id}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium capitalize"
              >
                {block.type === "metric" ? block.title : block.type}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Agent access and workflow</h4>
            <Button type="button" variant="ghost" className="h-11" onClick={() => onEdit(3)}>
              Edit
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {manifest.permissions.length ? (
                  manifest.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
                    >
                      {CABINET_TOOL_BUILDER_PERMISSION_COPY[permission].label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No additional permissions</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Automation
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {manifest.automations?.length
                  ? `${EVENTS.find((event) => event.value === manifest.automations?.[0]?.event)?.label}. The agent request waits in the visible inbox.`
                  : "No automatic follow-up. You stay fully in control."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ToolBuilderDialog({
  open,
  onOpenChange,
  existingToolIds,
  onInstall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingToolIds: string[];
  onInstall: (manifest: CabinetToolManifest) => Promise<void>;
}) {
  const [draft, setDraft] = useState(createInitialCabinetToolBuilderDraft);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      return {
        manifest: createCabinetToolManifestFromDraft(draft, existingToolIds),
        error: null,
      };
    } catch (cause) {
      return {
        manifest: null,
        error: cause instanceof Error ? cause.message : "This tool is incomplete.",
      };
    }
  }, [draft, existingToolIds]);

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!draft.name.trim()) return "Give your tool a name.";
      if (!draft.description.trim()) {
        return "Describe what this tool helps you accomplish.";
      }
    }
    if (index === 1) {
      if (!draft.collectionName.trim()) {
        return "Name the information this tool will track.";
      }
      if (!draft.fields.length) return "Add at least one field.";
      if (draft.fields.some((field) => !field.label.trim())) {
        return "Every field needs a label.";
      }
      const emptySelect = draft.fields.find(
        (field) =>
          field.type === "select" &&
          field.options.map((option) => option.trim()).filter(Boolean).length === 0,
      );
      if (emptySelect) return `${emptySelect.label} needs at least one choice.`;
    }
    if (index === 2) {
      if (!Object.values(draft.views).some(Boolean)) {
        return "Choose at least one workspace view.";
      }
      const boardField = draft.fields.find(
        (field) => field.key === draft.boardFieldKey,
      );
      if (draft.views.board && boardField?.type !== "select") {
        return "Choose which field supplies the board columns.";
      }
      const chartCategory = draft.fields.find(
        (field) => field.key === draft.chartCategoryFieldKey,
      );
      const chartValue = draft.fields.find(
        (field) => field.key === draft.chartValueFieldKey,
      );
      if (draft.views.chart && (!chartCategory || chartValue?.type !== "number")) {
        return "Choose the chart category and number fields.";
      }
    }
    if (index === 3 && draft.automationEnabled && !draft.automationPrompt.trim()) {
      return "Describe what the automation should ask an agent to do.";
    }
    return null;
  };

  const goNext = () => {
    const issue = validateStep(step);
    if (issue) {
      setError(issue);
      return;
    }
    if (step === 3 && preview.error) {
      setError(preview.error);
      return;
    }
    const next = Math.min(STEPS.length - 1, step + 1);
    setStep(next);
    setFurthestStep((current) => Math.max(current, next));
    setError(null);
  };

  const install = async () => {
    if (!preview.manifest) {
      setError(preview.error ?? "Finish the tool before installing it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onInstall(preview.manifest);
      setDraft(createInitialCabinetToolBuilderDraft());
      setStep(0);
      setFurthestStep(0);
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to install this tool.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(820px,calc(100dvh-2rem))] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl [&_[data-slot=dialog-close]]:size-11">
        <DialogHeader className="px-4 pt-5 pb-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <WandSparkles className="size-4" />
            Visual Tool Builder
          </div>
          <DialogTitle className="text-xl sm:text-2xl">
            Build a tool inside Cabinet
          </DialogTitle>
          <DialogDescription>
            Choose the information, views, and agent access. Preview everything before it becomes active.
          </DialogDescription>
        </DialogHeader>

        <nav
          aria-label="Tool builder progress"
          className="flex gap-1 overflow-x-auto border-y border-border/70 bg-muted/20 px-3 py-2 sm:px-5"
        >
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              disabled={index > furthestStep}
              onClick={() => {
                setStep(index);
                setError(null);
              }}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "flex h-11 min-w-max items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
                step === index
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {index < step ? <Check className="size-3.5" /> : index + 1}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
          {step === 0 ? <BasicsStep draft={draft} setDraft={setDraft} /> : null}
          {step === 1 ? <DataStep draft={draft} setDraft={setDraft} /> : null}
          {step === 2 ? <ViewsStep draft={draft} setDraft={setDraft} /> : null}
          {step === 3 ? <WorkflowStep draft={draft} setDraft={setDraft} /> : null}
          {step === 4 ? (
            <ReviewStep
              manifest={preview.manifest}
              onEdit={(index) => setStep(index)}
            />
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between rounded-none px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={step === 0 || saving}
            onClick={() => {
              setStep((current) => Math.max(0, current - 1));
              setError(null);
            }}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="hidden h-11 rounded-xl sm:inline-flex"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Save for later
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                className="h-11 rounded-xl px-4"
                onClick={goNext}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 rounded-xl px-4"
                disabled={saving || !preview.manifest}
                onClick={() => void install()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {saving ? "Installing…" : "Install tool"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
