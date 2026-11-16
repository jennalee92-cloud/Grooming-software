"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, ClipboardCheck, ListChecks, Plus, X } from "lucide-react";
import { FREQUENCY_LABELS, type ChecklistFrequency } from "@/lib/checklist-labels";
import { saveChecklist, type ChecklistFormState } from "./actions";

type Task = { key: number; id: string; label: string; details: string };

type Props = {
  checklistId?: string;
  locations: { id: string; name: string }[];
  defaults: { name: string; description: string; frequency: ChecklistFrequency; locationId: string; tasks: { id: string; label: string; details: string }[] };
};

export function ChecklistForm({ checklistId, locations, defaults }: Props) {
  const [state, formAction, pending] = useActionState<ChecklistFormState, FormData>(saveChecklist, undefined);
  const v = state?.values;
  const [tasks, setTasks] = useState<Task[]>(() => {
    const start = defaults.tasks.length > 0 ? defaults.tasks : [{ id: "", label: "", details: "" }];
    return start.map((t, i) => ({ ...t, key: i }));
  });
  const [nextKey, setNextKey] = useState(1000);

  const update = (key: number, change: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...change } : t)));
  const move = (index: number, by: number) => setTasks((ts) => {
    const to = index + by;
    if (to < 0 || to >= ts.length) return ts;
    const copy = [...ts];
    [copy[index], copy[to]] = [copy[to], copy[index]];
    return copy;
  });

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      {checklistId && <input type="hidden" name="checklistId" value={checklistId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <fieldset className="form-section form-section-first">
        <legend><ClipboardCheck size={15} /> The checklist</legend>
        <label className="field" htmlFor="cl-name">
          <span>Name</span>
          <input id="cl-name" name="name" maxLength={120} required autoComplete="off" defaultValue={v?.name ?? defaults.name}
            placeholder="For example: Closing sanitation" />
        </label>
        <label className="field" htmlFor="cl-description">
          <span>Description <em className="field-optional">optional</em></span>
          <input id="cl-description" name="description" maxLength={500} autoComplete="off" defaultValue={v?.description ?? defaults.description} />
        </label>
        <div className="field" role="radiogroup" aria-labelledby="cl-frequency-label">
          <span id="cl-frequency-label">How often</span>
          <div className="choice-row">
            {(Object.keys(FREQUENCY_LABELS) as ChecklistFrequency[]).map((f) => (
              <label key={f} className="choice-chip">
                <input type="radio" name="frequency" value={f} defaultChecked={(v?.frequency ?? defaults.frequency) === f} />
                <span>{FREQUENCY_LABELS[f]}</span>
              </label>
            ))}
          </div>
          <small>Weekly lists start fresh each Monday, monthly lists on the 1st.</small>
        </div>
        {locations.length > 1 && (
          <label className="field field-narrow" htmlFor="cl-location">
            <span>Location</span>
            <select id="cl-location" name="locationId" defaultValue={v?.locationId ?? defaults.locationId}>
              <option value="">Every location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend><ListChecks size={15} /> Tasks</legend>
        <ol className="task-editor">
          {tasks.map((t, i) => (
            <li key={t.key}>
              <input type="hidden" name={`taskId_${i}`} value={t.id} />
              <span className="task-number">{i + 1}</span>
              <div className="task-editor-fields">
                <input name={`task_${i}`} maxLength={200} autoComplete="off" aria-label={`Task ${i + 1}`} placeholder="What needs doing"
                  value={t.label} onChange={(e) => update(t.key, { label: e.target.value })} />
                <input name={`taskDetails_${i}`} maxLength={500} autoComplete="off" aria-label={`Task ${i + 1} details`} placeholder="Details or products to use (optional)"
                  className="task-details-input" value={t.details} onChange={(e) => update(t.key, { details: e.target.value })} />
              </div>
              <div className="task-editor-actions">
                <button type="button" className="button-quiet button-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="button-quiet button-icon" aria-label="Move down" disabled={i === tasks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="button-quiet button-icon" aria-label="Remove task" disabled={tasks.length === 1}
                  onClick={() => setTasks((ts) => ts.filter((x) => x.key !== t.key))}><X size={14} /></button>
              </div>
            </li>
          ))}
        </ol>
        {tasks.length < 100 && (
          <button type="button" className="button-quiet" onClick={() => { setTasks((ts) => [...ts, { key: nextKey, id: "", label: "", details: "" }]); setNextKey((k) => k + 1); }}>
            <Plus size={14} /> Add a task
          </button>
        )}
        <small className="field-help">Removing a task takes it off the list from now on. Past ticks are kept.</small>
      </fieldset>

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : checklistId ? "Save changes" : "Create checklist"}
      </button>
    </form>
  );
}
