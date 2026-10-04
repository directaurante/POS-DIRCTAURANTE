/**
 * DIRECTAURANTE POS CORE — Audit Logging Service
 * Provides immutable, tamper-resistant operational and financial event audit trails.
 */

import { db, DEFAULT_RESTAURANT_ID } from './database';
import { AuditLog } from './types';

export class AuditService {
  public static log(
    action: string,
    entity_type: AuditLog['entity_type'],
    entity_id: string,
    actor: string,
    previous_state: any = null,
    new_state: any = null,
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): AuditLog {
    const logEntry: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      restaurant_id,
      action,
      entity_type,
      entity_id,
      actor,
      previous_state: previous_state ? JSON.parse(JSON.stringify(previous_state)) : null,
      new_state: new_state ? JSON.parse(JSON.stringify(new_state)) : null,
      notes,
      timestamp: new Date().toISOString(),
    };

    db.get('audit_logs').unshift(logEntry);
    db.save();

    return logEntry;
  }

  public static getLogs(restaurant_id: string = DEFAULT_RESTAURANT_ID, limit: number = 100): AuditLog[] {
    return db
      .get('audit_logs')
      .filter((l) => l.restaurant_id === restaurant_id)
      .slice(0, limit);
  }
}
