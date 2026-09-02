'use client';

import { useAppData } from '@/lib/DataProvider';
import { logNavClick } from '@/lib/perfLog';
import { BookOpen, CalendarDays, Home, Plus, ShoppingCart } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LEFT_ITEMS  = [
  { href: '/',          label: 'Home',      Icon: Home          },
  { href: '/recipes',   label: 'Recipes',   Icon: BookOpen      },
] as const;

const RIGHT_ITEMS = [
  { href: '/plan',      label: 'Plan',      Icon: CalendarDays  },
  { href: '/groceries', label: 'Groceries', Icon: ShoppingCart  },
] as const;

type NavItem = { href: string; label: string; Icon: React.ElementType };

function NavBtn({ href, label, Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      onClick={() => logNavClick(href)}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-w-0 select-none"
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.5 : 1.75}
        className={active ? 'text-[#314A2E]' : 'text-gray-400'}
      />
      <span className={`text-[10px] font-medium leading-none ${active ? 'text-[#314A2E]' : 'text-gray-400'}`}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { openAddRecipe } = useAppData();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8E4DC]
                 md:hidden" /* hidden on desktop — TopNav takes over */
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end h-[60px] max-w-lg mx-auto px-2">

        {/* Left two items */}
        {LEFT_ITEMS.map((item) => (
          <NavBtn key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Centre FAB */}
        <div className="flex flex-1 flex-col items-center justify-end pb-2">
          <button
            type="button"
            onClick={openAddRecipe}
            aria-label="Add recipe"
            className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full
                       bg-[#314A2E] shadow-[0_4px_14px_rgba(49,74,46,0.40)]
                       hover:bg-[#243124] active:scale-95 transition-all"
          >
            <Plus size={26} color="white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Right two items */}
        {RIGHT_ITEMS.map((item) => (
          <NavBtn key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  );
}
