export default function ProfileLoading() {
  return (
    <div className="ProfileLoading grid grid-cols-[16px_auto_16px]">
      <div className="w-4 border border-border" />
      <div className="flex-1 p-8 space-y-6">
        {/* Profile header skeleton */}
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#f4f4f4] animate-pulse" />
          <div className="space-y-2">
            <div className="w-32 h-5 rounded-[8px] bg-[#f4f4f4] animate-pulse" />
            <div className="w-48 h-3 rounded-[8px] bg-[#f4f4f4] animate-pulse" />
          </div>
        </div>
        {/* Shelf tabs skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-24 h-8 rounded-[8px] bg-[#f4f4f4] animate-pulse"
            />
          ))}
        </div>
        {/* Book grid skeleton */}
        <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-[6px] bg-[#f4f4f4] animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="w-4 border border-border" />
    </div>
  );
}
