import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Profile — Stewdio' };

export default function ProfilePage() {
  return (
    <main className="flex-1 mx-auto w-full px-6 py-12" style={{ maxWidth: 1320 }}>
      <h1 className="text-3xl font-bold text-[#314A2E]">Profile</h1>
      <p className="mt-2 text-[#708C69]">Account settings — coming soon.</p>
    </main>
  );
}
