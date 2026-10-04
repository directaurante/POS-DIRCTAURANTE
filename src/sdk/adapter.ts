/**
 * DIRECTAURANTE POS & COMANDERO — SDK Adapters
 * Implements architectural decoupling:
 * UI -> SDK -> Adapter -> Repository / API
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
  Allergy,
  Ingredient,
  Printer,
  PrinterRoutingRule,
  PrintJob,
} from '../core/types';
import { KdsItemView } from '../modules/kds/kdsService';

export interface DirectauranteSdkAdapter {
  listTables(restaurantId?: string): Promise<any[]>;
  getTable(tableId: string, restaurantId?: string): Promise<any>;
  openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId?: string
  ): Promise<any>;
  closeTableSession(tableIdOrSessionId: string, actor?: string, restaurantId?: string): Promise<any>;

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
  updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  acknowledgeItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
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

  getStationItems(station?: 'kitchen' | 'bar', restaurantId?: string): Promise<KdsItemView[]>;

  listProducts(category?: string, restaurantId?: string): Promise<Product[]>;
  listAllergies(): Promise<{ allergies: Allergy[]; ingredients: Ingredient[] }>;

  getCurrentShift(restaurantId?: string): Promise<any>;
  openShift(
    initialFloatCents: number,
    cashier?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<CashShift>;
  closeShift(
    actualCashCents: number,
    cashier?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<CashShift>;
  recordMovement(
    type: CashMovement['type'],
    amountCents: number,
    description: string,
    performer?: string,
    restaurantId?: string
  ): Promise<CashMovement>;

  listAuditEvents(limit?: number, entityType?: string, restaurantId?: string): Promise<AuditLog[]>;
  listPlugins(restaurantId?: string): Promise<any[]>;
  togglePlugin(pluginId: string, enabled: boolean, actor?: string, restaurantId?: string): Promise<any>;

  // DirectPrint methods
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

import { PosService } from '../modules/pos/posService';
import { KdsService } from '../modules/kds/kdsService';
import { FinancialService } from '../modules/finance/financialService';
import { PrintService } from '../modules/directprint/printService';
import { CashService } from '../modules/cash/cashService';
import { PluginRegistry } from '../core/pluginRegistry';
import { AuditService } from '../core/audit';
import { db, DEFAULT_RESTAURANT_ID } from '../core/database';

export class InProcessDirectauranteAdapter implements DirectauranteSdkAdapter {
  async listTables(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.getTables(restaurantId);
  }

  async getTable(tableId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.getTableDetails(tableId, restaurantId);
  }

  async openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.openTable(tableId, waiterName, initialGuests, restaurantId);
  }

  async closeTableSession(tableIdOrSessionId: string, actor: string = 'Cajero', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.closeTable(tableIdOrSessionId, actor, restaurantId);
  }

  async listSubaccounts(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const details = PosService.getTableDetails(tableIdOrSessionId, restaurantId);
    return details.subaccounts || [];
  }

  async createSubaccount(
    tableIdOrSessionId: string,
    displayName: string,
    allergyIds: string[] = [],
    notes?: string,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.addGuestSubaccount(tableIdOrSessionId, displayName, allergyIds, notes, actor, restaurantId);
  }

  async updateSubaccount(
    subaccountId: string,
    updates: Partial<GuestSubaccount>,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const subaccounts = db.get('guest_subaccounts');
    const seat = subaccounts.find((s) => s.id === subaccountId);
    if (!seat) throw new Error(`Subcuenta ${subaccountId} no encontrada.`);
    Object.assign(seat, updates, { updated_at: new Date().toISOString() });
    db.save();
    return seat;
  }

  async getSubaccount(subaccountId: string) {
    const seat = db.get('guest_subaccounts').find((s) => s.id === subaccountId);
    if (!seat) throw new Error(`Subcuenta ${subaccountId} no encontrada.`);
    return seat;
  }

  async createOrderTicket(
    tableIdOrSessionId: string,
    waiterName: string = 'Mesero',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.createOrderTicket(tableIdOrSessionId, waiterName, notes, restaurantId);
  }

  async getSessionOrders(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const details = PosService.getTableDetails(tableIdOrSessionId, restaurantId);
    return details.orders || [];
  }

  async addOrderItem(
    tableIdOrSessionId: string,
    guestSubaccountId: string,
    productId: string,
    quantity: number = 1,
    notes?: string,
    overrideAllergy: boolean = false,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID,
    orderTicketId?: string,
    modifiers?: string[]
  ) {
    try {
      const item = PosService.addItemToSubaccount(
        tableIdOrSessionId,
        guestSubaccountId,
        productId,
        quantity,
        notes,
        overrideAllergy,
        actor,
        restaurantId,
        orderTicketId,
        modifiers
      );
      return { item, allergy_warning: false };
    } catch (err: any) {
      if (err.is_allergy_warning) {
        return { item: null as any, allergy_warning: true, conflicts: err.conflicts };
      }
      throw err;
    }
  }

  async updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor: string = 'Cocina',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.updateItemStatus(itemId, status, actor, notes, restaurantId);
  }

  async acknowledgeItem(itemId: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.acknowledgeItem(itemId, actor, restaurantId);
  }

  async removeOrderItem(itemId: string, reason?: string, actor: string = 'Mesero', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.removeOrderItem(itemId, reason, actor, restaurantId);
  }

  async reassignItemSubaccount(
    itemId: string,
    newSubaccountId: string,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.reassignItemSubaccount(itemId, newSubaccountId, actor, restaurantId);
  }

  async getSessionBill(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return FinancialService.calculateTableBill(tableIdOrSessionId, restaurantId);
  }

  async getSubaccountBill(
    tableIdOrSessionId: string,
    subaccountId: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const bill = FinancialService.calculateTableBill(tableIdOrSessionId, restaurantId);
    const subaccountBill = bill.subaccounts.find((s) => s.guest_subaccount_id === subaccountId);
    if (!subaccountBill) throw new Error(`Subcuenta ${subaccountId} no encontrada en la cuenta.`);
    return subaccountBill;
  }

  async recordPayment(
    tableIdOrSessionId: string,
    amountCents: number,
    method: Payment['method'],
    guestSubaccountId?: string,
    cashier: string = 'Cajero',
    reference?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return FinancialService.recordPayment(
      tableIdOrSessionId,
      amountCents,
      method,
      guestSubaccountId,
      cashier,
      reference,
      undefined,
      restaurantId
    );
  }

  async getStationItems(station?: 'kitchen' | 'bar', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.getActiveStationItems(station, restaurantId);
  }

  async listProducts(category?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    let prods = db.get('products').filter((p) => p.restaurant_id === restaurantId);
    if (category) {
      prods = prods.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    return prods;
  }

  async listAllergies() {
    return {
      allergies: db.get('allergies'),
      ingredients: db.get('ingredients'),
    };
  }

  async getCurrentShift(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CashService.getCurrentShift(restaurantId);
  }

  async openShift(
    initialFloatCents: number,
    cashier: string = 'Cajero Turno',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return FinancialService.openShift(initialFloatCents, cashier, notes, restaurantId);
  }

  async closeShift(
    actualCashCents: number,
    cashier: string = 'Cajero Turno',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return FinancialService.closeShift(actualCashCents, cashier, notes, restaurantId);
  }

  async recordMovement(
    type: CashMovement['type'],
    amountCents: number,
    description: string,
    performer: string = 'Cajero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return FinancialService.recordCashMovement(type, amountCents, description, performer, restaurantId);
  }

  async listAuditEvents(limit: number = 50, entityType?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    let logs = AuditService.getLogs(restaurantId, limit);
    if (entityType) {
      logs = logs.filter((l) => l.entity_type === entityType);
    }
    return logs;
  }

  async listPlugins(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PluginRegistry.getRestaurantPlugins(restaurantId);
  }

  async togglePlugin(
    pluginId: string,
    enabled: boolean,
    actor: string = 'Administrador',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    PluginRegistry.togglePlugin(pluginId, enabled, restaurantId, actor);
    return { success: true, plugin_id: pluginId, enabled };
  }

  // DirectPrint in-process implementation
  async listPrinters(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getPrinters(restaurantId);
  }

  async getPrinter(printerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getPrinter(printerId, restaurantId);
  }

  async createPrinter(printer: Omit<Printer, 'id' | 'created_at' | 'updated_at'>, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.addPrinter(printer, restaurantId);
  }

  async updatePrinter(printerId: string, updates: Partial<Printer>, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.updatePrinter(printerId, updates, restaurantId);
  }

  async deletePrinter(printerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.deletePrinter(printerId, restaurantId);
  }

  async listRoutingRules(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getRoutingRules(restaurantId);
  }

  async setRoutingRule(rule: Omit<PrinterRoutingRule, 'id'>, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.setRoutingRule(rule, restaurantId);
  }

  async listPrintJobs(limit: number = 50, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getPrintJobs(restaurantId, limit);
  }

  async getPrintJob(jobId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getPrintJob(jobId, restaurantId);
  }

  async printComanda(orderTicketId: string, station?: 'kitchen' | 'bar', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.printComandaTicket(orderTicketId, restaurantId, station);
  }

  async printPreBill(tableSessionId: string, guestSubaccountId?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.printPreBill(tableSessionId, restaurantId, guestSubaccountId);
  }

  async printPaymentReceipt(paymentId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.printPaymentReceipt(paymentId, restaurantId);
  }

  async printShiftReport(shiftId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.printShiftReport(shiftId, restaurantId);
  }

  async testPrinter(printerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.printTestTicket(printerId, restaurantId);
  }

  async reprintJob(jobId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.reprintJob(jobId, restaurantId);
  }
}
