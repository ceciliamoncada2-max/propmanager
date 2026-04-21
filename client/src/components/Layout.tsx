import { useLocation, Link } from "wouter";
import { Home, Building2, Users, ClipboardList, DollarSign, Wrench, Moon, Sun, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/inspections", label: "Inspections", icon: ClipboardList },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sidebar hidden md:flex flex-col py-6 px-3">
        <div className="flex items-center gap-3 px-3 mb-8">
          <svg aria-label="PropManager" viewBox="0 0 32 32" width="32" height="32" fill="none">
            <rect width="32" height="32" rx="7" fill="hsl(221 83% 53%)"/>
            <path d="M7 22V12.5L16 6l9 6.5V22H19v-6.5h-6V22H7z" fill="white"/>
          </svg>
          <span style={{ fontFamily: "'DM Serif Display', serif" }} className="text-white text-lg font-normal tracking-tight">PropManager</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${location === href ? "active" : ""}`}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-3">
          <button
            onClick={() => setDark(d => !d)}
            className="sidebar-link w-full"
            aria-label="Toggle dark mode"
            data-testid="theme-toggle"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
            <rect width="32" height="32" rx="7" fill="hsl(221 83% 53%)"/>
            <path d="M7 22V12.5L16 6l9 6.5V22H19v-6.5h-6V22H7z" fill="white"/>
          </svg>
          <span className="font-semibold text-base">PropManager</span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="p-1" data-testid="mobile-menu-toggle">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="sidebar flex flex-col py-6 px-3 w-56 mt-14">
            <nav className="flex flex-col gap-1 flex-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link ${location === href ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
