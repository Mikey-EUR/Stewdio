// Shared types — mirrors the mobile app's data models exactly.

export interface Ingredient {
  amount: string | number;
  unit: string;
  ingredient: string;
  form: string;
  grocery_category?: string;
}

export interface IngredientCategory {
  category: string;
  items: Ingredient[];
}

export interface Recipe {
  id: string;
  title: string;
  time: string;
  servings: number;
  ingredients: Ingredient[] | IngredientCategory[];
  steps: string[];
  tags: string[];
  image?: string;          // URL from Supabase storage
  source?: string;
  created_at?: string;
  rating?: number | null;
  notes?: string[];
}

// ── Database row shapes ────────────────────────────────────────────────────────

export interface DBRecipe {
  recipe_id: number;
  title: string;
  time: string;
  servings: number;
  tags: string[];
  steps: string[];
  created_at: string;
  user_id?: number;
  created_by_app_user_id?: string;
  image_url?: string;
  image_path?: string;
  source?: string;
  rating?: number | null;
  notes?: string[] | null;
}

export interface DBIngredient {
  recipe_ingredient_id: number;
  recipe_id: number;
  ingredient_name: string;
  unit_name?: string;
  quantity?: number;
  form?: string;
  category_ingredient_in_recipe_screen?: string;
  ingredient_grocery_list_category?: {
    name: string;
    category_grocery?: string;
  };
}

export interface RecipeCollection {
  collection_id: string;
  collection_name: string;
  app_user_id: string;
  recipe_ids: number[];
  created_at: string;
  updated_at: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AppUser {
  app_user_id: string;
  user_email_address: string;
  username?: string;
  created_at?: string;
}
