export default function StarRating({ rating, size = 12 }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className={i <= rating ? "text-[#f59e0b]" : "text-[#d1d5db]"}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}
