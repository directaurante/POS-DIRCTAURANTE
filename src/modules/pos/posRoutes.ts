/**
 * DIRECTAURANTE POS CORE — Express API Routes
 * Exposes RESTful endpoints conforming to Directaurante's backend conventions.
 */

import { Router, Request, Response } from 'express';
import { PosService } from './posService';
import { KdsService } from '../kds/kdsService';
import { CashService } from '../cash/cashService';
import { FinancialService } from '../finance/financialService';
import { PrintService } from '../directprint/printService';
import { ImportService } from '../directimport/importService';
import { PluginRegistry } from '../../core/pluginRegistry';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';
import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { OrderItemStatus } from '../../core/types';

export const apiRouter = Router();

// ==========================================
// SYSTEM & PLUGINS
// ==========================================

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    module: 'Directaurante POS Core',
    version: '0.5.0',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/plugins', (_req: Request, res: Response) => {
  const plugins = PluginRegistry.getRestaurantPlugins(DEFAULT_RESTAURANT_ID);
  res.json({ plugins });
});

apiRouter.post('/plugins/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled, actor } = req.body;
  const updated = PluginRegistry.togglePlugin(id, Boolean(enabled), DEFAULT_RESTAURANT_ID, actor || 'Admin');
  res.json({ success: true, plugin: updated });
});

// ==========================================
// POS TABLES & SESSIONS
// ==========================================

apiRouter.get('/pos/tables', (_req: Request, res: Response) => {
  const tables = PosService.getTables(DEFAULT_RESTAURANT_ID);
  res.json({ tables });
});

