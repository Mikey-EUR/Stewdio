import RecipesClient from '@/components/recipes/RecipesClient';
import { fetchRecipeCollections, fetchRecipes } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recipes — Stewdio',
};

// Revalidate every 60 s so the page stays fresh without a full rebuild
export const revalidate = 60;

export default async function RecipesPage() {
  const [recipes, collections] = await Promise.all([
    fetchRecipes(),
    fetchRecipeCollections(),
  ]);

  return (
    <main className="flex-1 mx-auto w-full px-6 py-8" style={{ maxWidth: 1320 }}>
      <RecipesClient initialRecipes={recipes} initialCollections={collections} />
    </main>
  );
}
