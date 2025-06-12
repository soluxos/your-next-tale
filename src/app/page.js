"use client"
import React, { useEffect, useState, useRef } from "react"
import Book from "@/components/book/book"

export default function BooksPage() {
  const pageSize = 45
  const [books, setBooks] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [itemsPerRow, setItemsPerRow] = useState(9)
  const [tallestBookHeight, setTallestBookHeight] = useState() // Default min-height
  const bookRefs = useRef([]) // Store refs for each book

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width >= 1024) {
        setItemsPerRow(9)
      } else if (width >= 768) {
        setItemsPerRow(6)
      } else if (width >= 480) {
        setItemsPerRow(4)
      } else {
        setItemsPerRow(2)
      }
      updateTallestBookHeight() // Update tallest book height on resize
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    fetchMoreBooks()
    updateTallestBookHeight()
  }, [])

  useEffect(() => {
    // Call after books or itemsPerRow change
    updateTallestBookHeight()
  }, [books, itemsPerRow])

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

  const updateTallestBookHeight = () => {
    // Ensure refs are populated
    const heights = bookRefs.current.map((ref) => {
      if (ref) {
        return ref.offsetHeight + 16
      }
      return 0
    })

    const tallest = Math.max(...heights, 160) // Default to 260 if no books
    setTallestBookHeight(tallest)
  }

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
        <div id="grid-container" className="grid">
          {rows.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <div
                key={rowIndex}
                className="bg-[linear-gradient(to_bottom,_#F0F0F0,_#F8F8F8)] grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-0 pt-4 items-end overflow-hidden"
                style={{ minHeight: `${tallestBookHeight}px` }}
              >
                {row.map((book, bookIndex) => (
                  <div
                    key={book.id}
                    className="w-full"
                    ref={(el) => {
                      bookRefs.current[rowIndex * itemsPerRow + bookIndex] = el
                    }}
                  >
                    <Book book={book} {...book} />
                  </div>
                ))}
              </div>
              <div
                id={`row-${rowIndex}`}
                className="h-4 border-1 border-border border flex border-r-0 border-l-0 w-full"
              ></div>
            </React.Fragment>
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
