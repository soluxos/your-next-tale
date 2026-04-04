import Link from "next/link";
import FacehashAvatar from "@/components/profile/FacehashAvatar";

export default function UserListItem({ user }) {
  return (
    <Link
      href={`/u/${user.username}`}
      className="flex items-center gap-3 p-3 rounded-[8px] hover:bg-[#f4f4f4]
                 transition-colors border border-transparent hover:border-border"
    >
      {/* Avatar */}
      <FacehashAvatar
        name={user.full_name || user.username}
        color={user.facehash_color}
        size={40}
      />

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
