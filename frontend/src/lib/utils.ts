import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Urgency } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayDate(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function urgencyClass(urgency?: Urgency) {
  switch (urgency?.toLowerCase()) {
    case "emergency":
    case "high":
      return "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25";
    case "medium":
      return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25";
    default:
      return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25";
  }
}

export function titleCase(value?: string) {
  if (!value) return "Low";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export const EMERGENCY_PATTERN = /\b(chest pain|difficulty breathing|shortness of breath|cannot breathe|stroke|face droop|severe bleeding|unconscious|loss of consciousness|suicid(?:e|al)|kill myself|high fever.*(?:infant|baby)|seizure)\b/i;

export function isEmergencyText(value: string) {
  return EMERGENCY_PATTERN.test(value);
}
