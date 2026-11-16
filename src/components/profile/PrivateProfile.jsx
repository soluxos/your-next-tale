import Link from "next/link";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import FollowButton from "@/components/profile/FollowButton";

/** Shown in place of a private profile's shelves to anyone who isn't an accepted follower. */
export default function PrivateProfile({ profile, signedIn, followStatus }) {
  const name = profile.full_name || profile.username;
  return (
    <div className="page-x min-h-[70vh] flex items-center justify-center py-16">
      <div className="card max-w-md w-full px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center text-center gap-4">
        <FacehashAvatar name={name} color={profile.facehash_color} size={72} />
        <div>
          <h1 className="font-ppMondwest text-ink text-[30px] leading-none">{name}</h1>
          <p className="label text-textSecondary mt-2">@{profile.username}</p>
        </div>
        <div className="flex items-center gap-2 label text-textSecondary bg-paper-2 rounded-full px-3 h-8">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Private bookcase
        </div>
        <p className="font-ppMondwest text-[17px] leading-snug text-textSecondary">
          {followStatus === "pending"
            ? `Your request is waiting for ${name.split(" ")[0]} to accept. Their shelves will appear here once they do.`
            : `Only people ${name.split(" ")[0]} approves can see their shelves.`}
        </p>
        {signedIn ? (
          <FollowButton targetUserId={profile.id} isPrivate initialStatus={followStatus} />
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/u/${profile.username}`)}`}
            className="btn btn-primary"
          >
            Sign in to request access
          </Link>
        )}
      </div>
    </div>
  );
}
