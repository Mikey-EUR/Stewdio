// Shared DB-row → app-model mapping. Safe to import from both server and
// client code (no server-only imports here), so the caching layer on the
// client can build the exact same `Recipe` shape as the server does.

import type { DBIngredient, DBRecipe, IngredientCategory, Recipe } from './types';

export function mapDBRecipeToRecipe(
  row: DBRecipe,
  ingredients: DBIngredient[] = [],
): Recipe {
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

/** Normalizes the joined `ingredient_grocery_list_category` shape from Supabase
 * (which can come back as an object or a single-item array depending on the
 * join), matching the logic previously duplicated in server-only code. */
export function normalizeJoinedIngredients<T extends { ingredient_grocery_list_category?: unknown }>(
  rows: T[],
): (T & { ingredient_grocery_list_category?: DBIngredient['ingredient_grocery_list_category'] })[] {
  return rows.map((ing) => ({
    ...ing,
    ingredient_grocery_list_category: Array.isArray(ing.ingredient_grocery_list_category)
      ? ing.ingredient_grocery_list_category[0]
      : (ing.ingredient_grocery_list_category as DBIngredient['ingredient_grocery_list_category']),
  }));
}
