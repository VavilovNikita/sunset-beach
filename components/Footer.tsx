import Link from "next/link";

const links = [
  { href: "/about", label: "About Us" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy & Policies" },
  { href: "/koh-samui", label: "Koh Samui" },
  { href: "/contact", label: "Contact Us" },
];

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-8 md:grid-cols-2">
        <div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/70">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-coral transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-cream/70">
            Find us on{" "}
            <a
              href="https://web.facebook.com/Sunset-Beach-Resort-Spa-178908469512522"
              target="_blank"
              rel="noreferrer"
              className="text-coral hover:text-cream"
            >
              Facebook
            </a>
          </p>
        </div>
        <div className="md:text-right text-sm text-cream/50 space-y-1">
          <p>Copyright {new Date().getFullYear()} © The Sunset Beach Resort &amp; Spa, Samui Resort Thailand.</p>
          <p>All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
