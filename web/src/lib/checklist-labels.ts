import type { Database } from "@/lib/supabase/database.types";

// Checklist labels, periods and starter templates. Safe to import from browser components.

export type ChecklistFrequency = Database["public"]["Enums"]["checklist_frequency"];

export const FREQUENCY_LABELS: Record<ChecklistFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const PERIOD_LABELS: Record<ChecklistFrequency, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};

// The start of the current period for a YYYY-MM-DD day: the day itself,
// that week's Monday, or the 1st of the month (matches the database).
export function periodStart(frequency: ChecklistFrequency, today: string) {
  if (frequency === "daily") return today;
  if (frequency === "monthly") return `${today.slice(0, 8)}01`;
  const d = new Date(`${today}T12:00:00Z`);
  const fromMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - fromMonday);
  return d.toISOString().slice(0, 10);
}

// Suggested checklists a salon can add and then make its own.
export const STARTER_CHECKLISTS: { key: string; name: string; description: string; frequency: ChecklistFrequency; tasks: string[] }[] = [
  {
    key: "opening",
    name: "Opening",
    description: "Before the first client arrives.",
    frequency: "daily",
    tasks: [
      "Turn on lights, dryers and water heater; check water temperature",
      "Check tubs, tables and kennels are clean and dry",
      "Restock towels, shampoo and conditioner",
      "Check clippers, blades and shears are clean, oiled and ready",
      "Review today's appointments and any handle-with-care notes",
    ],
  },
  {
    key: "closing",
    name: "Closing sanitation",
    description: "End of day cleaning and disinfecting.",
    frequency: "daily",
    tasks: [
      "Disinfect grooming tables and arms",
      "Scrub and disinfect tubs and drains; clear hair traps",
      "Disinfect kennels and crates",
      "Sweep and mop floors; empty hair and trash bins",
      "Start towels in the wash",
      "Clean and disinfect clippers, blades and combs",
      "Turn off dryers and unplug clippers",
    ],
  },
  {
    key: "weekly",
    name: "Weekly deep clean",
    description: "Once a week, beyond the daily clean.",
    frequency: "weekly",
    tasks: [
      "Wash walls and baseboards around tubs and tables",
      "Clean dryer filters and vents",
      "Deep clean kennel trays and mats",
      "Clean washer and dryer lint traps and seals",
      "Check first aid kit and restock",
    ],
  },
  {
    key: "monthly",
    name: "Monthly equipment care",
    description: "Maintenance that keeps equipment safe and working.",
    frequency: "monthly",
    tasks: [
      "Send blades and shears for sharpening if needed",
      "Check table and tub restraints for wear",
      "Inspect electrical cords and plugs on dryers and clippers",
      "Check fire extinguisher and emergency exits",
      "Check the expiry dates on products and medical supplies",
    ],
  },
];
