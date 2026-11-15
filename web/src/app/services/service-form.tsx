"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Clock, Tag } from "lucide-react";
import { PET_SIZES, SIZE_HINTS, SIZE_LABELS } from "@/lib/service-labels";
import { saveService, type ServiceFormState } from "./actions";

type Props = { serviceId?: string; defaults: Record<string, string> };

export function ServiceForm({ serviceId, defaults }: Props) {
  const [state, formAction, pending] = useActionState<ServiceFormState, FormData>(saveService, undefined);
  const v = state?.values ?? defaults;
  const [bySize, setBySize] = useState(v.pricing === "by_size");

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      {serviceId && <input type="hidden" name="serviceId" value={serviceId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <fieldset className="form-section form-section-first">
        <legend><Tag size={15} /> The service</legend>
        <label className="field" htmlFor="service-name">
          <span>Name</span>
          <input id="service-name" name="name" maxLength={80} required autoComplete="off" defaultValue={v.name}
            placeholder="For example: Full groom" />
        </label>
        <label className="field" htmlFor="service-description">
          <span>Description <em className="field-optional">optional</em></span>
          <textarea id="service-description" name="description" maxLength={500} rows={2} defaultValue={v.description}
            placeholder="What's included, so the whole team describes it the same way" />
        </label>
        <label className="field field-narrow" htmlFor="service-duration">
          <span><Clock size={13} /> Usual time in minutes <em className="field-optional">optional</em></span>
          <input id="service-duration" name="durationMinutes" type="number" inputMode="numeric" min={5} max={720} step={5}
            defaultValue={v.durationMinutes} />
          <small>Used later for booking appointments.</small>
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Price</legend>
        <div className="choice-row" role="radiogroup" aria-label="How this service is priced">
          <label className="choice-chip">
            <input type="radio" name="pricing" value="flat" checked={!bySize} onChange={() => setBySize(false)} />
            <span>One price</span>
          </label>
          <label className="choice-chip">
            <input type="radio" name="pricing" value="by_size" checked={bySize} onChange={() => setBySize(true)} />
            <span>Price by pet size</span>
          </label>
        </div>

        {bySize ? (
          <div className="price-grid">
            {PET_SIZES.map((size) => (
              <label key={size} className="field" htmlFor={`service-${size}`}>
                <span>{SIZE_LABELS[size]} <em className="field-optional">{SIZE_HINTS[size]}</em></span>
                <span className="money-input">
                  <span aria-hidden="true">$</span>
                  <input id={`service-${size}`} name={`${size}Price`} inputMode="decimal" autoComplete="off" required
                    defaultValue={v[`${size}Price`]} />
                </span>
              </label>
            ))}
          </div>
        ) : (
          <label className="field field-narrow" htmlFor="service-price">
            <span>Price</span>
            <span className="money-input">
              <span aria-hidden="true">$</span>
              <input id="service-price" name="price" inputMode="decimal" autoComplete="off" required defaultValue={v.price}
                placeholder="45" />
            </span>
          </label>
        )}
        <small className="field-help">Changing a price only affects visits recorded from now on. Past visits keep what was charged.</small>
      </fieldset>

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : serviceId ? "Save changes" : "Add to menu"}
      </button>
    </form>
  );
}
