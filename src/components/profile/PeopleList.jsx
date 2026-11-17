import Link from "next/link";
import UserListItem from "@/components/profile/UserListItem";

/** Followers / Following list, shown under the profile header. */
export default function PeopleList({ profile, title, people, emptyTitle, emptyText }) {
  const name = profile.full_name || profile.username;
  return (
    <div className="page-x mx-auto max-w-[1600px] pt-8 pb-24">
      <div className="max-w-2xl">
        <Link
          href={`/u/${encodeURIComponent(profile.username)}`}
          className="label text-textSecondary hover:text-ink inline-flex items-center gap-1.5 focus-ring rounded-[4px]"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to {name}&rsquo;s bookcase
        </Link>
        <h2 className="font-ppMondwest text-ink text-[30px] leading-none mt-4">
          {title}
          <span className="label text-textSecondary ml-3 align-middle">{people.length}</span>
        </h2>

        {people.length === 0 ? (
          <div className="card mt-6 px-6 py-10 text-center">
            <p className="font-ppMondwest text-[20px] text-ink">{emptyTitle}</p>
            {emptyText && (
              <p className="font-ppMondwest text-[16px] text-textSecondary mt-1">{emptyText}</p>
            )}
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {people.map((person) => (
              <li key={person.id}>
                <UserListItem user={person} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
