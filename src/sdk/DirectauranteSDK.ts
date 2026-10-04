/**
 * DIRECTAURANTE — Unified Client SDK
 * Authoritative single entry point for all frontend modules (POS, Comandero, KDS, Caja, DirectPrint).
 */

import { IDirectauranteSDK } from './types';
import { DirectauranteSdkAdapter, InProcessDirectauranteAdapter } from './adapter';
import {
  Payment,
  CashMovement,
  OrderItem,
  OrderItemStatus,
  Printer,
  PrinterRoutingRule,
} from '../core/types';

export class DirectauranteSDK implements IDirectauranteSDK {
  private adapter: DirectauranteSdkAdapter;
  private defaultRestaurantId: string;

  constructor(adapter?: DirectauranteSdkAdapter, defaultRestaurantId: string = 'rest_directaurante_01') {
    this.adapter = adapter || new InProcessDirectauranteAdapter();
    this.defaultRestaurantId = defaultRestaurantId;
  }

  public setAdapter(adapter: DirectauranteSdkAdapter): void {
    this.adapter = adapter;
  }

  public tables = {
    listTables: (restaurantId?: string) => this.adapter.listTables(restaurantId || this.defaultRestaurantId),
    getTable: (tableId: string, restaurantId?: string) =>
      this.adapter.getTable(tableId, restaurantId || this.defaultRestaurantId),
    openTableSession: (tableId: string, waiterName: string, initialGuests?: any[], restaurantId?: string) =>
      this.adapter.openTableSession(tableId, waiterName, initialGuests, restaurantId || this.defaultRestaurantId),
    closeTableSession: (tableIdOrSessionId: string, actor?: string, restaurantId?: string) =>
      this.adapter.closeTableSession(tableIdOrSessionId, actor, restaurantId || this.defaultRestaurantId),
  };

  public guests = {
    listSubaccounts: (tableIdOrSessionId: string, restaurantId?: string) =>
      this.adapter.listSubaccounts(tableIdOrSessionId, restaurantId || this.defaultRestaurantId),
    createSubaccount: (
      tableIdOrSessionId: string,
      displayName: string,
      allergyIds?: string[],
      notes?: string,
      actor?: string,
      restaurantId?: string
    ) =>
      this.adapter.createSubaccount(
        tableIdOrSessionId,
        displayName,
        allergyIds,
        notes,
        actor,
        restaurantId || this.defaultRestaurantId
      ),
    updateSubaccount: (subaccountId: string, updates: any, actor?: string, restaurantId?: string) =>
      this.adapter.updateSubaccount(subaccountId, updates, actor, restaurantId || this.defaultRestaurantId),
    getSubaccount: (subaccountId: string, restaurantId?: string) =>
      this.adapter.getSubaccount(subaccountId, restaurantId || this.defaultRestaurantId),
  };

  public orders = {
    createOrderTicket: (tableIdOrSessionId: string, waiterName?: string, notes?: string, restaurantId?: string) =>
      this.adapter.createOrderTicket(tableIdOrSessionId, waiterName, notes, restaurantId || this.defaultRestaurantId),
    getSessionOrders: (tableIdOrSessionId: string, restaurantId?: string) =>
      this.adapter.getSessionOrders(tableIdOrSessionId, restaurantId || this.defaultRestaurantId),
    addOrderItem: (
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
    ) =>
      this.adapter.addOrderItem(
        tableIdOrSessionId,
        guestSubaccountId,
        productId,
        quantity,
        notes,
        overrideAllergy,
        actor,
        restaurantId || this.defaultRestaurantId,
        orderTicketId,
        modifiers
      ),
    updateOrderItem: (itemId: string, updates: Partial<OrderItem>, actor?: string, restaurantId?: string) =>
      this.adapter.updateOrderItemStatus(
        itemId,
        updates.preparation_status as OrderItemStatus,
        actor,
        undefined,
        restaurantId || this.defaultRestaurantId
      ),
    removeOrderItem: (itemId: string, reason?: string, actor?: string, restaurantId?: string) =>
      this.adapter.removeOrderItem(itemId, reason, actor, restaurantId || this.defaultRestaurantId),
    reassignItemSubaccount: (itemId: string, newSubaccountId: string, actor?: string, restaurantId?: string) =>
      this.adapter.reassignItemSubaccount(itemId, newSubaccountId, actor, restaurantId || this.defaultRestaurantId),
  };

  public bills = {
    getSessionBill: (tableIdOrSessionId: string, restaurantId?: string) =>
      this.adapter.getSessionBill(tableIdOrSessionId, restaurantId || this.defaultRestaurantId),
    getSubaccountBill: (tableIdOrSessionId: string, subaccountId: string, restaurantId?: string) =>
      this.adapter.getSubaccountBill(tableIdOrSessionId, subaccountId, restaurantId || this.defaultRestaurantId),
    recordPayment: (
      tableIdOrSessionId: string,
      amountCents: number,
      method: Payment['method'],
      guestSubaccountId?: string,
      cashier?: string,
      reference?: string,
      restaurantId?: string
    ) =>
      this.adapter.recordPayment(
        tableIdOrSessionId,
        amountCents,
        method,
        guestSubaccountId,
        cashier,
        reference,
        restaurantId || this.defaultRestaurantId
      ),
  };

