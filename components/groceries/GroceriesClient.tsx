'use client';

import { useAppData } from '@/lib/DataProvider';
import type { Ingredient, IngredientCategory, Recipe } from '@/lib/types';
import type { WeekKey, Weeks } from '@/lib/weeks';
import { getWeeks, toLocalDateStr } from '@/lib/weeks';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AggIngredient {
  key: string;
  amount: number;
  unit: string;
  ingredient: string;
}

interface RecipeUsageEntry {
  title: string;
  amount: string;
  unit: string;
  day: string;
  weekLabel: string;
}

const WEEK_ORDER: WeekKey[] = ['last', 'current', 'next'];
const WEEK_LABELS: Record<WeekKey, string> = { last: 'Last', current: 'This', next: 'Next' };
const ALL_DAYS = ['any', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAllIngredients(recipe: Recipe): Ingredient[] {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return [];
  const first = recipe.ingredients[0];
  if (first && 'category' in first) {
    return (recipe.ingredients as IngredientCategory[]).flatMap(c => c.items);
  }
  return recipe.ingredients as Ingredient[];
}

function fmtAmount(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

function weekDateLabel(weeks: Weeks, wk: WeekKey) {
  const mon = weeks[wk].Monday;
  const sun = weeks[wk].Sunday;
  return `${mon.toLocaleDateString('en-US', { month: 'short' })} ${mon.getDate()}\u2013${sun.getDate()}`;
}

// ── Ingredient Info Modal ─────────────────────────────────────────────────────

function IngredientInfoModal({
  ingredient,
  usages,
  onClose,
}: {
  ingredient: string;
  usages: RecipeUsageEntry[];
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-y-auto z-10 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#243124] text-base capitalize">{ingredient}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-2">
          {usages.map((u, i) => (
            <div key={i} className="bg-[#FAF8F2] rounded-lg p-3 text-sm">
              <p className="font-medium text-[#243124]">{u.title}</p>
              <p className="text-[#708C69] text-xs mt-0.5">
                {u.amount} {u.unit} &bull; {u.day} &bull; {u.weekLabel}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GroceriesClient() {
  const weeks = getWeeks();
  const { recipes, plannedRecipes, refreshRecipes, refreshPlannedRecipes } = useAppData();

  const [selectedWeeks, setSelectedWeeks] = useState<WeekKey[]>(['current']);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [checkedOrder, setCheckedOrder] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [deselectedKeys, setDeselectedKeys] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<WeekKey>>(new Set(['current']));
  const [infoModal, setInfoModal] = useState<{ ingredient: string; usages: RecipeUsageEntry[] } | null>(null);

  useEffect(() => {
    void refreshRecipes();
    void refreshPlannedRecipes();
  }, [refreshRecipes, refreshPlannedRecipes]);

  const recipeMap = Object.fromEntries(recipes.map(r => [r.id, r]));

  // Load checked state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('stewdio:grocery-checked');
      if (raw) {
        const parsed = JSON.parse(raw) as { keys: string[]; order: string[] };
        setCheckedKeys(new Set(parsed.keys ?? []));
        setCheckedOrder(parsed.order ?? []);
      }
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('stewdio:grocery-checked', JSON.stringify({
        keys: [...checkedKeys],
        order: checkedOrder,
      }));
    } catch {}
  }, [checkedKeys, checkedOrder]);

  // ── Week date ranges ──────────────────────────────────────────────────────

  const getWeekRange = (wk: WeekKey) => ({
    start: toLocalDateStr(weeks[wk].Monday),
    end: toLocalDateStr(weeks[wk].Sunday),
  });

  // ── Recipe-week combos for selected weeks ─────────────────────────────────

  const recipeWeekCombos = useMemo(() => {
    return WEEK_ORDER.filter(wk => selectedWeeks.includes(wk)).flatMap(wk => {
      const { start, end } = getWeekRange(wk);
      const prsForWeek = plannedRecipes.filter(
        pr => pr.planned_date >= start && pr.planned_date <= end,
      );
      // Deduplicate by recipe within the week
      const seen = new Set<string>();
      return prsForWeek
        .filter(pr => { if (seen.has(pr.recipe_id)) return false; seen.add(pr.recipe_id); return true; })
        .map(pr => ({ weekKey: wk, recipeId: pr.recipe_id, title: recipeMap[pr.recipe_id]?.title ?? '' }));
    });
  }, [selectedWeeks, plannedRecipes, recipeMap]);

  const activeRecipeCombos = recipeWeekCombos.filter(c => !deselectedKeys.has(`${c.weekKey}|${c.recipeId}`));
  const allSelected = deselectedKeys.size === 0;

  // ── Ingredient aggregation ────────────────────────────────────────────────

  const { aggregated, infoMap } = useMemo(() => {
    const aggMap: Record<string, AggIngredient> = {};
    const iMap: Record<string, RecipeUsageEntry[]> = {};

    activeRecipeCombos.forEach(({ weekKey, recipeId }) => {
      const recipe = recipeMap[recipeId];
      if (!recipe) return;

      const baseServings = recipe.servings > 0 ? recipe.servings : 1;
      const { start, end } = getWeekRange(weekKey);
      const prsForRecipe = plannedRecipes.filter(
        pr => pr.recipe_id === recipeId && pr.planned_date >= start && pr.planned_date <= end,
      );
      const totalServings = prsForRecipe.reduce((s, pr) => s + (pr.servings || 1), 0) || baseServings;
      const ings = getAllIngredients(recipe);
      const weekLabel = WEEK_LABELS[weekKey] + ' week';

      ings.forEach(ing => {
        const key = `${ing.ingredient}|${ing.unit}`;
        const base = typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 0;
        const scaled = baseServings && base ? (base * totalServings) / baseServings : base;
        if (aggMap[key]) aggMap[key].amount += scaled;
        else aggMap[key] = { key, amount: scaled, unit: ing.unit, ingredient: String(ing.ingredient) };
      });

      prsForRecipe.forEach(pr => {
        const servings = pr.servings || 1;
        ings.forEach(ing => {
          const key = `${ing.ingredient}|${ing.unit}`;
          const base = typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 0;
          const scaled = baseServings && base ? ((base * servings) / baseServings).toFixed(2).replace(/\.00$/, '') : String(ing.amount ?? '');
          if (!iMap[key]) iMap[key] = [];
          iMap[key].push({ title: recipe.title, amount: scaled, unit: ing.unit, day: pr.day_of_week ?? 'Planned', weekLabel });
        });
      });
    });

    return { aggregated: Object.values(aggMap), infoMap: iMap };
  }, [activeRecipeCombos, plannedRecipes, recipeMap]);

  const needToBuy = aggregated.filter(a => !checkedKeys.has(a.key));
  const haveIt = checkedOrder.map(k => aggregated.find(a => a.key === k)).filter(Boolean) as AggIngredient[];

  const toggleChecked = (key: string) => {
    const nowChecked = checkedKeys.has(key);
    if (nowChecked) {
      setCheckedKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      setCheckedOrder(prev => prev.filter(k => k !== key));
    } else {
      setCheckedKeys(prev => new Set([...prev, key]));
      setCheckedOrder(prev => [...prev, key]);
    }
  };

  const toggleWeek = (wk: WeekKey) => {
    setSelectedWeeks(prev => {
      if (prev.includes(wk)) {
        if (prev.length === 1) return prev;
        return prev.filter(w => w !== wk);
      }
      return WEEK_ORDER.filter(w => [...prev, wk].includes(w));
    });
    setDeselectedKeys(prev => {
      const next = new Set(prev);
      [...next].forEach(k => { if (k.startsWith(`${wk}|`)) next.delete(k); });
      return next;
    });
  };

  const toggleAllRecipes = () => {
    if (allSelected) setDeselectedKeys(new Set(recipeWeekCombos.map(c => `${c.weekKey}|${c.recipeId}`)));
    else setDeselectedKeys(new Set());
  };

  const dropdownLabel = useMemo(() => {
    const active = recipeWeekCombos.length - deselectedKeys.size;
    const total = recipeWeekCombos.length;
    if (selectedWeeks.length === 1) return `${WEEK_LABELS[selectedWeeks[0]]} week \u00B7 ${active}/${total} recipes`;
    return `${selectedWeeks.length} weeks \u00B7 ${active}/${total} recipes`;
  }, [selectedWeeks, recipeWeekCombos, deselectedKeys]);

  // ── Ingredient row ────────────────────────────────────────────────────────

  function IngRow({ ing, suffix }: { ing: AggIngredient; suffix: string }) {
    const isChecked = checkedKeys.has(ing.key);
    return (
      <button
        key={ing.key + suffix}
        onClick={() => toggleChecked(ing.key)}
        className="w-full flex items-center gap-3 bg-white rounded-xl px-3 py-3 mb-2 shadow-sm border border-[#E8E4DC] text-left group"
      >
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isChecked ? 'bg-[#6B8E23] border-[#6B8E23]' : 'border-[#C5BFB5] bg-white'}`}>
          {isChecked && <Check size={13} className="text-white" />}
        </div>
        <span className={`flex-1 text-sm transition-colors ${isChecked ? 'line-through text-[#A9B388]' : 'text-[#243124]'}`}>
          <span className="font-semibold">{fmtAmount(ing.amount)} {ing.unit}{ing.unit ? ' ' : ''}</span>
          {ing.ingredient}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setInfoModal({ ingredient: ing.ingredient, usages: infoMap[ing.key] ?? [] }); }}
          className="w-6 h-6 rounded-full bg-[#6B8E23] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
        >
          i
        </button>
      </button>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-[#FAF3E0] min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-28 md:pb-10">

        {/* Title */}
        <h1 className="text-3xl font-bold text-[#3A4A1F] text-center mb-5">
          Grocery List
        </h1>

        {/* Week selector + Filter dropdown row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">

          {/* Week buttons */}
          <div className="flex gap-2">
            {WEEK_ORDER.map(wk => {
              const active = selectedWeeks.includes(wk);
              return (
                <button
                  key={wk}
                  onClick={() => toggleWeek(wk)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm ${active ? 'bg-[#FF6F61] text-white' : 'bg-[#A9B388] text-white opacity-70 hover:opacity-100'}`}
                >
                  {WEEK_LABELS[wk]}
                </button>
              );
            })}
          </div>

          {/* Filter dropdown button */}
          <div className="relative flex-1 w-full sm:w-auto">
            <button
              onClick={() => setShowFilter(v => !v)}
              className="w-full flex items-center justify-between gap-2 bg-[#6B8E23] text-white text-sm font-bold rounded-xl px-4 py-2.5 shadow-sm"
            >
              <span className="truncate">{dropdownLabel}</span>
              <ChevronDown size={16} className="flex-shrink-0" />
            </button>

            {showFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-[#E8E4DC] overflow-hidden max-h-[70vh] overflow-y-auto">
                  {/* All recipes toggle */}
                  <button
                    onClick={toggleAllRecipes}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#FAF8F2] transition-colors"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${allSelected ? 'bg-[#6B8E23] border-[#6B8E23]' : 'border-gray-300'}`}>
                      {allSelected && <Check size={11} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-[#243124]">All recipes</span>
                  </button>
                  <div className="border-t border-[#E8E4DC]" />

                  {/* Per-week sections */}
                  {WEEK_ORDER.map(wk => {
                    const combosForWeek = recipeWeekCombos.filter(c => c.weekKey === wk);
                    const isWeekActive = selectedWeeks.includes(wk);
                    const isExpanded = expandedWeeks.has(wk);

                    return (
                      <div key={wk}>
                        <div className="flex items-center px-4 py-2.5 hover:bg-[#FAF8F2]">
                          <button
                            onClick={() => toggleWeek(wk)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${isWeekActive ? 'bg-[#6B8E23] border-[#6B8E23]' : 'border-gray-300'}`}
                          >
                            {isWeekActive && <Check size={11} className="text-white" />}
                          </button>
                          <button
                            className="flex-1 flex items-center justify-between"
                            onClick={() => {
                              if (!isWeekActive) toggleWeek(wk);
                              setExpandedWeeks(prev => { const s = new Set(prev); s.has(wk) ? s.delete(wk) : s.add(wk); return s; });
                            }}
                          >
                            <div className="text-left">
                              <p className="text-sm font-semibold text-[#243124]">{WEEK_LABELS[wk]} week</p>
                              <p className="text-xs text-[#708C69]">{weekDateLabel(weeks, wk)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {isWeekActive && combosForWeek.length > 0 && (
                                <span className="text-xs text-[#708C69]">
                                  {combosForWeek.filter(c => !deselectedKeys.has(`${c.weekKey}|${c.recipeId}`)).length}/{combosForWeek.length}
                                </span>
                              )}
                              {combosForWeek.length > 0 && (
                                isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
                              )}
                            </div>
                          </button>
                        </div>

                        {isExpanded && isWeekActive && combosForWeek.length > 0 && (
                          <div className="pl-12 pr-4 pb-2">
                            {combosForWeek.map(({ recipeId, title }) => {
                              const ck = `${wk}|${recipeId}`;
                              const active = !deselectedKeys.has(ck);
                              return (
                                <button
                                  key={ck}
                                  onClick={() => {
                                    setDeselectedKeys(prev => {
                                      const s = new Set(prev);
                                      s.has(ck) ? s.delete(ck) : s.add(ck);
                                      return s;
                                    });
                                  }}
                                  className="w-full flex items-center gap-2 py-1.5 hover:text-[#314A2E]"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${active ? 'bg-[#6B8E23] border-[#6B8E23]' : 'border-gray-300'}`}>
                                    {active && <Check size={9} className="text-white" />}
                                  </div>
                                  <span className="text-sm text-[#243124] truncate">{title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="border-t border-[#E8E4DC]" />
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setShowFilter(false)}
                    className="w-full py-3 text-sm font-bold text-[#6B8E23] hover:bg-[#FAF8F2]"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ingredient list */}
        {aggregated.length === 0 ? (
          <div className="text-center py-16 text-[#A9B388]">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-lg font-medium">No ingredients yet</p>
            <p className="text-sm mt-1">Plan some meals for this week to see your shopping list</p>
          </div>
        ) : (
          <>
            <div>
              {needToBuy.map(ing => <IngRow key={ing.key + 'buy'} ing={ing} suffix="buy" />)}
            </div>

            {haveIt.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#A9B388] mb-3 px-1">I have it</p>
                {haveIt.map(ing => <IngRow key={ing.key + 'have'} ing={ing} suffix="have" />)}
              </div>
            )}
          </>
        )}
      </div>

      {infoModal && (
        <IngredientInfoModal
          ingredient={infoModal.ingredient}
          usages={infoModal.usages}
          onClose={() => setInfoModal(null)}
        />
      )}
    </main>
  );
}
