"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DOG_BREED_GROUPS } from "@/lib/breeds";
import type { PetSpecies } from "@/lib/client-labels";

type Props = {
  id: string;
  name: string;
  species: PetSpecies;
  defaultValue?: string;
};

// Breed field: for dogs, a searchable dropdown of doodles and AKC breeds
// that still accepts any typed breed; for other pets, a plain text box.
export function BreedPicker({ id, name, species, defaultValue = "" }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  if (species !== "dog") {
    return <input id={id} name={name} maxLength={80} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />;
  }

  const query = value.trim().toLowerCase();
  const groups = DOG_BREED_GROUPS
    .map((g) => ({ ...g, breeds: query ? g.breeds.filter((b) => b.toLowerCase().includes(query)) : g.breeds }))
    .filter((g) => g.breeds.length > 0);
  const options = groups.flatMap((g) => g.breeds);
  const optionId = (i: number) => `${listId}-${i}`;

  const choose = (breed: string) => {
    setValue(breed);
    setOpen(false);
    setActive(-1);
  };

  const move = (to: number) => {
    setOpen(true);
    setActive(to);
    requestAnimationFrame(() => document.getElementById(optionId(to))?.scrollIntoView({ block: "nearest" }));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (options.length) move(Math.min(active + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (options.length) move(Math.max(active - 1, 0)); }
    else if (e.key === "Enter" && open && active >= 0 && options[active]) { e.preventDefault(); choose(options[active]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
  };

  let index = -1;

  return (
    <div className="breed-picker">
      <input
        id={id}
        name={name}
        maxLength={80}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        placeholder="Pick from the list, or type any breed or mix"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="breed-toggle"
        tabIndex={-1}
        aria-label={open ? "Hide breeds" : "Show breeds"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOpen((o) => !o); document.getElementById(id)?.focus(); }}
      >
        <ChevronDown size={16} />
      </button>

      {open && (
        <ul id={listId} role="listbox" className="breed-list" aria-label="Breeds">
          {options.length === 0 ? (
            <li className="breed-empty" role="presentation">No match. &ldquo;{value.trim()}&rdquo; will be saved as typed.</li>
          ) : (
            groups.map((g) => (
              <li key={g.label} role="presentation">
                <span className="breed-group">{g.label}</span>
                <ul role="group" aria-label={g.label}>
                  {g.breeds.map((breed) => {
                    index += 1;
                    const i = index;
                    return (
                      <li
                        key={breed}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === active}
                        className={i === active ? "is-active" : undefined}
                        onMouseDown={(e) => { e.preventDefault(); choose(breed); }}
                        onMouseEnter={() => setActive(i)}
                      >
                        {breed}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
