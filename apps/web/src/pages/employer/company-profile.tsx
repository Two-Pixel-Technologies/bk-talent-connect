/**
 * The employer's company profile.
 *
 * The introduction is what candidates read on the company page once they are
 * shortlisted, so it is framed as writing for them rather than as another form
 * field.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS, type UpdateEmployerProfileInput } from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import { diffDraft } from '../../lib/diff-draft.js';
import {
  useEmployerProfile,
  useUpdateEmployerProfile,
  useSubmitEmployerProfile,
  type EmployerProfile,
} from '../../features/employer/use-employer.js';
import { useTaxonomy } from '../../features/candidate/use-profile.js';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';
import { EMPLOYER_CARD } from './employer-style.js';

type Draft = UpdateEmployerProfileInput;

/** The saved profile in the draft's own shape — the diff baseline. */
function savedValuesOf(profile: EmployerProfile): Draft {
  return {
    companyName: profile.companyName,
    sectorSlug: profile.sectorSlug ?? undefined,
    locations: profile.locations,
    website: profile.website ?? undefined,
    linkedinUrl: profile.linkedinUrl ?? undefined,
    hrContactName: profile.hrContactName,
    hrContactPhone: profile.hrContactPhone,
    companyIntro: profile.companyIntro ?? undefined,
  };
}

