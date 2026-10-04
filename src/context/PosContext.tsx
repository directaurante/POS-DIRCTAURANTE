/**
 * DIRECTAURANTE POS CORE — Unified POS React Context
 * Connects UI directly to directauranteSDK and keeps state synchronized via EventBus.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { directauranteSDK } from '../sdk';
import { eventBus } from '../core/eventBus';
import {
  Table,
  Product,
  GuestSubaccount,
  OrderItem,
  OrderItemStatus,
  TableBill,
  SubaccountBill,
  Payment,
  CashShift,
  Allergy,
  Ingredient,
  Printer,
  PrinterRoutingRule,
  PrintJob,
} from '../core/types';
import { KdsItemView } from '../modules/kds/kdsService';

interface PosContextType {
  tables: any[];
  selectedTableId: string | null;
  selectedTableDetails: any | null;
  products: Product[];
  allergies: Allergy[];
  ingredients: Ingredient[];
  kdsItems: KdsItemView[];
  currentShift: any | null;
  printers: Printer[];
  routingRules: PrinterRoutingRule[];
  printJobs: PrintJob[];
  previewJob: PrintJob | null;
  loading: boolean;
  error: string | null;

  // Navigation & selection
  selectTable: (tableId: string | null) => void;
  refreshAll: () => Promise<void>;

  // Operations
  openTable: (tableId: string, waiter?: string, guests?: any[]) => Promise<any>;
  addGuest: (tableId: string, displayName: string, allergyIds?: string[], notes?: string) => Promise<GuestSubaccount>;
  createOrderTicket: (tableId: string, waiterName?: string, notes?: string) => Promise<any>;
  addItemToSeat: (
    tableId: string,
    guestSeatId: string,
    productId: string,
    quantity?: number,
    notes?: string,
    overrideAllergy?: boolean,
    modifiers?: string[]
  ) => Promise<{ item: OrderItem; allergy_warning: boolean; conflicts?: any[] }>;
  updateItemStatus: (itemId: string, status: OrderItemStatus, notes?: string) => Promise<OrderItem>;
  acknowledgeItem: (itemId: string) => Promise<OrderItem>;
  removeOrderItem: (itemId: string, reason: string) => Promise<OrderItem>;
  reassignItemSubaccount: (itemId: string, newSeatId: string) => Promise<OrderItem>;

  // Finance
  getTableBill: (tableId: string) => Promise<TableBill>;
  getSubaccountBill: (tableId: string, seatId: string) => Promise<SubaccountBill>;
  recordPayment: (
    tableId: string,
    amountCents: number,
    method: Payment['method'],
    guestSeatId?: string,
    cashier?: string,
    reference?: string
  ) => Promise<Payment>;
  closeTable: (tableId: string) => Promise<any>;

  // Cash Drawer
  openShift: (initialFloatCents: number, cashier?: string, notes?: string) => Promise<CashShift>;
  recordCashMovement: (type: any, amountCents: number, description: string, performer?: string) => Promise<any>;
  closeShift: (actualCashCents: number, cashier?: string, notes?: string) => Promise<CashShift>;

  // DirectPrint
  printComanda: (orderTicketId: string, station?: 'kitchen' | 'bar') => Promise<PrintJob[]>;
  printPreBill: (tableSessionId: string, guestSeatId?: string) => Promise<PrintJob>;
  printPaymentReceipt: (paymentId: string) => Promise<PrintJob>;
  printShiftReport: (shiftId: string) => Promise<PrintJob>;
  testPrinter: (printerId: string) => Promise<PrintJob>;
  reprintJob: (jobId: string) => Promise<PrintJob>;
  addPrinter: (printer: Omit<Printer, 'id' | 'created_at' | 'updated_at'>) => Promise<Printer>;
  updatePrinter: (printerId: string, updates: Partial<Printer>) => Promise<Printer>;
  deletePrinter: (printerId: string) => Promise<boolean>;
  setRoutingRule: (rule: Omit<PrinterRoutingRule, 'id'>) => Promise<PrinterRoutingRule>;
  openThermalPreview: (job: PrintJob) => void;
  closeThermalPreview: () => void;

  // Canonical scenario
  loadCanonicalScenario: () => Promise<void>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableDetails, setSelectedTableDetails] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kdsItems, setKdsItems] = useState<KdsItemView[]>([]);
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [routingRules, setRoutingRules] = useState<PrinterRoutingRule[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [previewJob, setPreviewJob] = useState<PrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [
        tbls,
        prods,
        algData,
        kds,
        shift,
        prns,
        rules,
        jobs,
      ] = await Promise.all([
        directauranteSDK.tables.listTables(),
        directauranteSDK.catalog.listProducts(),
        directauranteSDK.catalog.listAllergies(),
        directauranteSDK.kds.getStationItems(),
        directauranteSDK.cash.getCurrentShift(),
        directauranteSDK.print.listPrinters(),
        directauranteSDK.print.listRoutingRules(),
        directauranteSDK.print.listPrintJobs(50),
      ]);

      setTables(tbls);
      setProducts(prods);
      setAllergies(algData.allergies);
      setIngredients(algData.ingredients);
      setKdsItems(kds);
      setCurrentShift(shift);
      setPrinters(prns);
      setRoutingRules(rules);
      setPrintJobs(jobs);

      if (selectedTableId) {
        const details = await directauranteSDK.tables.getTable(selectedTableId);
        setSelectedTableDetails(details);
      }
    } catch (err: any) {
      console.error('Error refreshing POS data:', err);
      setError(err.message || 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  }, [selectedTableId]);

  useEffect(() => {
    refreshAll();

    // Event bus synchronization
    const unsubscribe = eventBus.subscribe('*', () => {
      refreshAll();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshAll]);

  const selectTable = async (tableId: string | null) => {
    setSelectedTableId(tableId);
    if (!tableId) {
      setSelectedTableDetails(null);
      return;
    }
    try {
      const details = await directauranteSDK.tables.getTable(tableId);
      setSelectedTableDetails(details);
    } catch (err: any) {
      console.error('Error selecting table:', err);
    }
  };

  const openTable = async (tableId: string, waiter: string = 'Mesero Sofía', guests?: any[]) => {
    const res = await directauranteSDK.tables.openTableSession(tableId, waiter, guests);
    await refreshAll();
    await selectTable(tableId);
    return res;
  };

  const addGuest = async (tableId: string, displayName: string, allergyIds?: string[], notes?: string) => {
    const res = await directauranteSDK.guests.createSubaccount(tableId, displayName, allergyIds, notes);
    await refreshAll();
    return res;
  };

  const createOrderTicket = async (tableId: string, waiterName?: string, notes?: string) => {
    const res = await directauranteSDK.orders.createOrderTicket(tableId, waiterName, notes);
    await refreshAll();
    return res;
  };

  const addItemToSeat = async (
    tableId: string,
    guestSeatId: string,
    productId: string,
    quantity: number = 1,
    notes?: string,
    overrideAllergy: boolean = false,
    modifiers?: string[]
  ) => {
    const res = await directauranteSDK.orders.addOrderItem(
      tableId,
      guestSeatId,
      productId,
      quantity,
      notes,
      overrideAllergy,
      'Mesero',
      undefined,
      undefined,
      modifiers
    );
    await refreshAll();
    return res;
  };

  const updateItemStatus = async (itemId: string, status: OrderItemStatus, notes?: string) => {
    const res = await directauranteSDK.kds.updateItemStatus(itemId, status, 'Operador', notes);
    await refreshAll();
    return res;
  };

  const acknowledgeItem = async (itemId: string) => {
    const res = await directauranteSDK.kds.acknowledgeItem(itemId, 'Cocina');
    await refreshAll();
    return res;
  };

  const removeOrderItem = async (itemId: string, reason: string) => {
    const res = await directauranteSDK.orders.removeOrderItem(itemId, reason);
    await refreshAll();
    return res;
  };

  const reassignItemSubaccount = async (itemId: string, newSeatId: string) => {
    const res = await directauranteSDK.orders.reassignItemSubaccount(itemId, newSeatId);
    await refreshAll();
    return res;
  };

  const getTableBill = async (tableId: string) => {
    return directauranteSDK.bills.getSessionBill(tableId);
  };

  const getSubaccountBill = async (tableId: string, seatId: string) => {
    return directauranteSDK.bills.getSubaccountBill(tableId, seatId);
  };

  const recordPayment = async (
    tableId: string,
    amountCents: number,
    method: Payment['method'],
    guestSeatId?: string,
    cashier: string = 'Cajero Turno',
    reference?: string
  ) => {
    const res = await directauranteSDK.bills.recordPayment(
      tableId,
      amountCents,
      method,
      guestSeatId,
      cashier,
      reference
    );
    await refreshAll();
    return res;
  };

  const closeTable = async (tableId: string) => {
    const res = await directauranteSDK.tables.closeTableSession(tableId);
    await refreshAll();
    selectTable(null);
    return res;
  };

  const openShift = async (initialFloatCents: number, cashier?: string, notes?: string) => {
    const res = await directauranteSDK.cash.openShift(initialFloatCents, cashier, notes);
    await refreshAll();
    return res;
  };

  const recordCashMovement = async (type: any, amountCents: number, description: string, performer?: string) => {
    const res = await directauranteSDK.cash.recordMovement(type, amountCents, description, performer);
    await refreshAll();
    return res;
  };

  const closeShift = async (actualCashCents: number, cashier?: string, notes?: string) => {
    const res = await directauranteSDK.cash.closeShift(actualCashCents, cashier, notes);
    await refreshAll();
    return res;
  };

  // DirectPrint handlers
  const printComanda = async (orderTicketId: string, station?: 'kitchen' | 'bar') => {
    const jobs = await directauranteSDK.print.printComanda(orderTicketId, station);
    await refreshAll();
    if (jobs.length > 0) {
      setPreviewJob(jobs[0]);
    }
    return jobs;
  };

  const printPreBill = async (tableSessionId: string, guestSeatId?: string) => {
    const job = await directauranteSDK.print.printPreBill(tableSessionId, guestSeatId);
    await refreshAll();
    setPreviewJob(job);
    return job;
  };

  const printPaymentReceipt = async (paymentId: string) => {
    const job = await directauranteSDK.print.printPaymentReceipt(paymentId);
    await refreshAll();
    setPreviewJob(job);
    return job;
  };

  const printShiftReport = async (shiftId: string) => {
    const job = await directauranteSDK.print.printShiftReport(shiftId);
    await refreshAll();
    setPreviewJob(job);
    return job;
  };

  const testPrinter = async (printerId: string) => {
    const job = await directauranteSDK.print.testPrinter(printerId);
    await refreshAll();
    setPreviewJob(job);
    return job;
  };

  const reprintJob = async (jobId: string) => {
    const job = await directauranteSDK.print.reprintJob(jobId);
    await refreshAll();
    setPreviewJob(job);
    return job;
  };

  const addPrinter = async (printer: Omit<Printer, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await directauranteSDK.print.createPrinter(printer);
    await refreshAll();
    return res;
  };

  const updatePrinter = async (printerId: string, updates: Partial<Printer>) => {
    const res = await directauranteSDK.print.updatePrinter(printerId, updates);
    await refreshAll();
    return res;
  };

  const deletePrinter = async (printerId: string) => {
    const res = await directauranteSDK.print.deletePrinter(printerId);
    await refreshAll();
    return res;
  };

  const setRoutingRule = async (rule: Omit<PrinterRoutingRule, 'id'>) => {
    const res = await directauranteSDK.print.setRoutingRule(rule);
    await refreshAll();
    return res;
  };

  const openThermalPreview = (job: PrintJob) => {
    setPreviewJob(job);
  };

  const closeThermalPreview = () => {
    setPreviewJob(null);
  };

  const loadCanonicalScenario = async () => {
    setLoading(true);
    try {
      const allTbls = await directauranteSDK.tables.listTables();
      const t1 = allTbls.find((t) => t.number === 'Mesa 1') || allTbls[0];
      if (!t1) return;

      // Close previous if active
      if (t1.active_session_id) {
        try {
          await directauranteSDK.tables.closeTableSession(t1.id);
        } catch {
          // ignore
        }
      }

      // Open Mesa 1 with Double Carlos + Luis + Ana
      const openResult = await directauranteSDK.tables.openTableSession(
        t1.id,
        'Mesero Sofía',
        [
          { name: 'Carlos' }, // 1.1
          { name: 'Carlos' }, // 1.2 (Doble Carlos)
          { name: 'Luis' },   // 1.3
          { name: 'Ana', allergy_ids: ['alg_cacahuate'] }, // 1.4
        ]
      );

      const subaccounts = openResult.subaccounts;
      const c1 = subaccounts.find((s: any) => s.seat_number === '1.1')!;
      const c2 = subaccounts.find((s: any) => s.seat_number === '1.2')!;
      const l1 = subaccounts.find((s: any) => s.seat_number === '1.3')!;

      // Comanda 001: Carlos (1.1) orders Boneless ($140) + Cerveza ($45)
      await directauranteSDK.orders.addOrderItem(t1.id, c1.id, 'prod_boneless_bbq', 1);
      await directauranteSDK.orders.addOrderItem(t1.id, c1.id, 'prod_cerveza', 1);

      // Comanda 002: Carlos (1.2) orders Hamburguesa ($150)
      const ticket2 = await directauranteSDK.orders.createOrderTicket(t1.id, 'Mesero Sofía', 'Ronda Carlos B');
      await directauranteSDK.orders.addOrderItem(t1.id, c2.id, 'prod_hamburguesa', 1, undefined, false, 'Mesero Sofía', undefined, ticket2.id);

      // Comanda 003: Luis (1.3) orders Burritos x2 ($220) + Michelada ($90)
      const ticket3 = await directauranteSDK.orders.createOrderTicket(t1.id, 'Mesero Sofía', 'Ronda Luis');
      await directauranteSDK.orders.addOrderItem(t1.id, l1.id, 'prod_burritos', 2, undefined, false, 'Mesero Sofía', undefined, ticket3.id);
      await directauranteSDK.orders.addOrderItem(t1.id, l1.id, 'prod_michelada', 1, undefined, false, 'Mesero Sofía', undefined, ticket3.id);

      await refreshAll();
      await selectTable(t1.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PosContext.Provider
      value={{
        tables,
        selectedTableId,
        selectedTableDetails,
        products,
        allergies,
        ingredients,
        kdsItems,
        currentShift,
        printers,
        routingRules,
        printJobs,
        previewJob,
        loading,
        error,
        selectTable,
        refreshAll,
        openTable,
        addGuest,
        createOrderTicket,
        addItemToSeat,
        updateItemStatus,
        acknowledgeItem,
        removeOrderItem,
        reassignItemSubaccount,
        getTableBill,
        getSubaccountBill,
        recordPayment,
        closeTable,
        openShift,
        recordCashMovement,
        closeShift,
        printComanda,
        printPreBill,
        printPaymentReceipt,
        printShiftReport,
        testPrinter,
        reprintJob,
        addPrinter,
        updatePrinter,
        deletePrinter,
        setRoutingRule,
        openThermalPreview,
        closeThermalPreview,
        loadCanonicalScenario,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return context;
};
