/**
 * DIRECTAURANTE POS CORE — Financial Core Service
 * Handles unified session bills, individual subaccount bills, idempotent payments,
 * cash shifts, movements, blind count reconciliation, and immutable financial audit logging.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  TableSession,
  GuestSubaccount,
  TableBill,
  SubaccountBill,
  Payment,
  CashShift,
  CashMovement,
} from '../../core/types';
import { eventBus } from '../../core/eventBus';
import { AuditService } from '../../core/audit';

export class FinancialService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Calculate deterministic global table session bill and individual subaccount bills.
   */
  public static calculateTableBill(
    table_id_or_session_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): TableBill {
    const session = this.resolveActiveOrRecentSession(table_id_or_session_id, restaurant_id);
    const table = db.get('tables').find((t) => t.id === session.table_id);
    const tableNumber = table ? table.number : 'Mesa';

    const sessionOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);

    const subaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === session.id && s.status !== 'closed');

    const allSessionItems = db
      .get('order_items')
      .filter(
        (i) => i.table_session_id === session.id && i.preparation_status !== 'cancelled'
      );

    const sessionPayments = db
      .get('payments')
      .filter((p) => p.table_session_id === session.id);

    const taxRate = 0.16; // 16% IVA estándar

    const subaccountBills: SubaccountBill[] = subaccounts.map((seat) => {
      const seatItems = allSessionItems.filter((i) => i.guest_subaccount_id === seat.id);
      const subtotal_cents = seatItems.reduce((sum, item) => sum + item.total_price_cents, 0);
      const tax_cents = Math.round(subtotal_cents * taxRate);
      const total_cents = subtotal_cents + tax_cents;

      const seatPayments = sessionPayments.filter((p) => p.guest_subaccount_id === seat.id);
      const paid_cents = seatPayments.reduce((sum, p) => sum + p.amount_cents, 0);
      const balance_cents = Math.max(0, total_cents - paid_cents);

      return {
        guest_subaccount_id: seat.id,
        seat_number: seat.seat_number,
        display_name: seat.display_name,
        items: seatItems,
        subtotal_cents,
        tax_cents,
        total_cents,
        paid_cents,
        balance_cents,
      };
    });

    const globalSubtotal = subaccountBills.reduce((acc, s) => acc + s.subtotal_cents, 0);
    const globalTax = subaccountBills.reduce((acc, s) => acc + s.tax_cents, 0);
    const globalTotal = globalSubtotal + globalTax;
    const globalPaid = sessionPayments.reduce((acc, p) => acc + p.amount_cents, 0);
    const globalBalance = Math.max(0, globalTotal - globalPaid);

    return {
      table_id: session.table_id,
      table_number: tableNumber,
      table_session_id: session.id,
      session_status: session.status,
      orders: sessionOrders,
      order_id: sessionOrders[0]?.id,
      subaccounts: subaccountBills,
      total_items_count: allSessionItems.reduce((acc, i) => acc + i.quantity, 0),
      subtotal_cents: globalSubtotal,
      tax_cents: globalTax,
      total_cents: globalTotal,
      paid_cents: globalPaid,
      balance_cents: globalBalance,
    };
  }

  /**
   * Record payment with strict idempotency key enforcement, cash movement sync, and financial audit.
   */
  public static recordPayment(
    table_id_or_session_id: string,
    amount_cents: number,
    method: Payment['method'],
    guest_subaccount_id?: string,
    cashier: string = 'Cajero',
    reference?: string,
    idempotency_key?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Payment {
    if (amount_cents <= 0) {
      throw new Error('El monto de pago debe ser mayor a 0.');
    }

    // Check idempotency if provided
    const payments = db.get('payments');
    if (idempotency_key) {
      const existingPayment = payments.find(
        (p) => (p as any).idempotency_key === idempotency_key && p.restaurant_id === restaurant_id
      );
      if (existingPayment) {
        return existingPayment;
      }
    }

    const session = this.resolveActiveOrRecentSession(table_id_or_session_id, restaurant_id);
    const sessionOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);

    const now = new Date().toISOString();
    const paymentId = this.generateId('pay');

    const payment: Payment = {
      id: paymentId,
      restaurant_id,
      table_session_id: session.id,
      table_id: session.table_id,
      order_id: sessionOrders[0]?.id,
      guest_subaccount_id,
      amount_cents,
      method,
      created_at: now,
      cashier,
      reference,
      idempotency_key,
    };

    payments.push(payment);

    // If cash payment, synchronize with active cash shift
    if (method === 'cash') {
      const activeShift = db
        .get('cash_shifts')
        .find((s) => s.restaurant_id === restaurant_id && s.status === 'open');

      if (activeShift) {
        const cashMovement: CashMovement = {
          id: this.generateId('mov'),
          shift_id: activeShift.id,
          restaurant_id,
          type: 'sale',
          amount_cents,
          description: `Cobro en efectivo - Sesión ${session.id} (Mesa ${session.table_id})${
            guest_subaccount_id ? ` [Comensal ${guest_subaccount_id}]` : ''
          }`,
          performed_by: cashier,
          timestamp: now,
          source_payment_id: paymentId,
        };
        db.get('cash_movements').push(cashMovement);
        activeShift.expected_cash_cents += amount_cents;
      }
    }

    session.updated_at = now;
    db.save();

    AuditService.log(
      'payment_created',
      'payment',
      paymentId,
      cashier,
      null,
      payment,
      `Pago de $${(amount_cents / 100).toFixed(2)} registrado vía ${method} en sesión ${session.id}.`,
      restaurant_id
    );

    eventBus.publish('PAYMENT_CREATED', restaurant_id, cashier, payment);

    return payment;
  }

  /**
   * Cash Shift Management: Open shift with initial float
   */
  public static openShift(
    initial_float_cents: number,
    opened_by: string = 'Cajero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CashShift {
    const active = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open');
    if (active) {
      throw new Error('Ya existe un turno de caja abierto en este restaurante.');
    }

    const now = new Date().toISOString();
    const shiftId = this.generateId('shift');
    const shift: CashShift = {
      id: shiftId,
      restaurant_id,
      opened_by,
      opened_at: now,
      initial_float_cents,
      status: 'open',
      expected_cash_cents: initial_float_cents,
      notes,
    };

    db.get('cash_shifts').push(shift);

    const movement: CashMovement = {
      id: this.generateId('mov'),
      shift_id: shiftId,
      restaurant_id,
      type: 'opening_float',
      amount_cents: initial_float_cents,
      description: 'Fondo de apertura de turno',
      performed_by: opened_by,
      timestamp: now,
    };
    db.get('cash_movements').push(movement);
    db.save();

    AuditService.log(
      'cash_shift_opened',
      'cash_shift',
      shiftId,
      opened_by,
      null,
      shift,
      `Turno de caja abierto con fondo inicial de $${(initial_float_cents / 100).toFixed(2)}.`,
      restaurant_id
    );

    eventBus.publish('SHIFT_OPENED', restaurant_id, opened_by, shift);
    return shift;
  }

  /**
   * Record operational cash movement (expense, withdrawal, deposit)
   */
  public static recordCashMovement(
    type: CashMovement['type'],
    amount_cents: number,
    description: string,
    performed_by: string = 'Cajero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CashMovement {
    const current = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open');
    if (!current) {
      throw new Error('No hay turno de caja abierto para registrar movimientos.');
    }

    const now = new Date().toISOString();
    const movementId = this.generateId('mov');
    const movement: CashMovement = {
      id: movementId,
      shift_id: current.id,
      restaurant_id,
      type,
      amount_cents,
      description,
      performed_by,
      timestamp: now,
    };

    db.get('cash_movements').push(movement);

    if (type === 'sale' || type === 'deposit' || type === 'opening_float' || type === 'adjustment') {
      current.expected_cash_cents += amount_cents;
    } else {
      current.expected_cash_cents -= amount_cents;
    }

    db.save();

    const auditAction =
      type === 'expense' ? 'expense_created' : type === 'withdrawal' ? 'withdrawal_created' : 'cash_adjustment';

    AuditService.log(
      auditAction,
      'cash_shift',
      current.id,
      performed_by,
      null,
      movement,
      `Movimiento ${type} por $${(amount_cents / 100).toFixed(2)}: ${description}`,
      restaurant_id
    );

    return movement;
  }

  /**
   * Blind count reconciliation and shift closure
   */
  public static closeShift(
    actual_cash_cents: number,
    closed_by: string = 'Cajero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CashShift {
    const shift = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open');
    if (!shift) {
      throw new Error('No hay turno de caja abierto.');
    }

    const previousState = { ...shift };
    const now = new Date().toISOString();
    const difference_cents = actual_cash_cents - shift.expected_cash_cents;

    shift.status = 'closed';
    shift.closed_by = closed_by;
    shift.closed_at = now;
    shift.actual_cash_cents = actual_cash_cents;
    shift.difference_cents = difference_cents;
    shift.notes = notes ? `${shift.notes || ''} | Cierre: ${notes}` : shift.notes;

    db.save();

    AuditService.log(
      'cash_shift_closed',
      'cash_shift',
      shift.id,
      closed_by,
      previousState,
      shift,
      `Turno de caja cerrado. Esperado: $${(shift.expected_cash_cents / 100).toFixed(2)}, Contado: $${(
        actual_cash_cents / 100
      ).toFixed(2)}, Diferencia: $${(difference_cents / 100).toFixed(2)}.`,
      restaurant_id
    );

    eventBus.publish('SHIFT_CLOSED', restaurant_id, closed_by, shift);
    return shift;
  }

  private static resolveActiveOrRecentSession(
    table_id_or_session_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): TableSession {
    const sessions = db.get('table_sessions');
    let session = sessions.find(
      (s) => s.id === table_id_or_session_id && s.restaurant_id === restaurant_id
    );

    if (!session) {
      const table = db
        .get('tables')
        .find((t) => t.id === table_id_or_session_id && t.restaurant_id === restaurant_id);
      if (table && table.active_session_id) {
        session = sessions.find((s) => s.id === table.active_session_id);
      }
    }

    if (!session) {
      throw new Error(`No se encontró sesión para ${table_id_or_session_id}.`);
    }

    return session;
  }
}
