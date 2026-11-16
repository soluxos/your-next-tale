"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/lib/follows";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export default function FollowButton({
  targetUserId,
  isPrivate,
  initialStatus = "none",
  className = ""
}) {
  const [status, setStatus] = useState(initialStatus || "none");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleClick() {
    setLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (status === "none") {
        const newStatus = await followUser(supabase, user.id, targetUserId);
        setStatus(newStatus);
        if (newStatus === "pending") {
          toast.success("Follow request sent", {
            description: "You'll see their shelves once they accept."
          });
        }
      } else {
        await unfollowUser(supabase, user.id, targetUserId);
        setStatus("none");
      }
    } catch (e) {
      console.error("Follow action failed:", e);
      toast.error("Couldn't update follow", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  const label = {
    none: isPrivate ? "Request to follow" : "Follow",
    pending: "Requested",
    accepted: "Following"
  }[status];

  const hoverLabel = { pending: "Cancel request", accepted: "Unfollow" }[status];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={status !== "none"}
      className={cn(
        "btn group/follow min-w-[120px]",
        status === "none" ? "btn-primary" : "btn-secondary",
        className
      )}
    >
      {loading ? (
        <Spinner />
      ) : hoverLabel ? (
        <>
          <span className="group-hover/follow:hidden">{label}</span>
          <span className="hidden group-hover/follow:inline">{hoverLabel}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
