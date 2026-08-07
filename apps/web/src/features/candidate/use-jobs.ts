import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type BrowseJob = {
  id: string;
  title: string;
  department: string | null;
  sectorName: string | null;
  functionName: string | null;
  cityName: string | null;
  state: string | null;
  workType: string | null;
  minExperience: number | null;
  maxExperience: number | null;
  educationRequirement: string | null;
  description: string | null;
  requiredSkills: { id: number; name: string }[];
  goodToHaveSkills: { id: number; name: string }[];
  numberOfPositions: number;
  publishedAt: string | null;
  hasApplied: boolean;
};

export type TrackedApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  cityName: string | null;
  sectorName: string | null;
  /** null until shortlisted — the reveal is part of the product. */
  employerName: string | null;
  stage: string;
  stageLabel: string;
  isRecommended: boolean;
  appliedAt: string;
  lastStageChangeAt: string;
  timeline: { fromStage: string | null; toStage: string; byRole: string; note: string | null; at: string }[];
};

export type JobFilters = {
  sector?: string;
  function?: string;
  city?: string;
  search?: string;
};


export function useBrowseJobs(filters: JobFilters, page = 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  params.set('page', String(page));
  const qs = params.toString();

  return useQuery({
    queryKey: ['candidate', 'jobs', qs],
    queryFn: () => api.get<Page<BrowseJob>>(`/candidate/jobs?${qs}`),
    // Keeps the previous page on screen while the next loads, instead of
    // flashing an empty list.
    placeholderData: (prev) => prev,
  });
}

export function useJobDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['candidate', 'job', id],
    queryFn: () =>
      api.get<BrowseJob & { applicationId: string | null }>(`/candidate/jobs/${id}`),
    enabled: Boolean(id),
  });
}

export function useApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<{ applicationId: string; reopened: boolean }>(`/candidate/jobs/${jobId}/apply`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate'] }),
  });
}

export function useApplications(page = 1) {
  return useQuery({
    queryKey: ['candidate', 'applications', page],
    queryFn: () => api.get<Page<TrackedApplication>>(`/candidate/applications?page=${page}`),
    placeholderData: (prev) => prev,
  });
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api.post<void>(`/candidate/applications/${applicationId}/withdraw`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate'] }),
  });
}

export function useCompanyReveal(applicationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['candidate', 'company', applicationId],
    queryFn: () =>
      api.get<{
        companyName: string;
        sectorName: string | null;
        website: string | null;
        linkedinUrl: string | null;
        companyIntro: string | null;
      }>(`/candidate/applications/${applicationId}/company`),
    enabled: Boolean(applicationId) && enabled,
  });
}

// --- Interviews ------------------------------------------------------------

export type PartyInterview = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: 'PHONE' | 'VIDEO' | 'ONSITE';
  locationOrLink: string;
  instructions: string | null;
  status: string;
  youConfirmedAt: string | null;
  otherPartyConfirmed: boolean;
};

/**
 * Fetched per application rather than as one list: an interview is only ever
 * relevant next to the role it belongs to, and the candidate sees at most a
 * handful of applications at a time.
 */
export function useInterview(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['candidate', 'interview', applicationId],
    queryFn: () =>
      api.get<{ interview: PartyInterview | null }>(
        `/candidate/applications/${applicationId}/interview`,
      ),
    enabled,
  });
}

export function useConfirmInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api.post<{ interview: PartyInterview }>(
        `/candidate/applications/${applicationId}/interview/confirm`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate'] }),
  });
}

/**
 * Stepping back out of a role BK put them forward for.
 *
 * Separate from withdraw because the meaning differs: this one says "do not
 * share me with them", and the copy around it has to reflect that.
 */
export function useDeclineRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api.post<{ withdrawn: boolean }>(
        `/candidate/applications/${applicationId}/decline-recommendation`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate'] }),
  });
}
