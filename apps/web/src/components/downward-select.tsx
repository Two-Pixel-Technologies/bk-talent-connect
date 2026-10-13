/**
 * A select whose option list only ever opens downward.
 *
 * Scoped narrowly on purpose: native `<select>` option popups are rendered by
 * the browser/OS, not the page, and the browser decides whether to flip the
 * list upward when a field sits in the lower half of the viewport — no amount
 * of page CSS can override that. For the Candidate profile's Sector and
 * Education level fields specifically, that flip was clipping the list
 * against the top of the page. This is a minimal, hand-rolled combobox (same
 * pattern as the account menu and the skills-suggestion list elsewhere in
 * this app — a trigger button, an absolutely positioned panel, a click-outside
 * and Escape handler) used ONLY where that was reported, not a replacement
 * for the shared `Select`.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type DownwardSelectOption = { value: string; label: string };

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")";

export function DownwardSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select',
  required,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly DownwardSelectOption[];
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [maxListHeight, setMaxListHeight] = useState(256);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const listboxId = `${id}-listbox`;

  /*
   * The panel only ever opens downward (the whole point of this component),
   * so on a short viewport a fixed max-height could still run the list past
   * the bottom of the window. Clamping it to the space actually left below
   * the trigger — floor of 120px, enough for a couple of rows — keeps the
   * whole panel on screen and scrollable within itself instead of spilling
   * off the bottom edge.
   */
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.bottom - 16;
    setMaxListHeight(Math.max(120, Math.min(256, available)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Keep the highlighted option scrolled into view during arrow-key travel.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const currentIndex = options.findIndex((o) => o.value === value);

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openAt(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1 >= options.length ? 0 : i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(options.findIndex((o) => o.value === value)))}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        className={`flex w-full min-h-11 items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left text-base transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm ${
          invalid ? 'border-accent-400' : 'border-slate-300'
        }`}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          aria-hidden="true"
          className="ml-2 size-5 shrink-0 bg-no-repeat"
          style={{ backgroundImage: CHEVRON, backgroundPosition: 'center', backgroundSize: '1.25rem 1.25rem' }}
        />
      </button>

      {/*
        * Always top-full — the one behavioural change this component exists
        * for. No flip-to-upward logic, by design: see the file comment.
        * max-h-64 + overflow-y-auto keeps a long list (Sector has ~28
        * options) scrollable within itself instead of running off the
        * bottom of the viewport; z-40 matches the other hand-rolled
        * overlays in this app (Modal, the notification bell, the account
        * menu) so it is never caught behind the sticky header.
        */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          style={{ maxHeight: maxListHeight }}
          className="absolute top-full left-0 z-40 mt-1 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                // mousedown, not click — fires before the trigger's blur would
                // otherwise close the panel and swallow the selection.
                e.preventDefault();
                commit(index);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-brand-50 text-brand-900' : 'text-slate-700'
              } ${option.value === value ? 'font-semibold' : ''}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
