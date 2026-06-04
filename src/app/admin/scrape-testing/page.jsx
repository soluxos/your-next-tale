"use client";
import React, { useState } from "react";

const ScrapeBookPage = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookDetails, setBookDetails] = useState(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setBookDetails(null);

    try {
      const response = await fetch("/api/scrape-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(
          (await response.json()).error || "Failed to scrape the book details."
        );
      }

      const details = await response.json();
      setBookDetails(details);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ScrapeBookPage space-y-6">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-textSecondary">
          Scraper
        </p>
        <p className="font-ppMondwest text-textPrimary text-[28px] mt-1">
          Scrape Amazon Book
        </p>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="url"
          className="font-departureMono uppercase text-[10px] text-textSecondary"
        >
          Amazon Book URL
        </label>
        <input
          type="text"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="block w-full p-2 border border-border bg-white rounded-[8px] text-textPrimary font-departureMono text-[12px] placeholder:text-textSecondary focus:outline-none focus:border-[#1f1f1f]"
          placeholder="Enter Amazon book URL"
        />
      </div>
      <button
        onClick={handleScrape}
        disabled={loading}
        className="bg-[#1f1f1f] text-white font-departureMono uppercase text-[12px] min-h-[48px] px-8 rounded-[8px] disabled:opacity-40 hover:bg-[#484848] transition-colors"
      >
        {loading ? "Scraping..." : "Scrape Book"}
      </button>

      {error && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-[8px] px-4 py-3 font-departureMono text-[11px]">
          Error: {error}
        </p>
      )}

      {bookDetails && (
        <div className="border border-border rounded-[8px] p-6 space-y-3">
          <p className="font-ppMondwest text-textPrimary text-[22px]">
            {bookDetails.title}
          </p>
          <p className="font-departureMono uppercase text-[10px] text-textSecondary">
            {bookDetails.author}
          </p>
          {bookDetails.imageUrl && (
            <img
              src={bookDetails.imageUrl}
              alt={`${bookDetails.title} cover`}
              className="w-32 h-auto rounded-sm"
            />
          )}
          <p className="font-departureMono text-[11px] text-textSecondary whitespace-pre-wrap">
            {bookDetails.description}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScrapeBookPage;
