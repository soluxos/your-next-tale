import { TABLES } from "@/lib/supabase/types";
import { recordActivity } from "@/lib/activities";

function slugFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
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
 * Create a custom bookshelf for a user.
 */
export async function createShelf(supabase, userId, { name, description }) {
  const slug = slugFromName(name);

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
    .update({ name: newName, slug: slugFromName(newName) })
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
