import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { isEnglishIsbn, isNonEnglishIsbn } from "../lib/books/isbnUtils.js";
import { fetchAndNormaliseBook } from "../lib/books/fetchAndNormaliseBook.js";

// Use service role key to bypass RLS for test inserts/upserts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Helper: true if string contains any Cyrillic characters
const hasCyrillic = (s) => /[\u0400-\u04FF]/.test(s || "");

// Clean up any test records from previous runs
async function cleanupTestRecords() {
  await supabase.from("books").delete().eq("hardcover_id", "350178");
}

// ─── ISBN utilities ──────────────────────────────────────────────────────────
describe("isEnglishIsbn", () => {
  it("accepts 978-0 ISBN", () => assert.ok(isEnglishIsbn("9780593820261")));
  it("accepts 978-1 ISBN", () => assert.ok(isEnglishIsbn("9781398715608")));
  it("accepts 979-8 ISBN", () => assert.ok(isEnglishIsbn("9798217287178")));
  it("rejects Russian 978-5 ISBN", () =>
    assert.ok(!isEnglishIsbn("9785044660779")));
  it("rejects French 978-2 ISBN", () =>
    assert.ok(!isEnglishIsbn("9782070612758")));
  it("rejects null / invalid", () => {
    assert.ok(!isEnglishIsbn(null));
    assert.ok(!isEnglishIsbn(""));
    assert.ok(!isEnglishIsbn("1234"));
  });
});

describe("isNonEnglishIsbn", () => {
  it("detects Russian 978-5", () =>
    assert.ok(isNonEnglishIsbn("9785044660779")));
  it("detects French 978-2", () =>
    assert.ok(isNonEnglishIsbn("9782070612758")));
  it("detects German 978-3", () =>
    assert.ok(isNonEnglishIsbn("9783423214124")));
  it("does NOT flag English 978-0", () =>
    assert.ok(!isNonEnglishIsbn("9780593820261")));
  it("does NOT flag English 978-1", () =>
    assert.ok(!isNonEnglishIsbn("9781398715608")));
});

// ─── Integration: fetchAndNormaliseBook ──────────────────────────────────────
describe("fetchAndNormaliseBook — Hardcover source, no ISBN", () => {
  before(async () => await cleanupTestRecords());

  it("resolves an English edition of Dungeon Crawler Carl", async () => {
    const input = {
      source: "hardcover",
      hardcover_id: "350178",
      preview: {
        title: "Dungeon Crawler Carl",
        author: "Matt Dinniman",
        isbn_13: null,
        isbn_10: null,
        cover_preview_url: null
      }
    };

    const result = await fetchAndNormaliseBook(input, supabase);

    assert.ok(result, "result must not be null");
    assert.ok(result.title, "result must have a title");

    // ISBN must be an English registration group
    if (result.isbn_13) {
      assert.ok(
        isEnglishIsbn(result.isbn_13),
        `isbn_13 ${result.isbn_13} must be English (978-0/978-1/979-8)`
      );
    }

    // Description quality
    assert.ok(
      result.description && result.description.length > 50,
      "must have a meaningful English description"
    );
    assert.ok(
      !hasCyrillic(result.description),
      "description must not contain Cyrillic"
    );

    // Author
    const authorStr = (result.authors || []).join(" ").toLowerCase();
    assert.ok(
      authorStr.includes("dinniman"),
      `authors must include dinniman, got: ${result.authors}`
    );

    console.log("✓ Hardcover result:", {
      isbn_13: result.isbn_13,
      title: result.title,
      descLen: result.description?.length,
      authors: result.authors
    });
  });
});

describe("fetchAndNormaliseBook — Russian ISBN input", () => {
  before(async () => await cleanupTestRecords());

  it("discards Russian ISBN and resolves English edition", async () => {
    const input = {
      source: "hardcover",
      hardcover_id: "350178",
      preview: {
        title: "Dungeon Crawler Carl",
        author: "Matt Dinniman",
        isbn_13: "9785044660779",
        isbn_10: null,
        cover_preview_url: null
      }
    };

    const result = await fetchAndNormaliseBook(input, supabase);

    assert.ok(result, "result must not be null");

    // The Russian ISBN must NOT be stored
    if (result.isbn_13) {
      assert.ok(
        result.isbn_13 !== "9785044660779",
        "Russian ISBN must be stripped"
      );
      assert.ok(
        isEnglishIsbn(result.isbn_13),
        `isbn_13 ${result.isbn_13} must be English`
      );
    }

    // Description quality
    assert.ok(
      result.description && result.description.length > 50,
      "must have a meaningful English description"
    );
    assert.ok(
      !hasCyrillic(result.description),
      "description must not contain Cyrillic"
    );

    // Author
    const authorStr = (result.authors || []).join(" ").toLowerCase();
    assert.ok(
      authorStr.includes("dinniman"),
      `authors must include dinniman, got: ${result.authors}`
    );

    console.log("✓ Russian ISBN result:", {
      isbn_13: result.isbn_13,
      title: result.title,
      descLen: result.description?.length,
      authors: result.authors
    });
  });
});
