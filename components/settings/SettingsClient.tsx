'use client';

import { getOrCreateAppUser } from '@/lib/appUser';
import { useAppData } from '@/lib/DataProvider';
import { createBrowserSupabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Check, LogOut, Minus, Pencil, Plus, Scale, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MIN_PORTIONS = 1;
const MAX_PORTIONS = 20;

export default function SettingsClient() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const { username, setUsername } = useAppData();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  // UI-only preferences — not wired up to anything yet.
  const [defaultPortions, setDefaultPortions] = useState(4);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUserEmail(user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Ensures an app_users row exists (new users) so the username always has something to show.
  useEffect(() => {
    if (!userEmail || username) return;
    void getOrCreateAppUser(supabase, userEmail).then((profile) => {
      if (profile) setUsername(profile.username);
    });
  }, [userEmail, username, supabase, setUsername]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const startEditUsername = () => {
    setUsernameInput(username);
    setUsernameError(null);
    setEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed.includes(' ')) {
      setUsernameError('User ID cannot be empty or contain spaces.');
      return;
    }
    if (!userEmail) {
      setUsernameError('Unable to update — please sign in again.');
      return;
    }
    if (trimmed === username) {
      setEditingUsername(false);
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    const { data: existing } = await supabase
      .from('app_users')
      .select('user_email_address')
      .eq('username', trimmed)
      .maybeSingle();

    if (existing && existing.user_email_address !== userEmail) {
      setUsernameError('That User ID is already taken.');
      setSavingUsername(false);
      return;
    }

    const { error } = await supabase
      .from('app_users')
      .update({ username: trimmed, updated_at: new Date().toISOString() })
      .eq('user_email_address', userEmail);

    setSavingUsername(false);
    if (error) {
      setUsernameError('Failed to update User ID. Please try again.');
      return;
    }

    setUsername(trimmed);
    setEditingUsername(false);
  };

  return (
    <main className="flex-1 mx-auto w-full px-6 py-12" style={{ maxWidth: 720 }}>
      <h1 className="text-3xl font-bold text-[#314A2E]">Settings</h1>
      <p className="mt-2 text-[#708C69]">Manage your account and preferences.</p>

      {/* Account */}
      <section className="mt-8 rounded-2xl border border-[#E8E4DC] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#708C69]">Account</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#243124]">Signed in as</p>
            <p className="truncate text-sm text-[#708C69]">{userEmail ?? '—'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E8E4DC] px-4 py-2 text-sm font-medium text-[#708C69] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>

        <div className="mt-4 border-t border-[#F5F2EB] pt-4">
          <p className="text-sm font-medium text-[#243124]">User ID</p>
          {editingUsername ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                  autoFocus
                  placeholder="Choose a unique ID (no spaces)"
                  className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#243124] outline-none focus:border-[#314A2E]"
                />
                <button
                  onClick={handleSaveUsername}
                  disabled={savingUsername}
                  aria-label="Save User ID"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#314A2E] text-white hover:bg-[#243124] disabled:opacity-60"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => { setEditingUsername(false); setUsernameError(null); }}
                  aria-label="Cancel"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E8E4DC] text-[#708C69] hover:bg-[#F0EDE6]"
                >
                  <X size={15} />
                </button>
              </div>
              {usernameError && <p className="mt-1.5 text-xs text-red-500">{usernameError}</p>}
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-sm text-[#708C69]">{username || '—'}</p>
              <button
                onClick={startEditUsername}
                aria-label="Edit User ID"
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#708C69] hover:bg-[#F0EDE6] hover:text-[#314A2E]"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="mt-6 rounded-2xl border border-[#E8E4DC] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#708C69]">Preferences</h2>

        {/* Preferred portions */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#243124]">Preferred amount of portions</p>
            <p className="text-sm text-[#708C69]">Default servings used when viewing a recipe.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#E8E4DC] px-2 py-1.5">
            <button
              onClick={() => setDefaultPortions((n) => Math.max(MIN_PORTIONS, n - 1))}
              aria-label="Decrease portions"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#708C69] hover:bg-[#F0EDE6] hover:text-[#314A2E]"
            >
              <Minus size={14} />
            </button>
            <span className="w-5 text-center text-sm font-semibold text-[#243124]">{defaultPortions}</span>
            <button
              onClick={() => setDefaultPortions((n) => Math.min(MAX_PORTIONS, n + 1))}
              aria-label="Increase portions"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#708C69] hover:bg-[#F0EDE6] hover:text-[#314A2E]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Measurement units */}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#F5F2EB] pt-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-[#243124]">
              <Scale size={14} className="text-[#708C69]" />
              Measurement units
            </p>
            <p className="text-sm text-[#708C69]">Choose how ingredient amounts are displayed.</p>
          </div>
          <div className="flex shrink-0 rounded-lg border border-[#E8E4DC] p-1">
            <button
              onClick={() => setUnitSystem('metric')}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                unitSystem === 'metric' ? 'bg-[#314A2E] text-white' : 'text-[#708C69] hover:text-[#314A2E]',
              ].join(' ')}
            >
              kg
            </button>
            <button
              onClick={() => setUnitSystem('imperial')}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                unitSystem === 'imperial' ? 'bg-[#314A2E] text-white' : 'text-[#708C69] hover:text-[#314A2E]',
              ].join(' ')}
            >
              lb
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
