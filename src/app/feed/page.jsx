import { createClient } from "@/utils/supabase/server";
import { getFeed } from "@/lib/activities";
import { redirect } from "next/navigation";
import FeedClient from "./FeedClient";

export const metadata = {
  title: "Feed | Your Next Tale"
};

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groups = await getFeed(supabase, user.id);

  return (
    <div className="flex flex-col items-start justify-center">
      <div className="max-w-2xl mx-auto w-full p-4 md:p-8">
        <div className="mb-8">
          <h1 className="font-ppMondwest text-[32px]">Feed</h1>
          <p className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
            Recent activity from people you follow
          </p>
        </div>
        <FeedClient initialGroups={groups} userId={user.id} />
      </div>
    </div>
  );
}
