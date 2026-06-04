"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from "@/components/ui/hover-card";
import { useAdminBookEdit } from "@/hooks/useAdminBookEdit";
import BookPopover from "@/components/book/BookPopover.jsx";
import BookDrawer from "@/components/book/BookDrawer.jsx";

const Book = (props) => {
  const [coverUrl, setCoverUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { book: initialBook, onImageLoad, onDeleted, disableHover } = props;
  const [currentBook, setCurrentBook] = useState(initialBook);
  const { id, title, cover_url } = currentBook;

  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const router = useRouter();

  const adminEdit = useAdminBookEdit(currentBook);

  const drawerRef = useRef();

  // Ensure drawer only renders on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!cover_url) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const bucketName = "books";

    // Use public URL directly - much faster than blob downloads
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cover_url}`;
    setCoverUrl(publicUrl);
  }, [cover_url]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (onImageLoad) onImageLoad();
  };

  const openDrawer = () => {
    if (drawerRef.current) {
      drawerRef.current.open();
    }
  };

  const closeDrawer = () => {
    if (drawerRef.current) {
      drawerRef.current.close();
    }
    // Reset hover state when the drawer is closed
    setIsHovered(false);
    adminEdit.exitEditMode();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/books/${id}`, { method: "DELETE" });
      if (res.ok) {
        closeDrawer();
        setDeleted(true);
        if (onDeleted) onDeleted(id);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleMouseEnter = () => {
    if (!disableHover) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  if (deleted) return null;

  return (
    <>
      {mounted && (
        <BookDrawer
          ref={drawerRef}
          book={currentBook}
          coverUrl={coverUrl}
          onClose={closeDrawer}
          isAdmin={isAdmin}
          onDelete={handleDelete}
          deleting={deleting}
          adminEdit={adminEdit}
          onBookUpdated={(updatedBook) => {
            setCurrentBook(updatedBook);
            if (updatedBook.cover_url) {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              setCoverUrl(
                `${supabaseUrl}/storage/v1/object/public/books/${updatedBook.cover_url}`
              );
            }
            router.refresh();
          }}
        />
      )}

      <div
        className="z-10"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <HoverCard
          {...(disableHover ? { openDelay: 999999, closeDelay: 0 } : {})}
        >
          <HoverCardTrigger asChild>
            <div
              className="relative transition-all duration-200 ease-in-out cursor-pointer"
              onClick={openDrawer}
            >
              <div className="flex flex-col gap-1 relative z-10" key={id}>
                <div className="relative w-full">
                  {/* Skeleton placeholder shown until image loads */}
                  {!imageLoaded && (
                    <div
                      className="w-full bg-[#e0e0e0] rounded-sm animate-pulse"
                      style={{ aspectRatio: "2 / 3" }}
                    />
                  )}
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt={`${title} cover`}
                      draggable={false}
                      className={`w-full h-auto transform transition-all duration-200 ease-in-out rounded-sm ${
                        imageLoaded ? "opacity-100" : "opacity-0"
                      } ${imageLoaded ? "" : "absolute top-0 left-0"} ${
                        disableHover
                          ? ""
                          : isHovered
                            ? "-translate-y-2"
                            : "hover:-translate-y-2"
                      }`}
                      onLoad={handleImageLoad}
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
              <div className="w-full h-full absolute top-0 left-0 z-0"></div>
              {/* Invisible buffer area */}
              <div className="absolute bottom-[-8px] left-0 w-full h-2 bg-transparent"></div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            className="book-popover w-full max-w-[80vw] xs:max-w-[480px] p-4 bg-white shadow-lg rounded-lg"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <BookPopover
              book={currentBook}
              onOpenDrawer={openDrawer}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              deleting={deleting}
            />
          </HoverCardContent>
        </HoverCard>
      </div>
    </>
  );
};

export default Book;
