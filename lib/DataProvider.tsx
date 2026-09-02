'use client';

// DataProvider — client-side multi-layer cache, mirroring the mobile app's
// CacheService + DatabaseService pattern:
//   1) Memory (React state) — instant, always used for rendering.
//   2) Persistent (localStorage) — survives reloads, hydrated synchronously
//      on mount so navigation never shows a blank/loading page.
//   3) Incremental sync — on (re)focviews we only ask Supabase for
//      "what changed since my last known timestamp" instead of re-fetching
//      everything, exactly like DatabaseService.getAllRecipes() does with
//      AsyncStorage on the mobile app.
//
// Because this provider is mounted once in AppChrome (which stays mounted
// across client-side navigation in the Next.js App Router — only the routed
// page segment swaps out), the cached data now survives page-to-page
// navigation instead of being re-fetched from the server on every click.

import type { AuthChangeEvent } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { mapDBRecipeToRecipe, normalizeJoinedIngredients } from './recipeMapping';
import { logTiming, now as perfNow } from './perfLog';
import { createBrowserSupabase } from './supabase';
import type { DBIngredient, DBRecipe, Recipe, RecipeCollection } from './types';
import type { PlannedRecipe } from './weeks';

const CACHE_VERSION = 1;
const KEYS = {
  META: 'stewdio:cache:meta:v1',
  RECIPES: 'stewdio:cache:recipes:v1',
  COLLECTIONS: 'stewdio:cache:collections:v1',
  PLANNED: 'stewdio:cache:planned:v1',
  PROFILE: 'stewdio:cache:profile:v1',
} as const;

// Mirrors DatabaseService.MEMORY_CACHE_DURATION (30s) for the heavy recipes
// resource, and a shorter window for the lighter-weight lists.
const RECIPES_TTL_MS = 30_000;
const SIDE_TTL_MS = 20_000;

interface CacheMeta {
  version: number;
  userId: string | null;
  lastDatabaseTimestamp: string | null;
  recipesSyncedAt: number;
  collectionsSyncedAt: number;
  plannedSyncedAt: number;
}

interface Profile {
  appUserId: string;
  username: string;
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable — cache is best-effort only.
  }
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  Object.values(KEYS).forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

function defaultMeta(): CacheMeta {
  return {
    version: CACHE_VERSION,
    userId: null,
    lastDatabaseTimestamp: null,
    recipesSyncedAt: 0,
    collectionsSyncedAt: 0,
    plannedSyncedAt: 0,
  };
}

function loadMeta(): CacheMeta {
  const meta = readCache<CacheMeta>(KEYS.META);
  return meta && meta.version === CACHE_VERSION ? meta : defaultMeta();
}

interface DataContextValue {
  isLoggedIn: boolean;
  authChecked: boolean;
  username: string;

  recipes: Recipe[];
  recipesReady: boolean;
  collections: RecipeCollection[];
  collectionsReady: boolean;
  plannedRecipes: PlannedRecipe[];
  plannedReady: boolean;

  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  setCollections: Dispatch<SetStateAction<RecipeCollection[]>>;
  setPlannedRecipes: Dispatch<SetStateAction<PlannedRecipe[]>>;

  refreshRecipes: (force?: boolean) => Promise<void>;
  refreshCollections: (force?: boolean) => Promise<void>;
  refreshPlannedRecipes: (force?: boolean) => Promise<void>;

  addOpen: boolean;
  openAddRecipe: () => void;
  closeAddRecipe: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useAppData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within a DataProvider');
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const supabase = createBrowserSupabase();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [username, setUsername] = useState('');

  const [recipes, setRecipesState] = useState<Recipe[]>(() => readCache<Recipe[]>(KEYS.RECIPES) ?? []);
  const [recipesReady, setRecipesReady] = useState(() => Boolean(readCache<Recipe[]>(KEYS.RECIPES)));
  const [collections, setCollectionsState] = useState<RecipeCollection[]>(() => readCache<RecipeCollection[]>(KEYS.COLLECTIONS) ?? []);
  const [collectionsReady, setCollectionsReady] = useState(() => Boolean(readCache<RecipeCollection[]>(KEYS.COLLECTIONS)));
  const [plannedRecipes, setPlannedRecipesState] = useState<PlannedRecipe[]>(() => readCache<PlannedRecipe[]>(KEYS.PLANNED) ?? []);
  const [plannedReady, setPlannedReady] = useState(() => Boolean(readCache<PlannedRecipe[]>(KEYS.PLANNED)));

