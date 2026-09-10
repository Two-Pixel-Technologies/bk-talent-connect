/**
 * Sector and function admin.
 *
 * These two lists are the hard filters Phase 2 matches on, and the proposal
 * conflated them into one field — a QC chemist at a pharma plant had to choose
 * between "Pharmaceuticals" and "Lab" and lose the other. They are separate
 * here, and editable, so BK can extend the taxonomy without a deploy.
 *
 * Entries are deactivated rather than deleted: candidates and postings already
 * reference them, and a hard delete would break the foreign key.
 */

import { useState } from 'react';
import { ApiError } from '../../lib/api-client.js';
import {
  useTaxonomy,
  useTaxonomyMutations,
  type TaxonomyKind,
} from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, Field, Input } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';

const TABS: { kind: TaxonomyKind; label: string; blurb: string }[] = [
  {
    kind: 'sectors',
    label: 'Sectors',
    blurb: 'The industry a company or a candidate works in — pharma, auto components, EPC.',
  },
  {
    kind: 'functions',
    label: 'Functions',
    blurb: 'The department the work sits in — maintenance, QA/QC, design and drafting.',
  },
];

export function TaxonomyPage() {
  const [kind, setKind] = useState<TaxonomyKind>('sectors');
  const active = TABS.find((t) => t.kind === kind)!;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Taxonomy</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Sectors &amp; functions</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Both lists appear on candidate profiles and job postings. Adding to them here is
          immediate — no deploy.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setKind(tab.kind)}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${
              kind === tab.kind ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">{active.blurb}</p>

      <TaxonomyList kind={kind} />
    </div>
  );
}

function TaxonomyList({ kind }: { kind: TaxonomyKind }) {
  const { data, isPending, error, refetch } = useTaxonomy(kind);
  const { create, update } = useTaxonomyMutations(kind);
  const [newName, setNewName] = useState('');

  const actionError = [create.error, update.error].find((e) => e instanceof ApiError) as
    | ApiError
    | undefined;

  return (
    <div className="space-y-4">
      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Add one" htmlFor="new-entry">
              <Input
                id="new-entry"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={kind === 'sectors' ? 'Marine & Offshore' : 'Technical Documentation'}
              />
            </Field>
          </div>
          <Button
            loading={create.isPending}
            disabled={newName.trim().length < 2}
            onClick={() =>
              create.mutate(newName.trim(), { onSuccess: () => setNewName('') })
            }
          >
            Add
          </Button>
        </div>
      </Card>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        <div className="space-y-2">
          {data?.items.map((entry) => (
            <Card key={entry.id} className="!p-3 sm:!p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{entry.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{entry.slug}</p>
                </div>
                <Badge tone={entry.isActive ? 'green' : 'slate'}>
                  {entry.isActive ? 'Offered' : 'Hidden'}
                </Badge>
                <Button
                  variant="secondary"
                  className="px-3 text-xs"
                  onClick={() => update.mutate({ id: entry.id, isActive: !entry.isActive })}
                >
                  {entry.isActive ? 'Stop offering' : 'Offer again'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
