import {
  LayoutDashboard,
  Users,
  Car,
  FileText,
  Wrench,
  CalendarDays,
  Wallet,
  Lock,
  CircleDollarSign,
  UserCog,
  Target,
  Receipt,
  ShieldCheck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_HOME: NavItem = { label: "Inicio", href: "/dashboard", icon: LayoutDashboard };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { label: "Clientes", href: "/clients", icon: Users },
      { label: "Vehículos", href: "/vehicles", icon: Car },
      { label: "Presupuestos", href: "/quotes", icon: FileText },
      { label: "Órdenes", href: "/work-orders", icon: Wrench },
      { label: "Agenda", href: "/schedules", icon: CalendarDays },
      { label: "Caja", href: "/cash-movements", icon: Wallet },
      { label: "Cierre de Caja", href: "/daily-closes", icon: Lock },
      { label: "Deudas", href: "/debts", icon: CircleDollarSign },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Técnicos", href: "/technicians", icon: UserCog },
      { label: "Objetivos", href: "/goals", icon: Target },
      { label: "Costos", href: "/costs", icon: Receipt },
    ],
  },
  {
    label: "Control",
    items: [
      { label: "Auditoría", href: "/audit-logs", icon: ShieldCheck },
      { label: "Reportes", href: "/reports/monthly", icon: BarChart3 },
    ],
  },
];
