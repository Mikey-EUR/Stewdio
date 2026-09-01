'use client';

import AddRecipeWizard from '@/components/recipes/AddRecipeWizard';
import RecipeModal from '@/components/recipes/RecipeModal';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Recipe, RecipeCollection } from '@/lib/types';
import {
    BookOpen,
    Check,
    Clock,
    FolderCog,
    Pencil,
    Plus,
    Search,
    Star,
    Users,
    UtensilsCrossed,
    X
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

type SortMode = 'recent' | 'alpha' | 'rating';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'recent', label: 'Recently added' },
  { value: 'alpha', label: 'A-Z' },
  { value: 'rating', label: 'Top rated' },
];

function recipeImage(recipe: Recipe): string | null {
  return recipe.image ?? null;
}

function hasRecipeInCollection(collection: RecipeCollection, recipeId: string): boolean {
  return (collection.recipe_ids ?? []).includes(Number(recipeId));
}

function RecipeCard({
  recipe,
  onOpen,
  onEdit,
}: {
  recipe: Recipe;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="w-full rounded-xl border border-[#E8E4DC] bg-white overflow-hidden shadow-[0_1px_4px_rgba(36,49,36,0.07)] hover:shadow-[0_4px_16px_rgba(36,49,36,0.12)] transition-all duration-200">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="relative w-full aspect-[4/3] bg-[#EDE9E1]">
          {recipe.image ? (
            <Image
              src={recipe.image}
              alt={recipe.title}
              fill
              sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[#A9B388]">
              <UtensilsCrossed size={36} />
            </div>
          )}
          {recipe.rating != null && recipe.rating > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5">
              <Star size={10} className="fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-semibold text-white">{recipe.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2.5 px-3 py-3">
          <div className="w-[3px] shrink-0 self-stretch rounded-sm bg-[#D97442]" />
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[#243124]">{recipe.title}</p>
            <div className="flex flex-wrap gap-3">
              {recipe.time && (
                <span className="flex items-center gap-1 text-xs text-[#708C69]">
                  <Clock size={11} />{recipe.time}
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1 text-xs text-[#708C69]">
                  <Users size={11} />{recipe.servings} srv
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      <div className="border-t border-[#F0EDE6] px-3 py-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#314A2E] hover:text-[#243124]"
        >
          <Pencil size={12} /> Edit recipe
        </button>
      </div>
    </div>
  );
}

function ListRow({ recipe, onOpen, onEdit }: { recipe: Recipe; onOpen: () => void; onEdit: () => void }) {
  return (
    <div className="rounded-xl border border-[#E8E4DC] bg-white overflow-hidden hover:shadow-md transition-shadow">
      <button type="button" onClick={onOpen} className="w-full text-left flex">
        <div className="relative w-24 h-24 shrink-0 bg-[#EDE9E1]">
          {recipe.image ? (
            <Image src={recipe.image} alt={recipe.title} fill sizes="96px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#A9B388]">
              <UtensilsCrossed size={20} />
            </div>
          )}
        </div>
        <div className="flex flex-1 items-center gap-2.5 px-3 py-2.5">
          <div className="w-[3px] shrink-0 self-stretch rounded-sm bg-[#D97442]" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#243124] line-clamp-2">{recipe.title}</p>
            {recipe.time && (
              <span className="flex items-center gap-1 mt-1 text-xs text-[#708C69]"><Clock size={11} />{recipe.time}</span>
            )}
          </div>
        </div>
      </button>
      <div className="border-t border-[#F0EDE6] px-3 py-2">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#314A2E] hover:text-[#243124]">
          <Pencil size={12} /> Edit recipe
        </button>
      </div>
    </div>
  );
}

function CollectionManager({
  open,
  collections,
  recipes,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onSetRecipes,
}: {
  open: boolean;
  collections: RecipeCollection[];
  recipes: Recipe[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (collectionId: string, name: string) => Promise<void>;
  onDelete: (collectionId: string) => Promise<void>;
  onSetRecipes: (collectionId: string, recipeIds: number[]) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [membershipEditingId, setMembershipEditingId] = useState<string | null>(null);

  if (!open) return null;

  const activeMembership = collections.find((c) => c.collection_id === membershipEditingId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#243124]">Manage collections</h3>
          <button onClick={onClose} className="text-[#708C69] hover:text-[#243124]"><X size={18} /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection name"
            className="flex-1 rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]"
          />
          <button
            onClick={async () => {
              const name = newName.trim();
              if (!name) return;
              await onCreate(name);
              setNewName('');
            }}
            className="rounded-lg bg-[#314A2E] px-3 py-2 text-sm font-semibold text-white hover:bg-[#243124]"
          >
            <Plus size={14} className="inline mr-1" />Create
          </button>
        </div>

        <div className="space-y-2">
          {collections.map((c) => (
            <div key={c.collection_id} className="rounded-lg border border-[#E8E4DC] p-3">
              {editingId === c.collection_id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-md border border-[#E8E4DC] px-2 py-1.5 text-sm outline-none focus:border-[#314A2E]"
                  />
                  <button
                    onClick={async () => {
                      const name = editingName.trim();
                      if (!name) return;
                      await onRename(c.collection_id, name);
                      setEditingId(null);
                    }}
                    className="rounded-md bg-[#314A2E] px-2 py-1.5 text-xs text-white"
                  >Save</button>
                  <button onClick={() => setEditingId(null)} className="rounded-md border border-[#E8E4DC] px-2 py-1.5 text-xs">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#243124]">{c.collection_name}</p>
                    <p className="text-xs text-[#708C69]">{(c.recipe_ids ?? []).length} recipes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setMembershipEditingId(c.collection_id);
                      }}
                      className="rounded-md border border-[#E8E4DC] px-2 py-1 text-xs text-[#314A2E]"
                    >Recipes</button>
                    <button
                      onClick={() => {
                        setEditingId(c.collection_id);
                        setEditingName(c.collection_name);
                      }}
                      className="rounded-md border border-[#E8E4DC] px-2 py-1 text-xs"
                    >Rename</button>
                    <button
                      onClick={async () => {
                        await onDelete(c.collection_id);
                        if (membershipEditingId === c.collection_id) setMembershipEditingId(null);
                      }}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
                    >Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {activeMembership && (
          <div className="mt-5 rounded-lg border border-[#E8E4DC] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-[#243124]">{activeMembership.collection_name} recipes</p>
              <button onClick={() => setMembershipEditingId(null)} className="text-xs text-[#708C69]">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
              {recipes.map((r) => {
                const checked = hasRecipeInCollection(activeMembership, r.id);
                return (
                  <button
                    key={r.id}
                    onClick={async () => {
                      const next = new Set(activeMembership.recipe_ids ?? []);
                      const rid = Number(r.id);
                      if (next.has(rid)) next.delete(rid);
                      else next.add(rid);
                      await onSetRecipes(activeMembership.collection_id, Array.from(next));
                    }}
                    className="flex items-center gap-2 rounded-md border border-[#E8E4DC] px-2 py-2 text-left"
                  >
                    <span className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? 'bg-[#314A2E] border-[#314A2E]' : 'border-[#CFC8BD]'}`}>
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className="text-xs text-[#243124] line-clamp-1">{r.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeEditModal({
  open,
  recipe,
  collections,
  onClose,
  onSave,
}: {
  open: boolean;
  recipe: Recipe | null;
  collections: RecipeCollection[];
  onClose: () => void;
  onSave: (payload: {
    recipeId: string;
    title: string;
    time: string;
    servings: number;
    source: string;
    tags: string[];
    collectionIds: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [servings, setServings] = useState(1);
  const [source, setSource] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !recipe) return;
    setTitle(recipe.title ?? '');
    setTime(recipe.time ?? '');
    setServings(recipe.servings ?? 1);
    setSource(recipe.source ?? '');
    setTags((recipe.tags ?? []).join(', '));
    setSelectedCollections(
      collections
        .filter((c) => hasRecipeInCollection(c, recipe.id))
        .map((c) => c.collection_id),
    );
  }, [open, recipe, collections]);

  if (!open || !recipe) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#243124]">Edit recipe</h3>
          <button onClick={onClose} className="text-[#708C69] hover:text-[#243124]"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]" />
          <div className="grid grid-cols-2 gap-2">
            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Time" className="rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]" />
            <input type="number" min={1} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} placeholder="Servings" className="rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]" />
          </div>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source URL" className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm outline-none focus:border-[#314A2E]" />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#708C69]">Collections</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-auto">
              {collections.map((c) => {
                const checked = selectedCollections.includes(c.collection_id);
                return (
                  <button
                    key={c.collection_id}
                    onClick={() => {
                      setSelectedCollections((prev) =>
                        prev.includes(c.collection_id)
                          ? prev.filter((id) => id !== c.collection_id)
                          : [...prev, c.collection_id],
                      );
                    }}
                    className="flex items-center gap-2 rounded-md border border-[#E8E4DC] px-2 py-2 text-left"
                  >
                    <span className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? 'bg-[#314A2E] border-[#314A2E]' : 'border-[#CFC8BD]'}`}>
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className="text-xs text-[#243124] line-clamp-1">{c.collection_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={async () => {
              await onSave({
                recipeId: recipe.id,
                title: title.trim(),
                time: time.trim(),
                servings,
                source: source.trim(),
                tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                collectionIds: selectedCollections,
              });
              onClose();
            }}
            className="w-full rounded-lg bg-[#314A2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243124]"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecipesClient({
  initialRecipes,
  initialCollections,
}: {
  initialRecipes: Recipe[];
  initialCollections: RecipeCollection[];
}) {
  return (
    <Suspense fallback={null}>
      <RecipesClientContent
        initialRecipes={initialRecipes}
        initialCollections={initialCollections}
      />
    </Suspense>
  );
}

function RecipesClientContent({
  initialRecipes,
  initialCollections,
}: {
  initialRecipes: Recipe[];
  initialCollections: RecipeCollection[];
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initialCollectionFromUrl = searchParams.get('collection') ?? 'all';
  const shouldOpenAddFromUrl = searchParams.get('add') === '1';

  const supabase = createBrowserSupabase();

  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [collections, setCollections] = useState<RecipeCollection[]>(initialCollections);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedFilter, setSelectedFilter] = useState<string>(initialCollectionFromUrl);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(shouldOpenAddFromUrl);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setAddOpen(true);
    }
  }, [searchParams]);

  const handleCloseAdd = () => {
    setAddOpen(false);
    if (searchParams.get('add') !== '1') return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('add');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const collectionMap = useMemo(() => new Map(collections.map((c) => [c.collection_id, c])), [collections]);

  const collectionChips = useMemo(
    () => [
      { id: 'all', name: 'All collections' },
      ...collections.map((c) => ({ id: c.collection_id, name: c.collection_name })),
      { id: 'favorites', name: 'Favorites' },
    ],
    [collections],
  );

  const applySearch = (list: Recipe[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      const flatIngredients = (r.ingredients ?? []).flatMap((ing: any) => (ing.items ? ing.items : [ing]));
      return flatIngredients.some((ing: any) => String(ing.ingredient ?? '').toLowerCase().includes(q));
    });
  };

  const applySort = (list: Recipe[]) => {
    const next = [...list];
    if (sort === 'alpha') next.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'rating') next.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else next.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return next;
  };

  const filteredRecipes = useMemo(() => {
    let list = [...recipes];
    if (selectedFilter === 'favorites') {
      list = list.filter((r) => (r.rating ?? 0) > 0);
    } else if (selectedFilter !== 'all') {
      const coll = collectionMap.get(selectedFilter);
      const ids = new Set((coll?.recipe_ids ?? []).map(String));
      list = list.filter((r) => ids.has(r.id));
    }
    return applySort(applySearch(list));
  }, [recipes, search, sort, selectedFilter, collectionMap]);

  const grouped = useMemo(() => {
    if (selectedFilter !== 'all') return [] as Array<{ id: string; title: string; recipes: Recipe[] }>;

    const sections: Array<{ id: string; title: string; recipes: Recipe[] }> = [];
    const used = new Set<string>();

    for (const c of collections) {
      const ids = new Set((c.recipe_ids ?? []).map(String));
      const rs = applySort(applySearch(recipes.filter((r) => ids.has(r.id))));
      if (rs.length > 0) {
        rs.forEach((r) => used.add(r.id));
        sections.push({ id: c.collection_id, title: c.collection_name, recipes: rs });
      }
    }

    const uncategorized = applySort(applySearch(recipes.filter((r) => !used.has(r.id))));
    if (uncategorized.length > 0) {
      sections.push({ id: 'uncategorized', title: 'Uncategorized', recipes: uncategorized });
    }

    return sections;
  }, [selectedFilter, collections, recipes, search, sort]);

  const saveCollectionRecipes = async (collectionId: string, recipeIds: number[]) => {
    const { error } = await supabase
      .from('recipe_collections')
      .update({ recipe_ids: recipeIds })
      .eq('collection_id', collectionId);
    if (!error) {
      setCollections((prev) => prev.map((c) => (c.collection_id === collectionId ? { ...c, recipe_ids: recipeIds } : c)));
    }
  };

  const createCollection = async (name: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email?.toLowerCase().trim();
    if (!email) return;

    const { data: appUser } = await supabase
      .from('app_users')
      .select('app_user_id')
      .eq('user_email_address', email)
      .single();
    if (!appUser?.app_user_id) return;

    const { data, error } = await supabase
      .from('recipe_collections')
      .insert({ collection_name: name, app_user_id: appUser.app_user_id, recipe_ids: [] })
      .select('*')
      .single();

    if (!error && data) setCollections((prev) => [...prev, data as RecipeCollection]);
  };

  const renameCollection = async (collectionId: string, name: string) => {
    const { error } = await supabase
      .from('recipe_collections')
      .update({ collection_name: name })
      .eq('collection_id', collectionId);
    if (!error) {
      setCollections((prev) => prev.map((c) => (c.collection_id === collectionId ? { ...c, collection_name: name } : c)));
    }
  };

  const deleteCollection = async (collectionId: string) => {
    const { error } = await supabase.from('recipe_collections').delete().eq('collection_id', collectionId);
    if (!error) {
      setCollections((prev) => prev.filter((c) => c.collection_id !== collectionId));
      if (selectedFilter === collectionId) setSelectedFilter('all');
    }
  };

  const saveRecipe = async (payload: {
    recipeId: string;
    title: string;
    time: string;
    servings: number;
    source: string;
    tags: string[];
    collectionIds: string[];
  }) => {
    const recipeIdNum = Number(payload.recipeId);

    const { error } = await supabase
      .from('recipes')
      .update({
        title: payload.title,
        time: payload.time,
        servings: payload.servings,
        source: payload.source || null,
        tags: payload.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('recipe_id', recipeIdNum);

    if (!error) {
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === payload.recipeId
            ? {
                ...r,
                title: payload.title,
                time: payload.time,
                servings: payload.servings,
                source: payload.source || undefined,
                tags: payload.tags,
              }
            : r,
        ),
      );
    }

    for (const c of collections) {
      const has = (c.recipe_ids ?? []).includes(recipeIdNum);
      const shouldHave = payload.collectionIds.includes(c.collection_id);
      if (has === shouldHave) continue;
      const nextIds = shouldHave
        ? Array.from(new Set([...(c.recipe_ids ?? []), recipeIdNum]))
        : (c.recipe_ids ?? []).filter((id) => id !== recipeIdNum);
      await saveCollectionRecipes(c.collection_id, nextIds);
    }
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;

  return (
    <>
      <div className="mx-auto w-full" style={{ maxWidth: 1320 }}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#314A2E]">Recipes</h1>
            <p className="mt-1 text-sm text-[#708C69]">Your recipes by collections.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#314A2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243124] transition-all">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Recipe</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              onClick={() => setCollectionsOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-white px-3 py-2.5 text-sm font-semibold text-[#314A2E] hover:border-[#314A2E]"
            >
              <FolderCog size={15} /> Collections
            </button>
          </div>
        </div>

        <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-[#E8E4DC] bg-white px-3.5 py-2.5 shadow-[0_1px_4px_rgba(36,49,36,0.05)]">
          <Search size={16} className="shrink-0 text-[#A9B388]" />
          <input
            className="flex-1 bg-transparent text-sm text-[#243124] placeholder:text-[#B0AAA0] outline-none"
            placeholder="Search recipes or ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#A9B388] hover:text-[#708C69]"><X size={15} /></button>
          )}
        </div>

        <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
          {collectionChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedFilter(chip.id)}
              className={[
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                selectedFilter === chip.id
                  ? 'bg-[#314A2E] border-[#314A2E] text-white'
                  : 'bg-white border-[#E8E4DC] text-[#243124] hover:border-[#314A2E]',
              ].join(' ')}
            >
              {chip.id !== 'all' && chip.id !== 'favorites' && <BookOpen size={11} className="inline mr-1" />}
              {chip.id === 'favorites' && <Star size={11} className="inline mr-1" />}
              {chip.name}
            </button>
          ))}
        </div>

        <div className="mb-5 flex items-center gap-2">
          <button
            onClick={() => {
              const idx = SORT_OPTIONS.findIndex((o) => o.value === sort);
              setSort(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].value);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-white px-3 py-1.5 text-xs font-medium text-[#243124] hover:border-[#314A2E] transition-colors"
          >
            Sort: <span className="font-semibold">{sortLabel}</span>
          </button>
          <span className="flex-1 text-right text-xs text-[#A9B388]">{filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}</span>
          <div className="flex overflow-hidden rounded-lg border border-[#E8E4DC] bg-white">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={['px-2.5 py-1.5 text-xs transition-colors', view === v ? 'bg-[#F0EDE6] text-[#314A2E]' : 'text-[#A9B388]'].join(' ')}
              >
                {v === 'grid' ? '[]' : '='}
              </button>
            ))}
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <UtensilsCrossed size={48} className="text-[#C5BFB6]" />
            <p className="text-lg font-semibold text-[#243124]">Your cookbook is empty.</p>
            <p className="text-sm text-[#708C69] max-w-xs">Import your first recipe and start building your collection.</p>
          </div>
        ) : selectedFilter === 'all' && !search.trim() ? (
          <div className="space-y-7">
            {grouped.map((section) => (
              <section key={section.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-[#243124]">{section.title}</h2>
                  <span className="text-xs text-[#A9B388]">{section.recipes.length} {section.recipes.length === 1 ? 'recipe' : 'recipes'}</span>
                </div>
                {view === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {section.recipes.map((r) => (
                      <RecipeCard key={`${section.id}-${r.id}`} recipe={r} onOpen={() => setSelectedRecipe(r)} onEdit={() => setEditingRecipe(r)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {section.recipes.map((r) => (
                      <ListRow key={`${section.id}-${r.id}`} recipe={r} onOpen={() => setSelectedRecipe(r)} onEdit={() => setEditingRecipe(r)} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Search size={40} className="text-[#C5BFB6]" />
            <p className="text-lg font-semibold text-[#243124]">No recipes found.</p>
            <p className="text-sm text-[#708C69]">Try a different search or collection filter.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredRecipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} onOpen={() => setSelectedRecipe(r)} onEdit={() => setEditingRecipe(r)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredRecipes.map((r) => (
              <ListRow key={r.id} recipe={r} onOpen={() => setSelectedRecipe(r)} onEdit={() => setEditingRecipe(r)} />
            ))}
          </div>
        )}
      </div>

      <CollectionManager
        open={collectionsOpen}
        collections={collections}
        recipes={recipes}
        onClose={() => setCollectionsOpen(false)}
        onCreate={createCollection}
        onRename={renameCollection}
        onDelete={deleteCollection}
        onSetRecipes={saveCollectionRecipes}
      />

      <AddRecipeWizard
        open={addOpen}
        onClose={handleCloseAdd}
        collections={collections}
        onRecipeCreated={(created) => {
          setRecipes((prev) => [created, ...prev]);
        }}
        onCollectionCreated={(createdCollection) => {
          setCollections((prev) => [...prev, createdCollection]);
        }}
        onCollectionUpdated={(collectionId, recipeIds) => {
          setCollections((prev) => prev.map((c) => (c.collection_id === collectionId ? { ...c, recipe_ids: recipeIds } : c)));
        }}
      />

      <RecipeEditModal
        open={Boolean(editingRecipe)}
        recipe={editingRecipe}
        collections={collections}
        onClose={() => setEditingRecipe(null)}
        onSave={saveRecipe}
      />

      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onChanged={(updated) => {
            setRecipes((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
            setSelectedRecipe((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
          }}
        />
      )}
    </>
  );
}
