/**
 * DIRECTAURANTE — Loyalty Domain Service (Fase 11)
 * Configurable points-per-spend engine, idempotent order awards,
 * strict balance validation, redemption guards, and audit trail ledger.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  LoyaltyAccount,
  LoyaltyPointTransaction,
  LoyaltyProgramConfig,
  Customer,
} from '../../core/types';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export class LoyaltyService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  public static getProgramConfig(restaurant_id: string = DEFAULT_RESTAURANT_ID): LoyaltyProgramConfig {
    let config = db.get('loyalty_configs').find((c) => c.restaurant_id === restaurant_id);
    if (!config) {
      config = {
        id: this.generateId('lcfg'),
        restaurant_id,
        points_per_currency_unit: 1, // $1 MXN = 1 pt
        point_value_cents: 10, // 10 cents per point ($0.10 MXN)
        min_points_to_redeem: 50,
        welcome_bonus_points: 100,
        enabled: true,
        updated_at: new Date().toISOString(),
      };
      db.get('loyalty_configs').push(config);
      db.save();
    }
    return config;
  }

  public static updateProgramConfig(
    updates: Partial<Omit<LoyaltyProgramConfig, 'id' | 'restaurant_id'>>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): LoyaltyProgramConfig {
    const config = this.getProgramConfig(restaurant_id);
    const previous = { ...config };

    if (updates.points_per_currency_unit !== undefined) {
      if (updates.points_per_currency_unit <= 0) throw new Error('Los puntos por unidad de moneda deben ser mayores a 0.');
      config.points_per_currency_unit = updates.points_per_currency_unit;
    }
    if (updates.point_value_cents !== undefined) {
      if (updates.point_value_cents <= 0) throw new Error('El valor en centavos por punto debe ser mayor a 0.');
      config.point_value_cents = updates.point_value_cents;
    }
    if (updates.min_points_to_redeem !== undefined) {
      config.min_points_to_redeem = Math.max(0, updates.min_points_to_redeem);
    }
    if (updates.welcome_bonus_points !== undefined) {
      config.welcome_bonus_points = Math.max(0, updates.welcome_bonus_points);
    }
    if (updates.enabled !== undefined) {
      config.enabled = updates.enabled;
    }
    config.updated_at = new Date().toISOString();

    db.save();

    AuditService.log(
      'loyalty_config_updated',
      'loyalty',
      config.id,
      actor,
      previous,
      config,
      'Reglas del programa de puntos de fidelidad actualizadas.',
      restaurant_id
    );

    return config;
  }

  public static getOrCreateAccount(customerId: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): LoyaltyAccount {
    const customer = db.get('customers').find((c) => c.id === customerId && c.restaurant_id === restaurant_id);
    if (!customer) {
      throw new Error(`Cliente ${customerId} no encontrado en restaurante ${restaurant_id}.`);
    }

    let account = db.get('loyalty_accounts').find(
      (a) => a.customer_id === customerId && a.restaurant_id === restaurant_id
    );

    if (!account) {
      account = {
        id: this.generateId('loy'),
        customer_id: customerId,
        restaurant_id,
        points_balance: 0,
        lifetime_points_earned: 0,
        lifetime_points_redeemed: 0,
        updated_at: new Date().toISOString(),
      };
      db.get('loyalty_accounts').push(account);
      db.save();
    }

    return account;
  }

  public static getTransactions(customerId: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): LoyaltyPointTransaction[] {
    return db
      .get('loyalty_transactions')
      .filter((t) => t.customer_id === customerId && t.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Idempotently awards loyalty points for a completed order/purchase.
   * Ensures the same order_id never awards points twice.
   */
  public static awardPointsForOrder(
    orderId: string,
    customerId: string,
    amountCents: number,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Sistema POS'
  ): { transaction: LoyaltyPointTransaction; awardedPoints: number; isDuplicate: boolean } {
    const config = this.getProgramConfig(restaurant_id);
    if (!config.enabled) {
      throw new Error('El programa de puntos de fidelidad está deshabilitado en este restaurante.');
    }

    const customer = db.get('customers').find((c) => c.id === customerId && c.restaurant_id === restaurant_id);
    if (!customer) {
      throw new Error(`Cliente ${customerId} no encontrado en el restaurante ${restaurant_id}.`);
    }
    if (customer.status !== 'active') {
      throw new Error(`No se pueden otorgar puntos a un cliente en estado '${customer.status}'.`);
    }

    // IDEMPOTENCY CHECK: order_id + customer_id
    const idempotencyKey = `award_order_${orderId}_${customerId}`;
    const existing = db.get('loyalty_transactions').find(
      (t) =>
        t.restaurant_id === restaurant_id &&
        t.customer_id === customerId &&
        (t.idempotency_key === idempotencyKey || (t.reference === orderId && t.type === 'earn'))
    );

    if (existing) {
      return { transaction: existing, awardedPoints: existing.points, isDuplicate: true };
    }

    // Calculate points: amount in MXN currency units (amountCents / 100) * points_per_currency_unit
    const currencyUnits = Math.max(0, Math.floor(amountCents / 100));
    const pointsToAward = currencyUnits * config.points_per_currency_unit;

    if (pointsToAward <= 0) {
      throw new Error('El monto es insuficiente para otorgar puntos de fidelidad.');
    }

    const account = this.getOrCreateAccount(customerId, restaurant_id);
    account.points_balance += pointsToAward;
    account.lifetime_points_earned += pointsToAward;
    account.updated_at = new Date().toISOString();

    const transaction: LoyaltyPointTransaction = {
      id: this.generateId('tx_loy'),
      customer_id: customerId,
      restaurant_id,
      points: pointsToAward,
      type: 'earn',
      reference: orderId,
      idempotency_key: idempotencyKey,
      reason: `Puntos otorgados por compra en Orden ${orderId} ($${(amountCents / 100).toFixed(2)} MXN)`,
      actor,
      created_at: new Date().toISOString(),
    };

    db.get('loyalty_transactions').push(transaction);

    // If customer has a pending referral and this is their first order, complete referral
    const pendingReferral = db.get('referrals').find(
      (r) => r.referred_customer_id === customerId && r.restaurant_id === restaurant_id && r.status === 'pending'
    );
    if (pendingReferral) {
      pendingReferral.status = 'completed';
      pendingReferral.completed_at = new Date().toISOString();

      // Award bonus points to referrer
      const reward = pendingReferral.reward_points || 100;
      const referrerAccount = this.getOrCreateAccount(pendingReferral.referrer_customer_id, restaurant_id);
      referrerAccount.points_balance += reward;
      referrerAccount.lifetime_points_earned += reward;
      referrerAccount.updated_at = new Date().toISOString();

      db.get('loyalty_transactions').push({
        id: this.generateId('tx_loy'),
        customer_id: pendingReferral.referrer_customer_id,
        restaurant_id,
        points: reward,
        type: 'bonus',
        reference: pendingReferral.id,
        reason: `Bono de referidos por primera compra de ${customer.name}`,
        actor: 'Sistema Referidos',
        created_at: new Date().toISOString(),
      });

      pendingReferral.status = 'rewarded';
    }

    db.save();

    AuditService.log(
      'loyalty_points_earned',
      'loyalty',
      transaction.id,
      actor,
      null,
      transaction,
      `${pointsToAward} puntos otorgados a ${customer.name} (Orden: ${orderId}).`,
      restaurant_id
    );

    eventBus.publish('LOYALTY_POINTS_EARNED', restaurant_id, actor, { customerId, transaction, newBalance: account.points_balance });

    return { transaction, awardedPoints: pointsToAward, isDuplicate: false };
  }

  /**
   * Redeems loyalty points with strict non-negative balance checks and validation.
   */
  public static redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    reference: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Cajero'
  ): { transaction: LoyaltyPointTransaction; discountCents: number; newBalance: number } {
    if (pointsToRedeem <= 0) {
      throw new Error('La cantidad de puntos a canjear debe ser mayor a 0.');
    }

    const config = this.getProgramConfig(restaurant_id);
    if (!config.enabled) {
      throw new Error('El programa de puntos está deshabilitado.');
    }
    if (pointsToRedeem < config.min_points_to_redeem) {
      throw new Error(`El canje mínimo permitido es de ${config.min_points_to_redeem} puntos.`);
    }

    const customer = db.get('customers').find((c) => c.id === customerId && c.restaurant_id === restaurant_id);
    if (!customer) {
      throw new Error(`Cliente ${customerId} no encontrado en restaurante ${restaurant_id}.`);
    }
    if (customer.status !== 'active') {
      throw new Error(`No se pueden canjear puntos de un cliente en estado '${customer.status}'.`);
    }

    const account = this.getOrCreateAccount(customerId, restaurant_id);

    // Balance check: prevent negative balances
    if (account.points_balance < pointsToRedeem) {
      throw new Error(
        `Saldo insuficiente. El cliente tiene ${account.points_balance} puntos y se intentaron canjear ${pointsToRedeem} puntos.`
      );
    }

    account.points_balance -= pointsToRedeem;
    account.lifetime_points_redeemed += pointsToRedeem;
    account.updated_at = new Date().toISOString();

    const discountCents = pointsToRedeem * config.point_value_cents;

    const transaction: LoyaltyPointTransaction = {
      id: this.generateId('tx_loy'),
      customer_id: customerId,
      restaurant_id,
      points: -pointsToRedeem,
      type: 'redeem',
      reference,
      reason: `Canje de ${pointsToRedeem} puntos por descuento de $${(discountCents / 100).toFixed(2)} MXN`,
      actor,
      created_at: new Date().toISOString(),
    };

    db.get('loyalty_transactions').push(transaction);
    db.save();

    AuditService.log(
      'loyalty_points_redeemed',
      'loyalty',
      transaction.id,
      actor,
      null,
      transaction,
      `${pointsToRedeem} puntos canjeados por ${customer.name}. Descuento generado: $${(discountCents / 100).toFixed(2)} MXN.`,
      restaurant_id
    );

    eventBus.publish('LOYALTY_POINTS_REDEEMED', restaurant_id, actor, { customerId, transaction, newBalance: account.points_balance });

    return { transaction, discountCents, newBalance: account.points_balance };
  }

  /**
   * Adjusts points manually or awards bonus points.
   */
  public static adjustPoints(
    customerId: string,
    pointsDelta: number,
    reason: string,
    actor: string = 'Gerente',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): { transaction: LoyaltyPointTransaction; newBalance: number } {
    if (pointsDelta === 0) {
      throw new Error('El ajuste de puntos debe ser distinto de 0.');
    }

    const customer = db.get('customers').find((c) => c.id === customerId && c.restaurant_id === restaurant_id);
    if (!customer) {
      throw new Error(`Cliente ${customerId} no encontrado.`);
    }

    const account = this.getOrCreateAccount(customerId, restaurant_id);

    if (pointsDelta < 0 && account.points_balance + pointsDelta < 0) {
      throw new Error(
        `Saldo insuficiente para deducir puntos. Saldo actual: ${account.points_balance}, Deducción solicitada: ${Math.abs(pointsDelta)}.`
      );
    }

    account.points_balance += pointsDelta;
    if (pointsDelta > 0) {
      account.lifetime_points_earned += pointsDelta;
    }
    account.updated_at = new Date().toISOString();

    const transaction: LoyaltyPointTransaction = {
      id: this.generateId('tx_loy'),
      customer_id: customerId,
      restaurant_id,
      points: pointsDelta,
      type: pointsDelta > 0 ? 'adjustment' : 'adjustment',
      reference: `adj_${Date.now()}`,
      reason: reason || 'Ajuste manual de saldo de puntos',
      actor,
      created_at: new Date().toISOString(),
    };

    db.get('loyalty_transactions').push(transaction);
    db.save();

    AuditService.log(
      'loyalty_points_adjusted',
      'loyalty',
      transaction.id,
      actor,
      null,
      transaction,
      `Ajuste de puntos para ${customer.name}: ${pointsDelta > 0 ? '+' : ''}${pointsDelta}. Motivo: ${reason}`,
      restaurant_id
    );

    return { transaction, newBalance: account.points_balance };
  }

  /**
   * Reverses points awarded for an order without deleting the original transaction (creates refund transaction).
   */
  public static refundPoints(
    orderId: string,
    customerId: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): LoyaltyPointTransaction {
    const originalTx = db.get('loyalty_transactions').find(
      (t) => t.reference === orderId && t.customer_id === customerId && t.restaurant_id === restaurant_id && t.type === 'earn'
    );

    if (!originalTx) {
      throw new Error(`No se encontró transacción de puntos para revertir asociada a la orden ${orderId}.`);
    }

    // Check if already refunded
    const alreadyRefunded = db.get('loyalty_transactions').find(
      (t) => t.reference === orderId && t.customer_id === customerId && t.restaurant_id === restaurant_id && t.type === 'refund'
    );
    if (alreadyRefunded) {
      return alreadyRefunded;
    }

    const account = this.getOrCreateAccount(customerId, restaurant_id);
    const pointsToDeduct = originalTx.points;

    account.points_balance = Math.max(0, account.points_balance - pointsToDeduct);
    account.updated_at = new Date().toISOString();

    const reversalTx: LoyaltyPointTransaction = {
      id: this.generateId('tx_loy'),
      customer_id: customerId,
      restaurant_id,
      points: -pointsToDeduct,
      type: 'refund',
      reference: orderId,
      reason: `Reversión de puntos por cancelación o reembolso de Orden ${orderId}`,
      actor,
      created_at: new Date().toISOString(),
    };

    db.get('loyalty_transactions').push(reversalTx);
    db.save();

    AuditService.log(
      'loyalty_points_refunded',
      'loyalty',
      reversalTx.id,
      actor,
      null,
      reversalTx,
      `Puntos revertidos (-${pointsToDeduct}) por cancelación de orden ${orderId}.`,
      restaurant_id
    );

    return reversalTx;
  }
}
