import RecipesClient from '@/components/recipes/RecipesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recipes — Stewdio',
};

export default function RecipesPage() {
  return (
    <main className="flex-1 mx-auto w-full px-6 py-8" style={{ maxWidth: 1320 }}>
      <RecipesClient />
    </main>
  );
}
