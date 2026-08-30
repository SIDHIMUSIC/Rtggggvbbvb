import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SetupBuildingForm } from "@/components/owner/setup-building";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { rentKeys } from "@/lib/rent/queries";
import { getBuilding, upsertBuilding } from "@/lib/rent/server";
import type { Building } from "@/lib/rent/types";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <Skeleton className="h-96 rounded-3xl" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <SettingsView ownerHint={user.displayName ?? ""} />
    </AppShell>
  );
}

function SettingsView({ ownerHint }: { ownerHint: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: rentKeys.building, queryFn: () => getBuilding() });
  const save = useMutation({
    mutationFn: (data: Building) => upsertBuilding({ data }),
    onSuccess: (b) => {
      qc.setQueryData(rentKeys.building, b);
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      toast.success("Building saved");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Owner</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight">Building</h1>
      <p className="mt-2 mb-6 text-sm text-muted">
        This name and UPI ID appear on receipts and the collection QR.
      </p>
      {q.isLoading ? (
        <Skeleton className="h-80 rounded-3xl" />
      ) : (
        <div className="rounded-3xl border border-border bg-surface p-5">
          <SetupBuildingForm
            initial={q.data}
            ownerHint={ownerHint}
            submitLabel="Save building"
            busy={save.isPending}
            onSave={(data) => save.mutate(data)}
          />
        </div>
      )}
    </div>
  );
}
