"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { followUser, unfollowUser } from "@/lib/follows";

export default function FollowButton({
  targetUserId,
  isPrivate,
  initialStatus
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleClick() {
    setLoading(true);
    try {
      if (status === "none") {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        const newStatus = await followUser(supabase, user.id, targetUserId);
        setStatus(newStatus);
      } else {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        await unfollowUser(supabase, user.id, targetUserId);
        setStatus("none");
      }
    } catch (e) {
      console.error("Follow action failed:", e);
    } finally {
      setLoading(false);
    }
  }

  const label = {
    none: "Follow",
    pending: "Requested",
    accepted: "Following"
  }[status];

  const isPrimary = status === "none";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        font-departureMono uppercase text-[11px] rounded-[8px] px-5 h-[36px]
        transition-colors disabled:opacity-40
        ${
          isPrimary
            ? "bg-[#1f1f1f] text-white hover:bg-[#353535]"
            : "border border-border text-textSecondary hover:bg-[#f4f4f4] hover:text-textPrimary bg-white"
        }
      `}
    >
      {loading ? "..." : label}
    </button>
  );
}
