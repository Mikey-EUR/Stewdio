'use client';

import RecipeModal from '@/components/recipes/RecipeModal';
import { useAppData } from '@/lib/DataProvider';
import type { Recipe, RecipeCollection } from '@/lib/types';
import {
    ArrowRight,
    BookOpen,
    ChefHat,
    Clock,
    Star,
    Users,
    UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collection {
  id: string;
  name: string;
  count: number;
  recipeIds: string[];
  image?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
}

// ─── Collection builder ───────────────────────────────────────────────────────

function buildCollections(
  recipes: Recipe[],
  dbCollections: RecipeCollection[],
): Collection[] {
  const recipeById = new Map(recipes.map((r) => [Number(r.id), r]));
  return dbCollections
    .map((c) => {
      const ids = (c.recipe_ids ?? []).map((id) => String(id));
      const count = ids.length;
      const image = (c.recipe_ids ?? [])
        .map((id) => recipeById.get(id)?.image)
        .find(Boolean);
      return {
        id: c.collection_id,
        name: c.collection_name,
        count,
        recipeIds: ids,
        image,
        Icon: BookOpen,
      };
    })
    .filter((c) => c.count > 0);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomeClient() {
  const { recipes, collections: dbCollections, username, isLoggedIn, authChecked, setRecipes } = useAppData();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const featured = recipes[0] ?? null;
  const recentRecipes = recipes.slice(0, 8);
  const collections = useMemo(
    () => buildCollections(recipes, dbCollections),
    [recipes, dbCollections],
  );

  const greeting = username ? `Welcome back, ${username}!` : 'Welcome back!';

  return (
    <main className="flex-1">
      <div className="mx-auto w-full px-5 py-6 sm:px-6 sm:py-10" style={{ maxWidth: 1320 }}>

        {/* ── Welcome ─────────────────────────────────────────────────────── */}
        <section className="mb-7">
          <h1 className="text-[1.75rem] sm:text-4xl font-bold tracking-tight text-[#243124] leading-tight">
            {greeting}
          </h1>
          <p className="mt-1.5 text-[#708C69] text-base">
            Let&apos;s make something delicious today&nbsp;🌿
          </p>
        </section>

        {/* ── Cook Tonight card ────────────────────────────────────────────── */}
        <section className="mb-9">
          {featured ? (
            <CookTonightCard recipe={featured} onOpen={() => setSelectedRecipe(featured)} />
          ) : (
            <EmptyHeroCard />
          )}
        </section>

        {/* ── Your Collections ─────────────────────────────────────────────── */}
        {collections.some((c) => c.count > 0) && (
          <section className="mb-9">
            <SectionHeader title="Your Collections" href="/recipes" cta="View all" />

            {/* Horizontal scroll on mobile, grid on wider screens */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory
                            sm:mx-0 sm:px-0 sm:overflow-visible sm:pb-0
                            sm:grid sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-4">
              {collections.map((c) => (
                <CollectionCard key={c.id} collection={c} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently Added ───────────────────────────────────────────────── */}
        {recentRecipes.length > 0 && (
          <section>
            <SectionHeader title="Recently Added" href="/recipes" cta="See all" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {recentRecipes.map((r) => (
                <MiniCard key={r.id} recipe={r} onOpen={() => setSelectedRecipe(r)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {recipes.length === 0 && authChecked && (isLoggedIn ? <GlobalEmptyState /> : <SignInPrompt />)}
      </div>

      {/* Recipe modal */}
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
    </main>
  );
}

// ─── Cook Tonight card ────────────────────────────────────────────────────────

function CookTonightCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const hasImg = Boolean(recipe.image);

  return (
    <div className="flex overflow-hidden rounded-2xl bg-white border border-[#E8E4DC]
                    shadow-[0_2px_12px_rgba(36,49,36,0.08)]
                    min-h-[180px] sm:min-h-[220px]">

      {/* Text */}
      <div className="flex-1 flex flex-col justify-center p-5 sm:p-7">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D97442]">
          Cook Tonight
        </span>

        <h2 className="mt-2 text-[1.4rem] sm:text-[1.75rem] font-bold leading-tight text-[#243124] line-clamp-2">
          {recipe.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {recipe.time && (
            <span className="flex items-center gap-1.5 text-sm text-[#708C69]">
              <Clock size={13} className="shrink-0" />
              {recipe.time}
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1.5 text-sm text-[#708C69]">
              <Users size={13} className="shrink-0" />
              {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
            </span>
          )}
        </div>

        <button
          onClick={onOpen}
          className="mt-5 self-start flex items-center gap-2 bg-[#314A2E] text-white
                     text-sm font-semibold px-5 py-2.5 rounded-lg
                     hover:bg-[#243124] transition-colors active:scale-[0.98]"
        >
          Cook Tonight
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Image */}
      <div className="relative w-[42%] sm:w-[45%] shrink-0">
        {hasImg ? (
          <Image
            src={recipe.image!}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 42vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#EDE9E1] flex items-center justify-center text-[#A9B388]">
            <UtensilsCrossed size={40} />
          </div>
        )}

        {/* Subtle save button */}
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center
                     rounded-full bg-white shadow-md text-[#708C69] hover:text-[#314A2E] transition-colors"
          aria-label="Save recipe"
        >
          <Star size={14} />
        </button>
      </div>
    </div>
  );
}

function EmptyHeroCard() {
  return (
    <div className="flex items-center justify-between overflow-hidden rounded-2xl bg-white
                    border border-[#E8E4DC] p-6 sm:p-8 gap-4 shadow-sm min-h-[180px]">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#D97442]">
          Cook Tonight
        </span>
        <h2 className="mt-2 text-xl font-bold text-[#243124]">No recipes yet</h2>
        <p className="mt-1 text-sm text-[#708C69]">
          Import your first recipe to get started.
        </p>
        <Link
          href="/recipes"
          className="mt-4 inline-flex items-center gap-2 bg-[#314A2E] text-white
                     text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#243124] transition-colors"
        >
          Import Recipe <ArrowRight size={15} />
        </Link>
      </div>
      <UtensilsCrossed size={56} className="text-[#D6CFC2] shrink-0 hidden sm:block" />
    </div>
  );
}

// ─── Collection card ──────────────────────────────────────────────────────────

function CollectionCard({ collection }: { collection: Collection }) {
  const { Icon, name, count, image } = collection;

  return (
    <Link
      href={`/recipes?collection=${collection.id}`}
      className="relative flex-none w-[140px] sm:w-auto aspect-square rounded-xl overflow-hidden
                 cursor-pointer hover:scale-[1.03] transition-transform duration-200 snap-start"
    >
      {/* Background */}
      {image ? (
        <Image src={image} alt={name} fill sizes="160px" className="object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[#4A6741]" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

      {/* Icon badge */}
      <div className="absolute top-2.5 left-2.5 flex h-8 w-8 items-center justify-center
                      rounded-full bg-white/90 shadow-sm">
        <Icon size={14} className="text-[#314A2E]" />
      </div>

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white font-semibold text-sm leading-tight line-clamp-1">{name}</p>
        <p className="text-white/75 text-xs mt-0.5">
          {count} {count === 1 ? 'recipe' : 'recipes'}
        </p>
      </div>
    </Link>
  );
}

// ─── Mini recipe card (Recently Added grid) ───────────────────────────────────

function MiniCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left group flex flex-col bg-white rounded-xl overflow-hidden
                 border border-[#E8E4DC] shadow-[0_1px_4px_rgba(36,49,36,0.06)]
                 hover:shadow-[0_4px_16px_rgba(36,49,36,0.12)] hover:-translate-y-0.5
                 transition-all duration-200"
    >
      <div className="relative w-full aspect-[4/3] bg-[#EDE9E1]">
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#A9B388]">
            <UtensilsCrossed size={24} />
          </div>
        )}
      </div>

      <div className="flex gap-2.5 p-2.5 sm:p-3">
        <div className="w-[3px] shrink-0 rounded-sm bg-[#D97442] self-stretch" />
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold text-[#243124] line-clamp-2 leading-snug mb-1">
            {recipe.title}
          </p>
          {recipe.time && (
            <span className="flex items-center gap-1 text-[11px] text-[#708C69]">
              <Clock size={11} />
              {recipe.time}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg sm:text-xl font-bold text-[#243124]">{title}</h2>
      <Link href={href} className="text-sm font-medium text-[#314A2E] hover:text-[#D97442] transition-colors">
        {cta}
      </Link>
    </div>
  );
}

// ─── Sign-in prompt (shown when not authenticated) ───────────────────────────────

function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="w-20 h-20 rounded-full bg-[#F0EDE6] flex items-center justify-center">
        <ChefHat size={36} className="text-[#708C69]" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#243124]">Welcome to Stewdio</p>
        <p className="mt-2 text-sm text-[#708C69] max-w-xs">
          Sign in to see your recipes, plan your week, and build your grocery list.
        </p>
      </div>
      <Link
        href="/login"
        className="flex items-center gap-2 bg-[#314A2E] text-white text-sm font-semibold
                   px-6 py-3 rounded-xl hover:bg-[#243124] transition-colors"
      >
        Sign in <ArrowRight size={15} />
      </Link>
    </div>
  );
}

// ─── Global empty state ───────────────────────────────────────────────────────

function GlobalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F0EDE6] flex items-center justify-center">
        <UtensilsCrossed size={28} className="text-[#A9B388]" />
      </div>
      <div>
        <p className="text-lg font-semibold text-[#243124]">Your kitchen is empty</p>
        <p className="mt-1 text-sm text-[#708C69] max-w-xs">
          Import your first recipe and start building your personal cookbook.
        </p>
      </div>
      <Link
        href="/recipes"
        className="flex items-center gap-2 bg-[#314A2E] text-white text-sm font-semibold
                   px-5 py-2.5 rounded-lg hover:bg-[#243124] transition-colors mt-2"
      >
        Get started <ArrowRight size={15} />
      </Link>
    </div>
  );
}
