import { createClient } from "@/utils/supabase/server";
import { getPendingRequests } from "@/lib/follows";
import { redirect } from "next/navigation";
import FollowRequestsList from "@/components/profile/FollowRequestsList";

export const metadata = {
  title: "Follow Requests | Your Next Tale"
};

export default async function FollowRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requests = await getPendingRequests(supabase, user.id);

  return (
    <div className="FollowRequestsPage max-w-2xl mx-auto p-4 md:p-8">
      <h1 className="font-ppMondwest text-[28px] mb-6">Follow Requests</h1>
      <FollowRequestsList initialRequests={requests} currentUserId={user.id} />
    </div>
  );
}
