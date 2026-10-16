import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePrototype } from '../PrototypeContext.js';
import { mockJobs } from '../mock-data.js';
import { PrimaryButton, SectionCard } from '../components/ui.js';
import { SuccessCheckArt } from '../components/illustrations.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { applications, applyToJob } = usePrototype();
  const [applying, setApplying] = useState(false);

  const job = mockJobs.find((j) => j.id === id);
  const existingApplication = applications.find((a) => a.job.id === id);

  if (!job) {
    return (
      <SectionCard>
        <p className="text-sm text-pub-muted">This role is no longer available.</p>
        <Link to="/prototype/candidate/jobs" className="mt-3 inline-block text-sm font-semibold text-pub-blue hover:underline">
          ← Back to jobs
        </Link>
      </SectionCard>
    );
  }

  function handleApply() {
    setApplying(true);
    // Prototype-only: simulate network latency, then commit the local mock state.
    setTimeout(() => {
      applyToJob(job!.id);
      setApplying(false);
    }, 700);
  }

  return (
    <div className="space-y-6">
      <Link to="/prototype/candidate/jobs" className="inline-flex items-center gap-1 text-sm font-semibold text-pub-blue hover:underline">
        ← Back to jobs
      </Link>

      <section className="relative overflow-hidden rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/30 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{job.sectorName}</p>
            <h1 className="mt-1 font-heading text-2xl font-bold text-pub-navy sm:text-3xl">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pub-muted">
              <span className="inline-flex items-center gap-1.5">
                <PUBLIC_ICONS.briefcase className="size-4" />
                {job.functionName}
              </span>
              <span>
                {job.cityName}, {job.state}
              </span>
              <span>
                {job.minExperience}–{job.maxExperience} yrs
              </span>
              <span>{job.numberOfPositions} openings</span>
            </div>
          </div>
          <div className="shrink-0">
            {existingApplication ? (
              <Link
                to={`/prototype/candidate/applications/${existingApplication.id}`}
                className="flex min-h-11 items-center justify-center rounded-lg border border-pub-border bg-white px-5 text-sm font-semibold text-pub-navy hover:bg-pub-bg"
              >
                Track application →
              </Link>
            ) : (
              <PrimaryButton onClick={handleApply} loading={applying} className="min-h-11 px-6">
                {applying ? 'Applying…' : 'Apply now'}
              </PrimaryButton>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <SectionCard title="About the role">
          <p className="text-sm leading-relaxed text-pub-text">{job.description}</p>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Required skills">
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map((s) => (
                <span key={s} className="rounded-full bg-pub-blue-light px-2.5 py-1 text-xs font-medium text-pub-blue">
                  {s}
                </span>
              ))}
            </div>
            {job.goodToHaveSkills.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-pub-muted">Good to have</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.goodToHaveSkills.map((s) => (
                    <span key={s} className="rounded-full border border-pub-border px-2.5 py-1 text-xs font-medium text-pub-muted">
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Role details">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-pub-muted">Work type</dt>
                <dd className="font-medium text-pub-navy">{job.workType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-pub-muted">Education</dt>
                <dd className="text-right font-medium text-pub-navy">{job.educationRequirement}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-pub-muted">Department</dt>
                <dd className="font-medium text-pub-navy">{job.department}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-pub-muted">Posted</dt>
                <dd className="font-medium text-pub-navy">{job.publishedAt}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      {existingApplication && (
        <SectionCard className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <SuccessCheckArt className="size-14 shrink-0" />
          <div className="flex-1">
            <p className="font-heading text-sm font-bold text-pub-navy">You've already applied to this role</p>
            <p className="mt-1 text-xs text-pub-muted">Track its progress from your applications list.</p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
