/**
 * DIRECTAURANTE POS CORE — Domain Types & Schemas
 * Authoritative types for POS, Comandero, KDS, Financial Core, and DirectPrint.
 */

export interface Restaurant {
  id: string;
  name: string;
  legal_name: string;
  currency: string; // e.g. "MXN"
  tax_rate: number; // e.g. 0.16
  created_at: string;
}

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
}

export interface Allergy {
  id: string;
  name: string;
  ingredient_ids: string[];
  severity: 'mild' | 'moderate' | 'severe';
  description?: string;
}

export interface OrderItemAllocation {
  guest_subaccount_id: string;
  seat_number: string;
  percentage: number;
  allocated_price_cents: number;
}

export interface Product {
  id: string;
  restaurant_id: string;
  name: string;
  category: 'Platillos' | 'Bebidas' | 'Entradas' | 'Postres' | 'Snacks';
  description: string;
  price_cents: number; // Integer cents to prevent IEEE 754 precision issues
  ingredient_ids: string[];
  destination_station: 'kitchen' | 'bar';
  preparation_time_minutes: number;
  target_preparation_seconds?: number; // Target SLA for KDS timers
  available_modifiers?: string[]; // e.g. ["Extra queso", "Sin cebolla", "Término medio"]
  available: boolean;
  image_url?: string;
}

export type TableStatus = 'available' | 'occupied' | 'bill_requested' | 'paying' | 'closed';
export type TableSessionStatus = 'active' | 'bill_requested' | 'paying' | 'closed';

export interface TableSession {
  id: string; // UUID/str
  restaurant_id: string;
  branch_id?: string;
  table_id: string;
  status: TableSessionStatus;
  opened_at: string;
  closed_at?: string;
  server_id: string; // Waiter / Server identifier
  guest_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  restaurant_id: string;
  branch_id?: string;
  number: string; // e.g. "Mesa 1", "Mesa 2"
  capacity: number;
  status: TableStatus;
  active_session_id?: string;
  opened_at?: string;
  assigned_waiter?: string;
  notes?: string;
}

export interface GuestSubaccount {
  id: string; // UUID/str
  table_session_id: string; // Mandatory link to active session
  table_id?: string;
  seat_number: string; // e.g. "1.1", "1.2", "1.3", "1.4"
  display_name: string; // e.g. "Carlos", "Ana", "Luis", "María"
  customer_id?: string;
  allergy_ids: string[];
  notes?: string;
  status: 'active' | 'paid' | 'closed';
  created_at: string;
  updated_at: string;
}

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderItemPriority = 'normal' | 'high' | 'urgent';

export interface OrderItemStatusHistory {
  status: OrderItemStatus;
  changed_by: string;
  timestamp: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  order_id: string; // Comanda Ticket ID
  table_session_id: string; // TableSession ID
  restaurant_id: string;
  product_id: string;
  product_name: string;
  guest_subaccount_id: string; // Diner Subaccount ID (Ensures Double Carlos separation)
  seat_number: string;
  guest_name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  destination_station: 'kitchen' | 'bar';
  notes?: string;
  modifiers?: string[];
  priority?: OrderItemPriority;
  delayed?: boolean;
  preparation_status: OrderItemStatus;
  status_history: OrderItemStatusHistory[];
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  preparing_at?: string;
  ready_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  target_preparation_seconds?: number;
  preparation_duration_seconds?: number;
  total_operational_duration_seconds?: number;
  allocations?: OrderItemAllocation[];
}

export interface Order {
  id: string; // UUID/str (e.g. ord_..., or comanda ticket)
  restaurant_id: string;
  branch_id?: string;
  table_id: string;
  table_session_id: string; // Mandatory: belongs to TableSession
  ticket_number?: string; // e.g. "Comanda #001", "Comanda #002"
  order_type: 'dine_in' | 'directgo';
  status: 'open' | 'completed' | 'cancelled';
  subtotal_cents: number;
  discount_cents?: number;
  tax_cents: number;
  total_cents: number;
  server_id?: string;
  customer_id?: string;
  promotion_id?: string;
  coupon_code?: string;
  points_awarded?: number;
  points_redeemed?: number;
  notes?: string;
  created_at: string;
  closed_at?: string;
}

