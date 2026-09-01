'use client';

import { createBrowserSupabase } from '@/lib/supabase';
import type { Ingredient, IngredientCategory, Recipe, RecipeCollection } from '@/lib/types';
import { AlertCircle, Check, Copy, ImagePlus, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type RecipeFormat = 'text' | 'photo' | null;

interface AddRecipeWizardProps {
  open: boolean;
  onClose: () => void;
  collections: RecipeCollection[];
  onRecipeCreated: (recipe: Recipe) => void;
  onCollectionCreated: (collection: RecipeCollection) => void;
  onCollectionUpdated: (collectionId: string, recipeIds: number[]) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseEquivalentMeasures(equivalentMeasures: string | null | undefined): {
  cups: string | null;
  g: string | null;
  ml: string | null;
  tbsp: string | null;
  tsp: string | null;
} {
  const result = {
    cups: null as string | null,
    g: null as string | null,
    ml: null as string | null,
    tbsp: null as string | null,
    tsp: null as string | null,
  };

  if (!equivalentMeasures) return result;

  equivalentMeasures
    .split('/')
    .map((part) => part.trim())
    .forEach((part) => {
      if (!part || part === 'null') return;
      const match = part.match(/^([\d.]+)\s*(.+)$/);
      if (!match) return;

      const [, value, unitRaw] = match;
      const unit = unitRaw.toLowerCase();
      if (unit.includes('cup')) result.cups = value;
      else if (unit === 'g') result.g = value;
      else if (unit === 'ml') result.ml = value;
      else if (unit === 'tbsp') result.tbsp = value;
      else if (unit === 'tsp') result.tsp = value;
    });

  return result;
}

function parseStructuredTextRecipe(text: string): any {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) throw new Error('Empty recipe text');

  const headerEndIndex = lines.findIndex((line) => line === '---');
  if (headerEndIndex === -1) throw new Error('Missing ingredient separator (---)');

  const headerLines = lines.slice(0, headerEndIndex);
  const recipe: any = {};

  headerLines.forEach((line) => {
    if (line.startsWith('ID: ')) recipe.id = line.substring(4).trim();
    else if (line.startsWith('Title: ')) recipe.title = line.substring(7).trim();
    else if (line.startsWith('Time: ')) recipe.time = line.substring(6).trim();
    else if (line.startsWith('Servings: ')) recipe.servings = Number.parseInt(line.substring(10).trim(), 10);
    else if (line.startsWith('Tags: ')) recipe.tags = line.substring(6).trim().split(',').map((tag) => tag.trim()).filter(Boolean);
    else if (line.startsWith('Notes: ')) recipe.notes = line.substring(7).split('|').map((n) => n.trim()).filter(Boolean);
  });

  const ingredientsStartIndex = headerEndIndex + 1;
  const stepsStartIndex = lines.findIndex((line, index) => index > ingredientsStartIndex && line === '---');
  if (stepsStartIndex === -1) throw new Error('Missing steps separator (---)');

  const ingredientLines = lines.slice(ingredientsStartIndex, stepsStartIndex);
  const stepLines = lines.slice(stepsStartIndex + 1);

  const ingredients: Array<{ category: string; items: any[] }> = [];
  let currentCategory = '';
  let currentItems: any[] = [];

  ingredientLines.forEach((line) => {
    if (line.startsWith('- ')) {
      const ingredientMatch = line.match(/^- Amount: (.+?) \| Unit: (.+?) \| Ingredient: (.+?) \| Form: (.+?) \| Grocery Category: (.+?) \| Step\(s\): (.+?) \| Equivalent Measures: (.+?) \| Nutrition: (.+)$/);
      if (!ingredientMatch) return;

      const [, amount, unit, ingredient, form, groceryCategory, stepsStr, equivalentMeasures, nutrition] = ingredientMatch;

      let stepsArray: number[] | null = null;
      const trimmedSteps = stepsStr.trim();
      if (trimmedSteps.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmedSteps);
          if (Array.isArray(parsed)) {
            stepsArray = parsed.map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isFinite(n));
          }
        } catch {
          stepsArray = null;
        }
      } else {
        const parsed = trimmedSteps
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n));
        stepsArray = parsed.length > 0 ? parsed : null;
      }

      const nutritionMatch = nutrition.match(/(\d+(?:\.\d+)?)\s*kcal,\s*(\d+(?:\.\d+)?)\s*g protein,\s*(\d+(?:\.\d+)?)\s*g fat,\s*(\d+(?:\.\d+)?)\s*g carbs/);
      const nutritionData = nutritionMatch
        ? {
            calories: Number.parseFloat(nutritionMatch[1]),
            protein: Number.parseFloat(nutritionMatch[2]),
            fat: Number.parseFloat(nutritionMatch[3]),
            carbs: Number.parseFloat(nutritionMatch[4]),
          }
        : null;

      currentItems.push({
        amount: amount === 'null' ? null : Number.parseFloat(amount),
        unit: unit === 'null' ? null : unit.replace(/"/g, ''),
        ingredient: ingredient.replace(/"/g, ''),
        form: form === 'null' ? null : form.replace(/"/g, ''),
        groceryCategory: groceryCategory === 'null' ? null : groceryCategory.replace(/"/g, ''),
        steps: stepsArray,
        equivalentMeasures: equivalentMeasures === 'null' ? null : equivalentMeasures.trim(),
        nutrition: nutritionData,
        category: currentCategory,
      });
      return;
    }

    if (line && !line.startsWith('INGREDIENTS')) {
      if (currentCategory && currentItems.length > 0) {
        ingredients.push({ category: currentCategory, items: currentItems });
      }
      currentCategory = line;
      currentItems = [];
    }
  });

  if (currentCategory && currentItems.length > 0) {
    ingredients.push({ category: currentCategory, items: currentItems });
  }

  const steps: string[] = [];
  let stepStarted = false;
  stepLines.forEach((line) => {
    if (line.startsWith('STEPS')) {
      stepStarted = true;
      return;
    }

    if (!stepStarted) return;

    if (/^\d+\./.test(line)) {
      steps.push(line.replace(/^\d+\.\s*/, ''));
    } else if (line && !line.startsWith('✅') && steps.length > 0) {
      steps[steps.length - 1] += ` ${line}`;
    }
  });

  recipe.ingredients = ingredients;
  recipe.steps = steps;

  if (!recipe.title) recipe.title = 'Untitled Recipe';
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) recipe.servings = 4;
  if (!recipe.time) recipe.time = '';
  if (!Array.isArray(recipe.tags)) recipe.tags = [];
  if (!Array.isArray(recipe.notes)) recipe.notes = [];

  return recipe;
}

