import type { Recipe } from '@/lib/types';
import { Clock, Star, Users } from 'lucide-react';
import Image from 'next/image';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const hasImage = Boolean(recipe.image);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full bg-white rounded-xl border border-[#E8E4DC] overflow-hidden
                 shadow-[0_1px_4px_rgba(36,49,36,0.07)] hover:shadow-[0_4px_16px_rgba(36,49,36,0.12)]
                 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-[#EDE9E1]">
        {hasImage ? (
          <Image
            src={recipe.image!}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#A9B388]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a9 9 0 1 0 0 18A9 9 0 0 0 12 2Z" />
              <path d="M8 12h8M12 8v8" />
            </svg>
          </div>
        )}

        {/* Rating pill */}
        {recipe.rating != null && recipe.rating > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5">
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold text-white">
              {recipe.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex gap-2.5 px-3 py-3">
        {/* Terracotta accent bar */}
        <div className="w-[3px] shrink-0 self-stretch rounded-sm bg-[#D97442]" />

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[#243124] group-hover:text-[#314A2E]">
            {recipe.title}
          </p>

          <div className="flex flex-wrap gap-3">
            {recipe.time ? (
              <span className="flex items-center gap-1 text-xs text-[#708C69]">
                <Clock size={12} />
                {recipe.time}
              </span>
            ) : null}
            {recipe.servings ? (
              <span className="flex items-center gap-1 text-xs text-[#708C69]">
                <Users size={12} />
                {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
