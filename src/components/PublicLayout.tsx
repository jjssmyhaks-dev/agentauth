import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const navLinks = [
  { label: "Product", href: "/product" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
];

const footerColumns = [
  { title: "Product", links: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Changelog", href: "/changelog" },
    { label: "Status", href: "/status" },
  ]},
  { title: "Developers", links: [
    { label: "SDKs", href: "/sdks" },
    { label: "API Reference", href: "/api-reference" },
    { label: "Docs", href: "/docs" },
  ]},
  { title: "Company", links: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ]},
  { title: "Legal", links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Security", href: "/security" },
  ]},
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-dashed border-hairline bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
            <span className="text-sm font-medium">AgentAuth</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                to={l.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  location.pathname === l.href
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/auth" className="hidden px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block">
              Sign In
            </Link>
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground transition-all hover:opacity-90 sm:text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>

      {/* Footer */}
      <footer className="border-t border-dashed border-hairline">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
                <span className="font-medium">AgentAuth</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Identity and permissions infrastructure for AI agents.
              </p>
            </div>
            {footerColumns.map((col) => (
              <div key={col.title}>
                <div className="eyebrow mb-4">{col.title}</div>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-hairline pt-6 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} AgentAuth. All rights reserved.</span>
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
