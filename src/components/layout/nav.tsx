import { Link, useRouterState, useRouteContext } from "@tanstack/react-router";
import { Building2, Receipt, Settings, Users, Wallet } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserChip } from "@/components/auth/user-chip";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Board", icon: Building2 },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/payments", label: "Hisab", icon: Wallet },
  { to: "/bills", label: "Bills", icon: Receipt },
] as const;

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  const knownUser = user ?? (isPending ? sessionUser : null);
  const showAuthPulse = isPending && Boolean(sessionUser) && !user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-border bg-surface">
            <Building2 className="size-4 text-accent" />
          </span>
          <span className="font-display text-lg tracking-tight">Rentweb</span>
        </Link>

        {knownUser ? (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
              const Icon = l.icon;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-3.5" />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="flex items-center gap-1.5">
          {showAuthPulse ? (
            <div className="h-8 w-24 animate-pulse rounded-full bg-surface-2" />
          ) : knownUser ? (
            <>
              <Link
                to="/settings"
                className={cn(
                  "grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg",
                  pathname.startsWith("/settings") && "bg-surface-2 text-fg",
                )}
                aria-label="Building settings"
              >
                <Settings className="size-4" />
              </Link>
              <UserChip />
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg"
            >
              Owner sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="grid grid-cols-4">
        {links.map((l) => {
          const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "flex min-h-11 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
