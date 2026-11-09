// Supabase answers at most 1,000 rows a request, so reading the whole books
// table goes a page at a time. `order` keeps the pages from overlapping.
const PAGE = 1000;

export async function selectAllBooks(supabase, columns, { order = "id", ascending = true } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("books")
      .select(columns)
      .order(order, { ascending })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { data: rows.length ? rows : null, error };
    rows.push(...data);
    if (data.length < PAGE) return { data: rows, error: null };
  }
}
