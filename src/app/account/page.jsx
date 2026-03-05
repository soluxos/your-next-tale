import UserSettings from "@/components/pages/user-settings/UserSettings";
import { createClient } from "@/utils/supabase/server";

export default async function Account() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return <UserSettings user={user} />;
}
