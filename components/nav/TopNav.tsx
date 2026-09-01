'use client';

import { createBrowserSupabase } from '@/lib/supabase';
import { BookOpen, CalendarDays, Home, LogIn, LogOut, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '/',            label: 'Home',      Icon: Home          },
  { href: '/recipes',     label: 'Recipes',   Icon: BookOpen      },
  { href: '/plan',        label: 'Plan',      Icon: CalendarDays  },
  { href: '/groceries',   label: 'Groceries', Icon: ShoppingCart  },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E8E4DC]">
      <div
        className="mx-auto flex h-16 items-center gap-0 px-6"
        style={{ maxWidth: 1320 }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="mr-8 text-xl font-bold tracking-tight text-[#314A2E] hover:opacity-80 transition-opacity"
        >
          Stewdio
        </Link>

        {/* Nav links */}
        <nav className="flex flex-1 items-center gap-1">
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#F0EDE6] text-[#314A2E]'
                    : 'text-[#708C69] hover:bg-[#F0EDE6] hover:text-[#314A2E]',
                ].join(' ')}
              >
                <Icon size={15} className="shrink-0 sm:hidden" />
                <span className="hidden sm:inline">{label}</span>
                <Icon size={15} className="shrink-0 hidden sm:inline" />
              </Link>
            );
          })}
        </nav>

        {/* Auth section */}
        {userEmail ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#708C69] hover:bg-[#F0EDE6] hover:text-[#314A2E] transition-colors"
            >
              <User size={16} />
              <span className="hidden md:inline max-w-[120px] truncate">{userEmail}</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#708C69] hover:bg-[#F0EDE6] hover:text-red-500 transition-colors"
            >
              <LogOut size={15} />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="ml-1 flex items-center gap-1.5 rounded-lg bg-[#314A2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243124] transition-colors"
          >
            <LogIn size={15} />
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
