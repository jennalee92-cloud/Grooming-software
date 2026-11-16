"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { STARTER_CHECKLISTS, type ChecklistFrequency } from "@/lib/checklist-labels";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, required, snapshot, text } from "@/lib/form-fields";
import { canManageChecklists } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string } | undefined;
export type ChecklistFormState = { error?: string; values?: Record<string, string> } | undefined;

const FREQUENCIES: ChecklistFrequency[] = ["daily", "weekly", "monthly"];
const MAX_TASKS = 100;
// save_checklist takes null for "new checklist" and "every location"; the
// generated types mark those parameters as plain strings.
const NONE = null as unknown as string;

// Ticks or unticks one task for the current period at a location.
export async function toggleTask(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  const taskId = text(fd, "taskId");
  const locationId = text(fd, "locationId");
  const period = text(fd, "periodStart");
  if (!UUID_PATTERN.test(taskId) || !UUID_PATTERN.test(locationId) || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return { error: "That task isn't valid. Refresh the page and try again." };
  }

  const supabase = await createClient();
  if (fd.get("checked") === "true") {
    const { error } = await supabase.from("checklist_checks").insert({
      organization_id: workspace.organizationId, task_id: taskId, location_id: locationId, period_start: period,
    });
    // Someone else ticked it a moment ago: that's fine.
    if (error && error.code !== "23505") {
      return { error: error.code === "22023" ? "This list has moved to a new day, week or month. Refresh the page." : userMessage(error) };
    }
  } else {
    const { data, error } = await supabase.from("checklist_checks").delete()
      .eq("organization_id", workspace.organizationId).eq("task_id", taskId).eq("location_id", locationId).eq("period_start", period)
      .select("id");
    if (error) return { error: userMessage(error) };
    if (data.length === 0) return { error: "Only the person who ticked this, or a manager, can untick it." };
  }
  refresh();
  return undefined;
}

// Tasks arrive as task_<n> / taskDetails_<n> / taskId_<n>; blank rows are skipped.
function parseTasks(fd: FormData) {
  const tasks: { id: string | null; label: string; details: string | null }[] = [];
  for (let n = 0; n < MAX_TASKS; n++) {
    const label = text(fd, `task_${n}`);
    const details = text(fd, `taskDetails_${n}`);
    const id = text(fd, `taskId_${n}`);
    if (!label && !details) continue;
    if (!label) throw new Invalid("Give each task a name, or remove the empty row.");
    if (label.length > 200) throw new Invalid("Keep each task under 200 characters.");
    if (details.length > 500) throw new Invalid("Keep each task's details under 500 characters.");
    tasks.push({ id: UUID_PATTERN.test(id) ? id : null, label, details: details || null });
  }
  if (tasks.length === 0) throw new Invalid("Add at least one task.");
  return tasks;
}

export async function saveChecklist(_prev: ChecklistFormState, fd: FormData): Promise<ChecklistFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  let args;
  try {
    if (!canManageChecklists(workspace.role)) throw new Invalid("Only owners, admins and managers can change checklists.");
    const checklistId = text(fd, "checklistId");
    if (checklistId && !UUID_PATTERN.test(checklistId)) throw new Invalid("That checklist isn't valid.");
    const frequency = text(fd, "frequency");
    const locationId = text(fd, "locationId");
    if (locationId && !workspace.locations.some((l) => l.id === locationId)) throw new Invalid("Choose a location from the list.");
    args = {
      p_organization_id: workspace.organizationId,
      p_checklist_id: checklistId || NONE,
      p_name: required(fd, "name", 120, "a name for the checklist"),
      p_description: optional(fd, "description", 500, "the description") ?? "",
      p_frequency: FREQUENCIES.includes(frequency as ChecklistFrequency) ? (frequency as ChecklistFrequency) : "daily",
      p_location_id: locationId || NONE,
      p_tasks: parseTasks(fd),
    };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_checklist", args);
  if (error) return { error: userMessage(error), values };
  redirect("/checklists/manage?saved=1");
}

export async function addStarterChecklist(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canManageChecklists(workspace.role)) return { error: "Only owners, admins and managers can add checklists." };
  const starter = STARTER_CHECKLISTS.find((s) => s.key === text(fd, "starter"));
  if (!starter) return { error: "That suggested checklist isn't available." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_checklist", {
    p_organization_id: workspace.organizationId,
    p_checklist_id: NONE,
    p_location_id: NONE,
    p_name: starter.name,
    p_description: starter.description,
    p_frequency: starter.frequency,
    p_tasks: starter.tasks.map((label) => ({ label })),
  });
  if (error) return { error: userMessage(error) };
  refresh();
  return undefined;
}

export async function setChecklistArchived(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canManageChecklists(workspace.role)) return { error: "Only owners, admins and managers can change checklists." };
  const checklistId = text(fd, "checklistId");
  if (!UUID_PATTERN.test(checklistId)) return { error: "That checklist isn't valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("checklists")
    .update({ archived_at: fd.get("archived") === "true" ? new Date().toISOString() : null })
    .eq("id", checklistId).eq("organization_id", workspace.organizationId).select("id");
  if (error) return { error: userMessage(error) };
  if (data.length === 0) return { error: "That checklist couldn't be changed." };
  refresh();
  return undefined;
}
