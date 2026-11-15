"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";

type State = { error?: string } | undefined;

type Props = {
  action: (state: State, formData: FormData) => Promise<State>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  confirm?: string;
  className?: string;
};

// A one-button form for small changes (cancel, turn access off) that
// shows the error inline if the change is refused.
export function ActionButton({ action, fields, label, pendingLabel, confirm, className = "button-quiet" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      className="action-form"
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" className={className} disabled={pending}>{pending ? pendingLabel : label}</button>
      {state?.error && <p className="form-error form-error-inline" role="alert"><CircleAlert size={14} /> {state.error}</p>}
    </form>
  );
}