function normalizeParsedRecipe(text: string): any {
  try {
    return parseStructuredTextRecipe(text.trim());
  } catch {
    return {
      id: `manual-${Date.now()}`,
      title: 'User Recipe',
      time: '',
      servings: 4,
      tags: [],
      steps: [text.trim()],
      notes: [],
      ingredients: [],
    };
  }
}

function toGroupedIngredients(input: any[]): Ingredient[] | IngredientCategory[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  if ('items' in input[0]) {
    return input as IngredientCategory[];
  }
  return input as Ingredient[];
}

export default function AddRecipeWizard({
  open,
  onClose,
  collections,
  onRecipeCreated,
  onCollectionCreated,
  onCollectionUpdated,
}: AddRecipeWizardProps) {
  const supabase = createBrowserSupabase();

  const [currentStep, setCurrentStep] = useState(0);
  const [recipeFormat, setRecipeFormat] = useState<RecipeFormat>(null);
  const [recipeSource, setRecipeSource] = useState('');
  const [originalRecipe, setOriginalRecipe] = useState('');
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  const [recipePrompt, setRecipePrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [recipeText, setRecipeText] = useState('');
  const [parsedRecipe, setParsedRecipe] = useState<any>(null);
  const [recipeValid, setRecipeValid] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [pendingNewCollections, setPendingNewCollections] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');

  const [recipeImagePreview, setRecipeImagePreview] = useState<string | null>(null);
  const [recipeImageFile, setRecipeImageFile] = useState<File | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canProceedFromStep0 = recipeFormat !== null;
  const canProceedFromStep1 = (recipeFormat === 'text' && originalRecipe.trim().length > 0) || (recipeFormat === 'photo' && extractedText.trim().length > 10);
  const canProceedFromStep2 = recipeValid;
  const canProceedFromStep3 = true;
  const canSave = recipeValid && parsedRecipe && !isSaving;

  const collectionNameSet = useMemo(
    () => new Set(collections.map((c) => c.collection_name.toLowerCase().trim())),
    [collections],
  );

  useEffect(() => {
    if (!open) return;

    setCurrentStep(0);
    setRecipeFormat(null);
    setRecipeSource('');
    setOriginalRecipe('');
    setSelectedImageName(null);
    if (ocrImagePreview) URL.revokeObjectURL(ocrImagePreview);
    setOcrImagePreview(null);
    setExtractedText('');
    setRecipeText('');
    setParsedRecipe(null);
    setRecipeValid(false);
    setSelectedCollections([]);
    setPendingNewCollections([]);
    setNewCollectionName('');
    setRecipeImagePreview(null);
    setRecipeImageFile(null);
    setSaveError(null);

    const fetchPrompts = async () => {
      setLoadingPrompts(true);
      try {
        const { data } = await supabase
          .from('app_prompts')
          .select('prompt_key, prompt_content')
          .in('prompt_key', ['recipe_creation_in_app', 'image_generation']);

        const promptMap = new Map<string, string>((data ?? []).map((row: any) => [row.prompt_key, row.prompt_content]));
        setRecipePrompt(promptMap.get('recipe_creation_in_app') ?? '');
        setImagePrompt(promptMap.get('image_generation') ?? 'Generate a high-quality, appetizing photo of this recipe.');
      } finally {
        setLoadingPrompts(false);
      }
    };

    void fetchPrompts();
  }, [open, supabase]);

  if (!open) return null;

  const stepTitle =
    currentStep === 0
      ? 'Add Your Recipe'
      : currentStep === 1
        ? recipeFormat === 'photo'
          ? 'Upload Recipe Photo'
          : 'Enter Recipe Text'
        : currentStep === 2
          ? 'Format & Edit Recipe'
          : currentStep === 3
            ? 'Add Recipe Image'
            : 'Review & Save';

  const handleClose = () => {
    if (recipeImagePreview) URL.revokeObjectURL(recipeImagePreview);
    onClose();
  };

  const handleRecipeTextChange = (text: string) => {
    setRecipeText(text);
    if (text.trim().length <= 10) {
      setRecipeValid(false);
      setParsedRecipe(null);
      return;
    }

    const parsed = normalizeParsedRecipe(text);
    setParsedRecipe(parsed);
    setRecipeValid(true);
  };

  const handleCopyRecipePrompt = async () => {
    if (!recipePrompt) return;
    const combined = `${recipePrompt}\n\nHere's my recipe:\n${originalRecipe}`;
    await navigator.clipboard.writeText(combined);
  };

  const handleGenerateRecipe = async () => {
    if (!recipePrompt || !originalRecipe.trim()) return;
    setIsGenerating(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: { systemPrompt: recipePrompt, recipeInput: originalRecipe },
      });

      if (error) {
        throw new Error(error.message || 'Failed to call AI generation service.');
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }

      const text = String(data?.text ?? '')
        .replace(/^```[^\n]*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();

      handleRecipeTextChange(text);
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to generate recipe.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStep2ImagePick = async (file: File | null) => {
    if (!file) return;
    setSelectedImageName(file.name);
    if (ocrImagePreview) URL.revokeObjectURL(ocrImagePreview);
    setOcrImagePreview(URL.createObjectURL(file));
    setOcrLoading(true);

    try {
      const ocrKey = process.env.NEXT_PUBLIC_OCR_API_KEY;
      if (!ocrKey) {
        setOcrLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('OCREngine', '2');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { apikey: ocrKey },
        body: formData,
      });

      const result = await response.json();
      const text =
        result?.ParsedResults?.[0]?.ParsedText && typeof result.ParsedResults[0].ParsedText === 'string'
          ? result.ParsedResults[0].ParsedText
          : '';

      if (text.trim().length > 0) {
        setExtractedText(text.trim());
      }
    } catch {
      // The user can still paste OCR text manually.
    } finally {
      setOcrLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      setSaveError('Clipboard image read is not supported here. Use Ctrl/Cmd+V in the paste area or choose from gallery.');
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (!imageType) continue;

        const blob = await item.getType(imageType);
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type || 'image/png' });
        await handleStep2ImagePick(file);
        setSaveError(null);
        return;
      }
      setSaveError('No image found in clipboard. Copy a screenshot first and try again.');
    } catch {
      setSaveError('Could not read clipboard image. You can still paste with Ctrl/Cmd+V in the paste area below.');
    }
  };

  const getCurrentUserInfo = async (): Promise<{ appUserId: string; email: string } | null> => {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email?.toLowerCase().trim();
    if (!email) return null;

    const { data: appUser } = await supabase
      .from('app_users')
      .select('app_user_id')
      .eq('user_email_address', email)
      .single();

    if (!appUser?.app_user_id) return null;
    return { appUserId: appUser.app_user_id, email };
  };

  const createPendingCollections = async (appUserId: string): Promise<string[]> => {
    const createdIds: string[] = [];

    for (const name of pendingNewCollections) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      const { data, error } = await supabase
        .from('recipe_collections')
        .insert({
          collection_name: trimmed,
          app_user_id: appUserId,
          recipe_ids: [],
        })
        .select('*')
        .single();

      if (!error && data) {
        onCollectionCreated(data as RecipeCollection);
        createdIds.push(String(data.collection_id));
      }
    }

    return createdIds;
  };

  const uploadRecipeImage = async (
    imageFile: File,
    recipeIdText: string,
    appUserId: string,
  ): Promise<{ publicUrl: string; path: string; filename: string } | null> => {
    const safeBase = slugify(recipeIdText) || `recipe-${Date.now()}`;
    const extension = imageFile.name.includes('.') ? imageFile.name.split('.').pop() : 'jpg';
    const fileName = `${safeBase}_${appUserId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(fileName, imageFile, {
        contentType: imageFile.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) return null;

    const { data } = supabase.storage.from('recipe-images').getPublicUrl(fileName);
    return {
      publicUrl: data.publicUrl,
      path: `recipe-images/${fileName}`,
      filename: fileName,
    };
  };

  const flattenIngredientsForInsert = (ings: any[]): any[] => {
    if (!Array.isArray(ings) || ings.length === 0) return [];

    if (ings[0] && 'items' in ings[0] && Array.isArray(ings[0].items)) {
      return (ings as Array<{ category: string; items: any[] }>).flatMap((group) =>
        group.items.map((item) => ({ ...item, category: group.category })),
      );
    }

    return ings;
  };

  const insertRecipeIngredient = async (recipeId: number, ingredientData: any) => {
    const ingredientName = String(ingredientData.ingredient ?? '').trim();
    if (!ingredientName) return;

    let ingredientId: number | null = null;

    const { data: existingIngredient } = await supabase
      .from('ingredient_grocery_list_category')
      .select('ingredient_id')
      .eq('name', ingredientName)
      .maybeSingle();

    if (existingIngredient?.ingredient_id) {
      ingredientId = existingIngredient.ingredient_id;
    } else {
      const { data: newIngredient, error: insertIngredientError } = await supabase
        .from('ingredient_grocery_list_category')
        .insert({
          name: ingredientName,
          category_grocery: ingredientData.groceryCategory || ingredientData.grocery_category || null,
        })
        .select('ingredient_id')
        .single();

      if (insertIngredientError || !newIngredient?.ingredient_id) {
        throw new Error('Failed to create ingredient category row.');
      }

      ingredientId = newIngredient.ingredient_id;
    }

    const conversions = parseEquivalentMeasures(ingredientData.equivalentMeasures ?? null);
    const amountRaw = ingredientData.amount;
    const amountNum = typeof amountRaw === 'number' ? amountRaw : Number.parseFloat(String(amountRaw));

    const nutrition = ingredientData.nutrition
      ? {
          calories: ingredientData.nutrition.calories || 0,
          protein_g: ingredientData.nutrition.protein || ingredientData.nutrition.protein_g || 0,
          fat_g: ingredientData.nutrition.fat || ingredientData.nutrition.fat_g || 0,
          carbs_g: ingredientData.nutrition.carbs || ingredientData.nutrition.carbs_g || 0,
        }
      : null;

    const { error: recipeIngredientError } = await supabase.from('recipe_ingredients').insert({
      recipe_id: recipeId,
      ingredient_id: ingredientId,
      ingredient_name: ingredientName,
      quantity: Number.isFinite(amountNum) ? amountNum : null,
      unit_name: ingredientData.unit || null,
      form: ingredientData.form && ingredientData.form !== 'null' ? ingredientData.form : null,
      to_cups: conversions.cups,
      to_g: conversions.g,
      to_ml: conversions.ml,
      to_tbsp: conversions.tbsp,
      to_tsp: conversions.tsp,
      nutrition_per_quantity: nutrition,
      category_ingredient_in_recipe_screen: ingredientData.category || null,
      Steps: Array.isArray(ingredientData.steps) ? ingredientData.steps : null,
    });

    if (recipeIngredientError) {
      throw new Error('Failed to insert recipe ingredient row.');
    }
  };

  const upsertCollectionMembership = async (collectionId: string, recipeId: number) => {
    const { data, error } = await supabase
      .from('recipe_collections')
      .select('recipe_ids')
      .eq('collection_id', collectionId)
      .single();

    if (error) return;

    const nextIds = Array.from(new Set([...(data.recipe_ids ?? []), recipeId]));

    const { error: updateError } = await supabase
      .from('recipe_collections')
      .update({ recipe_ids: nextIds })
      .eq('collection_id', collectionId);

    if (!updateError) {
      onCollectionUpdated(collectionId, nextIds);
    }
  };

  const saveRecipe = async () => {
    if (!parsedRecipe) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      const userInfo = await getCurrentUserInfo();
      if (!userInfo) {
        throw new Error('You must be signed in to save recipes.');
      }

      const parsedRecipeIdText = String(parsedRecipe.id || '').trim() || null;

      if (parsedRecipeIdText) {
        const { data: existing } = await supabase
          .from('recipes')
          .select('recipe_id')
          .eq('recipe_id_text', parsedRecipeIdText)
          .eq('created_by_app_user_id', userInfo.appUserId)
          .maybeSingle();

        if (existing?.recipe_id) {
          const shouldReplace = window.confirm(
            `You already have a recipe with ID "${parsedRecipeIdText}". Replace it with this one?`,
          );

          if (!shouldReplace) {
            setIsSaving(false);
            return;
          }

          await supabase.from('recipe_ingredients').delete().eq('recipe_id', existing.recipe_id);
          await supabase.from('recipes').delete().eq('recipe_id', existing.recipe_id);
        }
      }

      const { data: insertedRecipe, error: recipeInsertError } = await supabase
        .from('recipes')
        .insert({
          title: parsedRecipe.title || 'Untitled Recipe',
          time: parsedRecipe.time || '',
          servings: Number(parsedRecipe.servings) || 4,
          tags: Array.isArray(parsedRecipe.tags) ? parsedRecipe.tags : [],
          steps: Array.isArray(parsedRecipe.steps) ? parsedRecipe.steps : [],
          notes: Array.isArray(parsedRecipe.notes) ? parsedRecipe.notes : [],
          created_by_app_user_id: userInfo.appUserId,
          recipe_id_text: parsedRecipeIdText,
          source: recipeSource || parsedRecipe.source || null,
          image_url: null,
          image_path: null,
          image_filename: null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (recipeInsertError || !insertedRecipe) {
        throw new Error('Failed to create recipe row.');
      }

      let imageUrl: string | undefined;
      if (recipeImageFile) {
        const uploadData = await uploadRecipeImage(
          recipeImageFile,
          parsedRecipeIdText || slugify(parsedRecipe.title || '') || `recipe-${insertedRecipe.recipe_id}`,
          userInfo.appUserId,
        );

        if (uploadData) {
          imageUrl = uploadData.publicUrl;
          await supabase
            .from('recipes')
            .update({
              image_url: uploadData.publicUrl,
              image_path: uploadData.path,
              image_filename: uploadData.filename,
            })
            .eq('recipe_id', insertedRecipe.recipe_id);
        }
      }

      const flatIngredients = flattenIngredientsForInsert(parsedRecipe.ingredients || []);
      for (const ingredientData of flatIngredients) {
        await insertRecipeIngredient(insertedRecipe.recipe_id, ingredientData);
      }

      const createdCollectionIds = await createPendingCollections(userInfo.appUserId);
      const allTargetCollectionIds = Array.from(new Set([...selectedCollections, ...createdCollectionIds]));
      for (const collectionId of allTargetCollectionIds) {
        await upsertCollectionMembership(collectionId, insertedRecipe.recipe_id);
      }

      const createdRecipe: Recipe = {
        id: String(insertedRecipe.recipe_id),
        title: insertedRecipe.title,
        time: insertedRecipe.time ?? '',
        servings: insertedRecipe.servings ?? 4,
        ingredients: toGroupedIngredients(parsedRecipe.ingredients || []),
        steps: Array.isArray(parsedRecipe.steps) ? parsedRecipe.steps : [],
        tags: Array.isArray(parsedRecipe.tags) ? parsedRecipe.tags : [],
        image: imageUrl ?? undefined,
        source: (recipeSource || parsedRecipe.source || undefined) as string | undefined,
        created_at: insertedRecipe.created_at,
        rating: insertedRecipe.rating ?? null,
        notes: Array.isArray(parsedRecipe.notes) ? parsedRecipe.notes : [],
      };

      onRecipeCreated(createdRecipe);
      handleClose();
    } catch (error: any) {
      setSaveError(error?.message || 'Could not save recipe.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[95dvh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#243124]">{stepTitle}</h3>
          <button onClick={handleClose} className="text-[#708C69] hover:text-[#243124]">
            <X size={18} />
          </button>
        </div>

        {saveError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-[#708C69]">How would you like to add your recipe?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setRecipeFormat('text')}
                className={`rounded-xl border p-4 text-left transition-colors ${recipeFormat === 'text' ? 'border-[#314A2E] bg-[#F7FAF5]' : 'border-[#E8E4DC] hover:border-[#314A2E]'}`}
              >
                <p className="text-sm font-semibold text-[#243124]">Paste or Type Recipe</p>
                <p className="mt-1 text-xs text-[#708C69]">Enter your recipe text and we will format it.</p>
              </button>

              <button
                onClick={() => setRecipeFormat('photo')}
                className={`rounded-xl border p-4 text-left transition-colors ${recipeFormat === 'photo' ? 'border-[#314A2E] bg-[#F7FAF5]' : 'border-[#E8E4DC] hover:border-[#314A2E]'}`}
              >
                <p className="text-sm font-semibold text-[#243124]">Upload a Photo of Recipe</p>
                <p className="mt-1 text-xs text-[#708C69]">Upload an image and extract text, then format it.</p>
              </button>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Source (optional)</p>
              <textarea
                value={recipeSource}
                onChange={(e) => setRecipeSource(e.target.value)}
                placeholder="e.g. Grandma's notebook p.110 or https://instagram.com/..."
                rows={2}
                className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]"
              />
            </div>
          </div>
        )}

        {currentStep === 1 && recipeFormat === 'text' && (
          <div className="space-y-3">
            <p className="text-sm text-[#708C69]">Enter your recipe text, any format works.</p>
            <textarea
              value={originalRecipe}
              onChange={(e) => setOriginalRecipe(e.target.value)}
              rows={12}
              placeholder="Paste or type your recipe here..."
              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]"
            />
          </div>
        )}

        {currentStep === 1 && recipeFormat === 'photo' && (
          <div className="space-y-3">
            <p className="text-sm text-[#708C69]">Upload a recipe image, then confirm or edit the extracted text.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#A9B388] bg-[#F7FAF5] px-4 py-4 text-sm font-medium text-[#314A2E] hover:bg-[#F1F7EC]">
                <Upload size={16} /> Choose from gallery
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    await handleStep2ImagePick(file);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E8E4DC] bg-white px-4 py-4 text-sm font-medium text-[#243124] hover:border-[#314A2E]"
              >
                <Copy size={16} /> Paste screenshot
              </button>
            </div>

            <div
              onPaste={async (e) => {
                const items = Array.from(e.clipboardData?.items ?? []);
                const imageItem = items.find((item) => item.type.startsWith('image/'));
                if (!imageItem) return;
                const file = imageItem.getAsFile();
                if (!file) return;
                e.preventDefault();
                await handleStep2ImagePick(file);
              }}
              className="rounded-lg border border-[#E8E4DC] bg-[#FCFBF8] px-3 py-2 text-xs text-[#708C69]"
            >
              Paste area: press Ctrl/Cmd+V after copying a screenshot.
            </div>

            {selectedImageName && (
              <p className="text-xs text-[#708C69]">Selected: {selectedImageName}</p>
            )}

            {ocrImagePreview && (
              <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-[#E8E4DC] bg-[#F5F2EB] aspect-[4/3]">
                <Image src={ocrImagePreview} alt="OCR source" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    if (ocrImagePreview) URL.revokeObjectURL(ocrImagePreview);
                    setOcrImagePreview(null);
                    setSelectedImageName(null);
                    setExtractedText('');
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-[#314A2E]"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {ocrLoading && (
              <p className="flex items-center gap-1 text-xs text-[#708C69]"><Loader2 size={13} className="animate-spin" /> Running OCR...</p>
            )}
            {!process.env.NEXT_PUBLIC_OCR_API_KEY && (
              <p className="text-xs text-[#A07D52]">OCR API key is not configured. You can still paste extracted text manually below.</p>
            )}

            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              rows={10}
              placeholder="Extracted text will appear here. You can edit or paste manually."
              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]"
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[#708C69]">Automatically format your recipe with AI, or use ChatGPT manually.</p>

            <button
              onClick={handleGenerateRecipe}
              disabled={isGenerating || loadingPrompts || !recipePrompt || !originalRecipe.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#314A2E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? 'Generating...' : 'Generate Recipe'}
            </button>

            <div className="flex items-center gap-2 text-xs text-[#A9B388]">
              <div className="h-px flex-1 bg-[#E8E4DC]" />
              <span>or do it manually</span>
              <div className="h-px flex-1 bg-[#E8E4DC]" />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  await handleCopyRecipePrompt();
                }}
                disabled={loadingPrompts || !recipePrompt}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#243124] hover:border-[#314A2E] disabled:opacity-60"
              >
                <Copy size={14} /> Copy Recipe Prompt
              </button>
              <button
                onClick={() => window.open('https://chat.openai.com', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#243124] hover:border-[#314A2E]"
              >
                <Wand2 size={14} /> Open ChatGPT
              </button>
            </div>

            <textarea
              value={recipeText}
              onChange={(e) => handleRecipeTextChange(e.target.value)}
              rows={12}
              placeholder="Paste AI-formatted recipe output here..."
              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]"
            />

            {recipeValid && parsedRecipe && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Parsed recipe: {parsedRecipe.title || 'Untitled'}
              </div>
            )}

            <div className="rounded-lg border border-[#E8E4DC] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Collections</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {collections.map((c) => {
                  const checked = selectedCollections.includes(c.collection_id);
                  return (
                    <button
                      key={c.collection_id}
                      onClick={() => {
                        setSelectedCollections((prev) =>
                          checked ? prev.filter((id) => id !== c.collection_id) : [...prev, c.collection_id],
                        );
                      }}
                      className="flex items-center gap-2 rounded-md border border-[#E8E4DC] px-2 py-2 text-left"
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-[#314A2E] bg-[#314A2E]' : 'border-[#CFC8BD]'}`}>
                        {checked && <Check size={11} className="text-white" />}
                      </span>
                      <span className="line-clamp-1 text-xs text-[#243124]">{c.collection_name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Create new collection"
                  className="flex-1 rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                />
                <button
                  onClick={() => {
                    const value = newCollectionName.trim();
                    if (!value) return;
                    if (collectionNameSet.has(value.toLowerCase())) return;
                    if (pendingNewCollections.some((c) => c.toLowerCase() === value.toLowerCase())) return;
                    setPendingNewCollections((prev) => [...prev, value]);
                    setNewCollectionName('');
                  }}
                  className="rounded-md bg-[#314A2E] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Add
                </button>
              </div>

              {pendingNewCollections.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendingNewCollections.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 rounded-full border border-[#DDE6D6] bg-[#F7FAF5] px-2 py-0.5 text-xs text-[#314A2E]">
                      {name}
                      <button
                        onClick={() => setPendingNewCollections((prev) => prev.filter((n) => n !== name))}
                        className="text-[#708C69]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-[#708C69]">Generate an image with AI or upload your own image.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  if (!imagePrompt || !recipeText.trim()) return;
                  await navigator.clipboard.writeText(`${imagePrompt}\n\nHere's the recipe:\n${recipeText}`);
                }}
                disabled={!imagePrompt}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#243124] hover:border-[#314A2E] disabled:opacity-60"
              >
                <Copy size={14} /> Copy Image Prompt
              </button>
              <button
                onClick={() => window.open('https://chat.openai.com', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#243124] hover:border-[#314A2E]"
              >
                <Wand2 size={14} /> Open ChatGPT
              </button>
            </div>

            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#A9B388] bg-[#F7FAF5] px-4 py-6 text-sm font-medium text-[#314A2E] hover:bg-[#F1F7EC]">
              <ImagePlus size={16} /> Upload recipe image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;

                  if (recipeImagePreview) URL.revokeObjectURL(recipeImagePreview);
                  setRecipeImageFile(file);
                  setRecipeImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>

            {recipeImagePreview && (
              <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-[#E8E4DC] bg-[#F5F2EB] aspect-[4/3]">
                <Image src={recipeImagePreview} alt="Recipe preview" fill className="object-cover" />
                <button
                  onClick={() => {
                    if (recipeImagePreview) URL.revokeObjectURL(recipeImagePreview);
                    setRecipeImagePreview(null);
                    setRecipeImageFile(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-[#314A2E]"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-[#708C69]">Review your recipe details before saving.</p>

            {parsedRecipe && (
              <div className="rounded-xl border border-[#E8E4DC] p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Title</p>
                    <input
                      value={parsedRecipe.title || ''}
                      onChange={(e) => setParsedRecipe((prev: any) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Time</p>
                    <input
                      value={parsedRecipe.time || ''}
                      onChange={(e) => setParsedRecipe((prev: any) => ({ ...prev, time: e.target.value }))}
                      className="w-full rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Servings</p>
                    <input
                      type="number"
                      min={1}
                      value={parsedRecipe.servings || 4}
                      onChange={(e) => setParsedRecipe((prev: any) => ({ ...prev, servings: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-full rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Tags (comma separated)</p>
                    <input
                      value={Array.isArray(parsedRecipe.tags) ? parsedRecipe.tags.join(', ') : ''}
                      onChange={(e) => setParsedRecipe((prev: any) => ({
                        ...prev,
                        tags: e.target.value
                          .split(',')
                          .map((t: string) => t.trim())
                          .filter(Boolean),
                      }))}
                      className="w-full rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-[#708C69]">
                  Ingredients: {Array.isArray(parsedRecipe.ingredients) ? parsedRecipe.ingredients.length : 0} groups/items
                </div>
                <div className="text-xs text-[#708C69]">Steps: {Array.isArray(parsedRecipe.steps) ? parsedRecipe.steps.length : 0}</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {currentStep === 0 ? (
            <button onClick={handleClose} className="rounded-lg border border-[#E8E4DC] px-4 py-2 text-sm text-[#243124]">Cancel</button>
          ) : (
            <button onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} className="rounded-lg border border-[#E8E4DC] px-4 py-2 text-sm text-[#243124]">Back</button>
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && recipeFormat === 'photo') {
                  setOriginalRecipe(extractedText);
                }
                setCurrentStep((s) => Math.min(4, s + 1));
              }}
              disabled={
                (currentStep === 0 && !canProceedFromStep0) ||
                (currentStep === 1 && !canProceedFromStep1) ||
                (currentStep === 2 && !canProceedFromStep2) ||
                (currentStep === 3 && !canProceedFromStep3)
              }
              className="rounded-lg bg-[#314A2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={saveRecipe}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-[#314A2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {isSaving ? 'Saving Recipe...' : 'Save Recipe'}
            </button>
          )}
        </div>

        {currentStep > 0 && (
          <div className="mt-4 flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`h-1.5 rounded-full ${currentStep >= step ? 'w-8 bg-[#314A2E]' : 'w-4 bg-[#D9D2C7]'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
