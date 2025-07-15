"use client"
import React, { useState } from "react"

const ScrapeBookPage = () => {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bookDetails, setBookDetails] = useState(null)

  const handleScrape = async () => {
    setLoading(true)
    setError(null)
    setBookDetails(null)

    try {
      const response = await fetch("/api/scrape-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error((await response.json()).error || "Failed to scrape the book details.")
      }

      const details = await response.json()
      setBookDetails(details)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Scrape Amazon Book</h1>
      <div className="mb-4">
        <label htmlFor="url" className="block text-sm font-medium text-gray-700">
          Amazon Book URL
        </label>
        <input
          type="text"
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Enter Amazon book URL"
        />
      </div>
      <button
        onClick={handleScrape}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? "Scraping..." : "Scrape Book"}
      </button>

      {error && <p className="text-red-500 mt-4">Error: {error}</p>}

      {bookDetails && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-bold mb-2">{bookDetails.title}</h2>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Author:</strong> {bookDetails.author}
          </p>
          <img src={bookDetails.imageUrl} alt={`${bookDetails.title} cover`} className="w-32 h-auto mb-4" />
          <p className="text-sm text-gray-700">
            <strong>Description:</strong> {bookDetails.description}
          </p>
        </div>
      )}
    </div>
  )
}

export default ScrapeBookPage
