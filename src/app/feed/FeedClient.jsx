"use client";
import Link from "next/link";
import FacehashAvatar from "@/components/profile/FacehashAvatar";

export default function FeedClient({ initialGroups }) {
  if (!initialGroups.length) {
    return (
      <div className="text-center py-16">
        <p className="font-ppMondwest text-[22px] mb-2">Nothing here yet</p>
        <p className="font-departureMono uppercase text-[11px] text-textSecondary">
          Follow some readers to see their activity
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {initialGroups.map((group, i) => (
        <FeedGroup key={i} group={group} />
      ))}
    </div>
  );
}

function FeedGroup({ group }) {
  const { user, activities } = group;

  return (
    <div className="border border-border rounded-[8px] overflow-hidden">
      {/* User header */}
      <Link
        href={`/u/${user?.username}`}
        className="flex items-center gap-3 p-4 hover:bg-[#f4f4f4] transition-colors"
      >
        <FacehashAvatar
          name={user?.full_name || user?.username}
          color={user?.facehash_color}
          size={32}
          className="shrink-0"
        />
        <div>
          <span className="font-ppMondwest text-[16px]">
            {user?.full_name || user?.username}
          </span>
          <span className="font-departureMono uppercase text-[10px] text-textSecondary ml-2">
            @{user?.username}
          </span>
        </div>
        <span className="ml-auto font-departureMono uppercase text-[10px] text-textSecondary">
          {formatTimeAgo(activities[0].created_at)}
        </span>
      </Link>

      {/* Activities in this group */}
      <div className="divide-y divide-border">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  const coverUrl = activity.book_cover_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${activity.book_cover_url}`
    : null;

  const label =
    {
      shelf_add: `Added to ${activity.shelf_name || "a shelf"}`,
      shelf_move: `Moved from ${activity.from_shelf_name || "?"} → ${activity.shelf_name || "?"}`,
      review: "Wrote a review",
      rating: `Rated ${"★".repeat(activity.metadata?.rating || 0)}`,
      shelf_create: `Created shelf "${activity.shelf_name}"`
    }[activity.activity_type] || activity.activity_type;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Book cover thumbnail */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={activity.book_title || ""}
          className="w-8 h-12 object-cover rounded-[4px] shrink-0"
        />
      ) : (
        <div className="w-8 h-12 bg-[#f4f4f4] rounded-[4px] shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-departureMono uppercase text-[10px] text-textSecondary">
          {label}
        </p>
        {activity.book_title && (
          <p className="font-ppMondwest text-[15px] text-textPrimary truncate mt-0.5">
            {activity.book_title}
          </p>
        )}
        {activity.activity_type === "review" &&
          activity.metadata?.review_snippet && (
            <p className="font-departureMono text-[11px] text-textSecondary mt-1 line-clamp-2">
              &ldquo;{activity.metadata.review_snippet}&rdquo;
            </p>
          )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
}
