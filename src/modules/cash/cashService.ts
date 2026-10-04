/**
 * DIRECTAURANTE POS CORE — Cash Register & Shift Service
 * Provides queries and metrics for shifts, blind counts, and cash drawer balances.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { CashShift, CashMovement } from '../../core/types';

export class CashService {
  public static getCurrentShift(restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const shift = db
      .get('cash_shifts')
      .find((s) => s.restaurant_id === restaurant_id && s.status === 'open');

    if (!shift) {
      return { shift: null, movements: [], totals: null };
    }

    const movements = db
      .get('cash_movements')
      .filter((m) => m.shift_id === shift.id && m.restaurant_id === restaurant_id);

    const sales_cents = movements
      .filter((m) => m.type === 'sale')
      .reduce((sum, m) => sum + m.amount_cents, 0);

    const expenses_cents = movements
      .filter((m) => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount_cents, 0);

    const withdrawals_cents = movements
      .filter((m) => m.type === 'withdrawal')
      .reduce((sum, m) => sum + m.amount_cents, 0);

    const net_cash_cents = shift.initial_float_cents + sales_cents - expenses_cents - withdrawals_cents;

    return {
      shift,
      movements,
      totals: {
        sales_cents,
        expenses_cents,
        withdrawals_cents,
        net_cash_cents,
      },
    };
  }

  public static getShiftHistory(restaurant_id: string = DEFAULT_RESTAURANT_ID, limit: number = 20): CashShift[] {
    return db
      .get('cash_shifts')
      .filter((s) => s.restaurant_id === restaurant_id)
      .slice(0, limit);
  }
}
