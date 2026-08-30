import { useState } from "react";
import { LogOut } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function UserChip() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Owner";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-8 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-medium">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-36 truncate sm:flex sm:flex-col">
        <span className="text-sm leading-tight text-fg">{label}</span>
        <span className="text-[11px] leading-tight text-muted">Owner</span>
      </span>
      {authEnabled && (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      )}
    </div>
  );
}
