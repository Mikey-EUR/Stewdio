import HomeClient from '@/components/home/HomeClient';
import { fetchRecipeCollections, fetchRecipes } from '@/lib/db';
import { isConfigured } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
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
      const sb = await createSupabaseServerClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user?.email) {
        isLoggedIn = true;
        const { data: appUser } = await sb
          .from('app_users')
          .select('username')
          .eq('user_email_address', user.email.toLowerCase().trim())
          .single();
        username = (appUser as any)?.username ?? '';
        [recipes, collections] = await Promise.all([
          fetchRecipes().catch(() => []),
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
