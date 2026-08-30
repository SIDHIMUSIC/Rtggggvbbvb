import { Link } from "@tanstack/react-router";
import { groupRoomsByFloor, inr } from "@/lib/rent/months";
import type { Room } from "@/lib/rent/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FloorBoard({ rooms }: { rooms: Room[] }) {
  const floors = groupRoomsByFloor(rooms);
  if (floors.length === 0) return null;

  return (
    <div className="space-y-8">
      {floors.map(({ floor, rooms: list }) => (
        <section key={floor}>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl tracking-tight">{floor}</h2>
            <p className="text-xs text-muted">
              {list.filter((r) => r.status === "occupied").length}/{list.length} occupied
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {list.map((room) => (
              <RoomTile key={room.id} room={room} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoomTile({ room }: { room: Room }) {
  const occupied = room.status === "occupied";
  return (
    <Link
      to="/rooms/$roomId"
      params={{ roomId: String(room.id) }}
      className={cn(
        "flex min-h-[108px] flex-col justify-between rounded-2xl border p-3 transition-[transform,background-color] duration-150",
        occupied
          ? "border-danger/25 bg-occupied hover:border-danger/40"
          : "border-accent/20 bg-vacant hover:border-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight">{room.roomNumber}</p>
        <Badge variant={occupied ? "occupied" : "vacant"}>
          {occupied ? "Occupied" : "Vacant"}
        </Badge>
      </div>
      <div>
        {room.tenantName ? (
          <p className="truncate text-xs text-fg/80">{room.tenantName}</p>
        ) : (
          <p className="text-xs text-muted">No tenant</p>
        )}
        <p className="mt-0.5 text-xs tabular text-muted">{inr(room.rent)}/mo</p>
      </div>
    </Link>
  );
}
