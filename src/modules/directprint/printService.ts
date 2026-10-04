/**
 * DIRECTAURANTE DIRECTPRINT — Thermal Print Service
 * Manages thermal ESC/POS printers, multi-station routing, automatic print jobs,
 * slip generation, and print job queues.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Printer,
  PrinterRoutingRule,
  PrintJob,
  PrintJobType,
  Order,
  OrderItem,
  TableSession,
  Table,
  GuestSubaccount,
  Payment,
  CashShift,
} from '../../core/types';
import { EscPosFormatter } from './escposFormatter';
import { eventBus } from '../../core/eventBus';
import { AuditService } from '../../core/audit';

export class PrintService {
  private static isInitialized = false;

  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Initializes automatic event subscribers for background printing
   */
  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for Comandas sent to production
    eventBus.subscribe('ORDER_ITEM_SENT_TO_PRODUCTION', (evt) => {
      try {
        const payload = evt.payload;
        if (!payload || !payload.item) return;
        const item: OrderItem = payload.item;
        const restaurantId = evt.restaurant_id || DEFAULT_RESTAURANT_ID;

        // Auto print comanda for this station if rule exists with auto_print: true
        const station = item.destination_station;
        const jobType: PrintJobType = station === 'bar' ? 'comanda_bar' : 'comanda_kitchen';

        const rules = db
          .get('printer_routing_rules')
          .filter((r) => r.restaurant_id === restaurantId && r.job_type === jobType && r.auto_print);

        if (rules.length > 0 && payload.ticket_number) {
          // Trigger comanda print for ticket
          this.printComandaTicket(item.order_id, restaurantId, station);
        }
      } catch (err) {
        console.error('[DirectPrint] Error auto-printing comanda on production dispatch:', err);
      }
    });

    // Listen for Payments created
    eventBus.subscribe('PAYMENT_CREATED', (evt) => {
      try {
        const payment: Payment = evt.payload;
        if (!payment) return;
        const restaurantId = evt.restaurant_id || DEFAULT_RESTAURANT_ID;

        const autoRule = db
          .get('printer_routing_rules')
          .find((r) => r.restaurant_id === restaurantId && r.job_type === 'payment_receipt' && r.auto_print);

        if (autoRule) {
          this.printPaymentReceipt(payment.id, restaurantId);
        }
      } catch (err) {
        console.error('[DirectPrint] Error auto-printing payment receipt:', err);
      }
    });

    // Listen for Shift closures
    eventBus.subscribe('SHIFT_CLOSED', (evt) => {
      try {
        const shift: CashShift = evt.payload;
        if (!shift) return;
        const restaurantId = evt.restaurant_id || DEFAULT_RESTAURANT_ID;

        const autoRule = db
          .get('printer_routing_rules')
          .find((r) => r.restaurant_id === restaurantId && r.job_type === 'cash_shift_cut' && r.auto_print);

        if (autoRule) {
          this.printShiftReport(shift.id, restaurantId);
        }
      } catch (err) {
        console.error('[DirectPrint] Error auto-printing shift cut:', err);
      }
    });
  }

  // ==========================================
  // PRINTER CRUD
  // ==========================================

  public static getPrinters(restaurant_id: string = DEFAULT_RESTAURANT_ID): Printer[] {
    return db.get('printers').filter((p) => p.restaurant_id === restaurant_id);
  }

  public static getPrinter(printer_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): Printer {
    const printer = db.get('printers').find((p) => p.id === printer_id && p.restaurant_id === restaurant_id);
    if (!printer) {
      throw new Error(`Impresora ${printer_id} no encontrada.`);
    }
    return printer;
  }

  public static addPrinter(
    printerData: Omit<Printer, 'id' | 'created_at' | 'updated_at'>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Admin'
  ): Printer {
    const now = new Date().toISOString();
    const printer: Printer = {
      ...printerData,
      id: this.generateId('prn'),
      restaurant_id,
      created_at: now,
      updated_at: now,
    };

    db.get('printers').push(printer);
    db.save();

    AuditService.log(
      'printer_created',
      'printer',
      printer.id,
      actor,
      null,
      printer,
      `Impresora "${printer.name}" (${printer.station}, ${printer.paper_width}mm) configurada.`,
      restaurant_id
    );

    return printer;
  }

  public static updatePrinter(
    printer_id: string,
    updates: Partial<Printer>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Admin'
  ): Printer {
    const printer = this.getPrinter(printer_id, restaurant_id);
    const prev = { ...printer };

    Object.assign(printer, updates, { updated_at: new Date().toISOString() });
    db.save();

    AuditService.log(
      'printer_updated',
      'printer',
      printer.id,
      actor,
      prev,
      printer,
      `Impresora "${printer.name}" actualizada.`,
      restaurant_id
    );

    return printer;
  }

  public static deletePrinter(
    printer_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Admin'
  ): boolean {
    const printers = db.get('printers');
    const index = printers.findIndex((p) => p.id === printer_id && p.restaurant_id === restaurant_id);
    if (index === -1) {
      throw new Error(`Impresora ${printer_id} no encontrada.`);
    }

    const removed = printers.splice(index, 1)[0];
    db.save();

    AuditService.log(
      'printer_deleted',
      'printer',
      printer_id,
      actor,
      removed,
      null,
      `Impresora "${removed.name}" eliminada.`,
      restaurant_id
    );

    return true;
  }

  // ==========================================
  // ROUTING RULES
  // ==========================================

  public static getRoutingRules(restaurant_id: string = DEFAULT_RESTAURANT_ID): PrinterRoutingRule[] {
    return db.get('printer_routing_rules').filter((r) => r.restaurant_id === restaurant_id);
  }

  public static setRoutingRule(
    ruleData: Omit<PrinterRoutingRule, 'id'>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Admin'
  ): PrinterRoutingRule {
    const rules = db.get('printer_routing_rules');
    let existing = rules.find(
      (r) => r.restaurant_id === restaurant_id && r.job_type === ruleData.job_type && r.station === ruleData.station
    );

    if (existing) {
      Object.assign(existing, ruleData);
    } else {
      existing = {
        ...ruleData,
        id: this.generateId('rule'),
        restaurant_id,
      };
      rules.push(existing);
    }

    db.save();

    AuditService.log(
      'routing_rule_updated',
      'printer',
      existing.id,
      actor,
      null,
      existing,
      `Regla de enrutamiento para ${existing.job_type} configurada a impresora ${existing.printer_id}.`,
      restaurant_id
    );

    return existing;
  }

  // ==========================================
  // PRINT JOBS & DISPATCH
  // ==========================================

  public static getPrintJobs(restaurant_id: string = DEFAULT_RESTAURANT_ID, limit: number = 50): PrintJob[] {
    return db
      .get('print_jobs')
      .filter((j) => j.restaurant_id === restaurant_id)
      .slice(0, limit);
  }

  public static getPrintJob(job_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): PrintJob {
    const job = db.get('print_jobs').find((j) => j.id === job_id && j.restaurant_id === restaurant_id);
    if (!job) {
      throw new Error(`Trabajo de impresión ${job_id} no encontrado.`);
    }
    return job;
  }

  public static dispatchPrintJob(
    printer: Printer,
    job_type: PrintJobType,
    title: string,
    raw_content: string,
    metadata: PrintJob['metadata'] = {},
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'DirectPrint'
  ): PrintJob {
    const now = new Date().toISOString();
    const jobId = this.generateId('pjob');

    const job: PrintJob = {
      id: jobId,
      restaurant_id,
      printer_id: printer.id,
      printer_name: printer.name,
      job_type,
      title,
      status: 'completed', // In-memory thermal emulation completes immediately
      created_at: now,
      completed_at: now,
      raw_content,
      metadata,
    };

    db.get('print_jobs').unshift(job);
    db.save();

    AuditService.log(
      'print_job_created',
      'print_job',
      jobId,
      actor,
      null,
      job,
      `Impresión ${job_type} enviada exitosamente a "${printer.name}".`,
      restaurant_id
    );

    eventBus.publish('PRINT_JOB_CREATED', restaurant_id, actor, job);
    eventBus.publish('PRINT_JOB_COMPLETED', restaurant_id, actor, {
      job_id: job.id,
      printer_id: printer.id,
      printer_name: printer.name,
      job_type,
    });

    return job;
  }

  // ==========================================
  // OPERATIONAL TICKET PRINT METHODS
  // ==========================================

  /**
   * Prints Comanda Ticket for Kitchen or Bar (Respects Double Carlos separation)
   */
  public static printComandaTicket(
    order_ticket_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    station_filter?: 'kitchen' | 'bar',
    actor: string = 'Mesero'
  ): PrintJob[] {
    const order = db.get('orders').find((o) => o.id === order_ticket_id && o.restaurant_id === restaurant_id);
    if (!order) {
      throw new Error(`Comanda ${order_ticket_id} no encontrada.`);
    }

    const table = db.get('tables').find((t) => t.id === order.table_id);
    const tableNumber = table ? table.number : 'Mesa ?';
    const rest = db.get('restaurants').find((r) => r.id === restaurant_id);
    const restName = rest ? rest.name : 'Directaurante';

    const allItems = db
      .get('order_items')
      .filter((i) => i.order_id === order.id && i.preparation_status !== 'cancelled');

    const jobs: PrintJob[] = [];
    const stations: Array<'kitchen' | 'bar'> = station_filter ? [station_filter] : ['kitchen', 'bar'];

    for (const station of stations) {
      const stationItems = allItems.filter((i) => i.destination_station === station);
      if (stationItems.length === 0) continue;

      const jobType: PrintJobType = station === 'bar' ? 'comanda_bar' : 'comanda_kitchen';
      const rule = db
        .get('printer_routing_rules')
        .find((r) => r.restaurant_id === restaurant_id && r.job_type === jobType);

      let printer = rule ? db.get('printers').find((p) => p.id === rule.printer_id) : undefined;
      if (!printer) {
        printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id && (p.station === station || p.station === 'all'));
      }
      if (!printer) {
        printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id);
      }
      if (!printer) continue;

      const formattedSlip =
        station === 'bar'
          ? EscPosFormatter.formatBarComanda({
              restaurantName: restName,
              tableNumber,
              ticketNumber: order.ticket_number || 'Comanda',
              waiter: order.server_id || 'Mesero',
              timestamp: order.created_at,
              items: stationItems.map((i) => ({
                quantity: i.quantity,
                productName: i.product_name,
                seatNumber: i.seat_number,
                guestName: i.guest_name,
                notes: i.notes,
                modifiers: i.modifiers,
              })),
              width: printer.paper_width === 58 ? 32 : 42,
            })
          : EscPosFormatter.formatKitchenComanda({
              restaurantName: restName,
              tableNumber,
              ticketNumber: order.ticket_number || 'Comanda',
              waiter: order.server_id || 'Mesero',
              timestamp: order.created_at,
              items: stationItems.map((i) => ({
                quantity: i.quantity,
                productName: i.product_name,
                seatNumber: i.seat_number,
                guestName: i.guest_name,
                notes: i.notes,
                modifiers: i.modifiers,
                priority: i.priority,
              })),
              width: printer.paper_width === 58 ? 32 : 42,
            });

      const title = `${order.ticket_number || 'Comanda'} — ${station.toUpperCase()} (${tableNumber})`;
      const job = this.dispatchPrintJob(
        printer,
        jobType,
        title,
        formattedSlip,
        {
          table_number: tableNumber,
          table_session_id: order.table_session_id,
          order_ticket_id: order.id,
          ticket_number: order.ticket_number,
          items_count: stationItems.length,
        },
        restaurant_id,
        actor
      );

      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Prints Pre-Bill / Full Table Check
   */
  public static printPreBill(
    table_session_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    guest_subaccount_id?: string,
    actor: string = 'Mesero'
  ): PrintJob {
    const session = db
      .get('table_sessions')
      .find((s) => s.id === table_session_id && s.restaurant_id === restaurant_id);
    if (!session) {
      throw new Error(`Sesión ${table_session_id} no encontrada.`);
    }

    const table = db.get('tables').find((t) => t.id === session.table_id);
    const tableNumber = table ? table.number : 'Mesa ?';
    const rest = db.get('restaurants').find((r) => r.id === restaurant_id);
    const restName = rest ? rest.name : 'Directaurante';
    const legalName = rest ? rest.legal_name : 'Directaurante Gastronomía Integral S.A. de C.V.';

    const rule = db
      .get('printer_routing_rules')
      .find((r) => r.restaurant_id === restaurant_id && r.job_type === 'pre_bill');
    let printer = rule ? db.get('printers').find((p) => p.id === rule.printer_id) : undefined;
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id && (p.station === 'cashier' || p.station === 'all'));
    }
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id);
    }
    if (!printer) {
      throw new Error('No hay impresora configurada para pre-cuentas.');
    }

    let subaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === session.id && s.status !== 'closed');

    if (guest_subaccount_id) {
      subaccounts = subaccounts.filter((s) => s.id === guest_subaccount_id);
    }

    const allItems = db
      .get('order_items')
      .filter((i) => i.table_session_id === session.id && i.preparation_status !== 'cancelled');

    const payments = db
      .get('payments')
      .filter((p) => p.table_session_id === session.id);

    const subaccountDetails = subaccounts.map((seat) => {
      const seatItems = allItems.filter((i) => i.guest_subaccount_id === seat.id);
      const subtotalCents = seatItems.reduce((acc, i) => acc + i.total_price_cents, 0);
      const taxCents = Math.round(subtotalCents * 0.16);
      const totalCents = subtotalCents + taxCents;

      const seatPayments = payments.filter((p) => p.guest_subaccount_id === seat.id);
      const paidCents = seatPayments.reduce((acc, p) => acc + p.amount_cents, 0);
      const balanceCents = Math.max(0, totalCents - paidCents);

      return {
        seatNumber: seat.seat_number,
        displayName: seat.display_name,
        items: seatItems.map((i) => ({
          quantity: i.quantity,
          productName: i.product_name,
          unitPriceCents: i.unit_price_cents,
          totalPriceCents: i.total_price_cents,
        })),
        subtotalCents,
        totalCents,
        paidCents,
        balanceCents,
      };
    });

    const globalSubtotal = subaccountDetails.reduce((acc, s) => acc + s.subtotalCents, 0);
    const globalTax = Math.round(globalSubtotal * 0.16);
    const globalTotal = globalSubtotal + globalTax;
    const globalPaid = payments.reduce((acc, p) => acc + p.amount_cents, 0);
    const globalBalance = Math.max(0, globalTotal - globalPaid);

    const formattedSlip = EscPosFormatter.formatPreBill({
      restaurantName: restName,
      legalName,
      tableNumber,
      sessionId: session.id,
      serverName: session.server_id,
      timestamp: new Date().toISOString(),
      subaccounts: subaccountDetails,
      globalSubtotalCents: globalSubtotal,
      globalTaxCents: globalTax,
      globalTotalCents: globalTotal,
      globalPaidCents: globalPaid,
      globalBalanceCents: globalBalance,
      width: printer.paper_width === 58 ? 32 : 42,
    });

    const title = `Pre-cuenta ${tableNumber} (Sesión #${session.id.slice(-6)})`;
    return this.dispatchPrintJob(
      printer,
      'pre_bill',
      title,
      formattedSlip,
      {
        table_number: tableNumber,
        table_session_id: session.id,
        guest_subaccount_id,
        total_cents: globalTotal,
      },
      restaurant_id,
      actor
    );
  }

  /**
   * Prints Payment Receipt Ticket
   */
  public static printPaymentReceipt(
    payment_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Cajero'
  ): PrintJob {
    const payment = db.get('payments').find((p) => p.id === payment_id && p.restaurant_id === restaurant_id);
    if (!payment) {
      throw new Error(`Pago ${payment_id} no encontrado.`);
    }

    const table = db.get('tables').find((t) => t.id === payment.table_id);
    const tableNumber = table ? table.number : 'Mesa ?';
    const rest = db.get('restaurants').find((r) => r.id === restaurant_id);
    const restName = rest ? rest.name : 'Directaurante';

    const rule = db
      .get('printer_routing_rules')
      .find((r) => r.restaurant_id === restaurant_id && r.job_type === 'payment_receipt');
    let printer = rule ? db.get('printers').find((p) => p.id === rule.printer_id) : undefined;
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id && (p.station === 'cashier' || p.station === 'all'));
    }
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id);
    }
    if (!printer) {
      throw new Error('No hay impresora configurada para recibos de pago.');
    }

    let seatNumber: string | undefined;
    let guestName: string | undefined;
    if (payment.guest_subaccount_id) {
      const subaccount = db.get('guest_subaccounts').find((s) => s.id === payment.guest_subaccount_id);
      if (subaccount) {
        seatNumber = subaccount.seat_number;
        guestName = subaccount.display_name;
      }
    }

    // Remaining balance calculation
    const allSessionItems = db
      .get('order_items')
      .filter((i) => i.table_session_id === payment.table_session_id && i.preparation_status !== 'cancelled');
    const subtotal = allSessionItems.reduce((acc, i) => acc + i.total_price_cents, 0);
    const total = subtotal + Math.round(subtotal * 0.16);

    const allPayments = db
      .get('payments')
      .filter((p) => p.table_session_id === payment.table_session_id);
    const totalPaid = allPayments.reduce((acc, p) => acc + p.amount_cents, 0);
    const remainingBalance = Math.max(0, total - totalPaid);

    const formattedSlip = EscPosFormatter.formatPaymentReceipt({
      restaurantName: restName,
      paymentId: payment.id,
      tableNumber,
      sessionId: payment.table_session_id,
      method: payment.method,
      amountCents: payment.amount_cents,
      cashier: payment.cashier,
      timestamp: payment.created_at,
      reference: payment.reference,
      seatNumber,
      guestName,
      remainingBalanceCents: remainingBalance,
      width: printer.paper_width === 58 ? 32 : 42,
    });

    const title = `Recibo de Pago #${payment.id.slice(-8)} — ${tableNumber}`;
    return this.dispatchPrintJob(
      printer,
      'payment_receipt',
      title,
      formattedSlip,
      {
        table_number: tableNumber,
        table_session_id: payment.table_session_id,
        payment_id: payment.id,
        total_cents: payment.amount_cents,
      },
      restaurant_id,
      actor
    );
  }

  /**
   * Prints Cash Shift Cut (Z-Report / Blind Count Reconciliation)
   */
  public static printShiftReport(
    shift_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Cajero'
  ): PrintJob {
    const shift = db.get('cash_shifts').find((s) => s.id === shift_id && s.restaurant_id === restaurant_id);
    if (!shift) {
      throw new Error(`Turno ${shift_id} no encontrado.`);
    }

    const rest = db.get('restaurants').find((r) => r.id === restaurant_id);
    const restName = rest ? rest.name : 'Directaurante';

    const rule = db
      .get('printer_routing_rules')
      .find((r) => r.restaurant_id === restaurant_id && r.job_type === 'cash_shift_cut');
    let printer = rule ? db.get('printers').find((p) => p.id === rule.printer_id) : undefined;
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id && (p.station === 'cashier' || p.station === 'all'));
    }
    if (!printer) {
      printer = db.get('printers').find((p) => p.restaurant_id === restaurant_id);
    }
    if (!printer) {
      throw new Error('No hay impresora configurada para cortes de caja.');
    }

    const movements = db
      .get('cash_movements')
      .filter((m) => m.shift_id === shift.id && m.restaurant_id === restaurant_id);

    const cashSales = movements
      .filter((m) => m.type === 'sale')
      .reduce((acc, m) => acc + m.amount_cents, 0);

    const expenses = movements
      .filter((m) => m.type === 'expense')
      .reduce((acc, m) => acc + m.amount_cents, 0);

    const withdrawals = movements
      .filter((m) => m.type === 'withdrawal')
      .reduce((acc, m) => acc + m.amount_cents, 0);

    // Associated non-cash payments during this shift period
    const shiftStart = new Date(shift.opened_at).getTime();
    const shiftEnd = shift.closed_at ? new Date(shift.closed_at).getTime() : Date.now();

    const periodPayments = db.get('payments').filter((p) => {
      const pTime = new Date(p.created_at).getTime();
      return p.restaurant_id === restaurant_id && pTime >= shiftStart && pTime <= shiftEnd;
    });

    const cardSales = periodPayments
      .filter((p) => p.method === 'card')
      .reduce((acc, p) => acc + p.amount_cents, 0);

    const transferSales = periodPayments
      .filter((p) => p.method === 'transfer')
      .reduce((acc, p) => acc + p.amount_cents, 0);

    const formattedSlip = EscPosFormatter.formatCashShiftCut({
      restaurantName: restName,
      shiftId: shift.id,
      openedBy: shift.opened_by,
      openedAt: shift.opened_at,
      closedBy: shift.closed_by || 'Cajero',
      closedAt: shift.closed_at || new Date().toISOString(),
      initialFloatCents: shift.initial_float_cents,
      cashSalesCents: cashSales,
      cardSalesCents: cardSales,
      transferSalesCents: transferSales,
      expensesCents: expenses,
      withdrawalsCents: withdrawals,
      expectedCashCents: shift.expected_cash_cents,
      actualCashCents: shift.actual_cash_cents ?? shift.expected_cash_cents,
      differenceCents: shift.difference_cents ?? 0,
      movementsCount: movements.length,
      notes: shift.notes,
      width: printer.paper_width === 58 ? 32 : 42,
    });

    const title = `Corte Z de Turno #${shift.id.slice(-8)}`;
    return this.dispatchPrintJob(
      printer,
      'cash_shift_cut',
      title,
      formattedSlip,
      {
        shift_id: shift.id,
        total_cents: shift.actual_cash_cents,
      },
      restaurant_id,
      actor
    );
  }

  /**
   * Prints Thermal Printer Self-Test Ticket
   */
  public static printTestTicket(
    printer_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Admin'
  ): PrintJob {
    const printer = this.getPrinter(printer_id, restaurant_id);
    const slip = EscPosFormatter.formatTestTicket({
      printerName: printer.name,
      station: printer.station,
      address: printer.address,
      paperWidth: printer.paper_width,
      timestamp: new Date().toISOString(),
    });

    const title = `Ticket de Prueba — ${printer.name}`;
    return this.dispatchPrintJob(
      printer,
      'test',
      title,
      slip,
      {},
      restaurant_id,
      actor
    );
  }

  /**
   * Reprints existing PrintJob
   */
  public static reprintJob(
    job_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Usuario'
  ): PrintJob {
    const original = this.getPrintJob(job_id, restaurant_id);
    const printer = this.getPrinter(original.printer_id, restaurant_id);

    const reprintTitle = `[REIMPRESION] ${original.title}`;
    const slipWithHeader = `*** COPIA DE REIMPRESION ***\n${original.raw_content}`;

    return this.dispatchPrintJob(
      printer,
      original.job_type,
      reprintTitle,
      slipWithHeader,
      {
        ...original.metadata,
        reprint_count: (original.metadata?.reprint_count || 0) + 1,
      },
      restaurant_id,
      actor
    );
  }

  /**
   * Generates formatted text & simulated ESC/POS hexadecimal command sequence (Compatibility)
   */
  public static generateEscPosTicket(
    station: 'kitchen' | 'bar' | 'cashier',
    table_number: string,
    waiter: string,
    items: OrderItem[],
    restaurant_name: string = 'Directaurante'
  ): { formatted_ticket: string; escpos_hex: string; bytes_count: number } {
    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const separator = '='.repeat(38);
    const thinSeparator = '-'.repeat(38);
    const lines: string[] = [];

    lines.push(separator);
    lines.push(`   ${restaurant_name.toUpperCase()}`);
    lines.push(`   COMANDA DE ${station.toUpperCase()} - MODO ESC/POS`);
    lines.push(separator);
    lines.push(`MESA: ${table_number.padEnd(16)} HORA: ${now}`);
    lines.push(`MESERO: ${waiter.padEnd(14)} ESTACION: ${station.toUpperCase()}`);
    lines.push(thinSeparator);
    lines.push(`CANT  DESCRIPCION              COMENSAL`);
    lines.push(thinSeparator);

    items.forEach((item) => {
      const qty = `${item.quantity}x`.padEnd(5);
      const name = item.product_name.slice(0, 22).padEnd(23);
      const seat = `${item.seat_number} ${item.guest_name.slice(0, 6)}`;
      lines.push(`${qty} ${name} ${seat}`);
      if (item.notes) {
        lines.push(`      * NOTA: ${item.notes}`);
      }
    });

    lines.push(thinSeparator);
    lines.push(`TOTAL ARTICULOS: ${items.reduce((acc, i) => acc + i.quantity, 0)}`);
    lines.push(separator);
    lines.push(`\n\n\n`);

    const formatted_ticket = lines.join('\n');
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(formatted_ticket);
    const escpos_hex = `1B401B6101${Array.from(textBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}1D564200`;

    return {
      formatted_ticket,
      escpos_hex,
      bytes_count: textBytes.length + 10,
    };
  }
}

// Auto-initialize background listener
PrintService.init();
