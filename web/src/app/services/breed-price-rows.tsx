"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { BreedPicker } from "@/components/breed-picker";
import { MAX_BREED_PRICES } from "@/lib/service-labels";

type Row = { key: number; breed: string; price: string };

// Breed-specific prices for one service. Sent as breed_<n> / breedPrice_<n>.
export function BreedPriceRows({ values }: { values: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const initial: Row[] = [];
    for (let n = 0; n < MAX_BREED_PRICES; n++) {
      const breed = values[`breed_${n}`] ?? "";
      const price = values[`breedPrice_${n}`] ?? "";
      if (breed || price) initial.push({ key: n, breed, price });
    }
    return initial;
  });
  const [nextKey, setNextKey] = useState(MAX_BREED_PRICES);

  return (
    <div className="breed-prices">
      {rows.length === 0 && <p className="field-help">No breed prices yet. Every breed uses the price above.</p>}
      {rows.length > 0 && (
        <ul className="breed-price-list">
          {rows.map((r, i) => (
            <li key={r.key}>
              <BreedPicker id={`breed-price-${r.key}`} name={`breed_${i}`} species="dog" defaultValue={r.breed} />
              <span className="money-input money-input-small">
                <span aria-hidden="true">$</span>
                <input name={`breedPrice_${i}`} inputMode="decimal" autoComplete="off" aria-label="Price for this breed"
                  value={r.price} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: e.target.value } : x)))} />
              </span>
              <button type="button" className="button-quiet button-icon" aria-label="Remove this breed price"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {rows.length < MAX_BREED_PRICES && (
        <button type="button" className="button-quiet" onClick={() => { setRows((rs) => [...rs, { key: nextKey, breed: "", price: "" }]); setNextKey((k) => k + 1); }}>
          <Plus size={14} /> Add a breed price
        </button>
      )}
    </div>
  );
}
