import PlanClient from '@/components/plan/PlanClient';
import { fetchPlannedRecipes, fetchRecipesBasic } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Plan | Stewdio' };
export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const [plannedRecipes, recipes] = await Promise.all([
    fetchPlannedRecipes().catch(() => []),
    fetchRecipesBasic().catch(() => []),
  ]);

  return (
    <PlanClient initialPlannedRecipes={plannedRecipes} initialRecipes={recipes} />
  );
}
