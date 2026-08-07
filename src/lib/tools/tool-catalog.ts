import type { CabinetToolManifest } from "@/types/tools";

const RESEARCH_BRIEF_TOOL: CabinetToolManifest = {
  schemaVersion: 1,
  id: "research-brief",
  version: "1.0.0",
  name: "Research Brief",
  description:
    "Turn the knowledge in this room into a focused, evidence-backed research brief.",
  icon: "search",
  permissions: ["knowledge:read", "knowledge:write", "agents:run"],
  surfaces: {
    home: {
      title: "Research Brief",
      description:
        "Research a topic, compare evidence, and save a useful briefing.",
      actionLabel: "Open workspace",
    },
    workspace: {
      title: "Research Brief",
      description:
        "Choose a starting workflow or give your AI team a custom research assignment.",
      starterPrompts: [
        {
          id: "topic-brief",
          label: "Research a topic",
          description:
            "Build a sourced overview with findings, unknowns, and next steps.",
          prompt:
            "Research this topic using the knowledge in this room. Create a concise brief with key findings, supporting evidence, disagreements or unknowns, and recommended next steps. Save it as a new page in this room.",
        },
        {
          id: "compare-options",
          label: "Compare options",
          description: "Turn scattered notes into a decision-ready comparison.",
          prompt:
            "Identify the main options discussed in this room and create a decision brief comparing their benefits, risks, costs, and evidence. End with a recommendation and explain the trade-offs. Save it as a new page in this room.",
        },
        {
          id: "find-gaps",
          label: "Find research gaps",
          description:
            "Show what the room knows and what still needs investigation.",
          prompt:
            "Audit the knowledge in this room for this subject. Summarize what is well supported, what is uncertain or contradictory, and the highest-value unanswered questions. Save the research-gap report as a new page in this room.",
        },
      ],
    },
  },
};

const CONTENT_STUDIO_TOOL: CabinetToolManifest = {
  schemaVersion: 1,
  id: "content-studio",
  version: "1.0.0",
  name: "Content Studio",
  description:
    "Plan, move, measure, and discuss content without leaving your Cabinet.",
  icon: "chart",
  permissions: ["knowledge:read", "knowledge:write", "agents:run", "tasks:manage"],
  surfaces: {
    home: {
      title: "Content Studio",
      description: "A live editorial board, calendar list, and performance view.",
      actionLabel: "Open studio",
    },
    workspace: {
      title: "Content Studio",
      description:
        "Track the work here or ask your AI team to add and update content during a conversation.",
      starterPrompts: [
        {
          id: "plan-week",
          label: "Plan this week",
          description: "Turn room knowledge into a balanced publishing plan.",
          prompt:
            "Review this room and use the Content Studio tool to add a practical content plan for this week. Explain the choices after updating the tool.",
        },
        {
          id: "find-gaps",
          label: "Find content gaps",
          description: "Compare current ideas with the audience's unanswered needs.",
          prompt:
            "Inspect the Content Studio tool and the knowledge in this room. Identify the most valuable content gaps and add the strongest ideas to the tool.",
        },
      ],
      blocks: [
        {
          id: "total-content",
          type: "metric",
          title: "Total content",
          collectionId: "content",
          calculation: "count",
        },
        {
          id: "estimated-reach",
          type: "metric",
          title: "Estimated reach",
          collectionId: "content",
          calculation: "sum",
          valueField: "reach",
        },
        {
          id: "add-content",
          type: "form",
          title: "Add content",
          description: "Capture an idea or planned piece.",
          collectionId: "content",
          fields: ["title", "status", "channel", "publish-date", "reach"],
          actionLabel: "Add to studio",
        },
        {
          id: "editorial-board",
          type: "board",
          title: "Editorial board",
          collectionId: "content",
          titleField: "title",
          groupBy: "status",
          lanes: [
            { value: "idea", label: "Ideas" },
            { value: "drafting", label: "Drafting" },
            { value: "review", label: "Review" },
            { value: "published", label: "Published" },
          ],
        },
        {
          id: "content-list",
          type: "table",
          title: "Content list",
          collectionId: "content",
          fields: ["title", "status", "channel", "publish-date", "reach"],
        },
        {
          id: "reach-by-channel",
          type: "chart",
          title: "Reach by channel",
          collectionId: "content",
          chartType: "bar",
          categoryField: "channel",
          valueField: "reach",
        },
      ],
    },
  },
  collections: [
    {
      id: "content",
      name: "Content",
      fields: [
        { id: "title", label: "Title", type: "text", required: true },
        {
          id: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            { value: "idea", label: "Idea" },
            { value: "drafting", label: "Drafting" },
            { value: "review", label: "Review" },
            { value: "published", label: "Published" },
          ],
        },
        {
          id: "channel",
          label: "Channel",
          type: "select",
          options: [
            { value: "blog", label: "Blog" },
            { value: "email", label: "Email" },
            { value: "social", label: "Social" },
            { value: "video", label: "Video" },
          ],
        },
        { id: "publish-date", label: "Publish date", type: "date" },
        { id: "reach", label: "Estimated reach", type: "number" },
      ],
    },
  ],
  automations: [
    {
      id: "review-completed-work",
      name: "Review completed work",
      event: "task.completed",
      action: {
        type: "queue-prompt",
        prompt:
          "Review the completed task and decide whether Content Studio should be updated. If so, use the installed tool to add or update the relevant record.",
      },
    },
  ],
};

export const BUILT_IN_TOOLS = new Map<string, CabinetToolManifest>([
  [RESEARCH_BRIEF_TOOL.id, RESEARCH_BRIEF_TOOL],
  [CONTENT_STUDIO_TOOL.id, CONTENT_STUDIO_TOOL],
]);
