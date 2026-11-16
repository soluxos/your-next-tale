// The genres the admin seeder can pull from Hardcover. Kept apart from
// seeder.js so the admin page can list them without loading the seeder's
// server-only code (image checks, API keys).
export const SEED_GENRES = [
  { query: "Fantasy", label: "Fantasy", minReaders: 100 },
  { query: "Epic Fantasy", label: "Epic Fantasy", minReaders: 50 },
  { query: "Science Fiction", label: "Sci-Fi", minReaders: 100 },
  { query: "Space Opera", label: "Space Opera", minReaders: 50 },
  { query: "Dystopia", label: "Dystopian", minReaders: 50 },
  { query: "Urban Fantasy", label: "Urban Fantasy", minReaders: 50 },
  { query: "Dark Fantasy", label: "Dark Fantasy", minReaders: 50 },
  { query: "Romantasy", label: "Romantasy", minReaders: 25 }
];
