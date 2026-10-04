/**
 * DIRECTAURANTE POS CORE — POS Service
 * Core business engine implementing the authoritative restaurant domain hierarchy:
 * TABLE -> TABLE SESSION -> GUEST SUBACCOUNT -> ORDER TICKET / ORDER -> ORDER ITEM
 *
 * Enforces strict state machine for OrderItem, Double Carlos identity separation,
 * and immutable audit logging.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Table,
  TableSession,
  GuestSubaccount,
  Product,
  Order,
  OrderItem,
  OrderItemStatus,
  Allergy,
  Ingredient,
} from '../../core/types';
import { eventBus } from '../../core/eventBus';
import { AuditService } from '../../core/audit';

export interface AllergyConflict {
  allergy: Allergy;
  conflicting_ingredient: Ingredient;
  product: Product;
  severity: 'mild' | 'moderate' | 'severe';
  message: string;
}

export class PosService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  public static getTables(restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const tables = db.get('tables').filter((t) => t.restaurant_id === restaurant_id);
    const sessions = db.get('table_sessions');
    const subaccounts = db.get('guest_subaccounts');
    const items = db.get('order_items');

    return tables.map((tbl) => {
      const activeSession = tbl.active_session_id
        ? sessions.find((s) => s.id === tbl.active_session_id && s.status !== 'closed')
        : undefined;

      if (!activeSession) {
        return {
          ...tbl,
          guests_count: 0,
          active_items_count: 0,
          total_cents: 0,
          active_session: undefined,
        };
      }

      const tableGuests = subaccounts.filter(
        (s) => s.table_session_id === activeSession.id && s.status !== 'closed'
      );
      const sessionItems = items.filter(
        (i) => i.table_session_id === activeSession.id && i.preparation_status !== 'cancelled'
      );
      const total_cents = sessionItems.reduce((acc, i) => acc + i.total_price_cents, 0);

      return {
        ...tbl,
        guests_count: tableGuests.length,
        active_items_count: sessionItems.length,
        total_cents,
        active_session: activeSession,
      };
    });
  }

  public static getTableDetails(table_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const table = db.get('tables').find((t) => t.id === table_id && t.restaurant_id === restaurant_id);
    if (!table) {
      throw new Error(`Mesa ${table_id} no encontrada.`);
    }

    const sessions = db.get('table_sessions');
    const activeSession = table.active_session_id
      ? sessions.find((s) => s.id === table.active_session_id && s.status !== 'closed')
      : undefined;

    if (!activeSession) {
      return {
        table,
        session: null,
        subaccounts: [],
        orders: [],
        order: null,
        items: [],
      };
    }

    const subaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === activeSession.id && s.status !== 'closed');
    const orders = db
      .get('orders')
      .filter((o) => o.table_session_id === activeSession.id && o.status === 'open');
    const items = db
      .get('order_items')
      .filter((i) => i.table_session_id === activeSession.id);

    return {
      table,
      session: activeSession,
      subaccounts,
      orders,
      order: orders[orders.length - 1] || orders[0] || null,
      items,
    };
  }

  public static openTable(
    table_id: string,
    waiter_name: string = 'Mesero',
    initial_guests: Array<{ name: string; allergy_ids?: string[] }> = [
      { name: 'Carlos' },
      { name: 'Ana' },
      { name: 'Luis' },
      { name: 'María' },
    ],
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const tables = db.get('tables');
    const table = tables.find((t) => t.id === table_id && t.restaurant_id === restaurant_id);
    if (!table) {
      throw new Error(`Mesa con ID ${table_id} no existe.`);
    }

    if (table.active_session_id) {
      const existingSession = db
        .get('table_sessions')
        .find((s) => s.id === table.active_session_id && s.status !== 'closed');
      if (existingSession) {
        throw new Error(`La mesa ${table.number} ya tiene una sesión activa (${existingSession.id}).`);
      }
    }

    const now = new Date().toISOString();
    const sessionId = this.generateId('sess');

    const session: TableSession = {
      id: sessionId,
      restaurant_id,
      table_id,
      status: 'active',
      opened_at: now,
      server_id: waiter_name,
      guest_count: initial_guests.length,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    db.get('table_sessions').push(session);

    const previousTableState = { ...table };
    table.status = 'occupied';
    table.active_session_id = sessionId;
    table.opened_at = now;
    table.assigned_waiter = waiter_name;

    const subaccounts = db.get('guest_subaccounts');
    const createdSubaccounts: GuestSubaccount[] = [];
    const tableNumberDigits = table.number.replace(/\D/g, '') || '1';

    initial_guests.forEach((g, index) => {
      const seatNumber = `${tableNumberDigits}.${index + 1}`;
      const subaccount: GuestSubaccount = {
        id: this.generateId('seat'), // Guarantees Double Carlos distinct IDs
        table_session_id: sessionId,
        table_id,
        seat_number: seatNumber,
        display_name: g.name.trim(),
        allergy_ids: g.allergy_ids || [],
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      subaccounts.push(subaccount);
      createdSubaccounts.push(subaccount);
    });

    const orderTicketId = this.generateId('ord');
    const initialOrder: Order = {
      id: orderTicketId,
      restaurant_id,
      table_id,
      table_session_id: sessionId,
      ticket_number: 'Comanda #001',
      order_type: 'dine_in',
      status: 'open',
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      server_id: waiter_name,
      created_at: now,
    };
    db.get('orders').push(initialOrder);

    db.save();

    AuditService.log(
      'table_opened',
      'table_session',
      session.id,
      waiter_name,
      previousTableState,
      session,
      `Sesión iniciada en ${table.number} con ${createdSubaccounts.length} comensales. Comanda #001 generada.`,
      restaurant_id
    );

    eventBus.publish('TABLE_OPENED', restaurant_id, waiter_name, {
      table_id,
      table_number: table.number,
      table_session_id: session.id,
      order_id: initialOrder.id,
      ticket_number: initialOrder.ticket_number,
      subaccounts: createdSubaccounts,
    });

    return {
      table,
      session,
      order: initialOrder,
      orders: [initialOrder],
      subaccounts: createdSubaccounts,
    };
  }

  public static createOrderTicket(
    table_id_or_session_id: string,
    waiter_name: string = 'Mesero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Order {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const existingOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);

    const ticketNumber = `Comanda #${String(existingOrders.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newTicket: Order = {
      id: this.generateId('ord'),
      restaurant_id,
      table_id: session.table_id,
      table_session_id: session.id,
      ticket_number: ticketNumber,
      order_type: 'dine_in',
      status: 'open',
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      server_id: waiter_name,
      notes,
      created_at: now,
    };

    db.get('orders').push(newTicket);
    db.save();

    AuditService.log(
      'order_ticket_created',
      'order',
      newTicket.id,
      waiter_name,
      null,
      newTicket,
      `Nueva comanda ${ticketNumber} aperturada en sesión ${session.id}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_CREATED', restaurant_id, waiter_name, newTicket);

    return newTicket;
  }

  public static addGuestSubaccount(
    table_id_or_session_id: string,
    display_name: string,
    allergy_ids: string[] = [],
    notes?: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): GuestSubaccount {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const table = db.get('tables').find((t) => t.id === session.table_id);
    const tableNumberDigits = table ? table.number.replace(/\D/g, '') || '1' : '1';

    const subaccounts = db.get('guest_subaccounts');
    const sessionSubaccounts = subaccounts.filter(
      (s) => s.table_session_id === session.id && s.status !== 'closed'
    );

    const nextSeatIndex = sessionSubaccounts.length + 1;
    const seatNumber = `${tableNumberDigits}.${nextSeatIndex}`;

    const now = new Date().toISOString();
    const newSubaccount: GuestSubaccount = {
      id: this.generateId('seat'),
      table_session_id: session.id,
      table_id: session.table_id,
      seat_number: seatNumber,
      display_name: display_name.trim(),
      allergy_ids,
      notes,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    subaccounts.push(newSubaccount);
    session.guest_count = sessionSubaccounts.length + 1;
    session.updated_at = now;

    db.save();

    AuditService.log(
      'subaccount_created',
      'guest_subaccount',
      newSubaccount.id,
      actor,
      null,
      newSubaccount,
      `Comensal ${newSubaccount.seat_number} (${newSubaccount.display_name}) añadido a sesión ${session.id}.`,
      restaurant_id
    );

    eventBus.publish('SUBACCOUNT_CREATED', restaurant_id, actor, newSubaccount);
    return newSubaccount;
  }

  public static checkAllergies(
    guest_subaccount_id: string,
    product_id: string
  ): { has_conflict: boolean; conflicts: AllergyConflict[] } {
    const subaccount = db.get('guest_subaccounts').find((s) => s.id === guest_subaccount_id);
    const product = db.get('products').find((p) => p.id === product_id);

    if (!subaccount || !product || !subaccount.allergy_ids || subaccount.allergy_ids.length === 0) {
      return { has_conflict: false, conflicts: [] };
    }

    const allergies = db.get('allergies');
    const ingredients = db.get('ingredients');
    const conflicts: AllergyConflict[] = [];

    for (const allergyId of subaccount.allergy_ids) {
      const allergy = allergies.find((a) => a.id === allergyId);
      if (!allergy) continue;

      for (const ingId of allergy.ingredient_ids) {
        if (product.ingredient_ids.includes(ingId)) {
          const ing = ingredients.find((i) => i.id === ingId) || { id: ingId, name: ingId, category: 'General' };
          conflicts.push({
            allergy,
            conflicting_ingredient: ing,
            product,
            severity: allergy.severity,
            message: `¡ALERTA CRÍTICA DE ALERGIA! El comensal ${subaccount.seat_number} (${subaccount.display_name}) tiene registrada alergia a "${allergy.name}" y el producto "${product.name}" contiene "${ing.name}".`,
          });
        }
      }
    }

    return { has_conflict: conflicts.length > 0, conflicts };
  }

  public static addItemToSubaccount(
    table_id_or_session_id: string,
    guest_subaccount_id: string,
    product_id: string,
    quantity: number = 1,
    notes?: string,
    override_allergy: boolean = false,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    order_ticket_id?: string,
    modifiers: string[] = []
  ): OrderItem {
    if (quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0.');
    }

    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);

    const subaccount = db
      .get('guest_subaccounts')
      .find((s) => s.id === guest_subaccount_id && s.table_session_id === session.id);
    if (!subaccount) {
      throw new Error(`Comensal ${guest_subaccount_id} no pertenece a la sesión activa ${session.id}.`);
    }

    const product = db.get('products').find((p) => p.id === product_id && p.restaurant_id === restaurant_id);
    if (!product) {
      throw new Error(`Producto ${product_id} no encontrado en catálogo.`);
    }

    const allergyCheck = this.checkAllergies(guest_subaccount_id, product_id);
    if (allergyCheck.has_conflict && !override_allergy) {
      const firstConflict = allergyCheck.conflicts[0];
      const error: any = new Error(firstConflict.message);
      error.allergy_conflict = allergyCheck.conflicts;
      error.is_allergy_warning = true;
      throw error;
    }

    if (allergyCheck.has_conflict && override_allergy) {
      AuditService.log(
        'allergy_override',
        'order_item',
        product.id,
        actor,
        null,
        {
          table_session_id: session.id,
          guest_subaccount_id,
          seat_number: subaccount.seat_number,
        },
        `Advertencia de alergia autorizada por ${actor} para comensal ${subaccount.seat_number}.`,
        restaurant_id
      );

      eventBus.publish('ALLERGY_WARNING_OVERRIDDEN', restaurant_id, actor, {
        table_session_id: session.id,
        guest_subaccount_id,
        product_id,
        conflicts: allergyCheck.conflicts,
      });
    }

    const orders = db.get('orders');
    let order: Order | undefined;

    if (order_ticket_id) {
      order = orders.find((o) => o.id === order_ticket_id && o.table_session_id === session.id);
      if (!order) {
        throw new Error(`Comanda ticket ${order_ticket_id} no encontrada en esta sesión.`);
      }
    } else {
      const sessionOrders = orders.filter((o) => o.table_session_id === session.id && o.status === 'open');
      order = sessionOrders[sessionOrders.length - 1];
      if (!order) {
        order = this.createOrderTicket(session.id, actor, undefined, restaurant_id);
      }
    }

    const now = new Date().toISOString();
    const unitPrice = product.price_cents;
    const totalPrice = unitPrice * quantity;
    const targetSeconds =
      product.target_preparation_seconds || (product.preparation_time_minutes || 10) * 60;

    const item: OrderItem = {
      id: this.generateId('item'),
      order_id: order.id,
      table_session_id: session.id,
      restaurant_id,
      product_id: product.id,
      product_name: product.name,
      guest_subaccount_id: subaccount.id, // Enforces Double Carlos separation
      seat_number: subaccount.seat_number,
      guest_name: subaccount.display_name,
      quantity,
      unit_price_cents: unitPrice,
      total_price_cents: totalPrice,
      destination_station: product.destination_station,
      notes,
      modifiers: modifiers || [],
      priority: 'normal',
      target_preparation_seconds: targetSeconds,
      preparation_status: 'pending',
      status_history: [
        {
          status: 'pending',
          changed_by: actor,
          timestamp: now,
          notes: `Registrado en ${order.ticket_number || 'Comanda'}.`,
        },
      ],
      created_at: now,
    };

    db.get('order_items').push(item);
    this.recalculateOrderTotals(order.id);
    session.updated_at = now;
    db.save();

    AuditService.log(
      'order_item_created',
      'order_item',
      item.id,
      actor,
      null,
      item,
      `Item agregado: ${quantity}x ${product.name} a ${subaccount.seat_number} (${subaccount.display_name}) en ${order.ticket_number}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_ITEM_ADDED', restaurant_id, actor, item);
    eventBus.publish('ORDER_ITEM_SENT_TO_PRODUCTION', restaurant_id, actor, {
      item,
      destination_station: item.destination_station,
      ticket_number: order.ticket_number,
      table_session_id: session.id,
    });

    return item;
  }

  /**
   * Strict OrderItem State Machine Enforcement
   * pending -> preparing -> ready -> delivered
   * pending -> cancelled
   * preparing -> cancelled
   * ready -> delivered / cancelled
   * delivered -> IMMUTABLE
   * cancelled -> IMMUTABLE
   */
  public static updateItemStatus(
    item_id: string,
    new_status: OrderItemStatus,
    actor: string = 'Operador',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const prevStatus = item.preparation_status;
    if (prevStatus === new_status) {
      return item;
    }

    const validTransitions: Record<OrderItemStatus, OrderItemStatus[]> = {
      pending: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered', 'cancelled'],
      delivered: [], // Terminal immutable state
      cancelled: [], // Terminal immutable state
    };

    if (!validTransitions[prevStatus].includes(new_status)) {
      throw new Error(
        `Transición de estado inválida: no se permite cambiar de "${prevStatus}" a "${new_status}".`
      );
    }

    const now = new Date().toISOString();
    item.preparation_status = new_status;

    if (new_status === 'preparing') {
      item.preparing_at = now;
    } else if (new_status === 'ready') {
      item.ready_at = now;
      if (item.preparing_at) {
        item.preparation_duration_seconds = Math.max(
          0,
          Math.floor((new Date(now).getTime() - new Date(item.preparing_at).getTime()) / 1000)
        );
      }
    } else if (new_status === 'delivered') {
      item.delivered_at = now;
      item.total_operational_duration_seconds = Math.max(
        0,
        Math.floor((new Date(now).getTime() - new Date(item.created_at).getTime()) / 1000)
      );
    } else if (new_status === 'cancelled') {
      item.cancelled_at = now;
    }

    item.status_history.push({
      status: new_status,
      changed_by: actor,
      timestamp: now,
      notes,
    });

    if (new_status === 'cancelled') {
      this.recalculateOrderTotals(item.order_id);
    }

    db.save();

    AuditService.log(
      'order_item_status_changed',
      'order_item',
      item.id,
      actor,
      { status: prevStatus },
      { status: new_status },
      notes || `Estado cambiado de ${prevStatus} a ${new_status}.`,
      restaurant_id
    );

    let eventName: any = 'ORDER_ITEM_PREPARING';
    if (new_status === 'preparing') eventName = 'ORDER_ITEM_PREPARING';
    else if (new_status === 'ready') eventName = 'ORDER_ITEM_READY';
    else if (new_status === 'delivered') eventName = 'ORDER_ITEM_DELIVERED';
    else if (new_status === 'cancelled') eventName = 'ORDER_ITEM_CANCELLED';

    const order = db.get('orders').find((o) => o.id === item.order_id);
    const table = order ? db.get('tables').find((t) => t.id === order.table_id) : undefined;

    eventBus.publish(eventName, restaurant_id, actor, {
      item_id: item.id,
      product_name: item.product_name,
      seat_number: item.seat_number,
      guest_name: item.guest_name,
      table_id: table?.id,
      table_number: table?.number || 'Mesa',
      table_session_id: item.table_session_id,
      destination_station: item.destination_station,
      previous_status: prevStatus,
      new_status,
      timestamp: now,
    });

    return item;
  }

  public static acknowledgeItem(
    item_id: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const now = new Date().toISOString();
    item.acknowledged_at = now;
    item.acknowledged_by = actor;
    db.save();

    AuditService.log(
      'order_item_acknowledged',
      'order_item',
      item.id,
      actor,
      null,
      item,
      `Item ${item.product_name} acusado de recibo en estación ${item.destination_station} por ${actor}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_ITEM_ACKNOWLEDGED', restaurant_id, actor, {
      item_id: item.id,
      acknowledged_by: actor,
      acknowledged_at: now,
    });

    return item;
  }

  public static removeOrderItem(
    item_id: string,
    reason: string = 'Cancelado por mesero',
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    if (!reason || !reason.trim()) {
      throw new Error('Se requiere una razón obligatoria para cancelar un ítem.');
    }
    return this.updateItemStatus(item_id, 'cancelled', actor, reason, restaurant_id);
  }

  /**
   * Reassign item subaccount within the same TableSession (Double Carlos safety)
   */
  public static reassignItemSubaccount(
    item_id: string,
    new_subaccount_id: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const subaccounts = db.get('guest_subaccounts');
    const newSubaccount = subaccounts.find(
      (s) => s.id === new_subaccount_id && s.table_session_id === item.table_session_id
    );
    if (!newSubaccount) {
      throw new Error(`La subcuenta destino ${new_subaccount_id} no pertenece a la misma sesión.`);
    }

    const prevSeat = item.seat_number;
    item.guest_subaccount_id = newSubaccount.id;
    item.seat_number = newSubaccount.seat_number;
    item.guest_name = newSubaccount.display_name;

    db.save();

    AuditService.log(
      'item_reassigned',
      'order_item',
      item.id,
      actor,
      { guest_subaccount_id: item.guest_subaccount_id, seat_number: prevSeat },
      { guest_subaccount_id: newSubaccount.id, seat_number: newSubaccount.seat_number },
      `Item ${item.product_name} reasignado de ${prevSeat} a ${newSubaccount.seat_number}.`,
      restaurant_id
    );

    eventBus.publish('ITEM_REASSIGNED', restaurant_id, actor, {
      item_id: item.id,
      previous_seat: prevSeat,
      new_seat: newSubaccount.seat_number,
      new_guest_id: newSubaccount.id,
    });

    return item;
  }

  public static closeTable(
    table_id_or_session_id: string,
    actor: string = 'Mesero / Cajero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const table = db.get('tables').find((t) => t.id === session.table_id);
    if (!table) {
      throw new Error(`Mesa ${session.table_id} no encontrada.`);
    }

    const now = new Date().toISOString();
    session.status = 'closed';
    session.closed_at = now;
    session.updated_at = now;

    const prevTableState = { ...table };
    table.status = 'available';
    table.active_session_id = undefined;
    table.opened_at = undefined;
    table.assigned_waiter = undefined;

    const sessionOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);
    sessionOrders.forEach((o) => {
      o.status = 'completed';
      o.closed_at = now;
    });

    const sessionSubaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === session.id);
    sessionSubaccounts.forEach((s) => {
      s.status = 'closed';
      s.updated_at = now;
    });

    db.save();

    AuditService.log(
      'table_closed',
      'table_session',
      session.id,
      actor,
      prevTableState,
      { table, session },
      `Sesión ${session.id} finalizada y Mesa ${table.number} liberada.`,
      restaurant_id
    );

    eventBus.publish('TABLE_CLOSED', restaurant_id, actor, {
      table_id: table.id,
      table_number: table.number,
      table_session_id: session.id,
    });

    return { success: true, table, session };
  }

  private static resolveActiveSession(
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
        session = sessions.find((s) => s.id === table.active_session_id && s.status !== 'closed');
      }
    }

    if (!session || session.status === 'closed') {
      throw new Error(`No hay sesión activa para ${table_id_or_session_id}.`);
    }

    return session;
  }

  private static recalculateOrderTotals(order_id: string): void {
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === order_id);
    if (!order) return;

    const items = db
      .get('order_items')
      .filter((i) => i.order_id === order_id && i.preparation_status !== 'cancelled');
    const subtotal = items.reduce((acc, i) => acc + i.total_price_cents, 0);
    const tax = Math.round(subtotal * 0.16);

    order.subtotal_cents = subtotal;
    order.tax_cents = tax;
    order.total_cents = subtotal + tax;
  }
}
