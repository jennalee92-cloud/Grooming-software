"use client";

import { useState } from "react";

type Props = {
  idPrefix: string;
  name: string; // form field that receives the birth date (YYYY-MM-DD)
  defaultBirthDate?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function ageFrom(birthDate: string): { years: string; months: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return { years: "", months: "" };
  const born = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return { years: "", months: "" };
  return { years: String(Math.floor(months / 12)), months: String(months % 12) };
}

function birthDateFrom(years: string, months: string) {
  const y = Number(years || 0);
  const m = Number(months || 0);
  if (!Number.isFinite(y) || !Number.isFinite(m) || (years === "" && months === "")) return "";
  const d = new Date();
  d.setMonth(d.getMonth() - (Math.round(y) * 12 + Math.round(m)));
  return isoDay(d);
}

// Age in years and months, or an exact birthday. Either one fills in the
// other; only the birth date is saved, so the age stays right over time.
export function AgeFields({ idPrefix, name, defaultBirthDate = "" }: Props) {
  const [birthDate, setBirthDate] = useState(defaultBirthDate);
  const [age, setAge] = useState(() => ageFrom(defaultBirthDate));

  const changeAge = (years: string, months: string) => {
    setAge({ years, months });
    setBirthDate(birthDateFrom(years, months));
  };

  return (
    <div className="field">
      <span id={`${idPrefix}-age-label`}>Age</span>
      <div className="age-row" role="group" aria-labelledby={`${idPrefix}-age-label`}>
        <label className="age-part" htmlFor={`${idPrefix}-years`}>
          <input id={`${idPrefix}-years`} type="number" inputMode="numeric" min={0} max={30} value={age.years}
            onChange={(e) => changeAge(e.target.value, age.months)} />
          <span>years</span>
        </label>
        <label className="age-part" htmlFor={`${idPrefix}-months`}>
          <input id={`${idPrefix}-months`} type="number" inputMode="numeric" min={0} max={11} value={age.months}
            onChange={(e) => changeAge(age.years, e.target.value)} />
          <span>months</span>
        </label>
      </div>
      <label className="age-birthday" htmlFor={`${idPrefix}-birth`}>
        <small>Or exact birthday</small>
        <input id={`${idPrefix}-birth`} name={name} type="date" min="1980-01-01" value={birthDate}
          onChange={(e) => { setBirthDate(e.target.value); setAge(ageFrom(e.target.value)); }} />
      </label>
    </div>
  );
}
