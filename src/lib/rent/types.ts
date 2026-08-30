export type RoomStatus = "vacant" | "occupied";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PayMethod = "cash" | "upi" | "card" | "dummy";

export const PAY_METHODS: PayMethod[] = ["upi", "cash", "card", "dummy"];

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
  extraAmount: number;
  extraNote: string;
  tenantName?: string;
  tenantPhone?: string;
};

export type PaymentEvent = {
  id: number;
  tenantId: number;
  paymentId: number;
  amount: number;
  method: PayMethod;
  reference: string;
  createdAt: string;
  month?: string;
  tenantName?: string;
};

export type TenantWithLedger = Tenant & {
  payments: Payment[];
  events: PaymentEvent[];
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

export type MonthPoint = {
  month: string;
  monthIndex: number;
  collected: number;
  due: number;
};

export type Dashboard = {
  building: Building;
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
  events: PaymentEvent[];
  months: MonthPoint[];
  stats: DashboardStats;
};

export type RoomDetail = {
  room: Room;
  tenant: TenantWithLedger | null;
};
