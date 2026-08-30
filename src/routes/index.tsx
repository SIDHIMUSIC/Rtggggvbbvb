import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { DoorOpen, Layers, Plus, Receipt, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
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
import { groupRoomsByFloor, inr } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import { addFloor, addRoom, getDashboard, seedSampleBuilding, upsertBuilding } from "@/lib/rent/server";
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
              Add floors and rooms. Keep tenant files. Collect rent with cash, UPI, card,
              or dummy — then print the bill.
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
            title: "Floors and rooms",
            body: "Add a whole floor at once, or one room. Vacant rooms stay quiet; occupied ones carry the tenant’s name.",
          },
          {
            icon: Users,
            title: "Tenant files",
            body: "Add, edit, or remove a tenant. Months generate themselves from the day they moved in.",
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

function nextFloorNumber(rooms: { roomNumber: string }[]): number {
  const nums = groupRoomsByFloor(rooms)
    .map((f) => parseInt(f.floor.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function Dashboard({ ownerHint }: { ownerHint: string }) {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const [roomOpen, setRoomOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [rent, setRent] = useState("3000");
  const [floor, setFloor] = useState("1");
  const [roomCount, setRoomCount] = useState("8");
  const [floorRent, setFloorRent] = useState("3000");

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
      setRoomOpen(false);
      setRoomNumber("");
      toast.success("Room added");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const floorMut = useMutation({
    mutationFn: () =>
      addFloor({
        data: { floor: Number(floor), roomCount: Number(roomCount), rent: Number(floorRent) },
      }),
    onSuccess: (rooms) => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      setFloorOpen(false);
      toast.success(`${rooms.length} rooms added on floor ${floor}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const suggestedFloor = useMemo(
    () => String(nextFloorNumber(dash.data?.rooms ?? [])),
    [dash.data?.rooms],
  );

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

  return (
    <div>
      {needsSetup && (
        <div className="mb-8 rounded-3xl border border-border bg-surface p-5">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Building
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Name the property</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Optional now. Needed later for UPI QR and receipts. You can still add floors
            and tenants below.
          </p>
          <SetupBuildingForm
            ownerHint={ownerHint}
            submitLabel="Save building"
            busy={setup.isPending}
            onSave={(b) => setup.mutate(b)}
          />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            {data?.building.name || "Building"}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Occupancy board</h1>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFloor(suggestedFloor);
              setFloorOpen(true);
            }}
          >
            <Layers className="size-4" />
            Add floor
          </Button>
          <Button type="button" onClick={() => setRoomOpen(true)}>
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
            Add a floor of rooms, one room, or load a four-floor sample building with a few
            tenants to see the ledger.
          </p>
        </div>
      ) : (
        data && <FloorBoard rooms={data.rooms} />
      )}

      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
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

      <Dialog open={floorOpen} onOpenChange={setFloorOpen}>
        <DialogContent>
          <DialogTitle>Add a floor</DialogTitle>
          <DialogDescription>
            Creates vacant rooms F{floor || "n"}-R1 through F{floor || "n"}-R{roomCount || "n"}.
          </DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              floorMut.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="floor-n">Floor number</Label>
                <Input
                  id="floor-n"
                  type="number"
                  min={1}
                  max={40}
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="floor-rooms">Rooms on floor</Label>
                <Input
                  id="floor-rooms"
                  type="number"
                  min={1}
                  max={30}
                  value={roomCount}
                  onChange={(e) => setRoomCount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="floor-rent">Monthly rent each</Label>
              <Input
                id="floor-rent"
                type="number"
                min={1}
                value={floorRent}
                onChange={(e) => setFloorRent(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={floorMut.isPending}>
              {floorMut.isPending ? "Adding…" : "Add floor"}
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
