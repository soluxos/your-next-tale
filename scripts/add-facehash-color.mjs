import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

// Check if column exists by selecting it
const { error } = await supabase
  .from("profiles")
  .select("facehash_color")
  .limit(1);

if (error && error.message.includes("facehash_color")) {
  console.log("Column missing — adding facehash_color...");
  const { error: rpcErr } = await supabase.rpc("exec_sql", {
    query: "ALTER TABLE profiles ADD COLUMN facehash_color TEXT DEFAULT NULL;"
  });
  if (rpcErr) {
    console.log("RPC not available, try running this SQL manually:");
    console.log(
      "ALTER TABLE profiles ADD COLUMN facehash_color TEXT DEFAULT NULL;"
    );
    process.exit(1);
  }
  console.log("Column added successfully!");
} else if (error) {
  console.error("Unexpected error:", error.message);
} else {
  console.log("Column facehash_color already exists.");
}
