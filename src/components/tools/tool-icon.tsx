import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  ListChecks,
  Search,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { CabinetToolIcon } from "@/types/tools";

const ICONS: Record<CabinetToolIcon, LucideIcon> = {
  "book-open": BookOpen,
  briefcase: BriefcaseBusiness,
  chart: BarChart3,
  "list-checks": ListChecks,
  search: Search,
  sparkles: Sparkles,
  workflow: Workflow,
};

export function ToolIcon({
  icon,
  className,
}: {
  icon: CabinetToolIcon;
  className?: string;
}) {
  const Icon = ICONS[icon] || Sparkles;
  return <Icon className={className} aria-hidden />;
}
