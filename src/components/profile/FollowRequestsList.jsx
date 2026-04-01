"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { acceptFollowRequest, declineFollowRequest } from "@/lib/follows";

export default function FollowRequestsList({ initialRequests, currentUserId }) {
  const [requests, setRequests] = useState(initialRequests);
  const [loading, setLoading] = useState(null);
  const supabase = createClient();

  async function handleAccept(followerId) {
    setLoading(followerId);
    try {
      await acceptFollowRequest(supabase, followerId, currentUserId);
      setRequests((prev) => prev.filter((r) => r.follower.id !== followerId));
    } finally {
      setLoading(null);
    }
  }

  async function handleDecline(followerId) {
    setLoading(followerId);
    try {
      await declineFollowRequest(supabase, followerId, currentUserId);
      setRequests((prev) => prev.filter((r) => r.follower.id !== followerId));
    } finally {
      setLoading(null);
    }
  }

  if (!requests.length) {
    return (
      <p className="font-departureMono uppercase text-[11px] text-textSecondary text-center py-12">
        No pending requests
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const avatarUrl = req.follower.avatar_url
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${req.follower.avatar_url}`
          : null;
        const isLoading = loading === req.follower.id;

        return (
          <div
            key={req.follower.id}
            className="flex items-center gap-3 p-3 border border-border rounded-[8px]"
          >
            <div className="w-10 h-10 rounded-full bg-[#f4f4f4] shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center
                                  font-departureMono text-[12px] text-textSecondary"
                >
                  {req.follower.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-ppMondwest text-[16px] truncate">
                {req.follower.full_name || req.follower.username}
              </p>
              <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                @{req.follower.username}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleAccept(req.follower.id)}
                disabled={isLoading}
                className="font-departureMono uppercase text-[10px] px-3 h-8
                           bg-[#1f1f1f] text-white rounded-[8px] hover:bg-[#353535]
                           transition-colors disabled:opacity-40"
              >
                {isLoading ? "..." : "Accept"}
              </button>
              <button
                onClick={() => handleDecline(req.follower.id)}
                disabled={isLoading}
                className="font-departureMono uppercase text-[10px] px-3 h-8
                           border border-border text-textSecondary rounded-[8px]
                           hover:bg-[#f4f4f4] transition-colors disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