export interface SubaccountBill {
  guest_subaccount_id: string;
  seat_number: string;
  display_name: string;
  items: OrderItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
}

export interface TableBill {
  table_id: string;
  table_number: string;
  table_session_id: string;
  session_status?: TableSessionStatus;
  orders: Order[]; // All orders/tickets within this session (e.g. Comanda #001, #002)
  order_id?: string;
  subaccounts: SubaccountBill[];
  total_items_count: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
}

export interface Payment {
  id: string; // UUID/str
  restaurant_id: string;
  table_session_id: string; // Mandatory: links payment to session
  table_id: string;
  order_id?: string; // Optional: references specific ticket or global order
  guest_subaccount_id?: string; // Optional: for individual guest settlement
  customer_id?: string;
  amount_cents: number;
  method: 'cash' | 'card' | 'transfer' | 'loyalty_points';
  created_at: string;
  cashier: string;
  reference?: string;
  idempotency_key?: string;
}

export interface CashShift {
  id: string;
  restaurant_id: string;
  opened_by: string;
  opened_at: string;
  initial_float_cents: number;
  status: 'open' | 'closed';
  closed_by?: string;
  closed_at?: string;
  expected_cash_cents: number;
  actual_cash_cents?: number;
  difference_cents?: number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  restaurant_id: string;
  type: 'opening_float' | 'sale' | 'expense' | 'withdrawal' | 'deposit' | 'adjustment' | 'refund';
  amount_cents: number;
  description: string;
  performed_by: string;
  timestamp: string;
  reference_order_id?: string;
  source_payment_id?: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  action: string;
  entity_type:
    | 'table'
    | 'table_session'
    | 'order'
    | 'order_item'
    | 'guest_subaccount'
    | 'payment'
    | 'cash_shift'
    | 'printer'
    | 'print_job'
    | 'plugin'
    | 'customer'
    | 'loyalty'
    | 'promotion'
    | 'coupon'
    | 'referral';
  entity_id: string;
  actor: string;
  previous_state?: any;
  new_state?: any;
  notes?: string;
  timestamp: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  isCore: boolean;
  category: 'operations' | 'kitchen' | 'finance' | 'hardware' | 'migration' | 'intelligence';
  icon: string;
  defaultEnabled: boolean;
  capabilities: string[];
}

export interface RestaurantPluginConfig {
  restaurant_id: string;
  plugin_id: string;
  enabled: boolean;
  version: string;
  settings: Record<string, any>;
  updated_at: string;
}

// ==========================================
// DIRECTPRINT TYPES (FASE 5)
// ==========================================

export type PrinterStation = 'kitchen' | 'bar' | 'cashier' | 'all';
export type PrinterConnectionType = 'ethernet' | 'usb' | 'wifi' | 'serial' | 'virtual';
export type PrinterStatus = 'online' | 'offline' | 'warning';
export type PrintJobType =
  | 'comanda_kitchen'
  | 'comanda_bar'
  | 'pre_bill'
  | 'payment_receipt'
  | 'cash_shift_cut'
  | 'test';

export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface Printer {
  id: string;
  restaurant_id: string;
  name: string;
  connection_type: PrinterConnectionType;
  address: string; // e.g. "192.168.1.200", "/dev/usb/lp0", "COM3", "virtual:kitchen"
  port: number; // e.g. 9100
  station: PrinterStation;
  paper_width: 80 | 58; // 80mm or 58mm thermal rolls
  protocol: 'esc_pos';
  enabled: boolean;
  status: PrinterStatus;
  created_at: string;
  updated_at: string;
}

export interface PrinterRoutingRule {
  id: string;
  restaurant_id: string;
  job_type: PrintJobType;
  station?: 'kitchen' | 'bar';
  categories?: string[]; // e.g. ['Platillos', 'Entradas']
  printer_id: string;
  auto_print: boolean; // Auto dispatch when ticket/bill/payment is confirmed
}

export interface PrintJob {
  id: string;
  restaurant_id: string;
  printer_id: string;
  printer_name: string;
  job_type: PrintJobType;
  title: string;
  status: PrintJobStatus;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  raw_content: string; // ESC/POS formatted representation
  metadata: {
    table_number?: string;
    table_session_id?: string;
    order_ticket_id?: string;
    ticket_number?: string;
    guest_subaccount_id?: string;
    payment_id?: string;
    shift_id?: string;
    items_count?: number;
    total_cents?: number;
    reprint_count?: number;
  };
}

