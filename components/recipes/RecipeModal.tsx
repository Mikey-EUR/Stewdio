'use client';

import { createBrowserSupabase } from '@/lib/supabase';
import type { Ingredient, IngredientCategory, Recipe } from '@/lib/types';
import { getWeeks, toLocalDateStr, type WeekKey } from '@/lib/weeks';
import { Clock, ExternalLink, FileDown, Flame, CalendarPlus, Star, Users, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onChanged?: (updated: Recipe) => void;
}

function isCategory(item: unknown): item is IngredientCategory {
  return typeof item === 'object' && item !== null && 'category' in item && 'items' in item;
}

function flattenIngredients(ingredients: Ingredient[] | IngredientCategory[]): Ingredient[] {
  if (!ingredients || ingredients.length === 0) return [];
  if (isCategory(ingredients[0])) {
    return (ingredients as IngredientCategory[]).flatMap((g) => g.items);
  }
  return ingredients as Ingredient[];
}

export default function RecipeModal({ recipe, onClose, onChanged }: RecipeModalProps) {
  const supabase = createBrowserSupabase();
  const weeks = getWeeks();

  const [view, setView] = useState<'details' | 'cook' | 'plan'>('details');
  const [rating, setRating] = useState<number>(recipe.rating ?? 0);
  const [savingRating, setSavingRating] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekKey>('current');
  const [selectedDay, setSelectedDay] = useState<'any' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'>('any');
  const [planServings, setPlanServings] = useState<number>(Math.max(1, recipe.servings || 1));
  const [planning, setPlanning] = useState(false);
  const [planMessage, setPlanMessage] = useState('');

  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const ingredients = recipe.ingredients ?? [];
  const grouped = ingredients.length > 0 && isCategory(ingredients[0]);
  const flatIngredients = useMemo(() => flattenIngredients(ingredients), [ingredients]);

  const exportPdf = () => {
    const html = `
      <html><head><title>${recipe.title}</title>
      <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#243124}
      h1{margin:0 0 10px}
      h2{margin:20px 0 8px;font-size:18px}
      li{margin:6px 0;line-height:1.4}
      .meta{color:#708C69;margin-bottom:14px}
      </style></head><body>
      <h1>${recipe.title}</h1>
      <div class="meta">${recipe.time || ''} ${recipe.servings ? ` - ${recipe.servings} servings` : ''}</div>
      <h2>Ingredients</h2>
      <ul>${flatIngredients.map((i) => `<li>${[i.amount, i.unit, i.ingredient, i.form].filter(Boolean).join(' ')}</li>`).join('')}</ul>
      <h2>Instructions</h2>
      <ol>${(recipe.steps || []).map((s) => `<li>${s}</li>`).join('')}</ol>
      ${(recipe.notes && recipe.notes.length > 0) ? `<h2>Notes</h2><ul>${recipe.notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const updateRating = async (next: number) => {
    setRating(next);
    setSavingRating(true);
    const value = next === 0 ? null : next;
    const { error } = await supabase
      .from('recipes')
      .update({ rating: value, updated_at: new Date().toISOString() })
      .eq('recipe_id', Number(recipe.id));

    setSavingRating(false);
    if (!error && onChanged) {
      onChanged({ ...recipe, rating: value });
    }
  };

  const planRecipe = async () => {
    setPlanning(true);
    setPlanMessage('');

    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email?.toLowerCase().trim();
    if (!email) {
      setPlanMessage('Please sign in first.');
      setPlanning(false);
      return;
    }

    const { data: appUser, error: userErr } = await supabase
      .from('app_users')
      .select('app_user_id')
      .eq('user_email_address', email)
      .single();

    if (userErr || !appUser?.app_user_id) {
      setPlanMessage('Could not find your app user profile.');
      setPlanning(false);
      return;
    }

    const week = weeks[selectedWeek];
    const plannedDate = selectedDay === 'any'
      ? toLocalDateStr(week.Monday)
      : toLocalDateStr(week[selectedDay]);

    const { error } = await supabase.from('planned_recipes').insert({
      recipe_id: recipe.id,
      planned_date: plannedDate,
      day_of_week: selectedDay,
      servings: Math.max(1, planServings),
      app_user_id: appUser.app_user_id,
      is_cooked: false,
    });

    if (error) {
      setPlanMessage('Could not add to plan.');
    } else {
      setPlanMessage('Added to your meal plan.');
    }

    setPlanning(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={recipe.title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 flex flex-col w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.20)]">
        <div className="relative w-full aspect-[16/7] shrink-0 bg-[#EDE9E1]">
          {recipe.image ? (
            <Image src={recipe.image} alt={recipe.title} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#A9B388]">
              <Flame size={42} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#314A2E] shadow hover:bg-white transition-colors" aria-label="Close recipe">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 border-b border-[#F0EDE6]">
          <h2 className="text-xl font-bold leading-snug text-[#243124]">{recipe.title}</h2>
          <div className="mt-2 mb-3 flex flex-wrap items-center gap-4">
            {recipe.time && <span className="flex items-center gap-1.5 text-sm text-[#708C69]"><Clock size={14} />{recipe.time}</span>}
            {recipe.servings && <span className="flex items-center gap-1.5 text-sm text-[#708C69]"><Users size={14} />{recipe.servings} servings</span>}
            {recipe.source && (
              <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#314A2E] underline underline-offset-2 hover:opacity-70 transition-opacity">
                <ExternalLink size={13} />Source
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#708C69]">Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => updateRating(n)} className="text-[#D8CDB9] hover:scale-105 transition-transform" title={`Rate ${n}`}>
                <Star size={16} className={n <= rating ? 'fill-[#E9B949] text-[#E9B949]' : 'text-[#D8CDB9]'} />
              </button>
            ))}
            <button onClick={() => updateRating(0)} className="ml-1 text-xs text-[#708C69] underline">Clear</button>
            {savingRating && <span className="text-xs text-[#A9B388]">Saving...</span>}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-white px-3 py-1.5 text-xs font-medium text-[#243124] hover:border-[#314A2E]"><FileDown size={13} />Export PDF</button>
            <button onClick={() => setView('plan')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-white px-3 py-1.5 text-xs font-medium text-[#243124] hover:border-[#314A2E]"><CalendarPlus size={13} />Plan</button>
            <button onClick={() => setView('cook')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-white px-3 py-1.5 text-xs font-medium text-[#243124] hover:border-[#314A2E]"><Flame size={13} />Cook now</button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setView('details')} className={`rounded-md px-3 py-1 text-xs font-semibold ${view === 'details' ? 'bg-[#314A2E] text-white' : 'bg-[#F5F2EB] text-[#708C69]'}`}>Details</button>
            <button onClick={() => setView('cook')} className={`rounded-md px-3 py-1 text-xs font-semibold ${view === 'cook' ? 'bg-[#314A2E] text-white' : 'bg-[#F5F2EB] text-[#708C69]'}`}>Cook</button>
            <button onClick={() => setView('plan')} className={`rounded-md px-3 py-1 text-xs font-semibold ${view === 'plan' ? 'bg-[#314A2E] text-white' : 'bg-[#F5F2EB] text-[#708C69]'}`}>Plan</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
          {view === 'details' && (
            <>
              {recipe.tags?.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {recipe.tags.map((tag) => <span key={tag} className="rounded-full border border-[#E8E4DC] bg-[#F5F2EB] px-2.5 py-0.5 text-xs font-medium text-[#708C69]">{tag}</span>)}
                </div>
              )}

              {ingredients.length > 0 && (
                <section className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Ingredients</h3>
                  {grouped ? (
                    (ingredients as IngredientCategory[]).map((group) => (
                      <div key={group.category} className="mb-4">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#314A2E]">{group.category}</p>
                        <ul className="space-y-1">{group.items.map((ing, i) => <IngredientRow key={i} ingredient={ing} />)}</ul>
                      </div>
                    ))
                  ) : (
                    <ul className="space-y-1">{(ingredients as Ingredient[]).map((ing, i) => <IngredientRow key={i} ingredient={ing} />)}</ul>
                  )}
                </section>
              )}

              {recipe.steps?.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Instructions</h3>
                  <ol className="space-y-4">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#314A2E] text-xs font-bold text-white">{i + 1}</span>
                        <p className="flex-1 text-sm leading-relaxed text-[#243124] pt-0.5">{step}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {recipe.notes && recipe.notes.length > 0 && (
                <section className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Notes</h3>
                  <ul className="space-y-2">
                    {recipe.notes.map((note, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#708C69]"><span className="text-[#D97442]">-</span>{note}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {view === 'cook' && (
            <>
              <section className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Cook checklist</h3>
                <div className="space-y-2">
                  {flatIngredients.map((ing, i) => {
                    const key = `ing-${i}`;
                    const checked = Boolean(checkedIngredients[key]);
                    return (
                      <button key={key} onClick={() => setCheckedIngredients((p) => ({ ...p, [key]: !checked }))} className="w-full flex items-center gap-2 rounded-md border border-[#E8E4DC] px-2 py-2 text-left">
                        <span className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? 'bg-[#314A2E] border-[#314A2E]' : 'border-[#CFC8BD]'}`}>
                          {checked && <Star size={10} className="text-white" />}
                        </span>
                        <span className={`text-sm ${checked ? 'line-through text-[#A9B388]' : 'text-[#243124]'}`}>
                          {[ing.amount, ing.unit, ing.ingredient, ing.form].filter(Boolean).join(' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Steps</h3>
                <div className="space-y-2">
                  {(recipe.steps || []).map((step, i) => {
                    const checked = Boolean(checkedSteps[i]);
                    return (
                      <button key={i} onClick={() => setCheckedSteps((p) => ({ ...p, [i]: !checked }))} className="w-full flex gap-2 rounded-md border border-[#E8E4DC] px-2 py-2 text-left">
                        <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center ${checked ? 'bg-[#314A2E] border-[#314A2E]' : 'border-[#CFC8BD]'}`}>
                          {checked && <Star size={10} className="text-white" />}
                        </span>
                        <span className={`text-sm ${checked ? 'line-through text-[#A9B388]' : 'text-[#243124]'}`}>{step}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {view === 'plan' && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#708C69]">Plan this recipe</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value as WeekKey)} className="rounded-md border border-[#E8E4DC] px-2 py-2 text-sm">
                  <option value="last">Last week</option>
                  <option value="current">This week</option>
                  <option value="next">Next week</option>
                </select>
                <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value as any)} className="rounded-md border border-[#E8E4DC] px-2 py-2 text-sm">
                  <option value="any">Anyday</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
                <input type="number" min={1} value={planServings} onChange={(e) => setPlanServings(Math.max(1, Number(e.target.value) || 1))} className="rounded-md border border-[#E8E4DC] px-2 py-2 text-sm" />
              </div>
              <button onClick={planRecipe} disabled={planning} className="rounded-lg bg-[#314A2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243124] disabled:opacity-60">
                {planning ? 'Adding...' : 'Add to plan'}
              </button>
              {planMessage && <p className="mt-2 text-sm text-[#708C69]">{planMessage}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function IngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const amount = ingredient.amount ? String(ingredient.amount) : '';
  const parts = [amount, ingredient.unit, ingredient.ingredient, ingredient.form].filter(Boolean).join(' ');
  return (
    <li className="flex items-start gap-2 text-sm text-[#243124]">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97442]" />
      {parts}
    </li>
  );
}
