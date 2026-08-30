export type RoomStatus = "vacant" | "occupied";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PayMethod = "cash" | "upi";

export type Building = {
  name: string;
  address: string;
  ownerName: string;
  phone: string;
  upiId: string;
};

export type Room = {
  id: number;
  roomNumber: string;
  rent: number;
  status: RoomStatus;
  tenantName: string;
};

export type Tenant = {
  id: number;
  name: string;
  phone: string;
  email: string;
  roomNumber: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  notes: string;
  isActive: boolean;
};

export type Payment = {
  id: number;
  tenantId: number;
  roomNumber: string;
  month: string;
  monthIndex: number;
  totalRent: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  paidBy: string;
  paidAt: string | null;
  transactionId: string;
  tenantName?: string;
  tenantPhone?: string;
};

export type TenantWithLedger = Tenant & {
  payments: Payment[];
  totalPaid: number;
  totalDue: number;
};

export type DashboardStats = {
  totalRooms: number;
  occupied: number;
  vacant: number;
  income: number;
  pending: number;
  overdue: number;
  tenantCount: number;
};

export type Dashboard = {
  building: Building;
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
  stats: DashboardStats;
};

export type RoomDetail = {
  room: Room;
  tenant: TenantWithLedger | null;
};
