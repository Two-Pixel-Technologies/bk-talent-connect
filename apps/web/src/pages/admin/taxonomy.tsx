/**
 * Sector Options — renamed from "Taxonomy" per the product request, with a
 * simplified add/list/delete UX for the list that matters most day to day.
 *
 * "Delete" here is the existing deactivate pattern, not a real DELETE: sectors
 * are referenced by candidate profiles and job postings, and a hard delete
 * would either break that foreign key or silently blank an existing record's
 * sector. Deactivating keeps every past reference displaying correctly and
 * just stops the sector being offered to new selections — the smallest safe
 * way to give the requested "Delete" action without destroying data or
 * creating a second, disconnected sector list. Functions use the same list
 * management and stay on their own tab here rather than losing their only
 * admin UI, since nothing else in the portal can add or retire one.
 */

import { useState } from 'react';
import { ApiError } from '../../lib/api-client.js';
import {
  useTaxonomy,
  useTaxonomyMutations,
  type TaxonomyEntry,
  type TaxonomyKind,
} from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, Field, Input } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';
import { ADMIN_CARD } from './admin-style.js';

const TABS: { kind: TaxonomyKind; label: string; noun: string }[] = [
  { kind: 'sectors', label: 'Sector Options', noun: 'sector' },
  { kind: 'functions', label: 'Functions', noun: 'function' },
];

export function TaxonomyPage() {
  const [kind, setKind] = useState<TaxonomyKind>('sectors');
  const active = TABS.find((t) => t.kind === kind)!;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Configuration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Sector Options</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          The sectors candidates and employers choose from. Changes apply immediately, no deploy
          needed.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setKind(tab.kind)}
            className={`min-h-11 cursor-pointer rounded-lg border px-4 text-sm font-semibold transition-colors ${
              kind === tab.kind
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-900/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <TaxonomyList key={kind} kind={kind} noun={active.noun} />
    </div>
  );
}

function TaxonomyList({ kind, noun }: { kind: TaxonomyKind; noun: string }) {
  const { data, isPending, error, refetch } = useTaxonomy(kind);
  const { create, update } = useTaxonomyMutations(kind);
  const [newName, setNewName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [justChanged, setJustChanged] = useState<string | null>(null);

  const actionError = [create.error, update.error].find((e) => e instanceof ApiError) as
    | ApiError
    | undefined;

  const existingNames = new Set((data?.items ?? []).map((e) => e.name.trim().toLowerCase()));

  function submitAdd() {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setFieldError(`Enter a ${noun} name.`);
      return;
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setFieldError(`"${trimmed}" is already in the list.`);
      return;
    }
    setFieldError(null);
    create.mutate(trimmed, {
      onSuccess: () => {
        setNewName('');
        setJustChanged(`"${trimmed}" added.`);
      },
    });
  }

  function toggle(entry: TaxonomyEntry) {
    update.mutate(
      { id: entry.id, isActive: !entry.isActive },
      {
        onSuccess: () => {
          setJustChanged(entry.isActive ? `"${entry.name}" removed.` : `"${entry.name}" restored.`);
        },
      },
    );
    setConfirmingId(null);
  }

  return (
    <div className="space-y-4">
      {actionError && <Alert tone="error">{actionError.message}</Alert>}
      {justChanged && !actionError && <Alert tone="success">{justChanged}</Alert>}

      <Card className={ADMIN_CARD}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label={`Add a ${noun}`} htmlFor="new-entry" error={fieldError ?? undefined}>
              <Input
                id="new-entry"
                value={newName}
                invalid={Boolean(fieldError)}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setFieldError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitAdd();
                  }
                }}
                placeholder={kind === 'sectors' ? 'Marine and Offshore' : 'Technical Documentation'}
              />
            </Field>
          </div>
          <Button loading={create.isPending} onClick={submitAdd}>
            Add
          </Button>
        </div>
      </Card>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        <div className="space-y-2">
          {data?.items.map((entry) => (
            <Card key={entry.id} className={`!p-3 sm:!p-4 ${ADMIN_CARD}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{entry.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{entry.slug}</p>
                </div>
                <Badge tone={entry.isActive ? 'green' : 'slate'}>
                  {entry.isActive ? 'Offered' : 'Removed'}
                </Badge>

                {confirmingId === entry.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Existing profiles and postings keep showing it.
                    </span>
                    <Button variant="danger" className="px-3 text-xs" onClick={() => toggle(entry)}>
                      Confirm delete
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-3 text-xs"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant={entry.isActive ? 'secondary' : 'primary'}
                    className="px-3 text-xs"
                    onClick={() => (entry.isActive ? setConfirmingId(entry.id) : toggle(entry))}
                  >
                    {entry.isActive ? 'Delete' : 'Restore'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
