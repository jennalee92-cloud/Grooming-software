"use client";

import { useState } from "react";
import { Syringe } from "lucide-react";
import { plusYears } from "@/lib/vaccine-labels";

type Props = { values: Record<string, string>; today: string };

// Optional rabies record when adding a pet. Field names: rabiesGivenOn,
// rabiesExpiresOn, rabiesVerified (read by parseRabies on the server).
export function RabiesFields({ values: v, today }: Props) {
  const [givenOn, setGivenOn] = useState(v.rabiesGivenOn ?? "");
  const [expiresOn, setExpiresOn] = useState(v.rabiesExpiresOn ?? "");

  return (
    <fieldset className="form-section">
      <legend><Syringe size={15} /> Rabies vaccine <em className="optional">optional, add other vaccines on the pet&apos;s page</em></legend>
      <div className="field-row">
        <label className="field" htmlFor="rabies-given">
          <span>Date given <em className="optional">if known</em></span>
          <input id="rabies-given" name="rabiesGivenOn" type="date" min="1990-01-01" max={today} value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
        </label>
        <label className="field" htmlFor="rabies-expires">
          <span>Expires</span>
          <input id="rabies-expires" name="rabiesExpiresOn" type="date" min="1990-01-01" max="2100-12-31" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>
      </div>
      <div className="quick-dates">
        <small>Expires after</small>
        {[1, 3].map((years) => (
          <button key={years} type="button" className="button-quiet" disabled={!givenOn} onClick={() => setExpiresOn(plusYears(givenOn, years))}>
            {years} {years === 1 ? "year" : "years"}
          </button>
        ))}
      </div>
      <label className="check-option">
        <input type="checkbox" name="rabiesVerified" defaultChecked={v.rabiesVerified === "on"} />
        <span>We&apos;ve seen proof from the vet</span>
      </label>
    </fieldset>
  );
}