  const [addOpen, setAddOpen] = useState(false);

  const metaRef = useRef<CacheMeta>(loadMeta());
  const profileRef = useRef<Profile | null>(readCache<Profile>(KEYS.PROFILE));
  const recipesRef = useRef(recipes);
  const inFlight = useRef<{ recipes: Promise<void> | null; collections: Promise<void> | null; planned: Promise<void> | null }>({
    recipes: null,
    collections: null,
    planned: null,
  });

  useEffect(() => {
    recipesRef.current = recipes;
  }, [recipes]);

  const resetForNewSession = useCallback(() => {
    metaRef.current = defaultMeta();
    profileRef.current = null;
    clearCache();
    setRecipesState([]);
    setCollectionsState([]);
    setPlannedRecipesState([]);
    setRecipesReady(false);
    setCollectionsReady(false);
    setPlannedReady(false);
  }, []);

  const setRecipes = useCallback<Dispatch<SetStateAction<Recipe[]>>>((updater) => {
    setRecipesState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Recipe[]) => Recipe[])(prev) : updater;
      writeCache(KEYS.RECIPES, next);
      return next;
    });
  }, []);

  const setCollections = useCallback<Dispatch<SetStateAction<RecipeCollection[]>>>((updater) => {
    setCollectionsState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: RecipeCollection[]) => RecipeCollection[])(prev) : updater;
      writeCache(KEYS.COLLECTIONS, next);
      return next;
    });
  }, []);

  const setPlannedRecipes = useCallback<Dispatch<SetStateAction<PlannedRecipe[]>>>((updater) => {
    setPlannedRecipesState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: PlannedRecipe[]) => PlannedRecipe[])(prev) : updater;
      writeCache(KEYS.PLANNED, next);
      return next;
    });
  }, []);

  const resolveProfile = useCallback(async (): Promise<Profile | null> => {
    const t0 = perfNow();
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email?.toLowerCase().trim();
    if (!email) {
      logTiming('resolveProfile: no authenticated user', t0);
      return null;
    }

    const { data: appUser } = await supabase
      .from('app_users')
      .select('app_user_id, username')
      .eq('user_email_address', email)
      .maybeSingle();

    logTiming('resolveProfile: getUser + app_users lookup', t0);
    if (!appUser?.app_user_id) return null;
    return { appUserId: appUser.app_user_id, username: appUser.username ?? '' };
  }, [supabase]);

  const fetchRecipesFromDb = useCallback(async (userId: string, since?: string | null) => {
    let query = supabase
      .from('recipes')
      .select('*, recipe_ingredients (*, ingredient_grocery_list_category (ingredient_id, name, category_grocery))')
      .eq('created_by_app_user_id', userId)
      .order('created_at', { ascending: false }) as any;

    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error || !data) return null;

    return (data as any[]).map((row) => {
      const { recipe_ingredients: rawIngredients = [], ...recipe } = row;
      const ingredients = normalizeJoinedIngredients(rawIngredients as DBIngredient[]);
      return mapDBRecipeToRecipe(recipe as DBRecipe, ingredients as DBIngredient[]);
    });
  }, [supabase]);

  /** Mirrors DatabaseService.getAllRecipes(): memory TTL → id/timestamp diff → incremental merge → full fetch fallback. */
  const refreshRecipes = useCallback(async (force = false) => {
    if (inFlight.current.recipes) {
      console.log('[cache] refreshRecipes: already in flight, reusing pending call');
      return inFlight.current.recipes;
    }

    const t0 = perfNow();
    const run = (async () => {
      const profile = profileRef.current ?? (await resolveProfile());
      if (!profile) {
        logTiming('refreshRecipes: no profile resolved (not logged in?)', t0);
        return;
      }

      if (metaRef.current.userId && metaRef.current.userId !== profile.appUserId) {
        resetForNewSession();
      }
      metaRef.current.userId = profile.appUserId;
      profileRef.current = profile;
      writeCache(KEYS.PROFILE, profile);
      setUsername(profile.username);
      setIsLoggedIn(true);

      const now = Date.now();
      const currentRecipes = recipesRef.current;

      if (!force && currentRecipes.length > 0 && now - metaRef.current.recipesSyncedAt < RECIPES_TTL_MS) {
        logTiming('refreshRecipes: TTL-fresh, skipped network', t0, { cachedCount: currentRecipes.length });
        return; // fresh enough — skip the network round trip entirely
      }

      const syncT0 = perfNow();
      const { data: syncRows } = await supabase
        .from('recipes')
        .select('recipe_id, updated_at')
        .eq('created_by_app_user_id', profile.appUserId);
      logTiming('refreshRecipes: sync-info query', syncT0, { rows: syncRows?.length ?? 0 });

      const syncRowsList = (syncRows ?? []) as Array<{ recipe_id: string | number; updated_at: string | null }>;
      const dbIds = new Set(syncRowsList.map((r) => String(r.recipe_id)));
      let latestTimestamp: string | null = null;
      for (const r of syncRowsList) {
        if (r.updated_at && (!latestTimestamp || r.updated_at > latestTimestamp)) {
          latestTimestamp = r.updated_at;
        }
      }

      if (!force && dbIds.size === 0 && currentRecipes.length > 0) {
        return; // likely a transient hiccup — keep showing cached data
      }

      const cachedIds = new Set(currentRecipes.map((r) => r.id));
      const deletedIds = [...cachedIds].filter((id) => !dbIds.has(id));
      const newIds = [...dbIds].filter((id) => !cachedIds.has(id));
      const timestampChanged = Boolean(
        latestTimestamp && metaRef.current.lastDatabaseTimestamp && latestTimestamp > metaRef.current.lastDatabaseTimestamp,
      );

      const needsFullFetch = force || currentRecipes.length === 0 || !metaRef.current.lastDatabaseTimestamp;

      if (!needsFullFetch && deletedIds.length === 0 && newIds.length === 0 && !timestampChanged) {
        metaRef.current.recipesSyncedAt = now;
        writeCache(KEYS.META, metaRef.current);
        logTiming('refreshRecipes: nothing changed', t0);
        return; // nothing changed
      }

      if (needsFullFetch) {
        const fetchT0 = perfNow();
        const fresh = await fetchRecipesFromDb(profile.appUserId);
        logTiming('refreshRecipes: full fetch query', fetchT0, { count: fresh?.length ?? 0 });
        if (fresh) {
          setRecipes(fresh);
          setRecipesReady(true);
          metaRef.current.lastDatabaseTimestamp = latestTimestamp ?? metaRef.current.lastDatabaseTimestamp;
          metaRef.current.recipesSyncedAt = now;
          writeCache(KEYS.META, metaRef.current);
        }
        logTiming('refreshRecipes: total (full fetch)', t0);
        return;
      }

      // Incremental: drop deletions, merge only the changed/new rows.
      let next = currentRecipes.filter((r) => !deletedIds.includes(r.id));
      if (newIds.length > 0 || timestampChanged) {
        const incT0 = perfNow();
        const changed = await fetchRecipesFromDb(profile.appUserId, metaRef.current.lastDatabaseTimestamp);
        logTiming('refreshRecipes: incremental fetch query', incT0, { changed: changed?.length ?? 0, deleted: deletedIds.length });
        if (changed && changed.length > 0) {
          const map = new Map(next.map((r) => [r.id, r]));
          changed.forEach((r) => map.set(r.id, r));
          next = Array.from(map.values()).sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
          });
        }
      }

      setRecipes(next);
      setRecipesReady(true);
      metaRef.current.lastDatabaseTimestamp = latestTimestamp ?? metaRef.current.lastDatabaseTimestamp;
      metaRef.current.recipesSyncedAt = now;
      writeCache(KEYS.META, metaRef.current);
      logTiming('refreshRecipes: total (incremental)', t0);
    })();

    inFlight.current.recipes = run;
    try {
      await run;
    } finally {
      inFlight.current.recipes = null;
    }
  }, [fetchRecipesFromDb, resetForNewSession, resolveProfile, setRecipes, supabase]);

  const refreshCollections = useCallback(async (force = false) => {
    if (inFlight.current.collections) return inFlight.current.collections;

    const t0 = perfNow();
    const run = (async () => {
      const profile = profileRef.current ?? (await resolveProfile());
      if (!profile) return;

      const now = Date.now();
      if (!force && metaRef.current.collectionsSyncedAt && now - metaRef.current.collectionsSyncedAt < SIDE_TTL_MS) {
        logTiming('refreshCollections: TTL-fresh, skipped network', t0);
        return;
      }

      const { data, error } = await supabase
        .from('recipe_collections')
        .select('*')
        .eq('app_user_id', profile.appUserId)
        .order('collection_name', { ascending: true });

      logTiming('refreshCollections: fetch query', t0, { count: data?.length ?? 0 });
      if (!error && data) {
        setCollections(data as RecipeCollection[]);
        setCollectionsReady(true);
        metaRef.current.collectionsSyncedAt = now;
        writeCache(KEYS.META, metaRef.current);
      }
    })();

    inFlight.current.collections = run;
    try {
      await run;
    } finally {
      inFlight.current.collections = null;
    }
  }, [resolveProfile, setCollections, supabase]);

  const refreshPlannedRecipes = useCallback(async (force = false) => {
    if (inFlight.current.planned) return inFlight.current.planned;

    const t0 = perfNow();
    const run = (async () => {
      const profile = profileRef.current ?? (await resolveProfile());
      if (!profile) return;

      const now = Date.now();
      if (!force && metaRef.current.plannedSyncedAt && now - metaRef.current.plannedSyncedAt < SIDE_TTL_MS) {
        logTiming('refreshPlannedRecipes: TTL-fresh, skipped network', t0);
        return;
      }

      const { data, error } = await supabase
        .from('planned_recipes')
        .select('*')
        .eq('app_user_id', profile.appUserId)
        .order('planned_date', { ascending: true });

      logTiming('refreshPlannedRecipes: fetch query', t0, { count: data?.length ?? 0 });
      if (!error && data) {
        setPlannedRecipes(data as PlannedRecipe[]);
        setPlannedReady(true);
        metaRef.current.plannedSyncedAt = now;
        writeCache(KEYS.META, metaRef.current);
      }
    })();

    inFlight.current.planned = run;
    try {
      await run;
    } finally {
      inFlight.current.planned = null;
    }
  }, [resolveProfile, setPlannedRecipes, supabase]);

  // Resolve auth once on mount, then react to sign-in/sign-out — mirrors
  // CacheService.handleLogin/handleLogout (clear cache on user switch).
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const t0 = perfNow();
      const { data: { user } } = await supabase.auth.getUser();
      logTiming('init: auth.getUser', t0);
      const email = user?.email?.toLowerCase().trim();

      if (!email) {
        if (!cancelled) {
          if (metaRef.current.userId) resetForNewSession();
          setIsLoggedIn(false);
          setAuthChecked(true);
        }
        return;
      }

      if (cancelled) return;
      setAuthChecked(true);
      void refreshRecipes();
      void refreshCollections();
      void refreshPlannedRecipes();
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        resetForNewSession();
        setIsLoggedIn(false);
        setAuthChecked(true);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setAuthChecked(true);
        void refreshRecipes();
        void refreshCollections();
        void refreshPlannedRecipes();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshCollections, refreshPlannedRecipes, refreshRecipes, resetForNewSession, supabase]);

  const openAddRecipe = useCallback(() => setAddOpen(true), []);
  const closeAddRecipe = useCallback(() => setAddOpen(false), []);

  const value = useMemo<DataContextValue>(() => ({
    isLoggedIn,
    authChecked,
    username,
    recipes,
    recipesReady,
    collections,
    collectionsReady,
    plannedRecipes,
    plannedReady,
    setRecipes,
    setCollections,
    setPlannedRecipes,
    refreshRecipes,
    refreshCollections,
    refreshPlannedRecipes,
    addOpen,
    openAddRecipe,
    closeAddRecipe,
  }), [
    isLoggedIn, authChecked, username,
    recipes, recipesReady, collections, collectionsReady, plannedRecipes, plannedReady,
    setRecipes, setCollections, setPlannedRecipes,
    refreshRecipes, refreshCollections, refreshPlannedRecipes,
    addOpen, openAddRecipe, closeAddRecipe,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
