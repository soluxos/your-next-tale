import HomePage from "@/components/pages/home/HomePage";
import { countCatalogue, loadHomeLists } from "@/lib/books/catalogueRanks";
import { SFF } from "@/lib/genres";
import { createStaticClient } from "@/utils/supabase/static";

export const revalidate = 60;

export default async function Home() {
  const supabase = createStaticClient();
  const [lists, total] = await Promise.all([
    loadHomeLists(supabase).catch(() => null),
    countCatalogue(supabase, SFF).catch(() => null)
  ]);
  return <HomePage lists={lists || {}} total={total} />;
}
