"use client"

import { useEffect, useState } from "react"
import Book from "@/components/book/book"

export default function BooksPage() {
  const pageSize = 45
  const [books, setBooks] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [itemsPerRow, setItemsPerRow] = useState(9) // Default to 9 items per row

  useEffect(() => {
    // Calculate how many items fit in a row based on the screen size
    const handleResize = () => {
      const width = window.innerWidth
      if (width >= 1024) {
        setItemsPerRow(9) // Desktop: 9 items per row
      } else if (width >= 768) {
        setItemsPerRow(6) // Tablet: 6 items per row
      } else if (width >= 480) {
        setItemsPerRow(4) // Mobile: 3 items per row
      } else {
        setItemsPerRow(2) // Small screens: 2 items per row
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

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

  // Helper function to chunk books into rows
  const chunkBooks = (books, itemsPerRow) => {
    const rows = []
    for (let i = 0; i < books.length; i += itemsPerRow) {
      rows.push(books.slice(i, i + itemsPerRow))
    }
    return rows
  }

  const rows = chunkBooks(books, itemsPerRow)

  return (
    <div className="grid grid-cols-[16px_auto_16px]">
      <div className="w-4 h-full border border-solid border-border"></div>
      <div className="flex-1 flex-col w-full h-full">
        <div className="left-border w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
        <div id="grid-container" className="grid gap-4">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
              {row.map((book) => (
                <div key={book.id} className="w-full">
                  <Book {...book} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {hasMore && (
          <button onClick={fetchMoreBooks} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </button>
        )}
      </div>
      <div className="left-border w-4 h-full border border-solid border-border"></div>
    </div>
  )
}
