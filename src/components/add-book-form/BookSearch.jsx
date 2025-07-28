import { useState } from "react"
import BookSimple from "@/components/book/BookSimple"

/* Book Structure
{
  "total": 0,
  "books": [
    {
      "title": "string",
      "title_long": "string",
      "isbn": "string",
      "isbn13": "string",
      "dewey_decimal": ["string"],
      "binding": "string",
      "publisher": "string",
      "language": "en",
      "date_published": "2025-07-28",
      "edition": "string",
      "pages": 0,
      "dimensions": "string",
      "dimensions_structured": {
        "length": { "unit": "string", "value": 0 },
        "width": { "unit": "string", "value": 0 },
        "height": { "unit": "string", "value": 0 },
        "weight": { "unit": "string", "value": 0 }
      },
      "overview": "string",
      "image": "string",
      "image_original": "string",
      "msrp": 0,
      "excerpt": "string",
      "synopsis": "string",
      "authors": ["string"],
      "subjects": ["string"],
      "reviews": ["string"],
      "prices": [
        {
          "condition": "string",
          "merchant": "string",
          "merchant_logo": "string",
          "merchant_logo_offset": { "x": "string", "y": "string" },
          "shipping": "string",
          "price": "string",
          "total": "string",
          "link": "string"
        }
      ],
      "related": { "type": "string" },
      "other_isbns": [
        { "isbn": "string", "binding": "string" }
      ]
    }
  ]
}
*/

const BookSearch = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const apiKey = process.env.NEXT_PUBLIC_ISBNDB_API_KEY // Access the API key from environment variables
  const baseURL = "https://api2.isbndb.com" // Default base URL for basic plan

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      // Construct the URL with query parameters
      const url = `${baseURL}/books/${encodeURIComponent(query)}?page=1&pageSize=10&column=title&shouldMatchAll=0`

      const response = await fetch(url, {
        headers: {
          Authorization: apiKey, // Pass the API key in the Authorization header
          Accept: "application/json" // Ensure the response is JSON
        }
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data.books || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="book-search p-4">
      <h2 className="text-lg font-bold mb-4">Search for a Book</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="border border-gray-300 p-2 flex-grow"
          placeholder="Enter book title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      <div className="results grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {results.length > 0 ? (
          <>
            {console.log("Results:", results)} {/* Log the results array once */}
            {results.map((book) => (
              <BookSimple
                key={book.isbn13} // Use ISBN-13 as a unique key
                book={{
                  title: book.title, // Pass the title
                  cover_url: book.image_original // Pass the cover image URL
                }}
              />
            ))}
          </>
        ) : (
          !loading && <p>No results found.</p>
        )}
      </div>
    </div>
  )
}

export default BookSearch
