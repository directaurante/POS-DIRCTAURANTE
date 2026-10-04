/**
 * DIRECTAURANTE — Promotions & Coupons Domain Service (Fase 11)
 * Centralized promotion evaluation engine, coupon validation with unique code checks,
 * redemption limits enforcement, discount application, and commercial reporting.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Promotion,
  PromotionType,
  Coupon,
  CouponRedemption,
  PromotionEvaluationResult,
  Customer,
} from '../../core/types';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export class PromotionService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // ==========================================
  // PROMOTIONS CRUD
  // ==========================================

  public static listPromotions(restaurant_id: string = DEFAULT_RESTAURANT_ID): Promotion[] {
    return db
      .get('promotions')
      .filter((p) => p.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static getPromotion(id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): Promotion {
    const promo = db.get('promotions').find((p) => p.id === id && p.restaurant_id === restaurant_id);
    if (!promo) {
      throw new Error(`Promoción ${id} no encontrada en restaurante ${restaurant_id}.`);
    }
    return promo;
  }

  public static createPromotion(
    data: {
      name: string;
      description: string;
      type: PromotionType;
      value: number;
      valid_from?: string;
      valid_until?: string;
      applicable_days?: number[];
      time_start?: string;
      time_end?: string;
      applicable_product_ids?: string[];
      applicable_categories?: string[];
      min_order_amount_cents?: number;
      max_discount_cents?: number;
      max_uses?: number;
      max_uses_per_customer?: number;
      requires_coupon?: boolean;
    },
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Gerencia Comercial'
  ): Promotion {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('El nombre de la promoción es obligatorio.');
    }
    if (data.value < 0) {
      throw new Error('El valor del beneficio debe ser mayor o igual a 0.');
    }

    const now = new Date().toISOString();
    const id = this.generateId('promo');

    const newPromo: Promotion = {
      id,
      restaurant_id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      type: data.type,
      value: data.value,
      valid_from: data.valid_from || now,
      valid_until: data.valid_until || new Date(Date.now() + 365 * 86400000).toISOString(),
      applicable_days: data.applicable_days,
      time_start: data.time_start,
      time_end: data.time_end,
      applicable_product_ids: data.applicable_product_ids,
      applicable_categories: data.applicable_categories,
      min_order_amount_cents: data.min_order_amount_cents || 0,
      max_discount_cents: data.max_discount_cents,
      max_uses: data.max_uses,
      max_uses_per_customer: data.max_uses_per_customer,
      current_uses: 0,
      requires_coupon: Boolean(data.requires_coupon),
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    db.get('promotions').push(newPromo);
    db.save();

    AuditService.log(
      'promotion_created',
      'promotion',
      id,
      actor,
      null,
      newPromo,
      `Promoción '${newPromo.name}' creada (${newPromo.type}).`,
      restaurant_id
    );

    return newPromo;
  }

  public static updatePromotion(
    id: string,
    updates: Partial<Omit<Promotion, 'id' | 'restaurant_id' | 'created_at'>>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Gerencia Comercial'
  ): Promotion {
    const promo = this.getPromotion(id, restaurant_id);
    const previous = { ...promo };

    if (updates.name !== undefined) promo.name = updates.name.trim();
    if (updates.description !== undefined) promo.description = updates.description.trim();
    if (updates.type !== undefined) promo.type = updates.type;
    if (updates.value !== undefined) promo.value = updates.value;
    if (updates.valid_from !== undefined) promo.valid_from = updates.valid_from;
    if (updates.valid_until !== undefined) promo.valid_until = updates.valid_until;
    if (updates.applicable_days !== undefined) promo.applicable_days = updates.applicable_days;
    if (updates.time_start !== undefined) promo.time_start = updates.time_start;
    if (updates.time_end !== undefined) promo.time_end = updates.time_end;
    if (updates.applicable_product_ids !== undefined) promo.applicable_product_ids = updates.applicable_product_ids;
    if (updates.applicable_categories !== undefined) promo.applicable_categories = updates.applicable_categories;
    if (updates.min_order_amount_cents !== undefined) promo.min_order_amount_cents = updates.min_order_amount_cents;
    if (updates.max_discount_cents !== undefined) promo.max_discount_cents = updates.max_discount_cents;
    if (updates.max_uses !== undefined) promo.max_uses = updates.max_uses;
    if (updates.max_uses_per_customer !== undefined) promo.max_uses_per_customer = updates.max_uses_per_customer;
    if (updates.status !== undefined) promo.status = updates.status;
    if (updates.requires_coupon !== undefined) promo.requires_coupon = updates.requires_coupon;

    promo.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'promotion_updated',
      'promotion',
      id,
      actor,
      previous,
      promo,
      `Promoción '${promo.name}' actualizada.`,
      restaurant_id
    );

    return promo;
  }

  // ==========================================
  // COUPONS CRUD
  // ==========================================

  public static listCoupons(restaurant_id: string = DEFAULT_RESTAURANT_ID): Coupon[] {
    return db
      .get('coupons')
      .filter((c) => c.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static createCoupon(
    data: {
      code: string;
      promotion_id: string;
      valid_from?: string;
      valid_until?: string;
      max_uses?: number;
      max_uses_per_customer?: number;
    },
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): Coupon {
    const rawCode = (data.code || '').trim().toUpperCase();
    if (!rawCode || rawCode.length < 3) {
      throw new Error('El código del cupón debe tener al menos 3 caracteres alfanuméricos.');
    }

    // UNIQUE CODE RULE WITHIN RESTAURANT
    const existing = db.get('coupons').find(
      (c) => c.restaurant_id === restaurant_id && c.code === rawCode
    );
    if (existing) {
      throw new Error(`Ya existe un cupón con el código '${rawCode}' en este restaurante.`);
    }

    // Verify promotion exists
    this.getPromotion(data.promotion_id, restaurant_id);

    const now = new Date().toISOString();
    const id = this.generateId('cpn');

    const coupon: Coupon = {
      id,
      code: rawCode,
      promotion_id: data.promotion_id,
      restaurant_id,
      valid_from: data.valid_from || now,
      valid_until: data.valid_until || new Date(Date.now() + 180 * 86400000).toISOString(),
      max_uses: data.max_uses,
      uses: 0,
      max_uses_per_customer: data.max_uses_per_customer,
      active: true,
      created_at: now,
    };

    db.get('coupons').push(coupon);
    db.save();

    AuditService.log(
      'coupon_created',
      'coupon',
      id,
      actor,
      null,
      coupon,
      `Cupón '${rawCode}' creado para la promoción ${data.promotion_id}.`,
      restaurant_id
    );

    return coupon;
  }

  // ==========================================
  // CENTRAL EVALUATION ENGINE
  // ==========================================

  /**
   * Central evaluation function determining promotion eligibility and calculated discount.
   */
  public static evaluatePromotion(
    target: { promotion_id?: string; coupon_code?: string },
    orderData: {
      subtotal_cents: number;
      items?: Array<{ product_id: string; category?: string; price_cents: number; quantity: number }>;
    },
    customerId?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PromotionEvaluationResult {
    let promotion: Promotion | undefined;
    let coupon: Coupon | undefined;

    if (target.coupon_code) {
      const code = target.coupon_code.trim().toUpperCase();
      coupon = db.get('coupons').find((c) => c.restaurant_id === restaurant_id && c.code === code);
      if (!coupon) {
        return { eligible: false, discount_cents: 0, reason: `El cupón '${code}' no existe en este restaurante.` };
      }
      if (!coupon.active) {
        return { eligible: false, discount_cents: 0, reason: `El cupón '${code}' está inactivo.` };
      }

      // Check coupon date validity
      const nowTime = Date.now();
      if (new Date(coupon.valid_from).getTime() > nowTime) {
        return { eligible: false, discount_cents: 0, reason: `El cupón '${code}' aún no entra en vigencia.` };
      }
      if (new Date(coupon.valid_until).getTime() < nowTime) {
        return { eligible: false, discount_cents: 0, reason: `El cupón '${code}' ha expirado.` };
      }

      // Check coupon global max uses
      if (coupon.max_uses !== undefined && coupon.uses >= coupon.max_uses) {
        return { eligible: false, discount_cents: 0, reason: `El cupón '${code}' ha alcanzado su límite máximo de usos (${coupon.max_uses}).` };
      }

      // Check coupon per-customer max uses
      if (customerId && coupon.max_uses_per_customer !== undefined) {
        const customerUses = db.get('coupon_redemptions').filter(
          (r) => r.coupon_id === coupon!.id && r.customer_id === customerId && r.restaurant_id === restaurant_id
        ).length;
        if (customerUses >= coupon.max_uses_per_customer) {
          return {
            eligible: false,
            discount_cents: 0,
            reason: `Has alcanzado el límite de usos permitido para este cupón (${coupon.max_uses_per_customer}).`,
          };
        }
      }

      promotion = db.get('promotions').find((p) => p.id === coupon!.promotion_id && p.restaurant_id === restaurant_id);
      if (!promotion) {
        return { eligible: false, discount_cents: 0, reason: 'La promoción vinculada a este cupón no está disponible.' };
      }
    } else if (target.promotion_id) {
      promotion = db.get('promotions').find((p) => p.id === target.promotion_id && p.restaurant_id === restaurant_id);
      if (!promotion) {
        return { eligible: false, discount_cents: 0, reason: 'Promoción no encontrada.' };
      }
      if (promotion.requires_coupon) {
        return { eligible: false, discount_cents: 0, reason: 'Esta promoción requiere un código de cupón válido.' };
      }
    } else {
      return { eligible: false, discount_cents: 0, reason: 'Debe especificarse una promoción o cupón a evaluar.' };
    }

    if (promotion.status !== 'active') {
      return { eligible: false, discount_cents: 0, reason: `La promoción está ${promotion.status}.` };
    }

    const now = new Date();
    const nowTime = now.getTime();

    // 1. Date window
    if (new Date(promotion.valid_from).getTime() > nowTime) {
      return { eligible: false, discount_cents: 0, reason: 'La promoción aún no está vigente.' };
    }
    if (new Date(promotion.valid_until).getTime() < nowTime) {
      return { eligible: false, discount_cents: 0, reason: 'La promoción ha expirado.' };
    }

    // 2. Day of week (0=Sunday, 1=Monday, ...)
    if (promotion.applicable_days && promotion.applicable_days.length > 0) {
      const currentDay = now.getDay();
      if (!promotion.applicable_days.includes(currentDay)) {
        return { eligible: false, discount_cents: 0, reason: 'Esta promoción no aplica en el día de hoy.' };
      }
    }

    // 3. Time window (HH:mm)
    if (promotion.time_start && promotion.time_end) {
      const currentHour = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      if (currentHour < promotion.time_start || currentHour > promotion.time_end) {
        return {
          eligible: false,
          discount_cents: 0,
          reason: `Horario no aplicable. Vigente de ${promotion.time_start} a ${promotion.time_end}.`,
        };
      }
    }

    // 4. Minimum order amount
    if (promotion.min_order_amount_cents && orderData.subtotal_cents < promotion.min_order_amount_cents) {
      return {
        eligible: false,
        discount_cents: 0,
        reason: `Monto mínimo de compra no alcanzado. Requiere $${(promotion.min_order_amount_cents / 100).toFixed(2)} MXN (actual: $${(orderData.subtotal_cents / 100).toFixed(2)} MXN).`,
      };
    }

    // 5. Global promotion usage limit
    if (promotion.max_uses !== undefined && promotion.current_uses >= promotion.max_uses) {
      return { eligible: false, discount_cents: 0, reason: 'Esta promoción ha alcanzado su límite de usos.' };
    }

    // 6. Customer usage limit
    if (customerId && promotion.max_uses_per_customer !== undefined) {
      const customerUses = db.get('coupon_redemptions').filter(
        (r) => r.promotion_id === promotion!.id && r.customer_id === customerId && r.restaurant_id === restaurant_id
      ).length;
      if (customerUses >= promotion.max_uses_per_customer) {
        return {
          eligible: false,
          discount_cents: 0,
          reason: `Límite de usos alcanzado por cliente (${promotion.max_uses_per_customer}).`,
        };
      }
    }

    // 7. Calculate Discount based on Promotion Type
    let discountCents = 0;
    const subtotal = orderData.subtotal_cents;

    switch (promotion.type) {
      case 'percentage_discount': {
        const pct = Math.min(100, Math.max(0, promotion.value));
        discountCents = Math.round((subtotal * pct) / 100);
        break;
      }
      case 'fixed_discount': {
        discountCents = Math.min(subtotal, promotion.value);
        break;
      }
      case 'buy_x_get_y':
      case 'combo':
      case 'free_product': {
        // Benefit corresponds to fixed value or complimentary item price
        discountCents = Math.min(subtotal, promotion.value || 3500);
        break;
      }
      case 'bonus_points': {
        // Bonus points are awarded at order settlement, 0 cash discount
        discountCents = 0;
        break;
      }
    }

    // Apply max discount ceiling if specified
    if (promotion.max_discount_cents && discountCents > promotion.max_discount_cents) {
      discountCents = promotion.max_discount_cents;
    }

    return {
      eligible: true,
      discount_cents: discountCents,
      reason: `Promoción '${promotion.name}' aplicada con éxito. Descuento: $${(discountCents / 100).toFixed(2)} MXN.`,
      promotion,
      coupon,
    };
  }

  /**
   * Redeems a validated coupon for an order, tracks redemption, and logs audit.
   */
  public static redeemCoupon(
    couponCode: string,
    orderId: string,
    customerId: string,
    discountCents: number,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Cajero'
  ): CouponRedemption {
    const code = couponCode.trim().toUpperCase();
    const coupon = db.get('coupons').find((c) => c.restaurant_id === restaurant_id && c.code === code);
    if (!coupon) {
      throw new Error(`Cupón '${code}' no encontrado.`);
    }

    const promotion = db.get('promotions').find((p) => p.id === coupon.promotion_id && p.restaurant_id === restaurant_id);
    if (!promotion) {
      throw new Error('Promoción no encontrada para este cupón.');
    }

    // Increment usage counters
    coupon.uses += 1;
    promotion.current_uses += 1;

    const redemption: CouponRedemption = {
      id: this.generateId('red'),
      coupon_id: coupon.id,
      coupon_code: code,
      promotion_id: promotion.id,
      customer_id: customerId,
      order_id: orderId,
      restaurant_id,
      discount_cents: discountCents,
      redeemed_at: new Date().toISOString(),
    };

    db.get('coupon_redemptions').push(redemption);
    db.save();

    AuditService.log(
      'coupon_redeemed',
      'coupon',
      coupon.id,
      actor,
      null,
      redemption,
      `Cupón '${code}' canjeado en Orden ${orderId}. Descuento otorgado: $${(discountCents / 100).toFixed(2)} MXN.`,
      restaurant_id
    );

    eventBus.publish('COUPON_REDEEMED', restaurant_id, actor, redemption);

    return redemption;
  }

  // ==========================================
  // COMMERCIAL & FIDELITY REPORTING (FASE 11)
  // ==========================================

  public static getCommercialReport(restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const customers = db.get('customers').filter((c) => c.restaurant_id === restaurant_id);
    const completedOrders = db.get('orders').filter((o) => o.restaurant_id === restaurant_id && o.status === 'completed');
    const redemptions = db.get('coupon_redemptions').filter((r) => r.restaurant_id === restaurant_id);
    const transactions = db.get('loyalty_transactions').filter((t) => t.restaurant_id === restaurant_id);

    // Customer segmentation counts
    let newCustomers = 0;
    let repeatCustomers = 0;

    customers.forEach((c) => {
      const orders = completedOrders.filter((o) => o.customer_id === c.id);
      if (orders.length <= 1) {
        newCustomers++;
      } else {
        repeatCustomers++;
      }
    });

    const pointsIssued = transactions
      .filter((t) => t.type === 'earn' || t.type === 'bonus')
      .reduce((sum, t) => sum + t.points, 0);

    const pointsRedeemed = transactions
      .filter((t) => t.type === 'redeem')
      .reduce((sum, t) => sum + Math.abs(t.points), 0);

    const totalDiscountsGrantedCents = redemptions.reduce((sum, r) => sum + r.discount_cents, 0);

    // Top customers by spend
    const customerSpendMap: Record<string, { customer: Customer; total_spent_cents: number; orders_count: number }> = {};
    customers.forEach((c) => {
      const orders = completedOrders.filter((o) => o.customer_id === c.id);
      const spent = orders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
      customerSpendMap[c.id] = { customer: c, total_spent_cents: spent, orders_count: orders.length };
    });

    const topCustomers = Object.values(customerSpendMap)
      .sort((a, b) => b.total_spent_cents - a.total_spent_cents)
      .slice(0, 5);

    return {
      total_customers: customers.length,
      new_customers: newCustomers,
      repeat_customers: repeatCustomers,
      points_issued: pointsIssued,
      points_redeemed: pointsRedeemed,
      active_promotions_count: db.get('promotions').filter((p) => p.restaurant_id === restaurant_id && p.status === 'active').length,
      coupons_redeemed_count: redemptions.length,
      total_discounts_granted_cents: totalDiscountsGrantedCents,
      top_customers: topCustomers,
    };
  }
}
