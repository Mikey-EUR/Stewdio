export default function RecipeCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-[#E8E4DC] overflow-hidden bg-white animate-pulse">
      {/* Image placeholder */}
      <div className="w-full aspect-[4/3] bg-[#EDE9E1]" />

      {/* Content placeholder */}
      <div className="flex gap-2.5 px-3 py-3">
        <div className="w-[3px] shrink-0 self-stretch rounded-sm bg-[#EDE9E1]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-4/5 rounded bg-[#EDE9E1]" />
          <div className="h-3 w-2/5 rounded bg-[#EDE9E1]" />
        </div>
      </div>
    </div>
  );
}
