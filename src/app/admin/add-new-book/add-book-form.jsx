"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import BookUpload from "./BookUpload";
import BookSimple from "@/components/book/BookSimple";
import BookSearch from "@/components/add-book-form/BookSearch";
import BookDiscover from "@/components/add-book-form/BookDiscover";

const AddBookForm = () => {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadKey, setUploadKey] = useState(Date.now());
  const [similarBooks, setSimilarBooks] = useState([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [discoverTab, setDiscoverTab] = useState("discover"); // "discover" | "search"

  // New optional fields
  const [isbn13, setIsbn13] = useState("");
  const [genres, setGenres] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [publisher, setPublisher] = useState("");
  const [language, setLanguage] = useState("en");

  const checkSimilarTitles = async (title) => {
    if (title.trim().length <= 2) {
      setSimilarBooks([]);
      return;
    }

    const { data, error } = await supabase
      .from("books")
      .select("*")
      .ilike("title", `%${title}%`);

    if (error) {
      console.error("Error checking similar titles:", error);
      return;
    }

    setSimilarBooks(data);
  };

  // Utility function to replace ' . . .' with '...'
  const normalizeEllipsis = (value) => value.replace(/ \. \. \./g, "...");

  // Function to upload image from URL to Supabase storage
  const uploadImageFromUrl = async (imageUrl) => {
    try {
      if (!imageUrl) return null;

      // Fetch the image from the URL
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");

      const blob = await response.blob();

      // Generate a unique filename
      const fileExt = imageUrl.split(".").pop()?.split("?")[0] || "jpg"; // Remove query params and get extension
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("books")
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: false
        });

      if (error) throw error;

      return data.path;
    } catch (error) {
      console.error("Error uploading image from URL:", error);
      return null;
    }
  };

  // Function to populate form fields from search result
  const handleBookSelect = async (bookData) => {
    // Check if description is available before proceeding
    const rawDescription =
      bookData.synopsis || bookData.overview || bookData.excerpt || "";
    const cleanedDescription = rawDescription
      .replace(/<br\s*\/?>/gi, "\n") // Replace <br> tags with line breaks
      .replace(/<[^>]*>/g, "") // Remove any other HTML tags
      .replace(/\n\s*\n/g, "\n\n") // Clean up multiple consecutive line breaks
      .trim();

    // Exit early if no description is available
    if (!cleanedDescription) {
      console.log("No description available for this book, skipping selection");
      return;
    }

    setTitle(bookData.title || "");
    setAuthor(bookData.authors ? bookData.authors.join(", ") : "");
    setDescription(cleanedDescription);

    // Upload image from URL and set cover URL
    const imageUrl = bookData.image_original || bookData.image;
    if (imageUrl) {
      setIsUploadingCover(true);
      try {
        const uploadedPath = await uploadImageFromUrl(imageUrl);
        if (uploadedPath) {
          setCoverUrl(uploadedPath);
          setUploadKey(Date.now()); // Trigger re-render of BookUpload component
        } else {
          // Fallback to direct URL if upload fails
          setCoverUrl(imageUrl);
        }
      } catch (error) {
        console.error("Error uploading cover image:", error);
        // Fallback to direct URL if upload fails
        setCoverUrl(imageUrl);
      } finally {
        setIsUploadingCover(false);
      }
    } else {
      setCoverUrl("");
    }

    // Try to find an Amazon link in the prices array
    // (no longer used in the UI but preserved in data)

    // Clear similar books when selecting from search
    setSimilarBooks([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const trimmedDescription = description.trim();
    const trimmedCoverUrl = coverUrl.trim();

    const insertPayload = {
      title: trimmedTitle,
      authors: [trimmedAuthor],
      description: trimmedDescription,
      cover_url: trimmedCoverUrl,
      source: "manual"
    };

    if (isbn13.trim()) insertPayload.isbn_13 = isbn13.trim();
    if (genres.trim())
      insertPayload.genres = genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
    if (pageCount) insertPayload.page_count = parseInt(pageCount, 10);
    if (publishedDate) insertPayload.published_date = publishedDate;
    if (publisher.trim()) insertPayload.publisher = publisher.trim();
    if (language.trim()) insertPayload.language = language.trim();

    const { data, error } = await supabase
      .from("books")
      .insert([insertPayload]);

    if (error) {
      console.error("Error adding book:", error);
    } else {
      console.log("Book added:", data);
      alert("Book added successfully!");

      setTitle("");
      setAuthor("");
      setDescription("");
      setCoverUrl("");
      setUploadKey(Date.now());
      setSimilarBooks([]);
      setIsUploadingCover(false);
      setIsbn13("");
      setGenres("");
      setPageCount("");
      setPublishedDate("");
      setPublisher("");
      setLanguage("en");
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0D00FF]">
      {/* Left panel — Browse & Discover */}
      <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-primary font-departureMono uppercase text-[20px] text-white">
            Add New Book
          </h1>
          <p className="font-departureMono uppercase text-[12px] text-white/60">
            Browse recent &amp; trending books, or search to find exactly what
            you want.
          </p>
        </div>

        {/* Discover / Search tabs */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-0 border-b border-white/20">
            <button
              onClick={() => setDiscoverTab("discover")}
              className={`font-departureMono uppercase text-[11px] px-4 py-2 border-b-2 -mb-px transition-colors ${
                discoverTab === "discover"
                  ? "border-white text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setDiscoverTab("search")}
              className={`font-departureMono uppercase text-[11px] px-4 py-2 border-b-2 -mb-px transition-colors ${
                discoverTab === "search"
                  ? "border-white text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              Search
            </button>
          </div>

          {discoverTab === "discover" ? (
            <BookDiscover onBookSelect={handleBookSelect} />
          ) : (
            <BookSearch onBookSelect={handleBookSelect} />
          )}
        </div>
      </div>

      {/* Right panel — Book Form */}
      <div className="w-full lg:w-[440px] border-t lg:border-t-0 lg:border-l border-white/10 p-8 overflow-y-auto flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-primary font-departureMono uppercase text-[16px] text-white">
            Book Details
          </h2>
          <p className="font-departureMono uppercase text-[11px] text-white/60">
            Fill in manually or select a book from the left to pre-populate.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6 justify-between flex-grow h-auto"
        >
          <div className="flex flex-col gap-6">
            {/* Title Input */}
            <div className="w-full">
              <label
                htmlFor="title"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Title:
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  checkSimilarTitles(e.target.value);
                }}
                onBlur={(e) => {
                  const normalizedValue = normalizeEllipsis(
                    e.target.value.trim()
                  );
                  setTitle(normalizedValue);
                }}
                required
              />
            </div>

            {similarBooks.length > 0 && (
              <div className="mt-2 text-sm text-white">
                <p className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">
                  Similar titles found:
                </p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {similarBooks.map((book) => (
                    <div key={book.id}>
                      <BookSimple book={book} onImageLoad={() => {}} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Author Input */}
            <div className="w-full">
              <label
                htmlFor="author"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Author:
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                onBlur={(e) => {
                  const normalizedValue = normalizeEllipsis(
                    e.target.value.trim()
                  );
                  setAuthor(normalizedValue);
                }}
                required
              />
            </div>

            {/* Description Input */}
            <div className="w-full">
              <label
                htmlFor="description"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Description:
              </label>
              <textarea
                className="w-full border border-solid border-white px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={(e) => {
                  const normalizedValue = normalizeEllipsis(
                    e.target.value.trim()
                  );
                  setDescription(normalizedValue);
                }}
                rows="4"
                required
              ></textarea>
            </div>

            {/* Cover Upload */}
            <div className="w-full">
              <label
                htmlFor="coverUrl"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Cover Image:{" "}
                {isUploadingCover && (
                  <span className="text-orange-500">Uploading...</span>
                )}
              </label>
              <div className="border border-solid border-white p-4 bg-transparent flex items-center gap-4">
                <BookUpload
                  key={uploadKey}
                  url={coverUrl}
                  size={150}
                  onUpload={(url) => setCoverUrl(url.trim())}
                />
              </div>
              <input
                className="opacity-0 w-0 h-0"
                type="text"
                id="coverUrl"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                onBlur={(e) => setCoverUrl(e.target.value.trim())}
                required
              />
            </div>

            {/* ISBN-13 Input */}
            <div className="w-full">
              <label
                htmlFor="isbn13"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                ISBN-13 (optional):
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="isbn13"
                value={isbn13}
                onChange={(e) => setIsbn13(e.target.value)}
              />
            </div>

            {/* Genres Input */}
            <div className="w-full">
              <label
                htmlFor="genres"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Genres (comma-separated, optional):
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="genres"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="fantasy, science fiction"
              />
            </div>

            {/* Page Count Input */}
            <div className="w-full">
              <label
                htmlFor="pageCount"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Page Count (optional):
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="number"
                id="pageCount"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
              />
            </div>

            {/* Published Date Input */}
            <div className="w-full">
              <label
                htmlFor="publishedDate"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Published Date (optional):
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="date"
                id="publishedDate"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
              />
            </div>

            {/* Publisher Input */}
            <div className="w-full">
              <label
                htmlFor="publisher"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Publisher (optional):
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="publisher"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </div>

            {/* Language Input */}
            <div className="w-full">
              <label
                htmlFor="language"
                className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
              >
                Language:
              </label>
              <input
                className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
                type="text"
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] min-h-[48px] px-6 transition duration-200 hover:bg-gray-200 mt-2"
            type="submit"
          >
            Add the book pls
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddBookForm;
