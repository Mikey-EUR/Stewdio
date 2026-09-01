'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import TopNav from './TopNav';

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === '/login' || pathname.startsWith('/auth/');

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
