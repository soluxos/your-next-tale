/**
 * Backfill default shelves for all existing users.
 *
 * Run once with:  npm run backfill:shelves
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const DEFAULT_SHELVES = [
  { name: "Read", slug: "read", display_order: 0 },
  { name: "Currently Reading", slug: "currently-reading", display_order: 1 },
  { name: "Want to Read", slug: "want-to-read", display_order: 2 },
  { name: "Did Not Finish", slug: "did-not-finish", display_order: 3 }
];

async function run() {
  console.log("Fetching all users...");

  const {
    data: { users },
    error: usersError
  } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error("Error fetching users:", usersError);
    process.exit(1);
  }

  console.log(`Found ${users.length} users.`);
  let totalCreated = 0;
  let usersModified = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`Processing user ${i + 1} of ${users.length}: ${user.id}`);

    const rows = DEFAULT_SHELVES.map((shelf) => ({
      user_id: user.id,
      name: shelf.name,
      slug: shelf.slug,
      is_default: true,
      is_exclusive: true,
      display_order: shelf.display_order
    }));

    const { data, error } = await supabase
      .from("bookshelves")
      .upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`  Error for user ${user.id}:`, error.message);
      continue;
    }

    const created = data?.length || 0;
    if (created > 0) {
      totalCreated += created;
      usersModified++;
    }
  }

  console.log(
    `\nDone. Created ${totalCreated} shelves for ${usersModified} users.`
  );
}

run().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
