"use client";

import Link from "next/link";
import BookCover from "@/components/book/BookCover";
import { Bookcase, Shelf } from "@/components/bookcase/Bookcase";

const POINTS = [
  ["Track every book", "Read, reading, want to read and did-not-finish — one bookcase."],
  ["Remember them", "Rate, review and log your progress page by page."],
  ["Share your taste", "Follow friends and see what they’re picking up next."]
];

/** Two-column sign-in / sign-up frame: the pitch and a real shelf beside the form. */
export default function AuthShell({ title, subtitle, showcase = [], children, footer }) {
  return (
    <div className="AuthShell page-x py-10 sm:py-16">
      <div className="mx-auto max-w-5xl grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 items-center">
        <section className="order-2 lg:order-1 flex flex-col gap-6 w-full max-w-[440px] mx-auto lg:max-w-none lg:mx-0" aria-label="About Your Next Tale">
          <div>
            <p className="label text-textSecondary">Your next tale</p>
            <p className="font-ppMondwest text-ink text-[30px] sm:text-[40px] leading-[1.05] mt-3 max-w-[16ch]">
              Your whole reading life, on one beautiful bookcase
            </p>
          </div>
          {showcase.length > 0 && (
            <div className="max-w-[520px]" aria-hidden="true">
              <Bookcase>
                <Shelf grid={false} booksClassName="!gap-2 justify-center">
                  {showcase.map((b) => (
                    <div key={b.id} className="w-[15%] min-w-[44px] relative z-10">
                      <BookCover book={b} sizes="80px" />
                    </div>
                  ))}
                </Shelf>
              </Bookcase>
            </div>
          )}
          <ul className="grid gap-4 xl:grid-cols-3 max-w-[620px]">
            {POINTS.map(([head, body]) => (
              <li key={head} className="flex gap-3">
                <span className="mt-1 w-5 h-5 shrink-0 rounded-full bg-shelved-bg text-shelved flex items-center justify-center" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3 3 7-7" />
                  </svg>
                </span>
                <span>
                  <span className="block label text-ink">{head}</span>
                  <span className="block font-ppMondwest text-[15px] leading-snug text-textSecondary mt-1">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="order-1 lg:order-2 card p-6 sm:p-8 w-full max-w-[440px] mx-auto lg:mx-0 shadow-[0_10px_40px_-16px_rgba(0,0,0,0.18)]">
          <h1 className="font-ppMondwest text-ink text-[30px] leading-none">{title}</h1>
          {subtitle && (
            <p className="font-ppMondwest text-[16px] leading-snug text-textSecondary mt-2">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 pt-5 border-t border-line text-center">{footer}</div>}
        </section>
      </div>
    </div>
  );
}

export function Field({ id, label, hint, action, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="label text-ink">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="label text-textSecondary">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ tone = "error", children }) {
  if (!children) return null;
  const styles =
    tone === "error"
      ? "bg-[#fef3f2] border-[#fecdca] text-[#b42318]"
      : "bg-shelved-bg border-shelved-line text-shelved";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-[8px] border px-3 py-2.5 font-ppMondwest text-[15px] leading-snug ${styles}`}>
      {children}
    </p>
  );
}

export function AuthLink({ href, children }) {
  return (
    <Link href={href} className="text-ink underline underline-offset-4 hover:no-underline">
      {children}
    </Link>
  );
}
