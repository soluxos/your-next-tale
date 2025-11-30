"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { createClient } from "@/utils/supabase/client";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from "@/components/ui/hover-card";

import BookPopover from "@/components/book/BookPopover.jsx";
import BookDrawer from "@/components/book/BookDrawer.jsx";

const Book = (props) => {
  const [coverUrl, setCoverUrl] = useState(null);
  const { book, onImageLoad } = props;
  const { id, title, cover_url } = book;
  const [isHovered, setIsHovered] = useState(false);

  const drawerRef = useRef();

  useEffect(() => {
    if (!cover_url) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const bucketName = "books";

    // Use public URL directly - much faster than blob downloads
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cover_url}`;
    setCoverUrl(publicUrl);
  }, [cover_url]);

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
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <>
      <BookDrawer
        ref={drawerRef}
        book={book}
        coverUrl={coverUrl}
        onClose={closeDrawer}
      />

      <div
        className="ham"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <HoverCard>
          <HoverCardTrigger asChild>
            <div
              className="relative transition-all duration-200 ease-in-out cursor-pointer"
              onClick={openDrawer}
            >
              <div className="flex flex-col gap-1 relative z-10" key={id}>
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={`${title} cover`}
                    className={`w-full h-auto shadow-[0_0_64px_8px_rgba(0,0,0,0.2)] transform transition-all duration-200 ease-in-out rounded-sm ${
                      isHovered ? "-translate-y-2" : "hover:-translate-y-2"
                    }`}
                    onLoad={onImageLoad}
                    loading="lazy"
                  />
                )}
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
            <BookPopover book={book} onOpenDrawer={openDrawer} />
          </HoverCardContent>
        </HoverCard>
      </div>
    </>
  );
};

export default Book;