  public kds = {
    getKitchenItems: (restaurantId?: string) =>
      this.adapter.getStationItems('kitchen', restaurantId || this.defaultRestaurantId),
    getStationItems: (station?: 'kitchen' | 'bar', restaurantId?: string) =>
      this.adapter.getStationItems(station, restaurantId || this.defaultRestaurantId),
    updateItemStatus: (
      itemId: string,
      status: OrderItemStatus,
      actor?: string,
      notes?: string,
      restaurantId?: string
    ) => this.adapter.updateOrderItemStatus(itemId, status, actor, notes, restaurantId || this.defaultRestaurantId),
    acknowledgeItem: (itemId: string, actor?: string, restaurantId?: string) =>
      this.adapter.acknowledgeItem(itemId, actor, restaurantId || this.defaultRestaurantId),
    markItemReady: (itemId: string, actor?: string, restaurantId?: string) =>
      this.adapter.updateOrderItemStatus(itemId, 'ready', actor, undefined, restaurantId || this.defaultRestaurantId),
    markItemDelivered: (itemId: string, actor?: string, restaurantId?: string) =>
      this.adapter.updateOrderItemStatus(
        itemId,
        'delivered',
        actor,
        undefined,
        restaurantId || this.defaultRestaurantId
      ),
  };

  public catalog = {
    listProducts: (category?: string, restaurantId?: string) =>
      this.adapter.listProducts(category, restaurantId || this.defaultRestaurantId),
    listAllergies: () => this.adapter.listAllergies(),
  };

  public cash = {
    getCurrentShift: (restaurantId?: string) => this.adapter.getCurrentShift(restaurantId || this.defaultRestaurantId),
    openShift: (initialFloatCents: number, cashier?: string, notes?: string, restaurantId?: string) =>
      this.adapter.openShift(initialFloatCents, cashier, notes, restaurantId || this.defaultRestaurantId),
    closeShift: (actualCashCents: number, cashier?: string, notes?: string, restaurantId?: string) =>
      this.adapter.closeShift(actualCashCents, cashier, notes, restaurantId || this.defaultRestaurantId),
    recordMovement: (
      type: CashMovement['type'],
      amountCents: number,
      description: string,
      performer?: string,
      restaurantId?: string
    ) =>
      this.adapter.recordMovement(
        type,
        amountCents,
        description,
        performer,
        restaurantId || this.defaultRestaurantId
      ),
  };

  public audit = {
    listAuditEvents: (limit?: number, entityType?: string, restaurantId?: string) =>
      this.adapter.listAuditEvents(limit, entityType, restaurantId || this.defaultRestaurantId),
  };

  public plugins = {
    listPlugins: (restaurantId?: string) => this.adapter.listPlugins(restaurantId || this.defaultRestaurantId),
    getPluginState: async (pluginId: string, restaurantId?: string) => {
      const plugins = await this.adapter.listPlugins(restaurantId || this.defaultRestaurantId);
      const found = plugins.find((p) => p.id === pluginId);
      return found ? found.enabled : false;
    },
    togglePlugin: (pluginId: string, enabled: boolean, actor?: string, restaurantId?: string) =>
      this.adapter.togglePlugin(pluginId, enabled, actor, restaurantId || this.defaultRestaurantId),
  };

  // DirectPrint SDK module (Phase 5)
  public print = {
    listPrinters: (restaurantId?: string) =>
      this.adapter.listPrinters(restaurantId || this.defaultRestaurantId),
    getPrinter: (printerId: string, restaurantId?: string) =>
      this.adapter.getPrinter(printerId, restaurantId || this.defaultRestaurantId),
    createPrinter: (printer: Omit<Printer, 'id' | 'created_at' | 'updated_at'>, restaurantId?: string) =>
      this.adapter.createPrinter(printer, restaurantId || this.defaultRestaurantId),
    updatePrinter: (printerId: string, updates: Partial<Printer>, restaurantId?: string) =>
      this.adapter.updatePrinter(printerId, updates, restaurantId || this.defaultRestaurantId),
    deletePrinter: (printerId: string, restaurantId?: string) =>
      this.adapter.deletePrinter(printerId, restaurantId || this.defaultRestaurantId),
    listRoutingRules: (restaurantId?: string) =>
      this.adapter.listRoutingRules(restaurantId || this.defaultRestaurantId),
    setRoutingRule: (rule: Omit<PrinterRoutingRule, 'id'>, restaurantId?: string) =>
      this.adapter.setRoutingRule(rule, restaurantId || this.defaultRestaurantId),
    listPrintJobs: (limit?: number, restaurantId?: string) =>
      this.adapter.listPrintJobs(limit, restaurantId || this.defaultRestaurantId),
    getPrintJob: (jobId: string, restaurantId?: string) =>
      this.adapter.getPrintJob(jobId, restaurantId || this.defaultRestaurantId),
    printComanda: (orderTicketId: string, station?: 'kitchen' | 'bar', restaurantId?: string) =>
      this.adapter.printComanda(orderTicketId, station, restaurantId || this.defaultRestaurantId),
    printPreBill: (tableSessionId: string, guestSubaccountId?: string, restaurantId?: string) =>
      this.adapter.printPreBill(tableSessionId, guestSubaccountId, restaurantId || this.defaultRestaurantId),
    printPaymentReceipt: (paymentId: string, restaurantId?: string) =>
      this.adapter.printPaymentReceipt(paymentId, restaurantId || this.defaultRestaurantId),
    printShiftReport: (shiftId: string, restaurantId?: string) =>
      this.adapter.printShiftReport(shiftId, restaurantId || this.defaultRestaurantId),
    testPrinter: (printerId: string, restaurantId?: string) =>
      this.adapter.testPrinter(printerId, restaurantId || this.defaultRestaurantId),
    reprintJob: (jobId: string, restaurantId?: string) =>
      this.adapter.reprintJob(jobId, restaurantId || this.defaultRestaurantId),
  };
}

export const directauranteSDK = new DirectauranteSDK();
