'use client';

import RecipeModal from '@/components/recipes/RecipeModal';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Recipe } from '@/lib/types';
import type { PlannedRecipe, WeekKey, Weeks } from '@/lib/weeks';
import { getWeeks, toLocalDateStr } from '@/lib/weeks';
import { CalendarDays, Check, ChevronLeft, ChevronRight, List, Pencil, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

const DAYS = ['any', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type DayName = typeof DAYS[number];

const WEEK_LABELS: Record<WeekKey, string> = { last: 'Last week', current: 'This week', next: 'Next week' };

function weekDateRange(weeks: Weeks, key: WeekKey) {
  const mon = weeks[key].Monday;
  const sun = weeks[key].Sunday;
  return `${mon.toLocaleDateString('en-US', { month: 'short' })} ${mon.getDate()}\u2013${sun.getDate()}`;
}

function getRecipeImage(recipe: Recipe): string | null {
  return recipe.image ?? null;
}

// ── Tiny recipe card used in both views ──────────────────────────────────────

function PlanRecipeCard({
  recipe,
  pr,
  onRemove,
  onCookedToggle,
  onEdit,
  onDragStart,
  isDragging,
  onClick,
}: {
  recipe: Recipe;
  pr: PlannedRecipe;
  onRemove: () => void;
  onCookedToggle: () => void;
  onEdit: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const img = getRecipeImage(recipe);
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`flex items-center gap-3 bg-white rounded-xl p-2.5 shadow-sm cursor-pointer border border-[#E8E4DC] transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      {img ? (
        <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
          <Image src={img} alt={recipe.title} fill className="object-cover" unoptimized />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-lg bg-[#F0EDE6] flex items-center justify-center flex-shrink-0 text-xl">🍽️</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#243124] text-sm leading-tight line-clamp-2">{recipe.title}</p>
        {pr.servings > 1 && (
          <p className="text-xs text-[#708C69] mt-0.5">{pr.servings} servings</p>
        )}
        {pr.tag && (
          <span className="inline-block mt-0.5 text-[10px] bg-[#F0EDE6] text-[#708C69] px-2 py-0.5 rounded-full">{pr.tag}</span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={onCookedToggle}
          title="Mark cooked"
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${pr.is_cooked ? 'bg-[#314A2E] text-white' : 'bg-[#F0EDE6] text-[#708C69] hover:bg-[#e0ddd6]'}`}
        >
          <Check size={13} />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#F0EDE6] text-[#708C69] hover:bg-red-100 hover:text-red-500 transition-colors"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#F0EDE6] text-[#708C69] hover:bg-[#d7e3ce] hover:text-[#314A2E] transition-colors"
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

function AgendaEditModal({
  open,
  entry,
  onClose,
  onSave,
}: {
  open: boolean;
  entry: PlannedRecipe | null;
  onClose: () => void;
  onSave: (patch: Partial<PlannedRecipe>) => Promise<void>;
}) {
  const [day, setDay] = useState<DayName>('any');
  const [servings, setServings] = useState(1);
  const [tag, setTag] = useState('');
  const [cooked, setCooked] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setDay((DAYS.includes(entry.day_of_week as DayName) ? entry.day_of_week : 'any') as DayName);
    setServings(Math.max(1, entry.servings || 1));
    setTag(entry.tag ?? '');
    setCooked(Boolean(entry.is_cooked));
  }, [open, entry]);

  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#243124]">Agenda edit</h3>
          <button onClick={onClose} className="text-[#708C69]"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#708C69]">Day</label>
            <select value={day} onChange={(e) => setDay(e.target.value as DayName)} className="w-full rounded-md border border-[#E8E4DC] px-2 py-2 text-sm">
              {DAYS.map((d) => <option key={d} value={d}>{d === 'any' ? 'Anyday' : d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#708C69]">Servings</label>
            <input type="number" min={1} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-md border border-[#E8E4DC] px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#708C69]">Tag</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Optional tag" className="w-full rounded-md border border-[#E8E4DC] px-2 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#243124]">
            <input type="checkbox" checked={cooked} onChange={(e) => setCooked(e.target.checked)} />
            Mark as cooked
          </label>
          <button
            onClick={async () => {
              await onSave({ day_of_week: day, servings, tag, is_cooked: cooked });
              onClose();
            }}
            className="w-full rounded-lg bg-[#314A2E] py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recipe detail modal (simple) ──────────────────────────────────────────────

function RecipeQuickView({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const img = getRecipeImage(recipe);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto z-10"
        onClick={e => e.stopPropagation()}
      >
        {img && (
          <div className="relative w-full h-48">
            <Image src={img} alt={recipe.title} fill className="object-cover rounded-t-2xl" unoptimized />
          </div>
        )}
        <div className="p-5">
          <h2 className="text-xl font-bold text-[#243124]">{recipe.title}</h2>
          <div className="flex gap-3 text-sm text-[#708C69] mt-1">
            {recipe.time && <span>⏱ {recipe.time}</span>}
            {recipe.servings && <span>👤 {recipe.servings} servings</span>}
          </div>
          {recipe.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.map(t => (
                <span key={t} className="text-xs bg-[#F0EDE6] text-[#708C69] px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
          <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl bg-[#314A2E] text-white text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialPlannedRecipes: PlannedRecipe[];
  initialRecipes: Recipe[];
}

export default function PlanClient({ initialPlannedRecipes, initialRecipes }: Props) {
  const supabase = createBrowserSupabase();
  const weeks = getWeeks();

  const [selectedWeek, setSelectedWeek] = useState<WeekKey>('current');
  const [viewMode, setViewMode] = useState<'weekly' | 'agenda'>('weekly');
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [plannedRecipes, setPlannedRecipes] = useState<PlannedRecipe[]>(initialPlannedRecipes);
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingEntry, setEditingEntry] = useState<PlannedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recipe lookup map
  const recipeMap = Object.fromEntries(recipes.map(r => [r.id, r]));

  // Planned recipes for selected week
  const weekDates = weeks[selectedWeek];
  const weekStart = toLocalDateStr(weekDates.Monday);
  const weekEnd   = toLocalDateStr(weekDates.Sunday);

  const weekPRs = plannedRecipes.filter(pr => {
    if (pr.planned_date >= weekStart && pr.planned_date <= weekEnd) return true;
    // Also include 'any' day entries if they were planned within this week
    if (pr.day_of_week === 'any') {
      // Check if the planned_date falls in this week
      return pr.planned_date >= weekStart && pr.planned_date <= weekEnd;
    }
    return false;
  });

  // For agenda view — group by day
  const byDay = DAYS.reduce<Record<DayName, PlannedRecipe[]>>((acc, day) => {
    acc[day] = [];
    return acc;
  }, {} as Record<DayName, PlannedRecipe[]>);

  weekPRs.forEach(pr => {
    const day = (DAYS.includes(pr.day_of_week as DayName) ? pr.day_of_week : 'any') as DayName;
    byDay[day].push(pr);
  });

  // Refresh from server
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.from('planned_recipes').select('*').order('planned_date', { ascending: true });
    if (data) setPlannedRecipes(data as PlannedRecipe[]);
    setIsLoading(false);
  }, [supabase]);

  const handleRemove = async (pr: PlannedRecipe) => {
    setPlannedRecipes(prev => prev.filter(p => p.planned_recipe_id !== pr.planned_recipe_id));
    await supabase.from('planned_recipes').delete().eq('planned_recipe_id', pr.planned_recipe_id);
  };

  const handleCookedToggle = async (pr: PlannedRecipe) => {
    const next = !pr.is_cooked;
    setPlannedRecipes(prev => prev.map(p =>
      p.planned_recipe_id === pr.planned_recipe_id ? { ...p, is_cooked: next } : p
    ));
    await supabase.from('planned_recipes').update({ is_cooked: next, updated_at: new Date().toISOString() })
      .eq('planned_recipe_id', pr.planned_recipe_id);
  };

  const handleEditEntry = async (entry: PlannedRecipe, patch: Partial<PlannedRecipe>) => {
    const targetDay = (patch.day_of_week ?? entry.day_of_week) as DayName;
    const targetDate = targetDay === 'any'
      ? weekStart
      : toLocalDateStr(weekDates[targetDay as keyof typeof weekDates]);

    const updates = {
      day_of_week: targetDay,
      planned_date: targetDate,
      servings: patch.servings ?? entry.servings,
      tag: patch.tag ?? entry.tag ?? null,
      is_cooked: patch.is_cooked ?? entry.is_cooked,
      updated_at: new Date().toISOString(),
    };

    setPlannedRecipes((prev) => prev.map((p) =>
      p.planned_recipe_id === entry.planned_recipe_id ? { ...p, ...updates } : p,
    ));

    await supabase.from('planned_recipes').update(updates).eq('planned_recipe_id', entry.planned_recipe_id);
  };

  // Drag & drop (HTML5)
  const handleDragStart = (pr: PlannedRecipe) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', pr.planned_recipe_id);
    setDragId(pr.planned_recipe_id);
  };

  const handleDrop = async (day: DayName) => {
    if (!dragId) return;
    const pr = plannedRecipes.find(p => p.planned_recipe_id === dragId);
    if (!pr) return;
    setDragId(null);

    const toDate = day === 'any'
      ? weekStart
      : toLocalDateStr(weekDates[day as keyof typeof weekDates]);

    setPlannedRecipes(prev => prev.map(p =>
      p.planned_recipe_id === pr.planned_recipe_id ? { ...p, day_of_week: day, planned_date: toDate } : p
    ));
    await supabase.from('planned_recipes').update({
      day_of_week: day, planned_date: toDate, updated_at: new Date().toISOString()
    }).eq('planned_recipe_id', pr.planned_recipe_id);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragEnd = () => setDragId(null);

  const prevWeek = () => {
    if (selectedWeek === 'next') setSelectedWeek('current');
    else if (selectedWeek === 'current') setSelectedWeek('last');
  };
  const nextWeek = () => {
    if (selectedWeek === 'last') setSelectedWeek('current');
    else if (selectedWeek === 'current') setSelectedWeek('next');
  };

  // ── Weekly view ─────────────────────────────────────────────────────────

  const DAY_ORDER = ['any', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weeklyRecipes = weekPRs.slice().sort((a, b) => {
    return DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week);
  });

  const dayLabel = (pr: PlannedRecipe) => {
    if (pr.day_of_week === 'any') return 'Anyday';
    const date = weekDates[pr.day_of_week as keyof typeof weekDates];
    return date ? `${pr.day_of_week} ${date.getDate()}` : pr.day_of_week;
  };

  return (
    <main className="flex-1 overflow-auto bg-[#FAF3E0] min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-28 md:pb-10">

        {/* Title */}
        <h1 className="text-3xl font-bold text-[#3A4A1F] text-center mb-3">
          What are you cooking?
        </h1>

        {/* Week selector */}
        <div className="flex items-center justify-center gap-3 mb-4 relative">
          <button onClick={prevWeek} disabled={selectedWeek === 'last'} className="p-1 text-[#6B8E23] disabled:text-gray-300">
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => setShowWeekDropdown(v => !v)}
            className="text-base text-[#666] hover:text-[#3A4A1F] transition-colors"
          >
            {WEEK_LABELS[selectedWeek]} • {weekDateRange(weeks, selectedWeek)} ▼
          </button>
          <button onClick={nextWeek} disabled={selectedWeek === 'next'} className="p-1 text-[#6B8E23] disabled:text-gray-300">
            <ChevronRight size={24} />
          </button>

          {showWeekDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowWeekDropdown(false)} />
              <div className="absolute top-8 z-20 bg-white rounded-xl shadow-lg py-2 min-w-[220px]">
                {(['last', 'current', 'next'] as WeekKey[]).map(wk => (
                  <button
                    key={wk}
                    onClick={() => { setSelectedWeek(wk); setShowWeekDropdown(false); }}
                    className="w-full px-4 py-2.5 text-center text-[#3A4A1F] hover:bg-[#FAF3E0] transition-colors"
                  >
                    {WEEK_LABELS[wk]} • {weekDateRange(weeks, wk)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex rounded-xl overflow-hidden shadow-sm border border-[#E8E4DC]">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-5 py-2 text-sm font-medium transition-colors ${viewMode === 'weekly' ? 'bg-[#6B8E23] text-white' : 'bg-[#F4EBD0] text-[#3A4A1F] hover:bg-[#ece4cc]'}`}
            >
              <List size={15} /> Weekly
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center gap-1.5 px-5 py-2 text-sm font-medium transition-colors ${viewMode === 'agenda' ? 'bg-[#6B8E23] text-white' : 'bg-[#F4EBD0] text-[#3A4A1F] hover:bg-[#ece4cc]'}`}
            >
              <CalendarDays size={15} /> Agenda
            </button>
          </div>
        </div>

        {/* ── Weekly view ────────────────────────────────────────────── */}
        {viewMode === 'weekly' && (
          <div className="space-y-3">
            {weeklyRecipes.length === 0 ? (
              <div className="text-center py-16 text-[#A9B388]">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-lg font-medium">No meals planned</p>
                <p className="text-sm mt-1">Add recipes to your plan from the Recipes page</p>
              </div>
            ) : (
              weeklyRecipes.map(pr => {
                const recipe = recipeMap[pr.recipe_id];
                if (!recipe) return null;
                return (
                  <div key={pr.planned_recipe_id}>
                    <div className="text-xs font-semibold text-[#6B8E23] uppercase tracking-wider mb-1 px-1">
                      {dayLabel(pr)}
                    </div>
                    <PlanRecipeCard
                      recipe={recipe}
                      pr={pr}
                      onRemove={() => handleRemove(pr)}
                      onCookedToggle={() => handleCookedToggle(pr)}
                      onEdit={() => setEditingEntry(pr)}
                      onClick={() => setSelectedRecipe(recipe)}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Agenda view ────────────────────────────────────────────── */}
        {viewMode === 'agenda' && (
          <div className="space-y-4">
            {DAYS.map(day => {
              const prs = byDay[day];
              const isDropTarget = dragId !== null;
              const dayDate = day !== 'any' ? weekDates[day as keyof typeof weekDates] : null;

              return (
                <div
                  key={day}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl transition-colors ${isDropTarget ? 'bg-[#e8f0e0]' : ''}`}
                >
                  {/* Day bar */}
                  <div className="flex items-center gap-2 bg-[#6B8E23] rounded-lg px-3 py-2 mb-2">
                    <span className="text-white font-bold text-sm">{day === 'any' ? 'Anyday' : day}</span>
                    {dayDate && (
                      <span className="text-white/70 text-xs">{dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>

                  {/* Recipe cards */}
                  <div className="space-y-2 pl-0.5">
                    {prs.map(pr => {
                      const recipe = recipeMap[pr.recipe_id];
                      if (!recipe) return null;
                      return (
                        <PlanRecipeCard
                          key={pr.planned_recipe_id}
                          recipe={recipe}
                          pr={pr}
                          onRemove={() => handleRemove(pr)}
                          onCookedToggle={() => handleCookedToggle(pr)}
                          onEdit={() => setEditingEntry(pr)}
                          onDragStart={handleDragStart(pr)}
                          isDragging={dragId === pr.planned_recipe_id}
                          onClick={() => setSelectedRecipe(recipe)}
                        />
                      );
                    })}
                    {prs.length === 0 && (
                      <div className={`h-12 rounded-xl border-2 border-dashed flex items-center justify-center text-xs text-[#A9B388] ${isDropTarget ? 'border-[#6B8E23] bg-[#f0f5ea]' : 'border-[#E8E4DC]'}`}>
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AgendaEditModal
        open={Boolean(editingEntry)}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={(patch) => editingEntry ? handleEditEntry(editingEntry, patch) : Promise.resolve()}
      />
      {selectedRecipe && (
        <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
    </main>
  );
}
