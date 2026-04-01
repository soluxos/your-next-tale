import Link from "next/link";

export default function UserListItem({ user }) {
  const avatarUrl = user.avatar_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.avatar_url}`
    : null;

  return (
    <Link
      href={`/u/${user.username}`}
      className="flex items-center gap-3 p-3 rounded-[8px] hover:bg-[#f4f4f4]
                 transition-colors border border-transparent hover:border-border"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[#f4f4f4] shrink-0 overflow-hidden">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center
                          font-departureMono uppercase text-[12px] text-textSecondary"
          >
            {user.username?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>

      {/* Name and username */}
      <div className="flex-1 min-w-0">
        <p className="font-ppMondwest text-[16px] text-textPrimary truncate">
          {user.full_name || user.username}
        </p>
        <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
          @{user.username}
          {user.is_private && (
            <span className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f4]">
              Private
            </span>
          )}
        </p>
      </div>

      {/* Arrow */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-textSecondary shrink-0"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
