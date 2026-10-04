/**
 * DIRECTAURANTE POS CORE v0.1 — Persistent Storage Layer
 * File-backed persistent document store matching MongoDB BSON/JSON conventions.
 * All mutations persist atomically to disk in Node.js environments with isomorphic memory safety.
 */

import {
  Restaurant,
  Table,
  TableSession,
  GuestSubaccount,
  Product,
  Order,
  OrderItem,
  Payment,
  CashShift,
  CashMovement,
  AuditLog,
  Allergy,
  Ingredient,
  RestaurantPluginConfig,
  Printer,
  PrinterRoutingRule,
  PrintJob,
  ImportJob,
  Customer,
  LoyaltyAccount,
  LoyaltyPointTransaction,
  LoyaltyProgramConfig,
  Promotion,
  Coupon,
  CouponRedemption,
  Referral,
} from './types';

export interface DatabaseSchema {
  restaurants: Restaurant[];
  tables: Table[];
  table_sessions: TableSession[];
  guest_subaccounts: GuestSubaccount[];
  products: Product[];
  orders: Order[];
  order_items: OrderItem[];
  payments: Payment[];
  cash_shifts: CashShift[];
  cash_movements: CashMovement[];
  audit_logs: AuditLog[];
  allergies: Allergy[];
  ingredients: Ingredient[];
  restaurant_plugins: RestaurantPluginConfig[];
  printers: Printer[];
  printer_routing_rules: PrinterRoutingRule[];
  print_jobs: PrintJob[];
  import_jobs: ImportJob[];
  customers: Customer[];
  loyalty_accounts: LoyaltyAccount[];
  loyalty_transactions: LoyaltyPointTransaction[];
  promotions: Promotion[];
  coupons: Coupon[];
  coupon_redemptions: CouponRedemption[];
  referrals: Referral[];
  loyalty_configs: LoyaltyProgramConfig[];
}

export const DEFAULT_RESTAURANT_ID = 'rest_directaurante_01';
export const INITIAL_RESTAURANT_ID = DEFAULT_RESTAURANT_ID;

function getNodeFs(): any | null {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (typeof process !== 'undefined' && Boolean(process.versions?.node)) {
    try {
      const getReq = new Function('return typeof require !== "undefined" ? require : null');
      const req = getReq();
      if (req) {
        return req('fs');
      }
    } catch {
      // Not in Node environment
    }
  }
  return null;
}

