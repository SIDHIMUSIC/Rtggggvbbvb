import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { DoorOpen, Plus, Receipt, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CollectionsChart } from "@/components/dashboard/collections-chart";
import { SetupBuildingForm } from "@/components/owner/setup-building";
import { FloorBoard } from "@/components/rooms/floor-board";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { inr } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import { addRoom, getDashboard, seedSampleBuilding, upsertBuilding } from "@/lib/rent/server";
import type { Building } from "@/lib/rent/types";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  const authed = Boolean(user ?? (isPending ? sessionUser : null));

  if (!authed) {
    return (
      <AppShell>
        <Landing />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {isPending && !user ? (
        <DashboardSkeleton />
      ) : (
        <Dashboard ownerHint={user?.displayName ?? ""} />
      )}
    </AppShell>
  );
}

function Landing() {
  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border border-border">
        <img
          src="/landing-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/35" />
        <div className="relative grid gap-10 px-6 py-12 md:grid-cols-[1.1fr_0.7fr] md:items-end md:px-10 md:py-16">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
              Owner portal
            </p>
            <h1 className="mt-3 max-w-xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
              Run your building like a ledger, not a notebook.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-fg/80">
              Occupancy floor by floor. Tenant hisab. Cash, UPI, card, or dummy —
              then print the bill and the receipt for every month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/login">Owner sign in</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/login">Create owner account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: DoorOpen,
            title: "Occupancy board",
            body: "See every floor at a glance. Vacant rooms stay quiet; occupied ones carry the tenant’s name.",
          },
          {
            icon: Users,
            title: "Tenant files",
            body: "Name, phone, deposit, start date. Months generate themselves from the day they moved in.",
          },
          {
            icon: Receipt,
            title: "Cash, UPI, card, dummy",
            body: "Collect however the tenant pays. Extra charges go on the bill. Print a receipt for the ledger.",
          },
        ].map((f) => (
          <article key={f.title} className="rounded-3xl border border-border bg-surface p-5">
            <f.icon className="size-5 text-accent" />
            <h2 className="mt-4 font-display text-lg tracking-tight">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Dashboard({ ownerHint }: { ownerHint: string }) {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const [open, setOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [rent, setRent] = useState("3000");

  const setup = useMutation({
    mutationFn: (data: Building) => upsertBuilding({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      void qc.invalidateQueries({ queryKey: rentKeys.building });
      toast.success("Building ready");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const seed = useMutation({
    mutationFn: () => seedSampleBuilding(),
    onSuccess: (data) => {
      qc.setQueryData(rentKeys.dashboard, data);
      toast.success("Sample building loaded");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const add = useMutation({
    mutationFn: () => addRoom({ data: { roomNumber, rent: Number(rent) } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      setOpen(false);
      setRoomNumber("");
      toast.success("Room added");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (dash.isLoading) return <DashboardSkeleton />;
  if (dash.error) {
    return (
      <p className="rounded-2xl border border-danger/30 bg-occupied px-4 py-3 text-sm text-danger">
        {errMsg(dash.error)}
      </p>
    );
  }

  const data = dash.data;
  const needsSetup = data && !data.building.name;
  const empty = !data || data.rooms.length === 0;

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          First step
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Set up your building</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Name the property and add the UPI ID rent should land on. You can change this later.
        </p>
        <div className="rounded-3xl border border-border bg-surface p-5">
          <SetupBuildingForm
            ownerHint={ownerHint}
            submitLabel="Save and continue"
            busy={setup.isPending}
            onSave={(b) => setup.mutate(b)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            {data?.building.name || "Building"}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Occupancy board</h1>
        </div>
        <div className="flex gap-2">
          {empty && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              Load sample building
            </Button>
          )}
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add room
          </Button>
        </div>
      </div>

      {data && (
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Income" value={inr(data.stats.income)} hint="Collected" />
          <Stat label="Pending" value={inr(data.stats.pending)} hint="Still due" danger />
          <Stat
            label="Occupied"
            value={String(data.stats.occupied)}
            hint={`${data.stats.totalRooms} rooms`}
          />
          <Stat
            label="Overdue"
            value={inr(data.stats.overdue)}
            hint={`${data.stats.tenantCount} tenants`}
            danger={data.stats.overdue > 0}
          />
        </div>
      )}

      {data && data.months.length > 0 && (
        <div className="mb-8">
          <CollectionsChart months={data.months} />
        </div>
      )}

      {empty ? (
        <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
          <Wallet className="mx-auto size-8 text-muted" />
          <p className="mt-3 font-display text-xl">No rooms yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add your first room, or load a four-floor sample building with a few tenants to
            see the ledger in action.
          </p>
        </div>
      ) : (
        data && <FloorBoard rooms={data.rooms} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Add a room</DialogTitle>
          <DialogDescription>Use a label like F1-R12 so floors group cleanly.</DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div>
              <Label htmlFor="room-number">Room number</Label>
              <Input
                id="room-number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="F1-R1"
                required
              />
            </div>
            <div>
              <Label htmlFor="room-rent">Monthly rent</Label>
              <Input
                id="room-rent"
                type="number"
                min={1}
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={add.isPending}>
              {add.isPending ? "Saving…" : "Save room"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface px-4 py-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-2 font-display text-2xl tabular tracking-tight ${danger ? "text-danger" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