export function CompanyProfilePage() {
  const navigate = useNavigate();
  const { data: profile, isPending, error: loadError, refetch } = useEmployerProfile();
  const { data: taxonomy } = useTaxonomy();
  const update = useUpdateEmployerProfile();

  const [draft, setDraft] = useState<Draft>({});
  const [saved, setSaved] = useState(false);
  const [reapproval, setReapproval] = useState<string[] | null>(null);
  const submit = useSubmitEmployerProfile();

  useEffect(() => {
    if (!profile) return;
    setDraft(savedValuesOf(profile));
  }, [profile?.id]);

  const error = update.error instanceof ApiError ? update.error : null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  async function save() {
    if (!profile) return;
    /*
     * Only the fields that actually changed.
     *
     * Posting the whole draft made the server treat every material field as
     * touched, so editing a phone number un-verified the account and hid the
     * "New posting" button until an admin re-approved it. The candidate wizard
     * and the job editor already diff; this page was the one that did not.
     */
    const { patch, changedFields } = diffDraft(draft, savedValuesOf(profile));
    if (changedFields.length === 0) {
      setSaved(true);
      setReapproval(null);
      return;
    }

    try {
      const result = await update.mutateAsync(patch);
      setSaved(true);
      setReapproval(result.requiresReapproval ? result.materialChanges : null);
    } catch {
      setSaved(false);
    }
  }

  const introLength = (draft.companyIntro ?? '').length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Company Profile</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Your company</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          What our team knows about you, and what shortlisted candidates see.
        </p>
      </div>

      {/* A failed load used to fall into the loading branch and spin forever:
          in TanStack v5 an errored query is `isPending: false, data: undefined`. */}
      <QueryState isPending={isPending} error={loadError} onRetry={() => void refetch()}>
      {!profile ? null : (
      <>

      {profile.accountStatus !== 'APPROVED' && (
        <Alert tone="warning" title="Awaiting verification">
          {profile.reviewNote ?? 'Our team verifies every company before any posting can go live.'}
        </Alert>
      )}

      {error && (
        <Alert tone="error" title={error.message}>
          {error.fields.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {error.fields.map((f) => <li key={f.path}>{f.message}</li>)}
            </ul>
          )}
        </Alert>
      )}

      {saved && !reapproval && <Alert tone="success">Saved.</Alert>}

      {reapproval && (
        <Alert tone="warning" title="Back to our team for a quick re-check">
          You changed {reapproval.join(', ')}. Because your company was already verified, we take
          another look before your postings go back up. Usually within a working day.
        </Alert>
      )}

      {/* CHANGES_REQUESTED belongs here too. The API accepts a resubmit from
          it, but the button was gated on DRAFT — so an employer told to add a
          company introduction could add it and then had no way to send it
          back. A dead end with a working endpoint behind it. */}
      {(profile.accountStatus === 'DRAFT' || profile.accountStatus === 'CHANGES_REQUESTED') && (
        <Alert tone="info" title={profile.accountStatus === 'DRAFT' ? 'Ready to be verified?' : 'Ready to send it back?'}>
          <p>
            Fill in your sector, hiring locations and a short introduction, then send it to our
            team. Candidates read the introduction once they are shortlisted.
          </p>
          <div className="mt-3">
            <Button onClick={() => submit.mutate(undefined, { onSuccess: () => navigate('/employer') })} loading={submit.isPending}>
              Send for verification
            </Button>
          </div>
          {submit.error instanceof ApiError && (
            <div className="mt-3">
              {/* The message first. Rendering only the field list meant a 403
                  or a 500 — which carry no fields — produced an empty <ul>,
                  so the button looked like it simply did nothing. */}
              <p className="font-medium text-accent-700">{submit.error.message}</p>
              {submit.error.fields.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {submit.error.fields.map((f) => (
                    <li key={f.path}>{f.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Alert>
      )}

      <Card className={EMPLOYER_CARD}>
        <div className="space-y-5">
          <h2 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Company information
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name" htmlFor="companyName" required>
              <Input id="companyName" value={draft.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} />
            </Field>
            <Field label="Sector" htmlFor="sectorSlug" required>
              <Select id="sectorSlug" value={draft.sectorSlug ?? ''} onChange={(e) => set('sectorSlug', e.target.value)}>
                <option value="">Select a sector</option>
                {taxonomy?.sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </Select>
            </Field>
          </div>

          {/*
            * Checkboxes, not a multi-select listbox.
            *
            * This was `<Select multiple>` with the hint "Hold ⌘/Ctrl to select
            * several" — computed from the deprecated navigator.platform. An
            * Android phone has no modifier key and no visible affordance for
            * multi-select, which made it the one control in the app that
            * genuinely could not be used on a phone. Checkboxes work
            * everywhere, are keyboard-navigable, and show the selection.
            */}
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">Hiring locations</legend>
            <p className="mt-0.5 text-xs text-slate-500">
              Where you typically hire · up to {LIMITS.employer.locations.max}
            </p>

            <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
              {(taxonomy?.cities ?? [])
                .filter((c) => c.state !== null)
                .map((c) => {
                  const selected = (draft.locations ?? []).includes(c.slug);
                  const atLimit =
                    (draft.locations ?? []).length >= LIMITS.employer.locations.max && !selected;

                  return (
                    <label
                      key={c.slug}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm transition-colors ${
                        atLimit
                          ? 'border-transparent text-slate-400'
                          : selected
                            ? 'border-brand-200 bg-brand-50/70 text-slate-800'
                            : 'border-transparent text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {/*
                        * The shared input reset (styles.css) applies
                        * appearance-none to every input/select/textarea for
                        * Safari's rounded-input quirk, which also stripped the
                        * native checkbox box and tick with nothing put back in
                        * its place — the control existed and worked, it was
                        * just invisible. appearance-auto restores it here,
                        * scoped to this one checkbox rather than touching the
                        * shared reset.
                        */}
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 appearance-auto rounded border-slate-300 accent-brand-600"
                        checked={selected}
                        disabled={atLimit}
                        onChange={(e) => {
                          const current = draft.locations ?? [];
                          set(
                            'locations',
                            e.target.checked
                              ? [...current, c.slug].slice(0, LIMITS.employer.locations.max)
                              : current.filter((v) => v !== c.slug),
                          );
                        }}
                      />
                      <span>
                        {c.name} <span className="text-slate-400">- {c.state}</span>
                      </span>
                    </label>
                  );
                })}
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              {(draft.locations ?? []).length} selected
            </p>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Website" htmlFor="website">
              <Input id="website" type="url" placeholder="https://" value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </Field>
            <Field label="LinkedIn page" htmlFor="linkedinUrl">
              <Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/company/…" value={draft.linkedinUrl ?? ''} onChange={(e) => set('linkedinUrl', e.target.value)} />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Company introduction
            </h2>
            <Field
              label="About your company"
              htmlFor="companyIntro"
              hint="Shown to candidates once they reach shortlist. What you make, where, and what it is like to work there."
            >
              <Textarea id="companyIntro" rows={5} value={draft.companyIntro ?? ''} onChange={(e) => set('companyIntro', e.target.value)} maxLength={LIMITS.employer.companyIntro.max} />
              <p className="mt-1.5 text-xs text-slate-500">
                {introLength} / {LIMITS.employer.companyIntro.max} characters
              </p>
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              HR contact
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              How our team reaches you. Never shown to candidates.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="hrContactName" required>
                <Input id="hrContactName" value={draft.hrContactName ?? ''} onChange={(e) => set('hrContactName', e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="hrContactPhone" required>
                <Input id="hrContactPhone" type="tel" value={draft.hrContactPhone ?? ''} onChange={(e) => set('hrContactPhone', e.target.value)} />
              </Field>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Sign-in email: <span className="font-medium text-slate-700">{profile.hrContactEmail}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-5">
          <Button onClick={() => void save()} loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </Card>
      </>
      )}
      </QueryState>
    </div>
  );
}
