/**
 * DIRECTAURANTE POS & COMANDERO — Unified SDK Types & Contracts
 */

import {
  Table,
  TableSession,
  GuestSubaccount,
  Product,
  Order,
  OrderItem,
  OrderItemStatus,
  TableBill,
  SubaccountBill,
  Payment,
  CashShift,
  CashMovement,
  AuditLog,
  PluginDefinition,
  Allergy,
  Ingredient,
  Printer,
  PrinterRoutingRule,
  PrintJob,
  Customer,
  CustomerSummary,
  CustomerSegment,
  LoyaltyAccount,
  LoyaltyPointTransaction,
  LoyaltyProgramConfig,
  Promotion,
  Coupon,
  CouponRedemption,
  PromotionEvaluationResult,
} from '../core/types';
import { KdsItemView } from '../modules/kds/kdsService';

export interface TablesSdk {
  listTables(restaurantId?: string): Promise<any[]>;
  getTable(tableId: string, restaurantId?: string): Promise<any>;
  openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId?: string
  ): Promise<any>;
  closeTableSession(tableIdOrSessionId: string, actor?: string, restaurantId?: string): Promise<any>;
}

export interface GuestsSdk {
  listSubaccounts(tableIdOrSessionId: string, restaurantId?: string): Promise<GuestSubaccount[]>;
  createSubaccount(
    tableIdOrSessionId: string,
    displayName: string,
    allergyIds?: string[],
    notes?: string,
    actor?: string,
    restaurantId?: string
  ): Promise<GuestSubaccount>;
  updateSubaccount(
    subaccountId: string,
    updates: Partial<GuestSubaccount>,
    actor?: string,
    restaurantId?: string
  ): Promise<GuestSubaccount>;
  getSubaccount(subaccountId: string, restaurantId?: string): Promise<GuestSubaccount>;
}