function getDefaultSeedData(): DatabaseSchema {
  const now = new Date().toISOString();

  const ingredients: Ingredient[] = [
    { id: 'ing_cacahuate', name: 'Cacahuate / Maní', category: 'Frutos secos' },
    { id: 'ing_nuez', name: 'Nueces', category: 'Frutos secos' },
    { id: 'ing_gluten', name: 'Gluten / Trigo', category: 'Cereales' },
    { id: 'ing_lacteos', name: 'Lácteos / Queso', category: 'Lácteos' },
    { id: 'ing_mariscos', name: 'Mariscos / Camarón', category: 'Pescados y Mariscos' },
    { id: 'ing_huevo', name: 'Huevo', category: 'Aves' },
    { id: 'ing_soya', name: 'Soya', category: 'Legumbres' },
    { id: 'ing_pollo', name: 'Pechuga de Pollo', category: 'Carnes' },
    { id: 'ing_res', name: 'Carne de Res 100% Angus', category: 'Carnes' },
    { id: 'ing_bbq', name: 'Salsa BBQ Ahumada', category: 'Salsas' },
    { id: 'ing_cerdo', name: 'Tocino / Cerdo', category: 'Carnes' },
    { id: 'ing_chile', name: 'Chile Habanero / Jalapeño', category: 'Especias' },
  ];

  const allergies: Allergy[] = [
    {
      id: 'alg_cacahuate',
      name: 'Alergia Grave a Cacahuate y Frutos Secos',
      ingredient_ids: ['ing_cacahuate', 'ing_nuez'],
      severity: 'severe',
      description: 'Anafilaxia potencial. Requiere exclusión estricta de trazas.',
    },
    {
      id: 'alg_gluten',
      name: 'Intolerancia al Gluten / Celíaco',
      ingredient_ids: ['ing_gluten'],
      severity: 'moderate',
      description: 'Requiere preparación en área libre de harinas.',
    },
    {
      id: 'alg_mariscos',
      name: 'Alergia a Mariscos',
      ingredient_ids: ['ing_mariscos'],
      severity: 'severe',
      description: 'Reacción alérgica aguda.',
    },
    {
      id: 'alg_lacteos',
      name: 'Intolerancia a Lácteos',
      ingredient_ids: ['ing_lacteos'],
      severity: 'mild',
      description: 'Sin queso ni crema.',
    },
  ];

  const products: Product[] = [
    {
      id: 'prod_boneless_bbq',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Boneless BBQ',
      category: 'Entradas',
      description: 'Trozos crujientes de pechuga de pollo bañados en salsa BBQ ahumada con aderezo ranch.',
      price_cents: 14000, // $140.00 MXN
      ingredient_ids: ['ing_pollo', 'ing_bbq', 'ing_gluten', 'ing_lacteos'],
      destination_station: 'kitchen',
      preparation_time_minutes: 15,
      target_preparation_seconds: 900,
      available_modifiers: ['Salsa aparte', 'Extra aderezo ranch', 'Poco picante', 'Bien dorados'],
      available: true,
    },
    {
      id: 'prod_cerveza',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Cerveza Nacional Ultra',
      category: 'Bebidas',
      description: 'Cerveza clara bien fría de 355 ml.',
      price_cents: 4500, // $45.00 MXN
      ingredient_ids: ['ing_gluten'],
      destination_station: 'bar',
      preparation_time_minutes: 2,
      target_preparation_seconds: 120,
      available_modifiers: ['Vaso frío', 'Con limón y sal', 'Sin vaso'],
      available: true,
    },
    {
      id: 'prod_hamburguesa',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Hamburguesa Clásica Angus',
      category: 'Platillos',
      description: '200g de carne de res Angus, queso cheddar fundido, lechuga, jitomate y pan brioche.',
      price_cents: 15000, // $150.00 MXN
      ingredient_ids: ['ing_res', 'ing_gluten', 'ing_lacteos'],
      destination_station: 'kitchen',
      preparation_time_minutes: 15,
      target_preparation_seconds: 900,
      available_modifiers: ['+ Tocino', '- Cebolla', 'Salsa aparte', 'Término medio', 'Bien cocida', 'Sin jitomate'],
      available: true,
    },
    {
      id: 'prod_burritos',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Burritos Norteños de Res',
      category: 'Platillos',
      description: 'Tortilla de harina rellena de carne asada con frijoles refritos y queso asadero.',
      price_cents: 11000, // $110.00 MXN cada uno
      ingredient_ids: ['ing_res', 'ing_gluten', 'ing_lacteos'],
      destination_station: 'kitchen',
      preparation_time_minutes: 12,
      target_preparation_seconds: 720,
      available_modifiers: ['Sin cebolla', 'Salsa verde aparte', 'Cortar a la mitad', 'Extra queso'],
      available: true,
    },
    {
      id: 'prod_michelada',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Michelada Especial',
      category: 'Bebidas',
      description: 'Vaso escarchado con limón, sal, salsas negras de la casa y clamato preparado.',
      price_cents: 9000, // $90.00 MXN
      ingredient_ids: ['ing_gluten', 'ing_soya'],
      destination_station: 'bar',
      preparation_time_minutes: 4,
      target_preparation_seconds: 240,
      available_modifiers: ['Poco picante', 'Sin clamato', 'Extra limón', 'Escarchado con tajín'],
      available: true,
    },
    {
      id: 'prod_ensalada',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Ensalada César con Pollo',
      category: 'Platillos',
      description: 'Lechuga orejona fresca, pechuga a la plancha, crutones dorados y queso parmesano.',
      price_cents: 13500, // $135.00 MXN
      ingredient_ids: ['ing_pollo', 'ing_lacteos', 'ing_gluten'],
      destination_station: 'kitchen',
      preparation_time_minutes: 8,
      target_preparation_seconds: 480,
      available_modifiers: ['Aderezo aparte', 'Sin crutones', 'Pechuga bien dorada'],
      available: true,
    },
    {
      id: 'prod_papas',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Papas a la Francesa Crujientes',
      category: 'Snacks',
      description: 'Papas corte delgado sazonadas con paprika y sal de mar.',
      price_cents: 6000, // $60.00 MXN
      ingredient_ids: [],
      destination_station: 'kitchen',
      preparation_time_minutes: 8,
      available: true,
    },
    {
      id: 'prod_agua',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Agua Embotellada 600ml',
      category: 'Bebidas',
      description: 'Agua purificada natural de manantial.',
      price_cents: 3500, // $35.00 MXN
      ingredient_ids: [],
      destination_station: 'bar',
      preparation_time_minutes: 1,
      available: true,
    },
    {
      id: 'prod_brownie',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Brownie de Chocolate y Cacahuate',
      category: 'Postres',
      description: 'Brownie tibio con nueces y trocitos de cacahuate tostado servido con helado.',
      price_cents: 8500, // $85.00 MXN
      ingredient_ids: ['ing_cacahuate', 'ing_nuez', 'ing_gluten', 'ing_lacteos', 'ing_huevo'],
      destination_station: 'kitchen',
      preparation_time_minutes: 6,
      available: true,
    },
  ];

  const restaurants: Restaurant[] = [
    {
      id: INITIAL_RESTAURANT_ID,
      name: 'Directaurante Grill & Bar',
      legal_name: 'Directaurante Operadora Gastronómica S.A.P.I. de C.V.',
      currency: 'MXN',
      tax_rate: 0.16,
      created_at: now,
    },
  ];

  const tables: Table[] = [
    { id: 'tbl_1', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 1', capacity: 4, status: 'available' },
    { id: 'tbl_2', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 2', capacity: 2, status: 'available' },
    { id: 'tbl_3', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 3', capacity: 6, status: 'available' },
    { id: 'tbl_4', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 4', capacity: 4, status: 'available' },
    { id: 'tbl_5', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 5', capacity: 8, status: 'available' },
    { id: 'tbl_6', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 6 (Terraza)', capacity: 4, status: 'available' },
    { id: 'tbl_7', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Mesa 7 (Terraza)', capacity: 4, status: 'available' },
    { id: 'tbl_8', restaurant_id: INITIAL_RESTAURANT_ID, number: 'Barra 1', capacity: 3, status: 'available' },
  ];

  const restaurant_plugins: RestaurantPluginConfig[] = [
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'pos', enabled: true, version: '0.1.0', settings: {}, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'kds', enabled: true, version: '0.1.0', settings: { sound_alerts: true }, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'cash', enabled: true, version: '0.1.0', settings: { strict_count: true }, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'directprint', enabled: true, version: '0.1.0', settings: { auto_ticket: true }, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'directimport', enabled: true, version: '0.1.0', settings: {}, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'inventory', enabled: false, version: '0.1.0', settings: {}, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'loyalty', enabled: false, version: '0.1.0', settings: {}, updated_at: now },
    { restaurant_id: INITIAL_RESTAURANT_ID, plugin_id: 'ai', enabled: false, version: '0.1.0', settings: {}, updated_at: now },
  ];

  const cash_shifts: CashShift[] = [
    {
      id: 'shift_init_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      opened_by: 'Cajero Principal (Admin)',
      opened_at: now,
      initial_float_cents: 200000, // $2,000.00 MXN fondo inicial
      status: 'open',
      expected_cash_cents: 200000,
      notes: 'Turno matutino abierto con fondo estándar.',
    },
  ];

  const cash_movements: CashMovement[] = [
    {
      id: 'mov_init_01',
      shift_id: 'shift_init_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      type: 'opening_float',
      amount_cents: 200000,
      description: 'Fondo de apertura de caja',
      performed_by: 'Cajero Principal',
      timestamp: now,
    },
  ];

  const printers: Printer[] = [
    {
      id: 'prn_kitchen_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Comandera Cocina Caliente (ESC/POS)',
      connection_type: 'ethernet',
      address: '192.168.1.201',
      port: 9100,
      station: 'kitchen',
      paper_width: 80,
      protocol: 'esc_pos',
      enabled: true,
      status: 'online',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'prn_bar_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Comandera Barra y Coctelería',
      connection_type: 'ethernet',
      address: '192.168.1.202',
      port: 9100,
      station: 'bar',
      paper_width: 80,
      protocol: 'esc_pos',
      enabled: true,
      status: 'online',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'prn_cashier_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Impresora de Cuentas y Tickets Caja',
      connection_type: 'usb',
      address: '/dev/usb/lp0',
      port: 9100,
      station: 'cashier',
      paper_width: 80,
      protocol: 'esc_pos',
      enabled: true,
      status: 'online',
      created_at: now,
      updated_at: now,
    },
  ];

  const printer_routing_rules: PrinterRoutingRule[] = [
    {
      id: 'rule_kitchen',
      restaurant_id: INITIAL_RESTAURANT_ID,
      job_type: 'comanda_kitchen',
      station: 'kitchen',
      printer_id: 'prn_kitchen_01',
      categories: ['Platillos', 'Entradas', 'Postres', 'Snacks'],
      auto_print: true,
    },
    {
      id: 'rule_bar',
      restaurant_id: INITIAL_RESTAURANT_ID,
      job_type: 'comanda_bar',
      station: 'bar',
      printer_id: 'prn_bar_01',
      categories: ['Bebidas'],
      auto_print: true,
    },
    {
      id: 'rule_pre_bill',
      restaurant_id: INITIAL_RESTAURANT_ID,
      job_type: 'pre_bill',
      printer_id: 'prn_cashier_01',
      auto_print: false,
    },
    {
      id: 'rule_payment_receipt',
      restaurant_id: INITIAL_RESTAURANT_ID,
      job_type: 'payment_receipt',
      printer_id: 'prn_cashier_01',
      auto_print: true,
    },
    {
      id: 'rule_cash_shift_cut',
      restaurant_id: INITIAL_RESTAURANT_ID,
      job_type: 'cash_shift_cut',
      printer_id: 'prn_cashier_01',
      auto_print: true,
    },
  ];

  const customers: Customer[] = [
    {
      id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Carlos Gómez',
      phone: '555-123-4567',
      email: 'carlos.gomez@example.com',
      birthday: '1988-06-15',
      notes: 'Cliente VIP habitual. Prefiere mesa en terraza y Boneless BBQ bien dorados.',
      status: 'active',
      referral_code: 'CARLOSVIP',
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      updated_at: now,
    },
    {
      id: 'cust_ana_02',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Ana Sofía Martínez',
      phone: '555-987-6543',
      email: 'ana.martinez@example.com',
      birthday: '1994-11-22',
      notes: 'Alergia severa a cacahuate y frutos secos. Siempre verificar comandas.',
      status: 'active',
      referral_code: 'ANASOFIA',
      referred_by: 'cust_carlos_01',
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      updated_at: now,
    },
    {
      id: 'cust_roberto_03',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Roberto Hernández',
      phone: '555-444-2222',
      email: 'roberto.h@example.com',
      status: 'inactive',
      referral_code: 'ROBERTOH',
      created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
  ];

  const loyalty_accounts: LoyaltyAccount[] = [
    {
      id: 'loy_carlos_01',
      customer_id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points_balance: 450,
      lifetime_points_earned: 650,
      lifetime_points_redeemed: 200,
      updated_at: now,
    },
    {
      id: 'loy_ana_02',
      customer_id: 'cust_ana_02',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points_balance: 180,
      lifetime_points_earned: 180,
      lifetime_points_redeemed: 0,
      updated_at: now,
    },
    {
      id: 'loy_roberto_03',
      customer_id: 'cust_roberto_03',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points_balance: 38,
      lifetime_points_earned: 38,
      lifetime_points_redeemed: 0,
      updated_at: now,
    },
  ];

  const loyalty_transactions: LoyaltyPointTransaction[] = [
    {
      id: 'tx_loy_01',
      customer_id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points: 250,
      type: 'earn',
      reference: 'ord_hist_01',
      reason: 'Puntos acumulados en Comanda #001',
      actor: 'Sistema Fidelidad',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'tx_loy_02',
      customer_id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points: 100,
      type: 'bonus',
      reference: 'ref_welcome_carlos',
      reason: 'Bono de bienvenida al programa de puntos Directaurante',
      actor: 'Gerencia',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'tx_loy_03',
      customer_id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points: -200,
      type: 'redeem',
      reference: 'ord_hist_02',
      reason: 'Canje de descuento en consumo de mesa',
      actor: 'Cajero Roberto',
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      id: 'tx_loy_04',
      customer_id: 'cust_carlos_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points: 300,
      type: 'earn',
      reference: 'ord_hist_03',
      reason: 'Puntos acumulados en visita fin de semana',
      actor: 'Sistema Fidelidad',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'tx_loy_05',
      customer_id: 'cust_ana_02',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points: 180,
      type: 'earn',
      reference: 'ord_hist_ana_01',
      reason: 'Puntos acumulados en cena Salón Principal',
      actor: 'Sistema Fidelidad',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  const loyalty_configs: LoyaltyProgramConfig[] = [
    {
      id: 'lcfg_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      points_per_currency_unit: 1, // 1 punto por cada $1 MXN gastado
      point_value_cents: 10, // Cada punto equivale a $0.10 MXN al canjear
      min_points_to_redeem: 50,
      welcome_bonus_points: 100,
      enabled: true,
      updated_at: now,
    },
  ];

  const promotions: Promotion[] = [
    {
      id: 'promo_bienvenida',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: '10% Descuento de Bienvenida',
      description: '10% de descuento en la cuenta para clientes nuevos o con cupón de registro.',
      type: 'percentage_discount',
      value: 10,
      valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 365 * 86400000).toISOString(),
      min_order_amount_cents: 10000, // Min $100.00 MXN
      max_discount_cents: 20000, // Max $200.00 MXN
      max_uses: 500,
      max_uses_per_customer: 1,
      current_uses: 12,
      requires_coupon: true,
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'promo_martes_burger',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Martes de Hamburguesa ($40 OFF)',
      description: '$40 MXN de descuento directo en órdenes de hamburguesas o platillos fuertes.',
      type: 'fixed_discount',
      value: 4000, // $40.00 MXN
      valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 365 * 86400000).toISOString(),
      applicable_categories: ['Platillos'],
      min_order_amount_cents: 12000,
      max_uses: 200,
      max_uses_per_customer: 2,
      current_uses: 45,
      requires_coupon: false,
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'promo_bonus_100',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Bonificación 100 Puntos Fidelidad',
      description: 'Obtén 100 puntos de bonificación extra en consumos superiores a $200 MXN.',
      type: 'bonus_points',
      value: 100, // 100 bonus points
      valid_from: new Date(Date.now() - 10 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 60 * 86400000).toISOString(),
      min_order_amount_cents: 20000,
      max_uses: 100,
      max_uses_per_customer: 3,
      current_uses: 28,
      requires_coupon: false,
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'promo_postre_vip',
      restaurant_id: INITIAL_RESTAURANT_ID,
      name: 'Cortesía de Postre VIP',
      description: 'Postre de la casa sin costo para miembros VIP o eventos especiales.',
      type: 'free_product',
      value: 0,
      valid_from: new Date(Date.now() - 10 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
      applicable_categories: ['Postres'],
      min_order_amount_cents: 35000,
      max_uses: 50,
      max_uses_per_customer: 1,
      current_uses: 5,
      requires_coupon: true,
      status: 'active',
      created_at: now,
      updated_at: now,
    },
  ];

  const coupons: Coupon[] = [
    {
      id: 'cpn_directa10',
      code: 'DIRECTA10',
      promotion_id: 'promo_bienvenida',
      restaurant_id: INITIAL_RESTAURANT_ID,
      valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 365 * 86400000).toISOString(),
      max_uses: 200,
      uses: 12,
      max_uses_per_customer: 1,
      active: true,
      created_at: now,
    },
    {
      id: 'cpn_burger40',
      code: 'BURGER40',
      promotion_id: 'promo_martes_burger',
      restaurant_id: INITIAL_RESTAURANT_ID,
      valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 365 * 86400000).toISOString(),
      max_uses: 100,
      uses: 45,
      max_uses_per_customer: 2,
      active: true,
      created_at: now,
    },
    {
      id: 'cpn_vip2026',
      code: 'VIP2026',
      promotion_id: 'promo_postre_vip',
      restaurant_id: INITIAL_RESTAURANT_ID,
      valid_from: new Date(Date.now() - 10 * 86400000).toISOString(),
      valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
      max_uses: 50,
      uses: 5,
      max_uses_per_customer: 1,
      active: true,
      created_at: now,
    },
  ];

  const coupon_redemptions: CouponRedemption[] = [
    {
      id: 'red_01',
      coupon_id: 'cpn_directa10',
      coupon_code: 'DIRECTA10',
      promotion_id: 'promo_bienvenida',
      customer_id: 'cust_carlos_01',
      order_id: 'ord_hist_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      discount_cents: 2500, // $25.00 MXN
      redeemed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];

  const referrals: Referral[] = [
    {
      id: 'ref_01',
      restaurant_id: INITIAL_RESTAURANT_ID,
      referrer_customer_id: 'cust_carlos_01',
      referred_customer_id: 'cust_ana_02',
      status: 'completed',
      reward_points: 100,
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      completed_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    },
  ];

  return {
    restaurants,
    tables,
    table_sessions: [],
    guest_subaccounts: [],
    products,
    orders: [],
    order_items: [],
    payments: [],
    cash_shifts,
    cash_movements,
    audit_logs: [
      {
        id: `aud_init_${Date.now()}`,
        restaurant_id: INITIAL_RESTAURANT_ID,
        action: 'system_initialized',
        entity_type: 'plugin',
        entity_id: 'pos',
        actor: 'Directaurante Core System',
        notes: 'Arranque del módulo POS Core v0.1 con datos operacionales reales.',
        timestamp: now,
      },
    ],
    allergies,
    ingredients,
    restaurant_plugins,
    printers,
    printer_routing_rules,
    print_jobs: [],
    import_jobs: [],
    customers,
    loyalty_accounts,
    loyalty_transactions,
    promotions,
    coupons,
    coupon_redemptions,
    referrals,
    loyalty_configs,
  };
}

class DatabaseManager {
  private data: DatabaseSchema;
  private saveTimeout: any = null;

  constructor() {
    this.data = this.loadData();
  }

  private isNode(): boolean {
    return typeof window === 'undefined' && typeof process !== 'undefined' && Boolean(process.versions?.node);
  }

  private loadData(): DatabaseSchema {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('directaurante_store');
        if (stored) {
          const parsed = JSON.parse(stored);
          const defaultData = getDefaultSeedData();
          return {
            ...defaultData,
            ...parsed,
            table_sessions: parsed.table_sessions || [],
            printers: parsed.printers || defaultData.printers,
            printer_routing_rules: parsed.printer_routing_rules || defaultData.printer_routing_rules,
            print_jobs: parsed.print_jobs || [],
            customers: parsed.customers || defaultData.customers,
            loyalty_accounts: parsed.loyalty_accounts || defaultData.loyalty_accounts,
            loyalty_transactions: parsed.loyalty_transactions || defaultData.loyalty_transactions,
            promotions: parsed.promotions || defaultData.promotions,
            coupons: parsed.coupons || defaultData.coupons,
            coupon_redemptions: parsed.coupon_redemptions || defaultData.coupon_redemptions,
            referrals: parsed.referrals || defaultData.referrals,
            loyalty_configs: parsed.loyalty_configs || defaultData.loyalty_configs,
          };
        }
      } catch (err) {
        console.warn('[DatabaseManager] Error reading localStorage:', err);
      }
      const initial = getDefaultSeedData();
      this.persistSync(initial);
      return initial;
    }

    const fs = getNodeFs();
    if (fs) {
      try {
        const dataDir = './data';
        const dataFile = './data/directaurante_store.json';

        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        if (fs.existsSync(dataFile)) {
          const fileContent = fs.readFileSync(dataFile, 'utf-8');
          const parsed = JSON.parse(fileContent);
          const defaultData = getDefaultSeedData();
          return {
            ...defaultData,
            ...parsed,
            table_sessions: parsed.table_sessions || [],
            printers: parsed.printers || defaultData.printers,
            printer_routing_rules: parsed.printer_routing_rules || defaultData.printer_routing_rules,
            print_jobs: parsed.print_jobs || [],
            customers: parsed.customers || defaultData.customers,
            loyalty_accounts: parsed.loyalty_accounts || defaultData.loyalty_accounts,
            loyalty_transactions: parsed.loyalty_transactions || defaultData.loyalty_transactions,
            promotions: parsed.promotions || defaultData.promotions,
            coupons: parsed.coupons || defaultData.coupons,
            coupon_redemptions: parsed.coupon_redemptions || defaultData.coupon_redemptions,
            referrals: parsed.referrals || defaultData.referrals,
            loyalty_configs: parsed.loyalty_configs || defaultData.loyalty_configs,
          };
        }
      } catch (err) {
        console.warn('[DatabaseManager] Error reading persistent store, seeding default:', err);
      }
    }

    const initial = getDefaultSeedData();
    this.persistSync(initial);
    return initial;
  }

  private persistSync(data: DatabaseSchema): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('directaurante_store', JSON.stringify(data));
      } catch (err) {
        console.warn('[DatabaseManager] Failed to persist to localStorage:', err);
      }
      return;
    }

    const fs = getNodeFs();
    if (fs) {
      try {
        const dataDir = './data';
        const dataFile = './data/directaurante_store.json';

        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const tmpPath = `${dataFile}.tmp.${Date.now()}`;
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpPath, dataFile);
      } catch (err) {
        console.error('[DatabaseManager] Failed to persist data to disk:', err);
      }
    }
  }

  public save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistSync(this.data);
      this.saveTimeout = null;
    }, 50);
  }

  public get<K extends keyof DatabaseSchema>(collection: K): DatabaseSchema[K] {
    return this.data[collection];
  }

  public resetToDefault(): void {
    this.data = getDefaultSeedData();
    this.persistSync(this.data);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('directaurante_store');
      } catch {}
    }
  }

  public resetTestStore(): void {
    this.resetToDefault();
  }
}

export const db = new DatabaseManager();
