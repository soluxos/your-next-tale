import Link from "next/link";

const links = [
  { label: "Discover", href: "/" },
  { label: "Get Started", href: "/get-started" },
  { label: "Register Interest", href: "/register-interest" }
];

export default function Footer() {
  return (
    <footer className="bg-white px-6 py-5">
      <div className="max-w-full w-full px-5 mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-departureMono uppercase text-[10px] text-textSecondary">
          © {new Date().getFullYear()} Your Next Tale
        </span>

        <nav className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
