/**
 * Skills admin.
 *
 * Candidates and employers both type free text here, so the vocabulary drifts
 * on its own: "PLC", "PLC Programming", "P.L.C." are three rows the moment
 * three people type them. Phase 2 scores skills for 35 of its 100 matching
 * points, so every duplicate is a direct hit on match quality — and merging is
 * only possible while somebody can see the duplicates.
 */

import { useState } from 'react';
import { ApiError } from '../../lib/api-client.js';
import { useSkills, useSkillAction, type AdminSkill } from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { useDebounced } from '../../lib/use-debounced.js';
import { Modal } from '../../components/modal.js';

const FILTERS = [
  { value: 'false', label: 'Needs a decision' },
  { value: 'true', label: 'Approved' },
  { value: '', label: 'Everything' },
] as const;

export function SkillsPage() {
  const [filter, setFilter] = useState<string>('false');
  const [search, setSearch] = useState('');
  // Only the value that reaches the query is delayed; the input stays instant.
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [mergeSource, setMergeSource] = useState<AdminSkill | null>(null);

  const approved = filter === '' ? undefined : filter === 'true';
  const { data, isPending, error, refetch } = useSkills(approved, debouncedSearch, page);
  const actions = useSkillAction();

  const actionError = [actions.approve.error, actions.reject.error, actions.rename.error, actions.merge.error]
    .find((e) => e instanceof ApiError) as ApiError | undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Skills</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Skills</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Anything a candidate or employer typed that we have not seen before waits here. Fold
          duplicates into the name you want to keep.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => {
                setPage(1);
                setFilter(f.value);
              }}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto sm:w-64">
          <Field label="Search" htmlFor="skill-search">
            <Input
              id="skill-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="PLC, HAZOP…"
            />
          </Field>
        </div>
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            description="New skills appear here as people type them into profiles and postings."
          />
        ) : (
          <div className="space-y-2">
            {data?.items.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onApprove={() => actions.approve.mutate(skill.id)}
                onReject={() => actions.reject.mutate(skill.id)}
                onRename={(name) => actions.rename.mutate({ id: skill.id, name })}
                onMergeFrom={() => setMergeSource(skill)}
              />
            ))}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} noun="skill" />
      )}

      {mergeSource && (
        <MergeDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onMerge={(targetId) =>
            actions.merge.mutate(
              { sourceId: mergeSource.id, targetId },
              { onSuccess: () => setMergeSource(null) },
            )
          }
          isPending={actions.merge.isPending}
        />
      )}
    </div>
  );
}

function SkillRow({
  skill,
  onApprove,
  onReject,
  onRename,
  onMergeFrom,
}: {
  skill: AdminSkill;
  onApprove: () => void;
  onReject: () => void;
  onRename: (name: string) => void;
  onMergeFrom: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(skill.name);

  const inUse = skill.candidateCount + skill.jobCount;

  return (
    <Card className="!p-3 sm:!p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Skill name" />
              <Button
                className="px-3 text-xs"
                onClick={() => {
                  onRename(name.trim());
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                className="px-3 text-xs"
                onClick={() => {
                  setName(skill.name);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <p className="font-medium text-slate-900">{skill.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {skill.candidateCount} candidate{skill.candidateCount === 1 ? '' : 's'} ·{' '}
                {skill.jobCount} posting{skill.jobCount === 1 ? '' : 's'}
                <span className="ml-2 font-mono text-slate-400">{skill.slug}</span>
              </p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={skill.isApproved ? 'green' : 'amber'}>
              {skill.isApproved ? 'Approved' : 'New'}
            </Badge>
            {!skill.isApproved && (
              <Button className="px-3 text-xs" onClick={onApprove}>
                Approve
              </Button>
            )}
            {skill.isApproved && (
              <Button variant="secondary" className="px-3 text-xs" onClick={onReject}>
                Unapprove
              </Button>
            )}
            <Button variant="ghost" className="px-3 text-xs" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button
              variant="ghost"
              className="px-3 text-xs"
              onClick={onMergeFrom}
              title={inUse > 0 ? `${inUse} records will move` : undefined}
            >
              Merge
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Merging asks for the target by name and resolves it against the live list,
 * so an admin cannot merge into an id they typed by hand.
 */
function MergeDialog({
  source,
  onClose,
  onMerge,
  isPending,
}: {
  source: AdminSkill;
  onClose: () => void;
  onMerge: (targetId: number) => void;
  isPending: boolean;
}) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string>('');
  const { data } = useSkills(undefined, search, 1);

  const candidates = (data?.items ?? []).filter((s) => s.id !== source.id);
  const moving = source.candidateCount + source.jobCount;

  return (
    <Modal label={`Merge ${source.name} into another skill`} onClose={onClose}>
        <h2 className="text-lg font-bold text-brand-900">Merge “{source.name}”</h2>
        <p className="mt-1 text-sm text-slate-600">
          Every candidate and posting using it moves to the skill you pick, and “{source.name}”
          stops being offered. This cannot be undone from here.
        </p>

        {moving > 0 && (
          <div className="mt-3">
            <Alert tone="warning">
              {moving} record{moving === 1 ? '' : 's'} will move.
            </Alert>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <Field label="Find the skill to keep" htmlFor="merge-search">
            <Input
              id="merge-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a few letters…"
            />
          </Field>

          <Field label="Keep this one" htmlFor="merge-target">
            <Select id="merge-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button loading={isPending} disabled={!targetId} onClick={() => onMerge(Number(targetId))}>
            Merge them
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
    </Modal>
  );
}
