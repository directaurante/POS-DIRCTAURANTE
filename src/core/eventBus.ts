/**
 * DIRECTAURANTE POS CORE — Domain Event Bus
 * In-process asynchronous event dispatcher supporting real-time cross-module synchronization
 * between POS, Comandero, KDS, DirectPrint, and Financial Audit.
 */

import { DEFAULT_RESTAURANT_ID } from './database';

export type DomainEventType =
  | 'TABLE_OPENED'
  | 'TABLE_CLOSED'
  | 'SUBACCOUNT_CREATED'
  | 'ITEM_REASSIGNED'
  | 'ORDER_CREATED'
  | 'ORDER_TICKET_CREATED'
  | 'ORDER_ITEM_ADDED'
  | 'ORDER_ITEM_SENT_TO_PRODUCTION'
  | 'ORDER_ITEM_ACKNOWLEDGED'
  | 'ORDER_ITEM_PREPARING'
  | 'ORDER_ITEM_READY'
  | 'ORDER_ITEM_DELIVERED'
  | 'ORDER_ITEM_CANCELLED'
  | 'ALLERGY_WARNING_OVERRIDDEN'
  | 'PAYMENT_CREATED'
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'PRINT_JOB_CREATED'
  | 'PRINT_JOB_COMPLETED'
  | 'PRINT_JOB_FAILED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'LOYALTY_POINTS_EARNED'
  | 'LOYALTY_POINTS_REDEEMED'
  | 'COUPON_REDEEMED'
  | 'PROMOTION_APPLIED'
  | 'REFERRAL_CREATED'
  | 'REFERRAL_REWARDED';

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  restaurant_id: string;
  timestamp: string;
  actor: string;
  payload: T;
}

export type EventSubscriber<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

class EventBus {
  private subscribers: Map<DomainEventType | '*', Set<EventSubscriber>> = new Map();
  private history: DomainEvent[] = [];
  private maxHistory: number = 200;

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  public subscribe<T = any>(type: DomainEventType | '*', handler: EventSubscriber<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler as EventSubscriber);

    // Unsubscribe callback
    return () => {
      this.subscribers.get(type)?.delete(handler as EventSubscriber);
    };
  }

  public publish<T = any>(
    type: DomainEventType,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'System',
    payload: T
  ): DomainEvent<T> {
    const event: DomainEvent<T> = {
      id: this.generateId(),
      type,
      restaurant_id,
      timestamp: new Date().toISOString(),
      actor,
      payload,
    };

    this.history.unshift(event);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    // Specific listeners
    const specificHandlers = this.subscribers.get(type);
    if (specificHandlers) {
      specificHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EventBus] Error in subscriber for ${type}:`, err);
        }
      });
    }

    // Wildcard listeners
    const wildcardHandlers = this.subscribers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EventBus] Error in wildcard subscriber:`, err);
        }
      });
    }

    return event;
  }

  public getHistory(restaurant_id: string = DEFAULT_RESTAURANT_ID, limit: number = 50): DomainEvent[] {
    return this.history
      .filter((e) => e.restaurant_id === restaurant_id)
      .slice(0, limit);
  }

  public clearHistory(): void {
    this.history = [];
  }
}

export const eventBus = new EventBus();