export interface OrdersSdk {
  createOrderTicket(
    tableIdOrSessionId: string,
    waiterName?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<Order>;
  getSessionOrders(tableIdOrSessionId: string, restaurantId?: string): Promise<Order[]>;
  addOrderItem(
    tableIdOrSessionId: string,
    guestSubaccountId: string,
    productId: string,
    quantity?: number,
    notes?: string,
    overrideAllergy?: boolean,
    actor?: string,
    restaurantId?: string,
    orderTicketId?: string,
    modifiers?: string[]
  ): Promise<any>;
  updateOrderItem(
    itemId: string,
    updates: Partial<OrderItem>,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  removeOrderItem(
    itemId: string,
    reason?: string,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  reassignItemSubaccount(
    itemId: string,
    newSubaccountId: string,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
}

export interface BillsSdk {
  getSessionBill(tableIdOrSessionId: string, restaurantId?: string): Promise<TableBill>;
  getSubaccountBill(
    tableIdOrSessionId: string,
    subaccountId: string,
    restaurantId?: string
  ): Promise<SubaccountBill>;
  recordPayment(
    tableIdOrSessionId: string,
    amountCents: number,
    method: Payment['method'],
    guestSubaccountId?: string,
    cashier?: string,
    reference?: string,
    restaurantId?: string
  ): Promise<Payment>;
}

export interface KdsSdk {
  getKitchenItems(restaurantId?: string): Promise<KdsItemView[]>;
  getStationItems(station?: 'kitchen' | 'bar', restaurantId?: string): Promise<KdsItemView[]>;
  updateItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  acknowledgeItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  markItemReady(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  markItemDelivered(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
}

export interface CashSdk {
  getCurrentShift(restaurantId?: string): Promise<any>;
  openShift(initialFloatCents: number, cashier?: string, notes?: string, restaurantId?: string): Promise<CashShift>;
  closeShift(actualCashCents: number, cashier?: string, notes?: string, restaurantId?: string): Promise<CashShift>;
  recordMovement(
    type: CashMovement['type'],
    amountCents: number,
    description: string,
    performer?: string,
    restaurantId?: string
  ): Promise<CashMovement>;
}

export interface CatalogSdk {
  listProducts(category?: string, restaurantId?: string): Promise<Product[]>;
  listAllergies(): Promise<{ allergies: Allergy[]; ingredients: Ingredient[] }>;
}

export interface AuditSdk {
  listAuditEvents(limit?: number, entityType?: string, restaurantId?: string): Promise<AuditLog[]>;
}

export interface PluginsSdk {
  listPlugins(
    restaurantId?: string
  ): Promise<Array<PluginDefinition & { enabled: boolean; settings: Record<string, any> }>>;
  getPluginState(pluginId: string, restaurantId?: string): Promise<boolean>;
  togglePlugin(pluginId: string, enabled: boolean, actor?: string, restaurantId?: string): Promise<any>;
}

// DirectPrint SDK Interface (Phase 5)
export interface PrintSdk {
  listPrinters(restaurantId?: string): Promise<Printer[]>;
  getPrinter(printerId: string, restaurantId?: string): Promise<Printer>;
  createPrinter(printer: Omit<Printer, 'id' | 'created_at' | 'updated_at'>, restaurantId?: string): Promise<Printer>;
  updatePrinter(printerId: string, updates: Partial<Printer>, restaurantId?: string): Promise<Printer>;
  deletePrinter(printerId: string, restaurantId?: string): Promise<boolean>;
  listRoutingRules(restaurantId?: string): Promise<PrinterRoutingRule[]>;
  setRoutingRule(rule: Omit<PrinterRoutingRule, 'id'>, restaurantId?: string): Promise<PrinterRoutingRule>;
  listPrintJobs(limit?: number, restaurantId?: string): Promise<PrintJob[]>;
  getPrintJob(jobId: string, restaurantId?: string): Promise<PrintJob>;
  printComanda(orderTicketId: string, station?: 'kitchen' | 'bar', restaurantId?: string): Promise<PrintJob[]>;
  printPreBill(tableSessionId: string, guestSubaccountId?: string, restaurantId?: string): Promise<PrintJob>;
  printPaymentReceipt(paymentId: string, restaurantId?: string): Promise<PrintJob>;
  printShiftReport(shiftId: string, restaurantId?: string): Promise<PrintJob>;
  testPrinter(printerId: string, restaurantId?: string): Promise<PrintJob>;
  reprintJob(jobId: string, restaurantId?: string): Promise<PrintJob>;
}

export interface CustomersSdk {
  list(search?: string, segment?: CustomerSegment, restaurantId?: string): Promise<Customer[]>;
  get(id: string, restaurantId?: string): Promise<Customer>;
  create(data: any, restaurantId?: string, actor?: string): Promise<Customer>;
  update(id: string, updates: any, restaurantId?: string, actor?: string): Promise<Customer>;
  getSummary(id: string, restaurantId?: string): Promise<CustomerSummary>;
  getOrders(id: string, restaurantId?: string): Promise<Order[]>;
}

export interface LoyaltySdk {
  getConfig(restaurantId?: string): Promise<LoyaltyProgramConfig>;
  updateConfig(updates: any, restaurantId?: string, actor?: string): Promise<LoyaltyProgramConfig>;
  getAccount(customerId: string, restaurantId?: string): Promise<LoyaltyAccount>;
  getTransactions(customerId: string, restaurantId?: string): Promise<LoyaltyPointTransaction[]>;
  awardPoints(
    orderId: string,
    customerId: string,
    amountCents: number,
    restaurantId?: string,
    actor?: string
  ): Promise<{ transaction: LoyaltyPointTransaction; awardedPoints: number; isDuplicate: boolean }>;
  redeem(
    customerId: string,
    points: number,
    reference: string,
    restaurantId?: string,
    actor?: string
  ): Promise<{ transaction: LoyaltyPointTransaction; discountCents: number; newBalance: number }>;
  adjust(
    customerId: string,
    points: number,
    reason: string,
    actor?: string,
    restaurantId?: string
  ): Promise<{ transaction: LoyaltyPointTransaction; newBalance: number }>;
  refund(
    orderId: string,
    customerId: string,
    restaurantId?: string,
    actor?: string
  ): Promise<LoyaltyPointTransaction>;
}

export interface PromotionsSdk {
  list(restaurantId?: string): Promise<Promotion[]>;
  get(id: string, restaurantId?: string): Promise<Promotion>;
  create(data: any, restaurantId?: string, actor?: string): Promise<Promotion>;
  update(id: string, updates: any, restaurantId?: string, actor?: string): Promise<Promotion>;
  evaluate(
    target: { promotion_id?: string; coupon_code?: string },
    orderData: any,
    customerId?: string,
    restaurantId?: string
  ): Promise<PromotionEvaluationResult>;
}

export interface CouponsSdk {
  list(restaurantId?: string): Promise<Coupon[]>;
  create(data: any, restaurantId?: string, actor?: string): Promise<Coupon>;
  validate(
    code: string,
    orderData: any,
    customerId?: string,
    restaurantId?: string
  ): Promise<PromotionEvaluationResult>;
  redeem(
    code: string,
    orderId: string,
    customerId: string,
    discountCents: number,
    restaurantId?: string,
    actor?: string
  ): Promise<CouponRedemption>;
}

export interface CommercialReportSdk {
  getReport(restaurantId?: string): Promise<any>;
}

export interface IDirectauranteSDK {
  tables: TablesSdk;
  guests: GuestsSdk;
  orders: OrdersSdk;
  bills: BillsSdk;
  kds: KdsSdk;
  catalog: CatalogSdk;
  cash: CashSdk;
  audit: AuditSdk;
  plugins: PluginsSdk;
  print: PrintSdk;
  customers: CustomersSdk;
  loyalty: LoyaltySdk;
  promotions: PromotionsSdk;
  coupons: CouponsSdk;
  commercial: CommercialReportSdk;
}
