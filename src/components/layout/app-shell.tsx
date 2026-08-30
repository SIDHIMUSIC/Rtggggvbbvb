import type { ReactNode } from "react";
import { SignedIn } from "@/lib/auth/gates";
import { MobileNav, Nav } from "./nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Nav />
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 md:pb-10">{children}</div>
      <SignedIn>
        <MobileNav />
      </SignedIn>
    </div>
  );
}
