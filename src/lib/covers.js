/** Public URL for a catalogue cover (`books.cover_url` is a storage path). */
export function coverUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${path}`;
}

/**
 * Resized versions of a stored cover for `srcset`, so shelves don't download
 * full-size originals. Bounded boxes with resize=contain keep each cover's own
 * proportions (width alone would keep the original height). Covers stored as
 * full URLs elsewhere get no srcset.
 */
export function coverSrcSet(path) {
  if (!path || /^https?:\/\//.test(path)) return undefined;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/books/${path}`;
  return [240, 480]
    .map((w) => `${base}?width=${w}&height=${w * 1.5}&resize=contain&quality=75 ${w}w`)
    .join(", ");
}
