/**
 * DIRECTAURANTE POS CORE — KDS Service (Kitchen Display System)
 * Real-time operational item queues, preparation timers, SLA monitoring, delay alerts, and priority sorting.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { OrderItem, OrderItemStatus } from '../../core/types';
import { PosService } from '../pos/posService';

export interface KdsItemView extends OrderItem {
  table_number: string;
  ticket_number?: string;
  elapsed_seconds: number;
  preparation_seconds?: number;
  target_seconds: number;
  traffic_light: 'pending' | 'preparing' | 'ready' | 'overdue' | 'delivered';
  traffic_light_label: string;
  traffic_light_color: string;
  is_overdue: boolean;
  delayed: boolean;
  diner_allergies?: string[];
}

export class KdsService {
  public static getActiveStationItems(
    station?: 'kitchen' | 'bar',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): KdsItemView[] {
    const items = db.get('order_items').filter((i) => {
      const matchRest = i.restaurant_id === restaurant_id;
      const matchStation = station ? i.destination_station === station : true;
      const notDone = i.preparation_status !== 'delivered' && i.preparation_status !== 'cancelled';
      return matchRest && matchStation && notDone;
    });

    const tables = db.get('tables');
    const orders = db.get('orders');
    const products = db.get('products');
    const subaccounts = db.get('guest_subaccounts');
    const allergies = db.get('allergies');
    const now = Date.now();

    return items
      .map((item) => {
        const order = orders.find((o) => o.id === item.order_id);
        const table = order ? tables.find((t) => t.id === order.table_id) : undefined;
        const product = products.find((p) => p.id === item.product_id);
        const subaccount = subaccounts.find((s) => s.id === item.guest_subaccount_id);

        const dinerAllergies = (subaccount?.allergy_ids || [])
          .map((algId) => allergies.find((a) => a.id === algId)?.name)
          .filter(Boolean) as string[];

        const createdTime = new Date(item.created_at).getTime();
        const elapsedSeconds = Math.max(0, Math.floor((now - createdTime) / 1000));

        let prepSeconds: number | undefined;
        if (item.preparing_at) {
          prepSeconds = Math.max(
            0,
            Math.floor((now - new Date(item.preparing_at).getTime()) / 1000)
          );
        }

        const targetSeconds =
          item.target_preparation_seconds ||
          product?.target_preparation_seconds ||
          (product?.preparation_time_minutes || 10) * 60;

        const isOverdue =
          elapsedSeconds > targetSeconds &&
          item.preparation_status !== 'ready' &&
          item.preparation_status !== 'delivered';

        let traffic_light: KdsItemView['traffic_light'] = 'pending';
        let traffic_light_label = 'En cola';
        let traffic_light_color = 'bg-zinc-100 text-zinc-700 border-zinc-300';

        if (isOverdue) {
          traffic_light = 'overdue';
          traffic_light_label = 'Retrasado';
          traffic_light_color = 'bg-rose-50 text-rose-700 border-rose-400 ring-1 ring-rose-400/40';
        } else if (item.preparation_status === 'preparing') {
          traffic_light = 'preparing';
          traffic_light_label = 'En preparación';
          traffic_light_color = 'bg-[#EAF0FF] text-[#05268F] border-[#05268F]/40';
        } else if (item.preparation_status === 'ready') {
          traffic_light = 'ready';
          traffic_light_label = '¡Listo para servir!';
          traffic_light_color = 'bg-emerald-50 text-emerald-800 border-emerald-400';
        } else if (item.preparation_status === 'delivered') {
          traffic_light = 'delivered';
          traffic_light_label = 'Entregado';
          traffic_light_color = 'bg-zinc-50 text-zinc-500 border-zinc-200';
        }

        return {
          ...item,
          table_number: table?.number || 'Mesa ?',
          ticket_number: order?.ticket_number || 'Comanda',
          elapsed_seconds: elapsedSeconds,
          preparation_seconds: prepSeconds,
          target_seconds: targetSeconds,
          traffic_light,
          traffic_light_label,
          traffic_light_color,
          is_overdue: isOverdue,
          delayed: isOverdue,
          diner_allergies: dinerAllergies,
        };
      })
      .sort((a, b) => {
        // Priority sorting: urgent > high > normal, then overdue, then ready, then oldest
        const pMap: Record<string, number> = { urgent: 3, high: 2, normal: 1 };
        const pA = pMap[a.priority || 'normal'] || 1;
        const pB = pMap[b.priority || 'normal'] || 1;
        if (pA !== pB) return pB - pA; // Higher priority first

        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        if (a.preparation_status === 'ready' && b.preparation_status !== 'ready') return -1;
        if (a.preparation_status !== 'ready' && b.preparation_status === 'ready') return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }

  public static startPreparing(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'preparing', actor, undefined, restaurant_id);
  }

  public static markItemReady(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'ready', actor, undefined, restaurant_id);
  }

  public static markItemDelivered(
    itemId: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'delivered', actor, undefined, restaurant_id);
  }

  public static acknowledgeItem(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.acknowledgeItem(itemId, actor, restaurant_id);
  }
}