export interface ImportJob {
  id: string;
  restaurant_id: string;
  source_pos: string;
  file_name: string;
  status: 'pending' | 'analyzing' | 'preview_ready' | 'imported' | 'reverted' | 'failed';
  total_products_detected: number;
  issues_count: number;
  created_at: string;
  preview_data?: {
    categories: string[];
    sample_products: Array<{ name: string; price: number; category: string }>;
  };
}

// ==========================================
// FASE 11: CLIENTES, FIDELIZACIÓN & PROMOCIONES
// ==========================================

export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type CustomerSegment = 'new' | 'active' | 'frequent' | 'inactive' | 'vip';

export interface Customer {
  id: string;
  restaurant_id: string;
  user_id?: string; // Optional link to Directaurante global user
  name: string;
  phone?: string;
  email?: string;
  birthday?: string; // YYYY-MM-DD
  notes?: string;
  status: CustomerStatus;
  referral_code?: string;
  referred_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSummary {
  customer: Customer;
  total_orders: number;
  completed_orders: number;
  total_spent_cents: number;
  average_ticket_cents: number;
  last_order_at?: string;
  days_since_last_order?: number;
  points_balance: number;
  segment: CustomerSegment;
}

export type LoyaltyTransactionType =
  | 'earn'
  | 'redeem'
  | 'adjustment'
  | 'bonus'
  | 'expiration'
  | 'refund';

export interface LoyaltyAccount {
  id: string;
  customer_id: string;
  restaurant_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  updated_at: string;
}

export interface LoyaltyPointTransaction {
  id: string;
  customer_id: string;
  restaurant_id: string;
  points: number; // positive for earn/bonus, negative for redeem
  type: LoyaltyTransactionType;
  reference: string; // e.g. order_id, payment_id, adjustment code
  idempotency_key?: string; // Prevents double awarding points for same order
  reason: string;
  actor: string;
  created_at: string;
}

export interface LoyaltyProgramConfig {
  id: string;
  restaurant_id: string;
  points_per_currency_unit: number; // e.g. 1 point per $1 MXN (100 cents)
  point_value_cents: number; // e.g. 10 cents = $0.10 MXN per point
  min_points_to_redeem: number;
  welcome_bonus_points: number;
  enabled: boolean;
  updated_at: string;
}

export type PromotionType =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'buy_x_get_y'
  | 'combo'
  | 'free_product'
  | 'bonus_points';

export type PromotionStatus = 'active' | 'inactive' | 'expired';

export interface Promotion {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  type: PromotionType;
  value: number; // e.g. 10 for 10%, 5000 for $50.00 MXN fixed, or points count
  valid_from: string;
  valid_until: string;
  applicable_days?: number[]; // [0,1,2,3,4,5,6] (0=Sunday)
  time_start?: string; // e.g. "12:00"
  time_end?: string; // e.g. "18:00"
  applicable_product_ids?: string[];
  applicable_categories?: string[];
  min_order_amount_cents?: number;
  max_discount_cents?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  current_uses: number;
  requires_coupon: boolean;
  status: PromotionStatus;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string; // Unique uppercase code within restaurant (e.g. DIRECTA10)
  promotion_id: string;
  restaurant_id: string;
  valid_from: string;
  valid_until: string;
  max_uses?: number;
  uses: number;
  max_uses_per_customer?: number;
  active: boolean;
  created_at: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  coupon_code: string;
  promotion_id: string;
  customer_id: string;
  order_id: string;
  restaurant_id: string;
  discount_cents: number;
  redeemed_at: string;
}

export interface Referral {
  id: string;
  restaurant_id: string;
  referrer_customer_id: string;
  referred_customer_id: string;
  status: 'pending' | 'completed' | 'rewarded';
  reward_points?: number;
  created_at: string;
  completed_at?: string;
}

export interface PromotionEvaluationResult {
  eligible: boolean;
  discount_cents: number;
  reason: string;
  promotion?: Promotion;
  coupon?: Coupon;
}

