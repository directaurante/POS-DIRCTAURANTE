/**
 * DIRECTAURANTE — Customer Domain Service (Fase 11)
 * Manages customer identities, profile updates, order histories,
 * dynamic metric aggregations, and business segmentation.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { Customer, CustomerSummary, CustomerSegment, Order, Payment } from '../../core/types';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export class CustomerService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  public static generateReferralCode(name: string): string {
    const clean = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'CLIENT';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${clean}${rand}`;
  }

  public static listCustomers(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    search?: string,
    segment?: CustomerSegment
  ): Customer[] {
    let list = db.get('customers').filter((c) => c.restaurant_id === restaurant_id);

    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.referral_code && c.referral_code.toLowerCase().includes(q))
      );
    }

    if (segment) {
      list = list.filter((c) => {
        const summary = this.getCustomerSummary(c.id, restaurant_id);
        return summary.segment === segment;
      });
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static getCustomer(id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): Customer {
    const customer = db.get('customers').find((c) => c.id === id && c.restaurant_id === restaurant_id);
    if (!customer) {
      throw new Error(`Cliente ${id} no encontrado en el restaurante ${restaurant_id}.`);
    }
    return customer;
  }

  public static createCustomer(
    data: {
      name: string;
      phone?: string;
      email?: string;
      birthday?: string;
      notes?: string;
      user_id?: string;
      referred_by?: string;
    },
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Recepción'
  ): Customer {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    const now = new Date().toISOString();
    const id = this.generateId('cust');
    const referralCode = this.generateReferralCode(data.name);

    // Validate referrer if provided
    let validReferredBy: string | undefined = undefined;
    if (data.referred_by) {
      const referrer = db.get('customers').find(
        (c) =>
          c.restaurant_id === restaurant_id &&
          (c.id === data.referred_by || (c.referral_code && c.referral_code.toUpperCase() === data.referred_by!.toUpperCase()))
      );
      if (referrer) {
        validReferredBy = referrer.id;
      }
    }

    const newCustomer: Customer = {
      id,
      restaurant_id,
      user_id: data.user_id,
      name: data.name.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      birthday: data.birthday,
      notes: data.notes?.trim(),
      status: 'active',
      referral_code: referralCode,
      referred_by: validReferredBy,
      created_at: now,
      updated_at: now,
    };

    db.get('customers').push(newCustomer);

    // Initialize Loyalty Account with welcome bonus
    const loyaltyConfigs = db.get('loyalty_configs').filter((c) => c.restaurant_id === restaurant_id);
    const welcomeBonus = loyaltyConfigs[0]?.welcome_bonus_points || 100;

    const loyaltyAccount = {
      id: this.generateId('loy'),
      customer_id: id,
      restaurant_id,
      points_balance: welcomeBonus,
      lifetime_points_earned: welcomeBonus,
      lifetime_points_redeemed: 0,
      updated_at: now,
    };
    db.get('loyalty_accounts').push(loyaltyAccount);

    if (welcomeBonus > 0) {
      db.get('loyalty_transactions').push({
        id: this.generateId('tx_loy'),
        customer_id: id,
        restaurant_id,
        points: welcomeBonus,
        type: 'bonus',
        reference: 'welcome_bonus',
        reason: 'Bono de bienvenida por apertura de cuenta',
        actor: 'Sistema Fidelidad',
        created_at: now,
      });
    }

    // If referred, register referral record
    if (validReferredBy) {
      db.get('referrals').push({
        id: this.generateId('ref'),
        restaurant_id,
        referrer_customer_id: validReferredBy,
        referred_customer_id: id,
        status: 'pending',
        reward_points: 100,
        created_at: now,
      });
    }

    db.save();

    AuditService.log(
      'customer_created',
      'customer',
      id,
      actor,
      null,
      newCustomer,
      `Cliente ${newCustomer.name} registrado con código de referido ${referralCode}.`,
      restaurant_id
    );

    eventBus.publish('CUSTOMER_CREATED', restaurant_id, actor, newCustomer);

    return newCustomer;
  }

  public static updateCustomer(
    id: string,
    updates: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'birthday' | 'notes' | 'status'>>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): Customer {
    const customer = this.getCustomer(id, restaurant_id);
    const previous = { ...customer };

    if (updates.name !== undefined) customer.name = updates.name.trim();
    if (updates.phone !== undefined) customer.phone = updates.phone?.trim();
    if (updates.email !== undefined) customer.email = updates.email?.trim();
    if (updates.birthday !== undefined) customer.birthday = updates.birthday;
    if (updates.notes !== undefined) customer.notes = updates.notes?.trim();
    if (updates.status !== undefined) customer.status = updates.status;
    customer.updated_at = new Date().toISOString();

    db.save();

    AuditService.log(
      'customer_updated',
      'customer',
      id,
      actor,
      previous,
      customer,
      `Cliente ${customer.name} actualizado.`,
      restaurant_id
    );

    eventBus.publish('CUSTOMER_UPDATED', restaurant_id, actor, customer);

    return customer;
  }

  public static getCustomerOrders(id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): Order[] {
    this.getCustomer(id, restaurant_id);

    // Orders directly tagged with customer_id or linked through session guest subaccounts
    const subaccountIds = db
      .get('guest_subaccounts')
      .filter((s) => s.customer_id === id)
      .map((s) => s.id);

    const directOrders = db.get('orders').filter((o) => o.restaurant_id === restaurant_id && o.customer_id === id);

    const sessionOrders = db.get('orders').filter((o) => {
      if (o.restaurant_id !== restaurant_id) return false;
      if (directOrders.some((d) => d.id === o.id)) return false;
      const orderItems = db.get('order_items').filter((item) => item.order_id === o.id);
      return orderItems.some((item) => subaccountIds.includes(item.guest_subaccount_id));
    });

    return [...directOrders, ...sessionOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public static getCustomerSummary(id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): CustomerSummary {
    const customer = this.getCustomer(id, restaurant_id);
    const orders = this.getCustomerOrders(id, restaurant_id);

    const completedOrders = orders.filter((o) => o.status === 'completed');
    const totalOrdersCount = orders.length;
    const completedCount = completedOrders.length;

    // Calculate total spent from completed orders or associated payments
    const totalSpentCents = completedOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
    const averageTicketCents = completedCount > 0 ? Math.round(totalSpentCents / completedCount) : 0;

    const lastOrder = orders.length > 0 ? orders[0] : undefined;
    const lastOrderAt = lastOrder ? lastOrder.created_at : undefined;

    let daysSinceLastOrder: number | undefined = undefined;
    if (lastOrderAt) {
      const diffMs = Date.now() - new Date(lastOrderAt).getTime();
      daysSinceLastOrder = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Points balance
    const account = db.get('loyalty_accounts').find(
      (a) => a.customer_id === id && a.restaurant_id === restaurant_id
    );
    const pointsBalance = account ? account.points_balance : 0;

    // Deterministic segmentation without black-box AI
    let segment: CustomerSegment = 'active';
    if (completedCount === 0) {
      segment = 'new';
    } else if (completedCount >= 10 || totalSpentCents >= 500000) {
      // 10+ orders or $5,000+ MXN spent
      segment = 'vip';
    } else if (completedCount >= 3) {
      segment = 'frequent';
    } else if (daysSinceLastOrder !== undefined && daysSinceLastOrder > 30) {
      segment = 'inactive';
    }

    return {
      customer,
      total_orders: totalOrdersCount,
      completed_orders: completedCount,
      total_spent_cents: totalSpentCents,
      average_ticket_cents: averageTicketCents,
      last_order_at: lastOrderAt,
      days_since_last_order: daysSinceLastOrder,
      points_balance: pointsBalance,
      segment,
    };
  }
}
