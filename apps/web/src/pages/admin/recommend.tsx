/**
 * Putting a candidate forward for a role they never applied to.
 *
 * This is the single feature that makes BK Talent Connect a managed service
 * rather than a job board, and it is also the most sensitive thing in the
 * product: it shares a person's profile and CV with a company they did not
 * choose. The server refuses without the consent captured at registration; the
 * screen says so plainly rather than surfacing a bare 403.
 *
 * Candidates are ranked by how many of the posting's required skills they
 * actually have — the admin is doing by hand what Phase 2 will score.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api-client.js';
import {
  useCandidateSearch,
  useRecommend,
  type RecommendableCandidate,
} from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Input } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { useDebounced } from '../../lib/use-debounced.js';
import { ADMIN_CARD } from './admin-style.js';

type AdminJob = {
  id: string;
  title: string;
  employerName: string;
  status: string;
  requiredSkills: { id: number; name: string }[];
  cityName: string | null;
  sectorName: string | null;
  functionName: string | null;
  minExperience: number | null;
  maxExperience: number | null;
};

export function RecommendPage() {
  const { id = '' } = useParams();
  const [search, setSearch] = useState('');
  // Only the value that reaches the query is delayed; the input stays instant.
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState<Record<string, string>>({});

  const job = useQuery({
    queryKey: ['admin', 'job', id],
    queryFn: () => api.get<AdminJob>(`/admin/jobs/${id}`),
  });

  const results = useCandidateSearch(id, debouncedSearch, page, job.isSuccess);
  const recommend = useRecommend(id);
  const error = recommend.error instanceof ApiError ? recommend.error : null;

  const live = job.data?.status === 'APPROVED';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/jobs" className="text-sm text-brand-700 hover:underline">
          ← Back to postings
        </Link>
        <p className="mt-3 text-xs font-semibold tracking-widest text-pub-blue uppercase">
          Recommendations
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">
          Who should we put forward?
        </h1>
        {job.data && (
          <p className="mt-1 text-sm text-slate-600">
            {job.data.title} · {job.data.employerName}
            {job.data.cityName && ` · ${job.data.cityName}`}
          </p>
        )}
      </div>

      {job.isSuccess && !live && (
        <Alert tone="warning" title="This posting is not live">
          Approve it before putting anyone forward — a candidate should not be recommended for a
          role that no employer can act on.
        </Alert>
      )}

      {job.data && job.data.requiredSkills.length > 0 && (
        <Card className={ADMIN_CARD}>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Ranked against these skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.data.requiredSkills.map((skill) => (
              <Badge key={skill.id} tone="brand">
                {skill.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="sm:max-w-sm">
        <Field label="Search by name or job title" htmlFor="candidate-search">
          <Input
            id="candidate-search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Anita, maintenance engineer…"
          />
        </Field>
      </div>

      <QueryState
        isPending={results.isPending}
        error={results.error}
        onRetry={() => void results.refetch()}
      >
        {results.data && results.data.items.length === 0 ? (
          <EmptyState
            title="No approved candidates match"
            description="Only approved candidates who consented to being put forward appear here."
          />
        ) : (
          <div className="space-y-3">
            {results.data?.items.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                requiredCount={job.data?.requiredSkills.length ?? 0}
                disabled={!live}
                state={done[candidate.id]}
                isPending={recommend.isPending}
                onRecommend={() =>
                  recommend.mutate(candidate.id, {
                    onSuccess: (result) =>
                      setDone((d) => ({
                        ...d,
                        [candidate.id]: result.alreadyExisted ? 'Already in this pipeline' : 'Put forward',
                      })),
                  })
                }
              />
            ))}
          </div>
        )}
      </QueryState>

      {results.data && (
        <Pagination
          page={page}
          pageSize={results.data.pageSize}
          total={results.data.total}
          onChange={setPage}
          noun="candidate"
        />
      )}
    </div>
  );
}

function CandidateCard({
  candidate: c,
  requiredCount,
  disabled,
  state,
  isPending,
  onRecommend,
}: {
  candidate: RecommendableCandidate;
  requiredCount: number;
  disabled: boolean;
  state: string | undefined;
  isPending: boolean;
  onRecommend: () => void;
}) {
  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-brand-900">{c.fullName}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {[c.currentJobTitle, c.cityName].filter(Boolean).join(' · ') || 'No current role listed'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[
              c.yearsOfExperience !== null ? `${c.yearsOfExperience} yrs` : null,
              c.sectorName,
              c.functionName,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {requiredCount > 0 && (
          <Badge tone={c.matchingSkills > 0 ? 'green' : 'slate'}>
            {c.matchingSkills} of {requiredCount} skills
          </Badge>
        )}
      </div>

      {c.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.skills.slice(0, 12).map((skill) => (
            <span key={skill.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
              {skill.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        {!c.hasResume && <span className="text-xs text-amber-700">No CV uploaded yet</span>}
        {state ? (
          <Badge tone="green">{state}</Badge>
        ) : (
          <Button
            className="ml-auto px-3 text-xs"
            disabled={disabled}
            loading={isPending}
            onClick={onRecommend}
          >
            Put them forward
          </Button>
        )}
      </div>
    </Card>
  );
}
