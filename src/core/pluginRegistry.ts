/**
 * DIRECTAURANTE POS CORE — Plugin Registry
 * Modular capability architecture for multi-tenant extensions.
 */

import { db, DEFAULT_RESTAURANT_ID } from './database';
import { PluginDefinition, RestaurantPluginConfig } from './types';
import { AuditService } from './audit';

export const CORE_PLUGINS: PluginDefinition[] = [
  {
    id: 'plugin_directprint',
    name: 'DirectPrint v1.0',
    version: '1.0.0',
    description: 'Enrutamiento multi-estación a impresoras térmicas ESC/POS (Cocina, Barra, Caja y Pre-cuentas).',
    isCore: true,
    category: 'hardware',
    icon: 'Printer',
    defaultEnabled: true,
    capabilities: ['esc_pos_rendering', 'multi_station_routing', 'auto_comanda_print', 'blind_cut_print'],
  },
  {
    id: 'plugin_kds',
    name: 'KDS Interactivo',
    version: '2.0.0',
    description: 'Pantallas táctiles de producción para cocina y barra con semáforo SLA y alertas de retraso.',
    isCore: true,
    category: 'kitchen',
    icon: 'ChefHat',
    defaultEnabled: true,
    capabilities: ['kitchen_station', 'bar_station', 'timer_alerts', 'order_item_lifecycle'],
  },
  {
    id: 'plugin_comandero',
    name: 'Comandero Táctil Meseros',
    version: '2.0.0',
    description: 'Toma rápida de comandas en tablets y smartphones con diferenciación estricta de comensales.',
    isCore: true,
    category: 'operations',
    icon: 'Tablet',
    defaultEnabled: true,
    capabilities: ['mobile_first', 'quick_diner_assignment', 'allergy_guards'],
  },
  {
    id: 'plugin_finance_core',
    name: 'Núcleo Financiero & Pagos',
    version: '1.0.0',
    description: 'Manejo de cuentas en centavos, pagos mixtos, idempotencia y arqueos de caja ciegos.',
    isCore: true,
    category: 'finance',
    icon: 'CreditCard',
    defaultEnabled: true,
    capabilities: ['split_bills', 'mixed_payments', 'cash_shift_audit', 'idempotent_settlement'],
  },
];

export class PluginRegistry {
  public static getRestaurantPlugins(restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const configs = db.get('restaurant_plugins').filter((c) => c.restaurant_id === restaurant_id);

    return CORE_PLUGINS.map((plugin) => {
      const existing = configs.find((c) => c.plugin_id === plugin.id);
      return {
        ...plugin,
        enabled: existing ? existing.enabled : plugin.defaultEnabled,
        settings: existing ? existing.settings : {},
      };
    });
  }

  public static isPluginEnabled(plugin_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): boolean {
    const configs = db.get('restaurant_plugins');
    const existing = configs.find((c) => c.restaurant_id === restaurant_id && c.plugin_id === plugin_id);
    if (existing) return existing.enabled;
    const def = CORE_PLUGINS.find((p) => p.id === plugin_id);
    return def ? def.defaultEnabled : false;
  }

  public static togglePlugin(
    plugin_id: string,
    enabled: boolean,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): RestaurantPluginConfig {
    const configs = db.get('restaurant_plugins');
    let existing = configs.find((c) => c.restaurant_id === restaurant_id && c.plugin_id === plugin_id);

    const prev = existing ? { ...existing } : null;
    const now = new Date().toISOString();

    if (existing) {
      existing.enabled = enabled;
      existing.updated_at = now;
    } else {
      existing = {
        restaurant_id,
        plugin_id,
        enabled,
        version: '1.0.0',
        settings: {},
        updated_at: now,
      };
      configs.push(existing);
    }

    db.save();

    AuditService.log(
      'plugin_toggled',
      'plugin',
      plugin_id,
      actor,
      prev,
      existing,
      `Plugin ${plugin_id} ${enabled ? 'habilitado' : 'deshabilitado'}.`,
      restaurant_id
    );

    return existing;
  }
}
