import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePrototype } from '../PrototypeContext.js';
import { StageChip, PrimaryButton, SecondaryButton, SectionCard } from '../components/ui.js';
import { StageStepper, StageHistory } from '../components/Timeline.js';
import { InterviewArt } from '../components/illustrations.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { applications, withdrawApplication, confirmInterview } = usePrototype();
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const application = applications.find((a) => a.id === id);

  if (!application) {
    return (
      <SectionCard>
        <p className="text-sm text-pub-muted">This application could not be found.</p>
        <Link to="/prototype/candidate/applications" className="mt-3 inline-block text-sm font-semibold text-pub-blue hover:underline">
          ← Back to applications
        </Link>
      </SectionCard>
    );
  }

  const canWithdraw = !['WITHDRAWN', 'NOT_SELECTED', 'OFFER_DECLINED', 'JOINED'].includes(application.stage);

  function handleWithdraw() {
    setWithdrawing(true);
    setTimeout(() => {
      withdrawApplication(application!.id);
      setWithdrawing(false);
    }, 500);
  }

  function handleConfirm() {
    setConfirming(true);
    setTimeout(() => {
      confirmInterview(application!.id);
      setConfirming(false);
    }, 500);
  }

  return (
    <div className="space-y-6">
      <Link to="/prototype/candidate/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-pub-blue hover:underline">
        ← Back to applications
      </Link>

      <SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{application.job.sectorName}</p>
            <h1 className="mt-1 font-heading text-xl font-bold text-pub-navy sm:text-2xl">{application.job.title}</h1>
            <p className="mt-1 text-sm text-pub-muted">
              {application.job.cityName} · Applied {application.appliedAt}
            </p>
          </div>
          <StageChip stage={application.stage} className="shrink-0" />
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[24rem]">
            <StageStepper stage={application.stage} />
          </div>
        </div>

        {canWithdraw && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-pub-border pt-4">
            <SecondaryButton onClick={handleWithdraw} loading={withdrawing} className="!text-red-600 hover:!bg-red-50">
              {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
            </SecondaryButton>
          </div>
        )}
      </SectionCard>

      {application.interview && (
        <SectionCard title="Interview details">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <InterviewArt className="h-16 w-20 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-pub-navy">
                {application.interview.date} at {application.interview.time}
              </p>
              <p className="mt-0.5 text-xs text-pub-muted">
                {application.interview.mode}
                {application.interview.location ? ` · ${application.interview.location}` : ''}
              </p>
            </div>
            {application.interview.confirmed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <PUBLIC_ICONS.shieldCheck className="size-3.5" />
                Attendance confirmed
              </span>
            ) : (
              <PrimaryButton onClick={handleConfirm} loading={confirming}>
                {confirming ? 'Confirming…' : 'Confirm attendance'}
              </PrimaryButton>
            )}
          </div>
        </SectionCard>
      )}

      {application.company && (
        <SectionCard title="About the employer">
          <p className="font-heading text-sm font-bold text-pub-navy">{application.company.name}</p>
          <p className="mt-1 text-xs text-pub-muted">{application.company.sectorName} · {application.company.website}</p>
          <p className="mt-3 text-sm leading-relaxed text-pub-text">{application.company.intro}</p>
        </SectionCard>
      )}

      <SectionCard title="History">
        <StageHistory history={application.history} />
      </SectionCard>
    </div>
  );
}
