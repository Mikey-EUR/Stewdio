'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import TopNav from './TopNav';

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = pathname === '/login' || pathname.startsWith('/auth/');

  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/recipes');
    router.prefetch('/plan');
    router.prefetch('/groceries');
  }, [router]);

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="hidden md:block">
        <TopNav />
      </div>

      <div className="flex-1 pb-[76px] md:pb-0">{children}</div>

      <BottomNav />
    </>
  );
}
