// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: "success" | "error";
  message?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  tallerName: string;
}

// Client types
export interface ClientForm {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

// Vehicle types
export interface VehicleForm {
  clientId: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje?: number;
}

// Quote types
export interface QuoteItemForm {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface QuoteForm {
  clientId: string;
  vehicleId: string;
  items: QuoteItemForm[];
  observaciones?: string;
}

// Work Order types
export interface WorkOrderItemForm {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface WorkOrderForm {
  clientId: string;
  vehicleId: string;
  quoteId?: string;
  motivoIngreso: string;
  diagnostico?: string;
  observaciones?: string;
  kmIngreso?: number;
  items: WorkOrderItemForm[];
}

// Schedule types
export interface ScheduleForm {
  clientId: string;
  vehicleId: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  motivo: string;
}

// Payment types
export interface PaymentForm {
  workOrderId: string;
  methodId: string;
  monto: number;
  numeroComprobante?: string;
  observaciones?: string;
}