apiRouter.get('/pos/tables/:id', (req: Request, res: Response) => {
  try {
    const details = PosService.getTableDetails(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json(details);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/open', (req: Request, res: Response) => {
  try {
    const { waiter_name, initial_guests } = req.body;
    const result = PosService.openTable(req.params.id, waiter_name, initial_guests, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/seats', (req: Request, res: Response) => {
  try {
    const { display_name, allergy_ids, notes, actor } = req.body;
    if (!display_name) {
      return res.status(400).json({ error: 'El nombre del comensal es obligatorio.' });
    }
    const seat = PosService.addGuestSubaccount(
      req.params.id,
      display_name,
      allergy_ids || [],
      notes,
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, seat });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/tickets', (req: Request, res: Response) => {
  try {
    const { waiter_name, notes } = req.body;
    const ticket = PosService.createOrderTicket(
      req.params.id,
      waiter_name || 'Mesero',
      notes,
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PRODUCTS & ALLERGIES
// ==========================================

apiRouter.get('/pos/products', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  let products = db.get('products').filter((p) => p.restaurant_id === DEFAULT_RESTAURANT_ID);
  if (category) {
    products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
  res.json({ products });
});

apiRouter.get('/pos/allergies', (_req: Request, res: Response) => {
  const allergies = db.get('allergies');
  const ingredients = db.get('ingredients');
  res.json({ allergies, ingredients });
});

apiRouter.post('/pos/allergies/check', (req: Request, res: Response) => {
  const { guest_subaccount_id, product_id } = req.body;
  const result = PosService.checkAllergies(guest_subaccount_id, product_id);
  res.json(result);
});

// ==========================================
// ORDER ITEMS (ASSIGNED TO SUBACCOUNT)
// ==========================================

apiRouter.post('/pos/tables/:id/items', (req: Request, res: Response) => {
  try {
    const {
      guest_subaccount_id,
      product_id,
      quantity,
      notes,
      override_allergy,
      actor,
      order_ticket_id,
      modifiers,
    } = req.body;

    if (!guest_subaccount_id || !product_id) {
      return res.status(400).json({ error: 'guest_subaccount_id y product_id son obligatorios.' });
    }

    const item = PosService.addItemToSubaccount(
      req.params.id,
      guest_subaccount_id,
      product_id,
      Number(quantity) || 1,
      notes,
      Boolean(override_allergy),
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID,
      order_ticket_id,
      modifiers || []
    );

    res.json({ success: true, item });
  } catch (err: any) {
    if (err.is_allergy_warning) {
      return res.status(409).json({
        error: err.message,
        is_allergy_warning: true,
        conflicts: err.allergy_conflict,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/pos/items/:itemId/status', (req: Request, res: Response) => {
  try {
    const { status, actor, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'El estado es requerido.' });
    }
    const updated = PosService.updateItemStatus(
      req.params.itemId,
      status as OrderItemStatus,
      actor || 'Operador',
      notes,
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/items/:itemId/acknowledge', (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    const item = PosService.acknowledgeItem(req.params.itemId, actor || 'Cocina', DEFAULT_RESTAURANT_ID);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/pos/items/:itemId/reassign', (req: Request, res: Response) => {
  try {
    const { new_subaccount_id, actor } = req.body;
    if (!new_subaccount_id) {
      return res.status(400).json({ error: 'new_subaccount_id es requerido.' });
    }
    const item = PosService.reassignItemSubaccount(
      req.params.itemId,
      new_subaccount_id,
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/pos/items/:itemId', (req: Request, res: Response) => {
  try {
    const { reason, actor } = req.body || {};
    const item = PosService.removeOrderItem(
      req.params.itemId,
      reason || 'Cancelado por mesero',
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// BILLS & FINANCIAL SETTLEMENTS
// ==========================================

apiRouter.get('/pos/tables/:id/bill', (req: Request, res: Response) => {
  try {
    const bill = FinancialService.calculateTableBill(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json({ bill });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/pay', (req: Request, res: Response) => {
  try {
    const { amount_cents, method, guest_subaccount_id, cashier, reference } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

    if (!amount_cents || !method) {
      return res.status(400).json({ error: 'amount_cents y method son obligatorios.' });
    }

    const payment = FinancialService.recordPayment(
      req.params.id,
      Number(amount_cents),
      method,
      guest_subaccount_id,
      cashier || 'Cajero',
      reference,
      idempotencyKey,
      DEFAULT_RESTAURANT_ID
    );

    const updatedBill = FinancialService.calculateTableBill(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, payment, updated_bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/close', (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    const bill = FinancialService.calculateTableBill(req.params.id, DEFAULT_RESTAURANT_ID);
    if (bill.balance_cents > 0) {
      return res.status(400).json({
        error: `No se puede cerrar la mesa con saldo pendiente ($${(bill.balance_cents / 100).toFixed(2)} MXN).`,
      });
    }
    const result = PosService.closeTable(req.params.id, actor || 'Cajero', DEFAULT_RESTAURANT_ID);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// KDS (KITCHEN DISPLAY SYSTEM)
// ==========================================

apiRouter.get('/pos/kds', (req: Request, res: Response) => {
  const station = req.query.station as 'kitchen' | 'bar' | undefined;
  const items = KdsService.getActiveStationItems(station, DEFAULT_RESTAURANT_ID);
  res.json({ items });
});

// ==========================================
// CASH SHIFTS & MOVEMENTS
// ==========================================

apiRouter.get('/cash/current', (_req: Request, res: Response) => {
  const current = CashService.getCurrentShift(DEFAULT_RESTAURANT_ID);
  res.json(current);
});

apiRouter.post('/cash/open', (req: Request, res: Response) => {
  try {
    const { initial_float_cents, opened_by, notes } = req.body;
    const shift = FinancialService.openShift(Number(initial_float_cents) || 0, opened_by || 'Cajero', notes, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/movement', (req: Request, res: Response) => {
  try {
    const { type, amount_cents, description, performed_by } = req.body;
    const movement = FinancialService.recordCashMovement(
      type,
      Number(amount_cents) || 0,
      description,
      performed_by || 'Cajero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/close', (req: Request, res: Response) => {
  try {
    const { actual_cash_cents, closed_by, notes } = req.body;
    const shift = FinancialService.closeShift(Number(actual_cash_cents) || 0, closed_by || 'Cajero', notes, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// DIRECTPRINT ENDPOINTS (FASE 5)
// ==========================================

apiRouter.get('/print/printers', (_req: Request, res: Response) => {
  const printers = PrintService.getPrinters(DEFAULT_RESTAURANT_ID);
  res.json({ printers });
});

apiRouter.post('/print/printers', (req: Request, res: Response) => {
  try {
    const { name, connection_type, address, port, station, paper_width, protocol, enabled } = req.body;
    const printer = PrintService.addPrinter(
      {
        restaurant_id: DEFAULT_RESTAURANT_ID,
        name,
        connection_type: connection_type || 'ethernet',
        address: address || '192.168.1.200',
        port: Number(port) || 9100,
        station: station || 'kitchen',
        paper_width: Number(paper_width) === 58 ? 58 : 80,
        protocol: protocol || 'esc_pos',
        enabled: enabled ?? true,
        status: 'online',
      },
      DEFAULT_RESTAURANT_ID,
      req.body.actor || 'Admin'
    );
    res.json({ success: true, printer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/print/printers/:id', (req: Request, res: Response) => {
  try {
    const updated = PrintService.updatePrinter(req.params.id, req.body, DEFAULT_RESTAURANT_ID, req.body.actor || 'Admin');
    res.json({ success: true, printer: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/print/printers/:id', (req: Request, res: Response) => {
  try {
    PrintService.deletePrinter(req.params.id, DEFAULT_RESTAURANT_ID, req.body.actor || 'Admin');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/print/rules', (_req: Request, res: Response) => {
  const rules = PrintService.getRoutingRules(DEFAULT_RESTAURANT_ID);
  res.json({ rules });
});

apiRouter.post('/print/rules', (req: Request, res: Response) => {
  try {
    const rule = PrintService.setRoutingRule(req.body, DEFAULT_RESTAURANT_ID, req.body.actor || 'Admin');
    res.json({ success: true, rule });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/print/jobs', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const jobs = PrintService.getPrintJobs(DEFAULT_RESTAURANT_ID, limit);
  res.json({ jobs });
});

apiRouter.post('/print/comanda/:orderTicketId', (req: Request, res: Response) => {
  try {
    const station = req.query.station as 'kitchen' | 'bar' | undefined;
    const jobs = PrintService.printComandaTicket(req.params.orderTicketId, DEFAULT_RESTAURANT_ID, station, req.body.actor || 'Mesero');
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/pre-bill/:sessionId', (req: Request, res: Response) => {
  try {
    const guestSubaccountId = req.query.guest_subaccount_id as string | undefined;
    const job = PrintService.printPreBill(req.params.sessionId, DEFAULT_RESTAURANT_ID, guestSubaccountId, req.body.actor || 'Mesero');
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/payment/:paymentId', (req: Request, res: Response) => {
  try {
    const job = PrintService.printPaymentReceipt(req.params.paymentId, DEFAULT_RESTAURANT_ID, req.body.actor || 'Cajero');
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/shift-cut/:shiftId', (req: Request, res: Response) => {
  try {
    const job = PrintService.printShiftReport(req.params.shiftId, DEFAULT_RESTAURANT_ID, req.body.actor || 'Cajero');
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/test/:printerId', (req: Request, res: Response) => {
  try {
    const job = PrintService.printTestTicket(req.params.printerId, DEFAULT_RESTAURANT_ID, req.body.actor || 'Admin');
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/reprint/:jobId', (req: Request, res: Response) => {
  try {
    const job = PrintService.reprintJob(req.params.jobId, DEFAULT_RESTAURANT_ID, req.body.actor || 'Usuario');
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// AUDIT & DOMAIN EVENTS
// ==========================================

apiRouter.get('/audit/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const logs = AuditService.getLogs(DEFAULT_RESTAURANT_ID, limit);
  res.json({ logs });
});

apiRouter.get('/events/history', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const events = eventBus.getHistory(DEFAULT_RESTAURANT_ID, limit);
  res.json({ events });
});

// ==========================================
// DIRECTIMPORT
// ==========================================

apiRouter.post('/import/preview', (req: Request, res: Response) => {
  const { source_pos, file_name, rows } = req.body;
  const preview = ImportService.createPreview(source_pos || 'SoftRestaurant', file_name || 'menu_export.csv', rows || [], DEFAULT_RESTAURANT_ID);
  res.json(preview);
});

apiRouter.post('/import/execute', (req: Request, res: Response) => {
  try {
    const { job_id, candidates, actor } = req.body;
    const result = ImportService.executeImport(job_id, candidates, actor || 'Admin', DEFAULT_RESTAURANT_ID);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// CANONICAL SCENARIO LOADER (DOBLE CARLOS)
// ==========================================

apiRouter.post('/pos/load-canonical-scenario', (_req: Request, res: Response) => {
  try {
    db.resetToDefault();

    const table1 = db.get('tables').find((t) => t.number === 'Mesa 1');
    if (!table1) throw new Error('Mesa 1 no encontrada');

    // Scenario: Mesa 1 with two diners named Carlos (1.1 and 1.2) and Luis (1.3)
    const openResult = PosService.openTable(
      table1.id,
      'Mesero Sofía',
      [
        { name: 'Carlos' }, // 1.1
        { name: 'Carlos' }, // 1.2 (Doble Carlos)
        { name: 'Luis' },   // 1.3
        { name: 'Ana', allergy_ids: ['alg_cacahuate'] }, // 1.4
      ],
      DEFAULT_RESTAURANT_ID
    );

    const subaccounts = openResult.subaccounts;
    const c1 = subaccounts.find((s) => s.seat_number === '1.1')!;
    const c2 = subaccounts.find((s) => s.seat_number === '1.2')!;
    const l1 = subaccounts.find((s) => s.seat_number === '1.3')!;

    // Comanda #001: Carlos (1.1) orders Boneless ($140) + Cerveza ($45)
    PosService.addItemToSubaccount(table1.id, c1.id, 'prod_boneless_bbq', 1, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID);
    PosService.addItemToSubaccount(table1.id, c1.id, 'prod_cerveza', 1, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID);

    // Comanda #002: Carlos (1.2) orders Hamburguesa ($150)
    const comanda2 = PosService.createOrderTicket(table1.id, 'Mesero Sofía', 'Ronda Carlos B');
    PosService.addItemToSubaccount(table1.id, c2.id, 'prod_hamburguesa', 1, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, comanda2.id);

    // Comanda #003: Luis (1.3) orders Burritos x2 ($220) + Michelada ($90)
    const comanda3 = PosService.createOrderTicket(table1.id, 'Mesero Sofía', 'Ronda Luis');
    PosService.addItemToSubaccount(table1.id, l1.id, 'prod_burritos', 2, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, comanda3.id);
    PosService.addItemToSubaccount(table1.id, l1.id, 'prod_michelada', 1, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, comanda3.id);

    const bill = FinancialService.calculateTableBill(table1.id, DEFAULT_RESTAURANT_ID);

    res.json({
      success: true,
      message: 'Escenario canónico (Doble Carlos + Múltiples Comandas) cargado en Mesa 1.',
      table: table1,
      subaccounts,
      bill,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
