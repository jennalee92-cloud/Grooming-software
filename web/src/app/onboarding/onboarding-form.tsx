"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { createBusiness, type OnboardingState } from "./actions";

const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain, no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/Toronto", label: "Eastern (Toronto)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Australia/Sydney", label: "Australia Eastern (Sydney)" },
];

const noSubscription = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || null;

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(createBusiness, undefined);
  // The device's time zone is only known in the browser; the server renders the default.
  const detected = useSyncExternalStore(noSubscription, browserTimezone, () => null);
  const [chosen, setChosen] = useState<string | null>(state?.values?.timezone || null);
  const timezone = chosen ?? detected ?? "America/New_York";
  const options = detected && !TIMEZONES.some((t) => t.value === detected)
    ? [{ value: detected, label: `${detected.replace(/_/g, " ")} (this device)` }, ...TIMEZONES]
    : TIMEZONES;

  const v = state?.values;

  return (
    <form action={formAction} className="auth-form" noValidate>
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <label className="field" htmlFor="onboarding-business">
        <span>Business name</span>
        <input id="onboarding-business" name="businessName" required maxLength={120} autoComplete="organization"
          defaultValue={v?.businessName} placeholder="Wag & Whisker Grooming" />
      </label>

      <label className="field" htmlFor="onboarding-name">
        <span>Your name</span>
        <input id="onboarding-name" name="displayName" maxLength={120} autoComplete="name"
          defaultValue={v?.displayName ?? suggestedName} placeholder="How your team will see you" />
        <small>Shown to your team. You can leave it blank.</small>
      </label>

      <div className="field-row">
        <label className="field" htmlFor="onboarding-location">
          <span>First location</span>
          <input id="onboarding-location" name="locationName" required maxLength={120}
            defaultValue={v?.locationName} placeholder="Main Street" />
        </label>

        <label className="field" htmlFor="onboarding-timezone">
          <span>Time zone</span>
          <select id="onboarding-timezone" name="timezone" value={timezone} onChange={(e) => setChosen(e.target.value)}>
            {options.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <small className="field-hint">You can add more locations later.</small>

      <button type="submit" className="button-primary button-block" disabled={pending}>
        {pending ? "Setting up…" : "Create business"}
        {!pending && <ArrowRight size={16} />}
      </button>
    </form>
  );
}
