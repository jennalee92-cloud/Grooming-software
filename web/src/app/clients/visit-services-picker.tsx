"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Tag, X } from "lucide-react";
import {
  MAX_EXTRAS,
  PET_SIZES,
  SIZE_HINTS,
  SIZE_LABELS,
  menuPrice,
  money,
  moneyInput,
  parseMoney,
  type MenuItem,
  type PetSize,
} from "@/lib/service-labels";

type Props = {
  menu: MenuItem[];
  values: Record<string, string>;
  suggestedSize: PetSize | null;
  canEditMenu: boolean;
};

// price === null means "use the menu price for the chosen size".
type Pick = { on: boolean; price: string | null };
type Extra = { key: number; name: string; price: string };

const asSize = (s: string | undefined): PetSize | "" => (PET_SIZES.includes(s as PetSize) ? (s as PetSize) : "");

// The services part of the visit form: pet size, menu picks with prices
// that follow the size (and can be changed), extra charges, and a total.
export function VisitServicesPicker({ menu, values: v, suggestedSize, canEditMenu }: Props) {
  // A new visit starts from the size suggested by the pet's weight; a
  // correction or a rejected form starts from what was entered.
  const initialSize = v.petSize === undefined ? suggestedSize ?? "" : asSize(v.petSize);
  const [size, setSize] = useState<PetSize | "">(initialSize);

  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(menu.map((item) => {
      const saved = v[`price_${item.id}`];
      const listed = moneyInput(menuPrice(item, initialSize));
      return [item.id, { on: v[`svc_${item.id}`] === "on", price: saved === undefined || saved === listed ? null : saved }];
    })),
  );

  const [extras, setExtras] = useState<Extra[]>(() => {
    const rows: Extra[] = [];
    for (let n = 0; n < MAX_EXTRAS; n++) {
      const name = v[`extraName_${n}`] ?? "";
      const price = v[`extraPrice_${n}`] ?? "";
      if (name || price) rows.push({ key: n, name, price });
    }
    return rows;
  });
  const [nextKey, setNextKey] = useState(MAX_EXTRAS);

  const update = (id: string, change: Partial<Pick>) => setPicks((p) => ({ ...p, [id]: { ...p[id], ...change } }));
  const shownPrice = (item: MenuItem) => picks[item.id]?.price ?? moneyInput(menuPrice(item, size));

  const amounts = [
    ...menu.filter((item) => picks[item.id]?.on).map((item) => parseMoney(shownPrice(item))),
    ...extras.map((e) => parseMoney(e.price)),
  ];
  const total = amounts.reduce<number>((sum, a) => sum + (a !== null && !Number.isNaN(a) ? a : 0), 0);
  const missing = amounts.some((a) => a === null || Number.isNaN(a));

  return (
    <>
      <label className="field field-narrow" htmlFor="visit-size">
        <span>Pet size</span>
        <select id="visit-size" name="petSize" value={size} onChange={(e) => setSize(asSize(e.target.value))}>
          <option value="">Not set</option>
          {PET_SIZES.map((s) => <option key={s} value={s}>{SIZE_LABELS[s]} ({SIZE_HINTS[s]})</option>)}
        </select>
        <small>Sets the menu prices for services priced by size.</small>
      </label>

      {menu.length === 0 ? (
        <p className="team-empty">
          <Tag size={13} /> No service menu yet.{" "}
          {canEditMenu
            ? <Link href="/services/new" className="text-link">Set up your services and prices</Link>
            : "An owner or manager can set one up. For now, add charges below."}
        </p>
      ) : (
        <ul className="service-picks" aria-label="Services from the menu">
          {menu.map((item) => {
            const pick = picks[item.id];
            const listed = menuPrice(item, size);
            return (
              <li key={item.id} className={pick?.on ? "is-on" : undefined}>
                <label className="service-pick">
                  <input type="checkbox" name={`svc_${item.id}`} checked={pick?.on ?? false}
                    onChange={(e) => update(item.id, { on: e.target.checked })} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{listed === null ? "Priced by size, choose the size above" : money(listed)}</small>
                  </span>
                </label>
                {pick?.on && (
                  <span className="money-input money-input-small">
                    <span aria-hidden="true">$</span>
                    <input name={`price_${item.id}`} inputMode="decimal" autoComplete="off" aria-label={`Price charged for ${item.name}`}
                      value={shownPrice(item)} onChange={(e) => update(item.id, { price: e.target.value })} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {extras.length > 0 && (
        <ul className="extra-charges" aria-label="Extra charges">
          {extras.map((e, i) => (
            <li key={e.key}>
              <input name={`extraName_${i}`} maxLength={80} autoComplete="off" placeholder="For example: matting fee" aria-label="Extra charge"
                value={e.name} onChange={(ev) => setExtras((xs) => xs.map((x) => (x.key === e.key ? { ...x, name: ev.target.value } : x)))} />
              <span className="money-input money-input-small">
                <span aria-hidden="true">$</span>
                <input name={`extraPrice_${i}`} inputMode="decimal" autoComplete="off" aria-label="Extra charge price"
                  value={e.price} onChange={(ev) => setExtras((xs) => xs.map((x) => (x.key === e.key ? { ...x, price: ev.target.value } : x)))} />
              </span>
              <button type="button" className="button-quiet button-icon" aria-label="Remove this charge"
                onClick={() => setExtras((xs) => xs.filter((x) => x.key !== e.key))}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="charges-foot">
        {extras.length < MAX_EXTRAS && (
          <button type="button" className="button-quiet" onClick={() => { setExtras((xs) => [...xs, { key: nextKey, name: "", price: "" }]); setNextKey((k) => k + 1); }}>
            <Plus size={14} /> Add an extra charge
          </button>
        )}
        <span className="charges-total" aria-live="polite">
          Total <strong>{money(total)}</strong>{missing && <small> (some prices still blank)</small>}
        </span>
      </div>
    </>
  );
}
