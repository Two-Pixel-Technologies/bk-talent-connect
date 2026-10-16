import { useState } from 'react';
import { usePrototype } from '../PrototypeContext.js';
import { PrimaryButton, SecondaryButton, SectionCard } from '../components/ui.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

/**
 * Only surfaces account actions that already exist in the real portal:
 * change password (a real route at /change-password), the DPDP data-rights
 * page (a real route at /candidate/privacy), and sign out. No notification
 * preferences or other settings are shown here — the current backend has no
 * such feature (in-app notifications only, no email/SMS opt-in to manage).
 */
export function Settings() {
  const { candidate } = usePrototype();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  function handleChangePassword() {
    setChangingPassword(true);
    setTimeout(() => {
      setChangingPassword(false);
      setPasswordChanged(true);
    }, 700);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-pub-navy">Settings</h1>
        <p className="mt-1 text-sm text-pub-muted">Manage your account and data.</p>
      </div>

      <SectionCard title="Account">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
            <PUBLIC_ICONS.userCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-pub-navy">{candidate.email}</p>
            <p className="text-xs text-pub-muted">Signed in as Candidate</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Password">
        {passwordChanged ? (
          <p className="text-sm text-emerald-700">Password updated. (Prototype only — no real password was changed.)</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pub-muted">Change the password used to sign in.</p>
            <SecondaryButton onClick={handleChangePassword} loading={changingPassword} className="shrink-0">
              {changingPassword ? 'Updating…' : 'Change password'}
            </SecondaryButton>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Your data">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-pub-muted">Review what BK Talent Connect holds about you and request export or erasure.</p>
          <SecondaryButton className="shrink-0">View data & privacy</SecondaryButton>
        </div>
      </SectionCard>

      <SectionCard title="Session">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-pub-muted">Sign out of BK Talent Connect on this device.</p>
          <PrimaryButton className="shrink-0 !bg-red-600 hover:!bg-red-700">Sign out</PrimaryButton>
        </div>
      </SectionCard>
    </div>
  );
}
