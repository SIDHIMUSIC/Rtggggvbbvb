export const rentKeys = {
  dashboard: ["rent", "dashboard"] as const,
  building: ["rent", "building"] as const,
  tenants: ["rent", "tenants"] as const,
  tenant: (id: number) => ["rent", "tenant", id] as const,
  payments: (tenantId?: number) => ["rent", "payments", tenantId ?? "all"] as const,
  room: (id: number) => ["rent", "room", id] as const,
};
