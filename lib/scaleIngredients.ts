// Scales ingredient amounts for a given servings count — mirrors the mobile
// app's scaleIngredients.ts (components/ui/utils/scaleIngredients.ts).
import type { Ingredient, IngredientCategory } from './types';

function isCategoryList(ings: Ingredient[] | IngredientCategory[]): ings is IngredientCategory[] {
  return ings.length > 0 && 'category' in ings[0] && 'items' in (ings[0] as IngredientCategory);
}

function scaleAmount(amount: string | number, servings: number, baseServings: number): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (Number.isNaN(num)) return String(amount);
  const result = (num * servings) / baseServings;
  return result % 1 === 0 ? String(result) : result.toFixed(2).replace(/\.00$/, '');
}

export function scaleIngredients(
  ingredients: Ingredient[] | IngredientCategory[],
  servings: number,
  baseServings: number,
): Ingredient[] | IngredientCategory[] {
  if (!ingredients || ingredients.length === 0) return ingredients;
  const base = baseServings > 0 ? baseServings : 1;

  if (isCategoryList(ingredients)) {
    return ingredients.map((cat) => ({
      ...cat,
      items: cat.items.map((ing) => ({ ...ing, scaled: scaleAmount(ing.amount, servings, base) })),
    }));
  }
  return (ingredients as Ingredient[]).map((ing) => ({ ...ing, scaled: scaleAmount(ing.amount, servings, base) }));
}
