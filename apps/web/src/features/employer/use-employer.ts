import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateEmployerProfileInput, UpdateJobInput, Page } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type EmployerProfile = {
  id: string;
  companyName: string;
  sectorSlug: string | null;
  sectorName: string | null;
  locations: string[];
  website: string | null;
  linkedinUrl: string | null;
  hrContactName: string;
  hrContactEmail: string;
  hrContactPhone: string;
  companyIntro: string | null;
  accountStatus: string;
  reviewNote: string | null;
};

export type JobSkill = { id: number; name: string };

export type EmployerJob = {
  id: string;
  title: string;
  department: string | null;
  numberOfPositions: number;
  sectorSlug: string | null;
  sectorName: string | null;
  functionSlug: string | null;
  functionName: string | null;
  citySlug: string | null;
  cityName: string | null;
  state: string | null;
  workType: string | null;
  minExperience: number | null;
  maxExperience: number | null;
  educationRequirement: string | null;
  description: string | null;
  targetJoiningDate: string | null;
  requiredSkills: JobSkill[];
  goodToHaveSkills: JobSkill[];
  salaryBandMinLpa: number | null;
  salaryBandMaxLpa: number | null;
  status: string;
  publishedAt: string | null;
  reviewNote: string | null;
  closedAt: string | null;
  updatedAt: string;
};

type JobListResponse = Page<EmployerJob> & { counts: Record<string, number> };

type UpdateJobResponse = {
  job: EmployerJob;
  requiresReapproval: boolean;
  materialChanges: string[];
  unpublished: boolean;
};

export function useEmployerProfile() {
  return useQuery({
    queryKey: ['employer', 'profile'],
    queryFn: () => api.get<EmployerProfile>('/employer/profile'),
  });
}

type UpdateProfileResponse = {
  profile: EmployerProfile;
  requiresReapproval: boolean;
  materialChanges: string[];
};

export function useUpdateEmployerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployerProfileInput) =>
      api.patch<UpdateProfileResponse>('/employer/profile', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['employer', 'profile'], data.profile);
      /*
       * The session's approval status changes with this call.
       *
       * A material edit sends a verified company back to SUBMITTED, but
       * ['auth','me'] was left cached — so the nav kept offering "+ New
       * posting" to an account that would now be refused, and the employer got
       * a 403 for a button the app was still showing them. Both sibling hooks
       * already invalidated it; this one did not.
       */
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useSubmitEmployerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EmployerProfile>('/employer/profile/submit'),
    onSuccess: (profile) => {
      queryClient.setQueryData(['employer', 'profile'], profile);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useEmployerJobs(status?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['employer', 'jobs', status ?? 'all', page],
    queryFn: () => api.get<JobListResponse>(`/employer/jobs?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

/** How many applicants a close would auto-reject, for the confirmation. */
export function useCloseImpact(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['employer', 'close-impact', jobId],
    queryFn: () => api.get<{ affectedApplicants: number }>(`/employer/jobs/${jobId}/close-impact`),
    enabled,
  });
}

export function useEmployerJob(id: string | undefined) {
  return useQuery({
    queryKey: ['employer', 'job', id],
    queryFn: () => api.get<EmployerJob>(`/employer/jobs/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api.post<EmployerJob>('/employer/jobs', { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer', 'jobs'] }),
  });
}

export function useUpdateJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJobInput) => api.patch<UpdateJobResponse>(`/employer/jobs/${id}`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['employer', 'job', id], data.job);
      void queryClient.invalidateQueries({ queryKey: ['employer', 'jobs'] });
    },
  });
}

type JobActionResponse = EmployerJob | { job: EmployerJob; closedApplications?: number; restoredApplications?: number };

function useJobAction(id: string, action: 'submit' | 'close' | 'reopen') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<JobActionResponse>(`/employer/jobs/${id}/${action}`),
    onSuccess: (result) => {
      const job = 'job' in result ? result.job : result;
      queryClient.setQueryData(['employer', 'job', id], job);
      void queryClient.invalidateQueries({ queryKey: ['employer'] });
    },
  });
}

export const useSubmitJob = (id: string) => useJobAction(id, 'submit');
export const useCloseJob = (id: string) => useJobAction(id, 'close');
export const useReopenJob = (id: string) => useJobAction(id, 'reopen');

export const JOB_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Under review',
  APPROVED: 'Live',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Not approved',
  CLOSED: 'Closed',
  FILLED: 'Filled',
};

export const JOB_STATUS_TONE: Record<string, string> = {
  DRAFT: 'slate',
  PENDING_APPROVAL: 'amber',
  APPROVED: 'green',
  CHANGES_REQUESTED: 'amber',
  REJECTED: 'red',
  CLOSED: 'slate',
  FILLED: 'brand',
};

// --- Interviews ------------------------------------------------------------

export type EmployerInterview = {
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

export function useEmployerInterview(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['employer', 'interview', applicationId],
    queryFn: () =>
      api.get<{ interview: EmployerInterview | null; hasOpenRequest: boolean }>(
        `/employer/applications/${applicationId}/interview`,
      ),
    enabled,
  });
}

/**
 * Asking BK to arrange a meeting.
 *
 * Deliberately a request, not a booking: the employer never gets the
 * candidate's calendar or contact details, and BK confirms with both sides.
 */
export function useRequestInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicationId: string; preferredSlots: string[]; note?: string }) =>
      api.post<{ requestId: string; status: string }>(
        `/employer/applications/${input.applicationId}/request-interview`,
        { preferredSlots: input.preferredSlots, ...(input.note ? { note: input.note } : {}) },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer'] }),
  });
}

export function useConfirmEmployerInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api.post<{ interview: EmployerInterview }>(
        `/employer/applications/${applicationId}/interview/confirm`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer'] }),
  });
}
