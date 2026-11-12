'use client';

import { createBrowserSupabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { LogOut, Minus, Plus, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MIN_PORTIONS = 1;
const MAX_PORTIONS = 20;

export default function SettingsClient() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
