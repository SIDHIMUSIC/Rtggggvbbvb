export function monthIndex(d: Date): number {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

export function currentMonthIndex(): number {
  return monthIndex(new Date());
}

export function isOverdue(p: { monthIndex: number; remainingAmount: number }): boolean {
  return p.remainingAmount > 0 && p.monthIndex < currentMonthIndex();
}

export function monthLabel(d: Date): string {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

export function monthsFrom(start: Date, end = new Date()): Date[] {
  const out: Date[] = [];
  let cur = firstOfMonth(start);
  const last = firstOfMonth(end);
  if (cur.getFullYear() < 2001) cur = firstOfMonth(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

export function floorOf(roomNumber: string): string {
  const part = roomNumber.split("-")[0];
  return part?.trim() || roomNumber;
}

export function floorSort(a: string, b: string): number {
  const na = parseInt(a.replace(/\D/g, ""), 10);
  const nb = parseInt(b.replace(/\D/g, ""), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

export function roomSort(a: string, b: string): number {
  const fa = floorOf(a);
  const fb = floorOf(b);
  const fs = floorSort(fa, fb);
  if (fs !== 0) return fs;
  const na = parseInt((a.split("-")[1] ?? "").replace(/\D/g, ""), 10);
  const nb = parseInt((b.split("-")[1] ?? "").replace(/\D/g, ""), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

export function groupRoomsByFloor<T extends { roomNumber: string }>(
  rooms: T[],
): Array<{ floor: string; rooms: T[] }> {
  const map = new Map<string, T[]>();
  for (const room of rooms) {
    const floor = floorOf(room.roomNumber);
    const list = map.get(floor) ?? [];
    list.push(room);
    map.set(floor, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => floorSort(a, b))
    .map(([floor, list]) => ({
      floor,
      rooms: list.slice().sort((a, b) => roomSort(a.roomNumber, b.roomNumber)),
    }));
}

export function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateIN(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeIN(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function methodLabel(method: string): string {
  if (method === "upi") return "UPI";
  if (method === "card") return "Card";
  if (method === "dummy") return "Dummy";
  if (method === "cash") return "Cash";
  return method || "—";
}

export function toIsoDate(value: Date | string): string {
  const d = parseDate(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function txId(): string {
  const n = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");
  return `RW-${n}`;
}
