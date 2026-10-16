import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InterviewMode, NoteEntityType, Page } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type AdminInterview = {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  locationOrLink: string;
  instructions: string | null;
  status: string;
  candidateConfirmedAt: string | null;
  employerConfirmedAt: string | null;
  supersededById: string | null;
  createdAt: string;
  candidateName?: string;
};

/**
 * Read-only: Admin can see an application's interview history (folded into
 * the Pipeline page) but cannot schedule, cancel or complete one — that
 * authority moved entirely to Candidate/Employer. See
 * admin-coordination.routes.ts's file comment for the product decision.
 */
export function useApplicationInterviews(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'application-interviews', applicationId],
    queryFn: () => api.get<{ items: AdminInterview[] }>(`/admin/applications/${applicationId}/interviews`),
    enabled,
  });
}

// --- Recommendations -------------------------------------------------------

export type RecommendableCandidate = {
  id: string;
  fullName: string;
  currentJobTitle: string | null;
  yearsOfExperience: number | null;
  cityName: string | null;
  sectorName: string | null;
  functionName: string | null;
  skills: { id: number; name: string }[];
  matchingSkills: number;
  hasResume: boolean;
};

export function useCandidateSearch(jobId: string, search: string, page: number, enabled: boolean) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);

  return useQuery({
    queryKey: ['admin', 'candidate-search', jobId, search, page],
    queryFn: () =>
      api.get<Page<RecommendableCandidate>>(
        `/admin/jobs/${jobId}/candidate-search?${params.toString()}`,
      ),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useRecommend(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (candidateProfileId: string) =>
      api.post<{ applicationId: string; alreadyExisted: boolean }>(
        `/admin/jobs/${jobId}/recommend`,
        { candidateProfileId },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

// --- Private notes ---------------------------------------------------------

export type AdminNote = {
  id: string;
  body: string;
  authorEmail: string;
  authorId: string;
  createdAt: string;
};

export function useNotes(entityType: NoteEntityType, entityId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'notes', entityType, entityId],
    queryFn: () =>
      api.get<{ items: AdminNote[] }>(
        `/admin/notes?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
      ),
    enabled,
  });
}

export function useAddNote(entityType: NoteEntityType, entityId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<AdminNote>('/admin/notes', { entityType, entityId, body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'notes', entityType, entityId] });
    },
  });
}

export function useDeleteNote(entityType: NoteEntityType, entityId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/notes/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'notes', entityType, entityId] });
    },
  });
}

// --- Skills, taxonomy, enquiries ------------------------------------------

export type AdminSkill = {
  id: number;
  name: string;
  slug: string;
  isApproved: boolean;
  candidateCount: number;
  jobCount: number;
};

export function useSkills(approved: boolean | undefined, search: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (approved !== undefined) params.set('approved', String(approved));
  if (search) params.set('search', search);

  return useQuery({
    queryKey: ['admin', 'skills', approved, search, page],
    queryFn: () => api.get<Page<AdminSkill>>(`/admin/skills?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useSkillAction() {
  const client = useQueryClient();
  /*
   * Two roots, deliberately.
   *
   * The admin list lives under ['admin','skills']; the autocomplete that
   * candidates and employers type into lives under ['skills', query] with a
   * five-minute staleTime. Invalidating only the admin root meant a merged or
   * rejected skill carried on being suggested from cache — and the taxonomy
   * screen's own promise that changes are "immediate, no deploy" was untrue
   * for up to half an hour.
   */
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['admin', 'skills'] });
    void client.invalidateQueries({ queryKey: ['skills'] });
  };

  return {
    approve: useMutation({
      mutationFn: (id: number) => api.post<void>(`/admin/skills/${id}/approve`),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: (id: number) => api.post<void>(`/admin/skills/${id}/reject`),
      onSuccess: invalidate,
    }),
    rename: useMutation({
      mutationFn: (input: { id: number; name: string }) =>
        api.patch<void>(`/admin/skills/${input.id}`, { name: input.name }),
      onSuccess: invalidate,
    }),
    merge: useMutation({
      mutationFn: (input: { sourceId: number; targetId: number }) =>
        api.post<{ movedCandidates: number; movedJobs: number }>('/admin/skills/merge', input),
      onSuccess: invalidate,
    }),
  };
}

export type TaxonomyEntry = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

/** 'sectors' and 'functions' are the route names the API accepts. */
export type TaxonomyKind = 'sectors' | 'functions';

export function useTaxonomy(kind: TaxonomyKind) {
  return useQuery({
    queryKey: ['admin', 'taxonomy', kind],
    queryFn: () => api.get<{ items: TaxonomyEntry[] }>(`/admin/taxonomy/${kind}`),
  });
}

export function useTaxonomyMutations(kind: TaxonomyKind) {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['admin', 'taxonomy', kind] });
    // The sector/function dropdowns on the candidate and job forms.
    void client.invalidateQueries({ queryKey: ['taxonomy'] });
  };

  return {
    create: useMutation({
      mutationFn: (name: string) => api.post<TaxonomyEntry>(`/admin/taxonomy/${kind}`, { name }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: { id: number; name?: string; isActive?: boolean }) => {
        const { id, ...patch } = input;
        return api.patch<void>(`/admin/taxonomy/${kind}/${id}`, patch);
      },
      onSuccess: invalidate,
    }),
  };
}

export type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  handledAt: string | null;
  createdAt: string;
};

export function useEnquiries(handled: boolean | undefined, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (handled !== undefined) params.set('handled', String(handled));

  return useQuery({
    queryKey: ['admin', 'enquiries', handled, page],
    queryFn: () => api.get<Page<Enquiry>>(`/admin/enquiries?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useMarkEnquiryHandled() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; handled: boolean }) =>
      api.post<void>(`/admin/enquiries/${input.id}/handled`, { handled: input.handled }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'enquiries'] });
    },
  });
}
