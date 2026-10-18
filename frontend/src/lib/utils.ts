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
      return "bg-emergency-tint text-emergency ring-emergency/25";
    case "high":
      return "bg-high-tint text-high ring-high/25";
    case "medium":
      return "bg-med-tint text-med ring-med/25";
    default:
      return "bg-low-tint text-low ring-low/25";
  }
}

export function titleCase(value?: string) {
  if (!value) return "Low";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// Client-side pre-filter only for instant UI; the server emergency module is authoritative.
export const EMERGENCY_PATTERN = /\b(chest pain|difficulty breathing|shortness of breath|cannot breathe|stroke|face droop|severe bleeding|unconscious|loss of consciousness|suicid(?:e|al)|kill myself|high fever.*(?:infant|baby)|seizure)\b/i;

export function isEmergencyText(value: string) {
  return EMERGENCY_PATTERN.test(value);
}
