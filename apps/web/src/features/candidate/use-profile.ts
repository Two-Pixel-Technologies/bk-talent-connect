import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProfileInput } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type SkillView = { id: number; name: string };

export type ExperienceView = {
  id: string;
  company: string;
  title: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  domainTags: string[];
  keyAchievement: string | null;
};

export type CandidateProfile = {
  id: string;
  fullName: string;
  mobile: string;
  citySlug: string | null;
  cityName: string | null;
  state: string | null;
  openToRelocation: boolean;
  currentJobTitle: string | null;
  currentEmployer: string | null;
  yearsOfExperience: number | null;
  sectorSlug: string | null;
  sectorName: string | null;
  functionSlug: string | null;
  functionName: string | null;
  educationLevel: string | null;
  qualification: string | null;
  qualificationYear: number | null;
  careerSummary: string | null;
  noticePeriod: string | null;
  employmentPreference: string | null;
  currentSalaryLpa: number | null;
  expectedSalaryMinLpa: number | null;
  expectedSalaryMaxLpa: number | null;
  linkedinUrl: string | null;
  skills: SkillView[];
  experiences: ExperienceView[];
  hasResume: boolean;
  profileStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  completionPercent: number;
};

export type Taxonomy = {
  sectors: { slug: string; name: string }[];
  functions: { slug: string; name: string }[];
  /** state is null for "Other", which is offered in every state. */
  cities: { slug: string; name: string; state: string | null }[];
  /** Derived server-side from the cities, so the two lists cannot disagree. */
  states: string[];
};

type UpdateResponse = {
  profile: CandidateProfile;
  requiresReapproval: boolean;
  materialChanges: string[];
};

export function useProfile() {
  return useQuery({
    queryKey: ['candidate', 'profile'],
    queryFn: () => api.get<CandidateProfile>('/candidate/profile'),
  });
}

export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => api.get<Taxonomy>('/taxonomy'),
    // Lookup tables change when an admin edits them, which is rare.
    staleTime: 30 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api.patch<UpdateResponse>('/candidate/profile', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['candidate', 'profile'], data.profile);
      // The approval gate may have moved, and the portal shell reads it.
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useSubmitProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CandidateProfile>('/candidate/profile/submit'),
    onSuccess: (profile) => {
      queryClient.setQueryData(['candidate', 'profile'], profile);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      return api.upload<CandidateProfile>('/candidate/resume', formData);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['candidate', 'profile'], profile);
    },
  });
}

export function useSkillSearch(query: string) {
  return useQuery({
    queryKey: ['skills', query],
    queryFn: () => api.get<{ skills: SkillView[] }>(`/skills?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
