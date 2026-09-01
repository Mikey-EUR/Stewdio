import GroceriesClient from '@/components/groceries/GroceriesClient';
import { fetchPlannedRecipes, fetchRecipes } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Groceries | Stewdio' };
export const dynamic = 'force-dynamic';

export default async function GroceriesPage() {
  const [plannedRecipes, recipes] = await Promise.all([
    fetchPlannedRecipes().catch(() => []),
    fetchRecipes().catch(() => []),
  ]);

  return (
    <GroceriesClient initialPlannedRecipes={plannedRecipes} initialRecipes={recipes} />
  );
}
