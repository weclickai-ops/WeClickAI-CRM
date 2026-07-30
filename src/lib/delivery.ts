import type { Project, ProjectStatus, WorkPriority, ClientStatus } from "@/lib/types";

export const SERVICES = [
  "Website Development",
  "Landing Page",
  "AI Automation",
  "Voice Agent",
  "Chatbot",
  "SEO",
  "Google Ads",
  "Meta Ads",
  "Branding",
  "Social Media",
  "UGC Ads",
];

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; cls: string; dot: string }> = {
  planning:       { label: "Planning",           cls: "bg-black/[0.05] text-muted",        dot: "#8A8F98" },
  development:    { label: "Development",        cls: "bg-blue-50 text-blue-700",          dot: "#3B82F6" },
  waiting_client: { label: "Waiting for client", cls: "bg-amber-50 text-amber-800",        dot: "#F59E0B" },
  review:         { label: "Review",             cls: "bg-violet-50 text-violet-700",      dot: "#8B5CF6" },
  revision:       { label: "Revision",           cls: "bg-yellow-50 text-yellow-800",      dot: "#EAB308" },
  delayed:        { label: "Delayed",            cls: "bg-red-50 text-red-700",            dot: "#EF4444" },
  completed:      { label: "Completed",          cls: "bg-emerald-50 text-emerald-700",    dot: "#16A34A" },
};

export const CLIENT_STATUS: Record<ClientStatus, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Paused",    cls: "bg-amber-50 text-amber-800" },
  completed: { label: "Completed", cls: "bg-black/[0.05] text-muted" },
  churned:   { label: "Churned",   cls: "bg-red-50 text-red-700" },
};

export const PRIORITY: Record<WorkPriority, { label: string; cls: string }> = {
  low:    { label: "Low",    cls: "text-muted" },
  medium: { label: "Medium", cls: "text-ink" },
  high:   { label: "High",   cls: "text-amber-700 font-medium" },
  urgent: { label: "Urgent", cls: "text-red-600 font-medium" },
};

/** Whole days from today until the date. Negative means it's gone past. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export type Health = "healthy" | "attention" | "critical";

export const HEALTH: Record<Health, { label: string; cls: string; bar: string }> = {
  healthy:   { label: "Healthy",         cls: "text-emerald-700", bar: "bg-emerald-500" },
  attention: { label: "Needs attention", cls: "text-amber-700",   bar: "bg-amber-500" },
  critical:  { label: "Critical",        cls: "text-red-600",     bar: "bg-red-500" },
};

/**
 * Project health, derived rather than stored — a stored flag goes stale the
 * moment a deadline passes and nobody touches the record.
 *
 * Critical: already overdue, marked delayed, or money is overdue.
 * Attention: due inside a week with real work left, or stuck on the client.
 */
export function projectHealth(
  p: Pick<Project, "status" | "delivery_date" | "progress">,
  opts: { overdueMoney?: boolean } = {}
): Health {
  if (p.status === "completed") return "healthy";

  const left = daysUntil(p.delivery_date);
  if (p.status === "delayed") return "critical";
  if (left !== null && left < 0) return "critical";
  if (opts.overdueMoney) return "critical";

  if (left !== null && left <= 7 && p.progress < 80) return "attention";
  if (p.status === "waiting_client") return "attention";
  if (p.status === "revision") return "attention";

  return "healthy";
}
