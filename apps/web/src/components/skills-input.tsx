/**
 * Skills entry with suggestions.
 *
 * Suggestions come from the approved skill list so the taxonomy stays coherent
 * — Phase 2 scores skills for 35 of 100 points, and "AutoCAD" fragmenting into
 * four spellings degrades that directly. Free text is still allowed, because
 * refusing a real skill that happens to be missing would be worse; new entries
 * simply arrive unapproved and stay out of everyone else's suggestions until an
 * admin accepts them.
 */

import { useState, useRef, type KeyboardEvent } from 'react';
import { LIMITS } from '@bktc/shared';
import { useSkillSearch } from '../features/candidate/use-profile.js';
import { Input } from './ui/index.js';

export function SkillsInput({
  id = 'skills',
  value,
  onChange,
  disabled,
  max = LIMITS.candidate.skills.max,
  min = LIMITS.candidate.skills.min,
}: {
  /** Required when a page renders more than one — the job editor has two, and
   *  a shared id left both <label htmlFor> pointing at nothing. */
  id?: string;
  value: readonly string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
  max?: number;
  min?: number;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useSkillSearch(query);

  const atLimit = value.length >= max;

  const suggestions = (data?.skills ?? [])
    .map((s) => s.name)
    .filter((name) => !value.some((v) => v.toLowerCase() === name.toLowerCase()))
    .slice(0, 8);

  function add(skill: string) {
    const trimmed = skill.trim();
    if (!trimmed || atLimit) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(skill: string) {
    onChange(value.filter((s) => s !== skill));
  }

  /*
   * Arrow-key navigation over the suggestions.
   *
   * Without it the list was mouse-only: a keyboard user had to type the whole
   * skill name exactly, and tabbing towards a suggestion raced the 150ms blur
   * timer that unmounted it. `activeIndex` of -1 means "nothing highlighted",
   * so Enter still commits whatever was typed.
   */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const hasSuggestions = open && suggestions.length > 0;

    if (event.key === 'ArrowDown' && hasSuggestions) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && hasSuggestions) {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const highlighted = hasSuggestions && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      add(highlighted ?? query);
      setActiveIndex(-1);
    } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
      remove(value[value.length - 1]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-1.5 pl-3 text-sm text-brand-800"
          >
            {skill}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(skill)}
                aria-label={`Remove ${skill}`}
                className="rounded-full px-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {!disabled && (
        <div className="relative mt-2">
          <Input
            ref={inputRef}
            id={id}
            value={query}
            disabled={atLimit}
            placeholder={atLimit ? `Maximum ${max} skills` : 'Type a skill and press Enter'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={`${id}-suggestions`}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined
            }
          />

          {open && suggestions.length > 0 && (
            <ul
              id={`${id}-suggestions`}
              role="listbox"
              className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {suggestions.map((name, index) => (
                <li
                  key={name}
                  id={`${id}-suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(name)}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      index === activeIndex ? 'bg-brand-50' : 'hover:bg-brand-50'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        {value.length} of {max}
        {min > 0 ? ` · at least ${min} required` : ''}
      </p>
    </div>
  );
}
