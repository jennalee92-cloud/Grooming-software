"use client";

import { useActionState } from "react";
import { Check, CircleAlert } from "lucide-react";
import { toggleTask, type ActionState } from "./actions";

type Props = {
  taskId: string;
  locationId: string;
  periodStart: string;
  label: string;
  details: string | null;
  checked: boolean;
  doneBy: string | null; // "Ben · 4:32 PM"
};

// One task row: tapping the box ticks or unticks it.
export function TaskToggle({ taskId, locationId, periodStart, label, details, checked, doneBy }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(toggleTask, undefined);
  // Show the new state right away while it saves.
  const shown = pending ? !checked : checked;

  return (
    <form action={formAction} className={`task-row${shown ? " is-done" : ""}`}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="periodStart" value={periodStart} />
      <input type="hidden" name="checked" value={checked ? "false" : "true"} />
      <button type="submit" className="task-box" role="checkbox" aria-checked={shown} aria-label={label} disabled={pending}>
        {shown && <Check size={15} strokeWidth={3} />}
      </button>
      <span className="task-copy">
        <span className="task-label">{label}</span>
        {details && <small>{details}</small>}
        {checked && doneBy && !pending && <small className="task-done-by">Done by {doneBy}</small>}
        {state?.error && <small className="form-error-inline-text"><CircleAlert size={12} /> {state.error}</small>}
      </span>
    </form>
  );
}
