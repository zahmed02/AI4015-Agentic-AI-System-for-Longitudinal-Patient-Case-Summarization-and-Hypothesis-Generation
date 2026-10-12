import { BadgeCheck, Pill, Split, Thermometer, type LucideIcon } from "lucide-react";

export type EntityKey = "symptoms" | "confirmed" | "differential" | "treatments";

export interface EntityStyle {
  label: string;
  relation: string;
  hex: string;
  pill: string;
  text: string;
  icon: LucideIcon;
}

export const ENTITY_STYLES: Record<EntityKey, EntityStyle> = {
  symptoms: {
    label: "Symptoms", relation: "HAS_SYMPTOM", hex: "#fbbf24",
    pill: "border-amber-400/30 bg-amber-400/10 text-amber-100", text: "text-amber-300", icon: Thermometer,
  },
  confirmed: {
    label: "Confirmed diagnoses", relation: "HAS_CONFIRMED_DIAGNOSIS", hex: "#34d399",
    pill: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100", text: "text-emerald-300", icon: BadgeCheck,
  },
  differential: {
    label: "Differential (considered)", relation: "CONSIDERED_DIAGNOSIS", hex: "#38bdf8",
    pill: "border-sky-400/30 bg-sky-400/10 text-sky-100", text: "text-sky-300", icon: Split,
  },
  treatments: {
    label: "Treatments", relation: "RECEIVED_TREATMENT", hex: "#a78bfa",
    pill: "border-violet-400/30 bg-violet-400/10 text-violet-100", text: "text-violet-300", icon: Pill,
  },
};