/**
 * Shared layout for 404s, errors and dead links: an illustration, a mono
 * eyebrow ("404 · Page not found"), a serif title, a line of help and the
 * actions — contextual primary first, then the way home.
 *
 * Has no hooks so it renders from server pages and client error boundaries.
 */
export default function StatusPage({ eyebrow, title, children, actions, illustration = <EmptyShelf /> }) {
  return (
    <div className="StatusPage page-x min-h-[70vh] flex items-center justify-center py-16">
      <div className="text-center max-w-md flex flex-col items-center gap-4">
        {illustration}
        {eyebrow && <p className="label text-textSecondary">{eyebrow}</p>}
        <h1 className="font-ppMondwest text-ink text-[32px] sm:text-[36px] leading-[1.05]">{title}</h1>
        {children && <div className="font-ppMondwest text-[17px] leading-snug text-textSecondary text-pretty">{children}</div>}
        {actions && (
          <div className="flex flex-col xs:flex-row flex-wrap justify-center gap-2 mt-2 w-full xs:w-auto [&>*]:w-full xs:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** A shelf with a gap where a book should be. */
export function EmptyShelf() {
  return (
    <svg width="120" height="72" viewBox="0 0 120 72" fill="none" aria-hidden="true" className="mb-2">
      <rect x="0.5" y="0.5" width="119" height="71" rx="2" fill="#fff" stroke="#ddd" />
      <rect x="8" y="8" width="104" height="48" fill="#f4f4f4" stroke="#ddd" />
      <rect x="8" y="56" width="104" height="8" fill="#efefef" stroke="#ddd" />
      <rect x="20" y="26" width="10" height="30" rx="1" fill="#d9d6e8" />
      <rect x="32" y="20" width="9" height="36" rx="1" fill="#c9c5dc" />
      <rect x="44" y="30" width="22" height="7" rx="1" fill="#e2e0ec" transform="rotate(-18 44 30)" />
      <rect x="86" y="24" width="10" height="32" rx="1" fill="#e2e0ec" />
    </svg>
  );
}
