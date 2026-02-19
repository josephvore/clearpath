import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Search,
  Compass,
  Shield,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Phone,
  ExternalLink,
  Navigation,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show public layout on admin pages
  const isAdmin = location.startsWith("/admin");
  if (isAdmin) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Crisis Banner */}
      <div className="bg-red-50 border-b border-red-200 text-red-800 text-sm py-2 px-4 text-center">
        <Phone className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
        <span className="font-medium">If you or someone you know is in crisis:</span>{" "}
        <a
          href="tel:988"
          className="font-bold underline hover:text-red-900"
        >
          Call or text 988
        </a>{" "}
        (Suicide & Crisis Lifeline) or{" "}
        <a
          href="tel:911"
          className="font-bold underline hover:text-red-900"
        >
          911
        </a>{" "}
        for emergencies.
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="font-serif font-bold text-xl text-foreground tracking-tight">
                ClearPath
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/search" active={location === "/search"}>
                <Search className="w-4 h-4" />
                Search Programs
              </NavLink>
              <NavLink href="/find" active={location === "/find"}>
                <Compass className="w-4 h-4" />
                Guided Finder
              </NavLink>
              <NavLink href="/nearby" active={location === "/nearby"}>
                <Navigation className="w-4 h-4" />
                Nearby
              </NavLink>
              {user?.role === "admin" && (
                <NavLink href="/admin" active={location.startsWith("/admin")}>
                  <LayoutDashboard className="w-4 h-4" />
                  Admin
                </NavLink>
              )}
            </nav>

            {/* Right side */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-accent transition-colors">
                      <Avatar className="h-7 w-7 border">
                        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                          {user.name?.charAt(0).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {user.name ?? "User"}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="no-underline">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign in
                </Button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            <MobileNavLink
              href="/search"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Search className="w-4 h-4" />
              Search Programs
            </MobileNavLink>
            <MobileNavLink
              href="/find"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Compass className="w-4 h-4" />
              Guided Finder
            </MobileNavLink>
            <MobileNavLink
              href="/nearby"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Navigation className="w-4 h-4" />
              Nearby
            </MobileNavLink>
            {user?.role === "admin" && (
              <MobileNavLink
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                Admin
              </MobileNavLink>
            )}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-serif font-bold text-foreground">ClearPath</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Helping individuals and families discover treatment programs through
                transparent, citation-backed information.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
              <div className="space-y-2">
                <Link href="/search" className="block text-sm text-muted-foreground hover:text-foreground no-underline">
                  Search Programs
                </Link>
                <Link href="/find" className="block text-sm text-muted-foreground hover:text-foreground no-underline">
                  Guided Finder
                </Link>
                <Link href="/nearby" className="block text-sm text-muted-foreground hover:text-foreground no-underline">
                  Nearby Programs
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Crisis Resources</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <a href="tel:988" className="flex items-center gap-1.5 hover:text-foreground no-underline">
                  <Phone className="w-3.5 h-3.5" />
                  988 Suicide & Crisis Lifeline
                </a>
                <a
                  href="https://www.samhsa.gov/find-help/national-helpline"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-foreground no-underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  SAMHSA Helpline: 1-800-662-4357
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Disclaimer:</strong> ClearPath is an informational tool only and does not provide medical advice,
                diagnosis, or treatment recommendations. Information shown is extracted from public sources using AI and
                may contain inaccuracies. Always verify directly with providers. If you are in crisis, call 988 or 911.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors no-underline"
    >
      {children}
    </Link>
  );
}
