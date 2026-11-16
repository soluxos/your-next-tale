import { TABLES } from "@/lib/supabase/types";
import { recordActivity } from "@/lib/activities";

export function shelfSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export const DEFAULT_SHELVES = [
  { name: "Read", slug: "read", display_order: 0 },
  { name: "Currently Reading", slug: "currently-reading", display_order: 1 },
  { name: "Want to Read", slug: "want-to-read", display_order: 2 },
  { name: "Did Not Finish", slug: "did-not-finish", display_order: 3 }
];

/**
 * Make sure the four default (exclusive "status") shelves exist for a user.
 * Returns the full, ordered shelf list (re-fetched only if anything was
 * created). Safe to call repeatedly.
 */
export async function ensureDefaultShelves(supabase, userId, shelves) {
  const existing = new Set((shelves || []).map((s) => s.slug));
  const missing = DEFAULT_SHELVES.filter((d) => !existing.has(d.slug));
  if (!missing.length) return shelves;

  await supabase.from(TABLES.BOOKSHELVES).upsert(
    missing.map((d) => ({
      user_id: userId,
      name: d.name,
      slug: d.slug,
      is_default: true,
      is_exclusive: true,
      display_order: d.display_order
    })),
    { onConflict: "user_id,slug", ignoreDuplicates: true }
  );

  const { data } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });
  return data || shelves;
}

/**
 * Fetch all bookshelves for a user, ordered by display_order.
 */
export async function getUserShelves(supabase, userId) {
  const { data, error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create a custom bookshelf for a user. `silent` skips the feed activity
 * (used by imports, which may create many shelves at once).
 */
export async function createShelf(
  supabase,
  userId,
  { name, description },
  { silent = false } = {}
) {
  const slug = shelfSlug(name);

  const { data, error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .insert({
      user_id: userId,
      name,
      slug,
      description: description || null,
      is_default: false,
      is_exclusive: false,
      display_order: 999
    })
    .select()
    .single();

  if (error) throw error;

  if (silent) return data;

  recordActivity(supabase, {
    userId,
    type: "shelf_create",
    shelfId: data.id,
    shelfName: data.name
  });

  return data;
}

/**
 * Delete a custom shelf (only if is_default is false).
 */
export async function deleteShelf(supabase, shelfId) {
  const { data: shelf, error: fetchError } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("is_default, name")
    .eq("id", shelfId)
    .single();

  if (fetchError) throw fetchError;
  if (shelf.is_default) {
    throw new Error(
      `"${shelf.name}" is a default shelf and cannot be deleted.`
    );
  }

  const { error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .delete()
    .eq("id", shelfId);

  if (error) throw error;
}

/**
 * Rename a custom shelf (only if is_default is false).
 */
export async function renameShelf(supabase, shelfId, newName) {
  const { data: shelf, error: fetchError } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("is_default, name")
    .eq("id", shelfId)
    .single();

  if (fetchError) throw fetchError;
  if (shelf.is_default) {
    throw new Error(
      `"${shelf.name}" is a default shelf and cannot be renamed.`
    );
  }

  const { data, error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .update({ name: newName, slug: shelfSlug(newName) })
    .eq("id", shelfId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update the default_view for a shelf ('books' or 'reviews').
 */
export async function updateShelfDefaultView(supabase, shelfId, userId, view) {
  const { error } = await supabase
    .from("bookshelves")
    .update({ default_view: view })
    .eq("id", shelfId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Bulk update display_order for shelves.
 * @param {string[]} orderedShelfIds - shelf IDs in desired display order
 */
export async function updateShelfOrder(supabase, orderedShelfIds) {
  const updates = orderedShelfIds.map((id, index) => ({
    id,
    display_order: index
  }));

  // Supabase doesn't have a bulk-update-by-id in one call,
  // so we upsert with the id as the conflict key.
  const { error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .upsert(updates, { onConflict: "id" });

  if (error) throw error;
}
