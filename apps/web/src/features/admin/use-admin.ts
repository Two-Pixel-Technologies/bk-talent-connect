import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type PlatformStats = {
  candidates: { total: number; pending: number; approved: number };
  employers: { total: number; pending: number; approved: number };
  jobs: { total: number; pending: number; live: number };
  applications: { total: number; active: number };
  enquiries: { unhandled: number };
};

export type AdminCandidate = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  cityName: string | null;
  state: string | null;
  currentJobTitle: string | null;
  currentEmployer: string | null;
  yearsOfExperience: number | null;
  sectorName: string | null;
  /** The candidate's own typed text when sectorName resolved to the taxonomy's "Other" row. */
  sectorOther: string | null;
  functionName: string | null;
  educationLevel: string | null;
  /** The candidate's own typed text when educationLevel is 'OTHER'. */
  educationLevelOther: string | null;
  qualification: string | null;
  careerSummary: string | null;
  noticePeriod: string | null;
  skills: { id: number; name: string }[];
  experiences: {
    id: string;
    company: string;
    title: string;
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
    keyAchievement: string | null;
  }[];
  hasResume: boolean;
  resumeFileId: string | null;
  resumeFileName: string | null;
  currentSalaryLpa: number | null;
  expectedSalaryMinLpa: number | null;
  expectedSalaryMaxLpa: number | null;
  profileStatus: string;
  submittedAt: string | null;
  reviewNote: string | null;
  completionPercent: number;
  userStatus: string;
  userId: string;
  consentedAt: string | null;
};

export type AdminEmployer = {
  id: string;
  companyName: string;
  email: string;
  sectorName: string | null;
  locations: string[];
  website: string | null;
  linkedinUrl: string | null;
  hrContactName: string;
  hrContactPhone: string;
  companyIntro: string | null;
  accountStatus: string;
  reviewNote: string | null;
  userStatus: string;
  userId: string;
  jobCount: number;
};

export type AdminJob = {
  id: string;
  title: string;
  department: string | null;
  employerName: string;
  employerProfileId: string;
  numberOfPositions: number;
  sectorName: string | null;
  functionName: string | null;
  cityName: string | null;
  state: string | null;
  additionalLocations: { citySlug: string | null; cityName: string | null; state: string }[];
  workType: string | null;
  minExperience: number | null;
  maxExperience: number | null;
  educationRequirement: string | null;
  description: string | null;
  requiredSkills: { id: number; name: string }[];
  goodToHaveSkills: { id: number; name: string }[];
  salaryBandMinLpa: number | null;
  salaryBandMaxLpa: number | null;
  status: string;
  publishedAt: string | null;
  reviewNote: string | null;
  contactFlags: { kind: string; value: string }[];
};

export type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export type ReviewPayload = {
  decision: ReviewDecision;
  note?: string;
  /** The status shown on screen — the optimistic-concurrency token. */
  expectedStatus: string;
};

export function useStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<PlatformStats>('/admin/stats'),
    refetchInterval: 60_000,
  });
}

function queueQuery(path: string, status: string, search: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  return `${path}?${params.toString()}`;
}

export function useCandidateQueue(status: string, search: string, page = 1) {
  return useQuery({
    queryKey: ['admin', 'candidates', status, search, page],
    queryFn: () => api.get<Page<AdminCandidate>>(queueQuery('/admin/candidates', status, search, page)),
    placeholderData: (prev) => prev,
  });
}

export function useEmployerQueue(status: string, search: string, page = 1) {
  return useQuery({
    queryKey: ['admin', 'employers', status, search, page],
    queryFn: () => api.get<Page<AdminEmployer>>(queueQuery('/admin/employers', status, search, page)),
    placeholderData: (prev) => prev,
  });
}

export function useJobQueue(status: string, search: string, page = 1) {
  return useQuery({
    queryKey: ['admin', 'jobs', status, search, page],
    queryFn: () => api.get<Page<AdminJob>>(queueQuery('/admin/jobs', status, search, page)),
    placeholderData: (prev) => prev,
  });
}

/**
 * One record, fetched directly by id.
 *
 * Needed because a notification deep link (`?focus=<id>`) points at a record
 * whose position in the queue is unknown — and the queue pages resolved the
 * selection by searching the twenty rows of the current page. With 227
 * candidates in the system that found nothing, so the bell's most important
 * links landed on "Select a record to review it."
 *
 * These fetch only when the id is not already on the page, so the normal
 * click-through path costs nothing extra.
 */
export function useCandidateDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'candidate', id],
    queryFn: () =>
      api.get<{ candidate: AdminCandidate; userId: string; history: { action: string; createdAt: string }[] }>(
        `/admin/candidates/${id}`,
      ),
    enabled: Boolean(id),
  });
}

export function useEmployerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'employer', id],
    queryFn: () => api.get<{ employer: AdminEmployer; userId: string }>(`/admin/employers/${id}`),
    enabled: Boolean(id),
  });
}

export function useJobDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'job', id],
    queryFn: () => api.get<AdminJob>(`/admin/jobs/${id}`),
    enabled: Boolean(id),
  });
}

/** Everything the queues show is invalidated after a decision, including stats. */
function useReview(kind: 'candidates' | 'employers' | 'jobs') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ReviewPayload & { id: string }) =>
      api.post<void>(`/admin/${kind}/${id}/review`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const useReviewCandidate = () => useReview('candidates');
export const useReviewEmployer = () => useReview('employers');
export const useReviewJob = () => useReview('jobs');

export function useSalaryComparison(candidateId: string | undefined, jobId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'salary', candidateId, jobId],
    queryFn: () =>
      api.get<{
        candidateCurrentLpa: number | null;
        candidateExpectedMinLpa: number | null;
        candidateExpectedMaxLpa: number | null;
        jobBandMinLpa: number | null;
        jobBandMaxLpa: number | null;
        fit: 'WITHIN' | 'ABOVE' | 'BELOW' | 'UNKNOWN';
        gapLpa: number | null;
      }>(`/admin/salary-comparison?candidateId=${candidateId}&jobId=${jobId}`),
    enabled: Boolean(candidateId && jobId),
  });
}

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting review',
  PENDING_APPROVAL: 'Awaiting review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
  FILLED: 'Filled',
};

export const REVIEW_STATUS_TONE: Record<string, string> = {
  DRAFT: 'slate',
  SUBMITTED: 'amber',
  PENDING_APPROVAL: 'amber',
  APPROVED: 'green',
  CHANGES_REQUESTED: 'amber',
  REJECTED: 'red',
  CLOSED: 'slate',
  FILLED: 'brand',
};
