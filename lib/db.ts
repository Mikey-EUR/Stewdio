import { isConfigured } from './supabase';
import { createSupabaseServerClient } from './supabase-server';
import type {
    DBIngredient,
    DBRecipe,
    IngredientCategory,
    Recipe,
    RecipeCollection,
} from './types';
import type { PlannedRecipe } from './weeks';
export { getWeeks, toLocalDateStr } from './weeks';
export type { PlannedRecipe, WeekDates, WeekKey, Weeks } from './weeks';

export async function fetchPlannedRecipes(): Promise<PlannedRecipe[]> {
  if (!isConfigured) return [];
  const userId = await getCurrentAppUserId();
  if (!userId) return [];
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('planned_recipes')
    .select('*')
    .eq('app_user_id', userId)
    .order('planned_date', { ascending: true });
  if (error) { console.error('fetchPlannedRecipes error:', error); return []; }
  return (data ?? []) as PlannedRecipe[];
}

export async function fetchRecipeCollections(): Promise<RecipeCollection[]> {
  if (!isConfigured) return [];
  const userId = await getCurrentAppUserId();
  if (!userId) return [];
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('recipe_collections')
    .select('*')
    .eq('app_user_id', userId)
    .order('collection_name', { ascending: true });
  if (error) {
    console.error('fetchRecipeCollections error:', error);
    return [];
  }
  return (data ?? []) as RecipeCollection[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapDBRecipeToRecipe(
  row: DBRecipe,
  ingredients: DBIngredient[] = [],
): Recipe {
  // Group ingredients by recipe-screen category
  const byCategory: Record<string, IngredientCategory> = {};

  for (const ing of ingredients) {
    const cat =
      ing.category_ingredient_in_recipe_screen ||
      ing.ingredient_grocery_list_category?.category_grocery ||
      'Ingredients';

    if (!byCategory[cat]) {
      byCategory[cat] = { category: cat, items: [] };
    }

    byCategory[cat].items.push({
      amount: ing.quantity ?? 0,
      unit: ing.unit_name ?? '',
      ingredient:
        ing.ingredient_grocery_list_category?.name ?? ing.ingredient_name,
      form: ing.form ?? '',
      grocery_category:
        ing.ingredient_grocery_list_category?.category_grocery ?? 'General',
    });
  }

  return {
    id: row.recipe_id.toString(),
    title: row.title,
    time: row.time,
    servings: row.servings,
    ingredients:
      Object.values(byCategory).length > 0 ? Object.values(byCategory) : [],
    steps: row.steps ?? [],
    tags: row.tags ?? [],
    image: row.image_url ?? undefined,
    source: row.source ?? undefined,
    created_at: row.created_at,
    rating: row.rating ?? null,
    notes: row.notes ?? [],
  };
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getCurrentAppUserId(): Promise<string | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) return null;
    const { data: appUser } = await sb
      .from('app_users')
      .select('app_user_id')
      .eq('user_email_address', user.email.toLowerCase().trim())
      .single();
    return appUser?.app_user_id ?? null;
  } catch {
    return null;
  }
}

// ── Recipe queries ────────────────────────────────────────────────────────────

/**
 * Fetch all recipes for the authenticated user (lightweight — no ingredients).
 */
export async function fetchRecipes(): Promise<Recipe[]> {
  if (!isConfigured) return [];
  const userId = await getCurrentAppUserId();
  if (!userId) return [];
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('recipes')
    .select('*')
    .eq('created_by_app_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchRecipes error:', error);
    return [];
  }

  const recipeRows = (data ?? []) as DBRecipe[];
  const recipeIds = recipeRows.map((r) => r.recipe_id);
  if (recipeIds.length === 0) return [];

  const { data: ingredientRows, error: ingErr } = await sb
    .from('recipe_ingredients')
    .select(
      `recipe_ingredient_id, recipe_id, ingredient_name, unit_name, quantity, form,
       category_ingredient_in_recipe_screen,
       ingredient_grocery_list_category ( name, category_grocery )`,
    )
    .in('recipe_id', recipeIds);

  if (ingErr) {
    console.error('fetchRecipes ingredients error:', ingErr);
  }

  const byRecipeId = new Map<number, DBIngredient[]>();
  ((ingredientRows ?? []) as DBIngredient[]).forEach((ing) => {
    const list = byRecipeId.get(ing.recipe_id) ?? [];
    list.push(ing);
    byRecipeId.set(ing.recipe_id, list);
  });

  return recipeRows.map((r) => mapDBRecipeToRecipe(r, byRecipeId.get(r.recipe_id) ?? []));
}

/**
 * Fetch a single recipe with its full ingredient list.
 */
export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  const sb = await createSupabaseServerClient();
  const { data: row, error: recipeErr } = await sb
    .from('recipes')
    .select('*')
    .eq('recipe_id', Number(id))
    .single();

  if (recipeErr || !row) return null;

  const { data: ings } = await sb
    .from('recipe_ingredients')
    .select(
      `recipe_ingredient_id, recipe_id, ingredient_name, unit_name, quantity, form,
       category_ingredient_in_recipe_screen,
       ingredient_grocery_list_category ( name, category_grocery )`,
    )
    .eq('recipe_id', Number(id));

  return mapDBRecipeToRecipe(row as DBRecipe, (ings as unknown as DBIngredient[]) ?? []);
}

/**
 * Update the rating for a recipe.
 */
export async function updateRecipeRating(
  recipeId: string,
  rating: number | null,
): Promise<void> {
  const sb = await createSupabaseServerClient();
  await sb
    .from('recipes')
    .update({ rating })
    .eq('recipe_id', Number(recipeId));
}
