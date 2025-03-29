"use client"

import { useEffect, useState } from "react"
import Book from "@/components/book/book"

export default function BooksPage() {
  const pageSize = 1
  const [books, setBooks] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchMoreBooks()
  }, [])

  const fetchMoreBooks = async () => {
    setLoading(true)
    const start = page * pageSize
    const end = start + pageSize - 1

    try {
      const res = await fetch(`/api/books?start=${start}&end=${end}`)
      if (!res.ok) throw new Error("Failed to fetch books")

      const data = await res.json()
      console.log("data", data)
      if (data.Books && Array.isArray(data.Books)) {
        setBooks((prevBooks) => [...prevBooks, ...data.Books])
        setPage((prevPage) => prevPage + 1)
        if (data.Books.length < pageSize) setHasMore(false)
      } else {
        console.error("Fetched data is not an array:", data)
      }
    } catch (err) {
      console.error("Error fetching more books:", err)
    }

    setLoading(false)
  }

  return (
    <div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {books.map((book) => (
          <li key={book.id}>
            <Book {...book} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <button onClick={fetchMoreBooks} disabled={loading}>
          {loading ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  )
}
