import HomeClient from '@/components/home/HomeClient';
import { fetchRecipeCollections, fetchRecipesBasic, getCurrentAppUserProfile } from '@/lib/db';
import { isConfigured } from '@/lib/supabase';
import type { Recipe, RecipeCollection } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home | Stewdio' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let recipes: Recipe[] = [];
  let collections: RecipeCollection[] = [];
  let username = '';
  let isLoggedIn = false;

  if (isConfigured) {
    try {
      const profile = await getCurrentAppUserProfile();
      if (profile?.appUserId) {
        isLoggedIn = true;
        username = profile.username;
        [recipes, collections] = await Promise.all([
          fetchRecipesBasic().catch(() => []),
          fetchRecipeCollections().catch(() => []),
        ]);
      }
    } catch {}
  }

  return (
    <HomeClient
      recipes={recipes}
      collections={collections}
      username={username}
      isLoggedIn={isLoggedIn}
    />
  );
}
