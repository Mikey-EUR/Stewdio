'use client';

import AddRecipeWizard from '@/components/recipes/AddRecipeWizard';
import { DataProvider, useAppData } from '@/lib/DataProvider';
import { logNavCommitted } from '@/lib/perfLog';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import TopNav from './TopNav';

export default function AppChrome({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <AppChromeInner>{children}</AppChromeInner>
    </DataProvider>
  );
}

function AppChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = pathname === '/login' || pathname.startsWith('/auth/');
  const { addOpen, openAddRecipe, closeAddRecipe, collections, setRecipes, setCollections } = useAppData();

  useEffect(() => {
    logNavCommitted(pathname);
  }, [pathname]);

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

      <button
        type="button"
        onClick={openAddRecipe}
        className="fixed bottom-6 right-6 z-[120] hidden items-center gap-2 rounded-full bg-[#314A2E] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(49,74,46,0.28)] transition-colors hover:bg-[#243124] md:inline-flex"
      >
        + Add Recipe
      </button>

      <AddRecipeWizard
        open={addOpen}
        onClose={closeAddRecipe}
        collections={collections}
        onRecipeCreated={(recipe) => {
          setRecipes((prev) => (prev.some((r) => r.id === recipe.id) ? prev : [recipe, ...prev]));
          closeAddRecipe();
        }}
        onCollectionCreated={(collection) => {
          setCollections((prev) => (prev.some((c) => c.collection_id === collection.collection_id) ? prev : [...prev, collection]));
        }}
        onCollectionUpdated={(collectionId, recipeIds) => {
          setCollections((prev) => prev.map((c) => (c.collection_id === collectionId ? { ...c, recipe_ids: recipeIds } : c)));
        }}
      />
    </>
  );
}
