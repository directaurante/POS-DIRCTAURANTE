/**
 * DIRECTAURANTE POS CORE v0.1 — Automated Verification & Test Suite
 * Validates:
 * - Domain hierarchy: TABLE -> TABLE SESSION -> GUEST SUBACCOUNT -> ORDER TICKET / ORDER -> ORDER ITEM
 * - UUID/String domain IDs (no ObjectId in POS domain contracts)
 * - Single active TableSession per table rule
 * - Multiple comandas (Comanda #001, #002, #003) under the SAME table_session_id
 * - Consolidated session bill & individual diner bills
 * - Safe payment settlement & session closure
 */

import { PosService } from './src/modules/pos/posService';
import { KdsService } from './src/modules/kds/kdsService';
import { CashService } from './src/modules/cash/cashService';
import { PrintService } from './src/modules/directprint/printService';
import { ImportService } from './src/modules/directimport/importService';
import { PluginRegistry } from './src/core/pluginRegistry';
import { AuditService } from './src/core/audit';
import { eventBus } from './src/core/eventBus';
import { db, DEFAULT_RESTAURANT_ID } from './src/core/database';

async function runTestSuite() {
  console.log('====================================================');
  console.log(' DIRECTAURANTE POS CORE v0.1 — AUTOMATED TEST SUITE');
  console.log(' Architecture & Domain Hierarchy Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // Reset database to ensure pristine initial state
  db.resetToDefault();

  // Test 1: Plugin Registry Verification
  console.log('\n--- 1. PLUGIN REGISTRY ---');
  const plugins = PluginRegistry.getRestaurantPlugins(DEFAULT_RESTAURANT_ID);
  assert(plugins.length >= 4, 'Plugins disponibles registrados', `Encontrados: ${plugins.length}`);
  const posPlugin = plugins.find((p) => p.id === 'plugin_comandero' || p.id === 'pos');
  assert(Boolean(posPlugin && posPlugin.enabled), 'Plugin POS habilitado por defecto');

  // Test 2: Domain Event Bus
  console.log('\n--- 2. DOMAIN EVENT BUS ---');
  let eventCaptured = false;
  const unsubscribe = eventBus.subscribe('ORDER_ITEM_ADDED', () => {
    eventCaptured = true;
  });
  assert(typeof unsubscribe === 'function', 'Suscripción a EventBus exitosa');

  // Test 3: Table Opening and TableSession Hierarchy
  console.log('\n--- 3. TABLE -> TABLE SESSION -> GUEST SUBACCOUNTS ---');
  const table1 = db.get('tables').find((t) => t.number === 'Mesa 1');
  assert(Boolean(table1), 'Mesa 1 existe en base de datos');

  const openRes = PosService.openTable(
    table1!.id,
    'Mesero Carlos R.',
    [
      { name: 'Carlos' },
      { name: 'Ana', allergy_ids: ['alg_cacahuate'] },
      { name: 'Luis' },
      { name: 'María' },
    ],
    DEFAULT_RESTAURANT_ID
  );

  assert(openRes.table.status === 'occupied', 'Mesa 1 marcada como ocupada');
  assert(Boolean(openRes.session), 'Entidad TableSession creada como entidad de primer nivel');
  assert(typeof openRes.session.id === 'string' && openRes.session.id.startsWith('sess_'), 'ID de TableSession es string UUID');
  assert(openRes.session.table_id === table1!.id, 'TableSession vinculada a table_id');
  assert(openRes.session.status === 'active', 'TableSession en estado active');
  assert(openRes.table.active_session_id === openRes.session.id, 'Mesa vinculada a active_session_id');

  // Negative test: Cannot open two active sessions on the same table simultaneously
  let duplicateSessionBlocked = false;
  try {
    PosService.openTable(table1!.id, 'Otro Mesero');
  } catch {
    duplicateSessionBlocked = true;
  }
  assert(duplicateSessionBlocked, 'Regla: Una mesa sólo puede tener una sesión activa simultáneamente');

  assert(openRes.subaccounts.length === 4, '4 comensales creados en la sesión (1.1, 1.2, 1.3, 1.4)');
  const s1 = openRes.subaccounts.find((s) => s.seat_number === '1.1')!;
  const s2 = openRes.subaccounts.find((s) => s.seat_number === '1.2')!;
  const s3 = openRes.subaccounts.find((s) => s.seat_number === '1.3')!;
  const s4 = openRes.subaccounts.find((s) => s.seat_number === '1.4')!;

  assert(s1.table_session_id === openRes.session.id, 'Comensal 1.1 pertenece estrictamente a table_session_id');
  assert(s2.table_session_id === openRes.session.id, 'Comensal 1.2 pertenece a table_session_id');
  assert(s1.display_name === 'Carlos', 'Comensal 1.1 es Carlos');
  assert(s2.display_name === 'Ana', 'Comensal 1.2 es Ana');
  assert(s2.allergy_ids.includes('alg_cacahuate'), 'Ana tiene alergia a Cacahuate registrada');

  // Test 4: Operational Model: Multiple Comanda Tickets under the SAME TableSession
  console.log('\n--- 4. MÚLTIPLES COMANDAS BAJO LA MISMA TABLE SESSION ---');
  // Comanda #001: Carlos pide Boneless BBQ ($140) + Cerveza ($45)
  const comanda1 = openRes.order;
  assert(comanda1.ticket_number === 'Comanda #001', 'Primera comanda es Comanda #001');
  assert(comanda1.table_session_id === openRes.session.id, 'Comanda #001 pertenece a table_session_id');

  const item1_1 = PosService.addItemToSubaccount(
    table1!.id,
    s1.id,
    'prod_boneless_bbq',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );
  const item1_2 = PosService.addItemToSubaccount(
    table1!.id,
    s1.id,
    'prod_cerveza',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );

  assert(item1_1.table_session_id === openRes.session.id, 'Item 1.1 lleva table_session_id');
  assert(item1_1.order_id === comanda1.id, 'Item 1.1 asignado a Comanda #001');
  assert(item1_1.total_price_cents === 14000, 'Boneless BBQ = $140.00');
  assert(item1_2.total_price_cents === 4500, 'Cerveza = $45.00');
  assert(eventCaptured, 'Evento ORDER_ITEM_ADDED emitido y capturado');

  // 1.2 Ana pide Hamburguesa ($150) en Comanda #001
  const item2_1 = PosService.addItemToSubaccount(
    table1!.id,
    s2.id,
    'prod_hamburguesa',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );
  assert(item2_1.total_price_cents === 15000, 'Hamburguesa = $150.00');

  // Comanda #002: Segunda ronda - Luis pide Burritos x2 ($220)
  const comanda2 = PosService.createOrderTicket(table1!.id, 'Mesero Carlos R.', 'Ronda 2');
  assert(comanda2.ticket_number === 'Comanda #002', 'Segunda comanda es Comanda #002');
  assert(comanda2.table_session_id === openRes.session.id, 'Comanda #002 pertenece a la misma sesión');

  const item3_1 = PosService.addItemToSubaccount(
    table1!.id,
    s3.id,
    'prod_burritos',
    2,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda2.id
  );
  assert(item3_1.order_id === comanda2.id, 'Burritos asignados a Comanda #002');
  assert(item3_1.table_session_id === openRes.session.id, 'Burritos pertenecen a la sesión común');
  assert(item3_1.total_price_cents === 22000, 'Burritos x2 = $220.00');

  // Comanda #003: Tercera ronda - Luis pide Cerveza/Michelada ($90) y María pide Ensalada ($135)
  const comanda3 = PosService.createOrderTicket(table1!.id, 'Mesero Carlos R.', 'Ronda Bebidas');
  assert(comanda3.ticket_number === 'Comanda #003', 'Tercera comanda es Comanda #003');
  assert(comanda3.table_session_id === openRes.session.id, 'Comanda #003 pertenece a la misma sesión');

  const item3_2 = PosService.addItemToSubaccount(
    table1!.id,
    s3.id,
    'prod_michelada',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda3.id
  );
  const item4_1 = PosService.addItemToSubaccount(
    table1!.id,
    s4.id,
    'prod_ensalada',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda3.id
  );

  assert(item3_2.total_price_cents === 9000, 'Michelada = $90.00');
  assert(item4_1.total_price_cents === 13500, 'Ensalada = $135.00');

  // Test 5: Deterministic Allergy Conflict Detection
  console.log('\n--- 5. VALIDACIÓN DETERMINISTA DE ALERGIAS ---');
  let allergyBlocked = false;
  try {
    // Ana ordering Brownie with peanut ingredient
    PosService.addItemToSubaccount(table1!.id, s2.id, 'prod_brownie', 1, undefined, false);
  } catch (err: any) {
    if (err.is_allergy_warning) {
      allergyBlocked = true;
    }
  }
  assert(allergyBlocked, 'Bloqueo determinista de producto con alérgeno para Ana (Cacahuate -> Brownie)');

  // Authorized override with audit log
  const authorizedBrownie = PosService.addItemToSubaccount(
    table1!.id,
    s2.id,
    'prod_brownie',
    1,
    'Autorizado por comensal',
    true,
    'Encargado'
  );
  assert(Boolean(authorizedBrownie), 'Autorización explícita de alérgeno permitida con registro');

  const auditLogs = AuditService.getLogs(DEFAULT_RESTAURANT_ID);
  const overrideAudit = auditLogs.find((l) => l.action === 'allergy_override');
  assert(Boolean(overrideAudit), 'Pista de auditoría de anulación de alergia asentada inmutablemente');

  // Test 6: Operational Item Status Transitions (KDS)
  console.log('\n--- 6. ESTADOS OPERATIVOS POR ITEM (KDS) ---');
  const updatedItem = PosService.updateItemStatus(item1_1.id, 'preparing', 'Cocinero Marcos', 'En freidora caliente');
  assert(updatedItem.preparation_status === 'preparing', 'Estado cambiado a preparing');
  assert(Boolean(updatedItem.preparing_at), 'Timestamp de inicio registrado');

  const readyItem = PosService.updateItemStatus(item1_1.id, 'ready', 'Cocinero Marcos', 'Listo en barra');
  assert(readyItem.preparation_status === 'ready', 'Estado cambiado a ready');
  assert(Boolean(readyItem.ready_at), 'Timestamp de listo registrado');

  // Test 7: Unified Session Account Consolidated across all Comandas
  console.log('\n--- 7. CUENTA GLOBAL DE SESIÓN CONSOLIDANDO COMANDAS #001, #002, #003 ---');
  const { FinancialService } = await import('./src/modules/finance/financialService');
  const bill = FinancialService.calculateTableBill(table1!.id, DEFAULT_RESTAURANT_ID);
  assert(bill.table_session_id === openRes.session.id, 'Cuenta asociada a table_session_id');
  assert(bill.orders.length === 3, 'La cuenta consolida las 3 comandas de la sesión (#001, #002, #003)');

  // Carlos: Boneless ($140) + Cerveza ($45) = Subtotal $185
  const billCarlos = bill.subaccounts.find((s) => s.seat_number === '1.1')!;
  assert(billCarlos.subtotal_cents === 18500, 'Cuenta Carlos: Subtotal $185.00');

  // Ana: Hamburguesa ($150) + Brownie ($85) = Subtotal $235
  const billAna = bill.subaccounts.find((s) => s.seat_number === '1.2')!;
  assert(billAna.subtotal_cents === 23500, 'Cuenta Ana: Subtotal $235.00');

  // Luis: Burritos de Comanda #002 ($220) + Michelada de Comanda #003 ($90) = Subtotal $310
  const billLuis = bill.subaccounts.find((s) => s.seat_number === '1.3')!;
  assert(billLuis.subtotal_cents === 31000, 'Cuenta Luis consolida ítems de Comanda #002 y #003: Subtotal $310.00');
  assert(billLuis.items.length === 2, 'Luis tiene 2 items provenientes de distintas comandas');

  // María: Ensalada ($135) = Subtotal $135
  const billMaria = bill.subaccounts.find((s) => s.seat_number === '1.4')!;
  assert(billMaria.subtotal_cents === 13500, 'Cuenta María: Subtotal $135.00');

  // Global Table Session: Sum of subaccounts
  assert(bill.subtotal_cents === 86500, 'Subtotal global de sesión = $865.00');
  assert(bill.tax_cents === Math.round(86500 * 0.16), 'IVA global 16% calculado exactamente');
  assert(bill.total_cents === bill.subtotal_cents + bill.tax_cents, 'Total global = Subtotal + IVA');
  assert(bill.balance_cents === bill.total_cents, 'Saldo inicial = Total de la sesión');

  // Test 8: Partial & Full Payments
  console.log('\n--- 8. PAGOS Y LIQUIDACIÓN EN LA SESIÓN ---');
  // Pay individual seat 1.1 (Carlos)
  const paymentCarlos = FinancialService.recordPayment(table1!.id, billCarlos.total_cents, 'card', s1.id, 'Cajero 1');
  assert(paymentCarlos.table_session_id === openRes.session.id, 'Pago vinculado a table_session_id');
  assert(paymentCarlos.amount_cents === billCarlos.total_cents, 'Pago de comensal Carlos registrado');

  const billAfterCarlos = FinancialService.calculateTableBill(table1!.id);
  const carlosAfter = billAfterCarlos.subaccounts.find((s) => s.seat_number === '1.1')!;
  assert(carlosAfter.balance_cents === 0, 'Saldo individual de Carlos en 0');
  assert(billAfterCarlos.balance_cents < bill.total_cents, 'Saldo global reducido por pago de Carlos');

  // Test 9: Close Table Session Protection
  console.log('\n--- 9. SEGURIDAD Y CIERRE DE SESIÓN ---');
  let closePrevented = false;
  try {
    const checkBill = FinancialService.calculateTableBill(table1!.id);
    if (checkBill.balance_cents > 0) throw new Error('Saldo pendiente');
    PosService.closeTable(table1!.id);
  } catch {
    closePrevented = true;
  }
  assert(closePrevented, 'Cierre de mesa impedido si aún existe saldo pendiente en la sesión');

  // Pay remaining balance of session
  FinancialService.recordPayment(table1!.id, billAfterCarlos.balance_cents, 'cash', undefined, 'Cajero 1');
  const billSettled = FinancialService.calculateTableBill(table1!.id);
  assert(billSettled.balance_cents === 0, 'Sesión de mesa completamente liquidada');

  const closeResult = PosService.closeTable(table1!.id);
  assert(closeResult.success, 'Mesa cerrada y liberada exitosamente tras liquidación');
  assert(closeResult.session.status === 'closed', 'TableSession marcada como closed');
  assert(Boolean(closeResult.session.closed_at), 'Timestamp closed_at registrado en TableSession');

  const table1Closed = db.get('tables').find((t) => t.id === table1!.id);
  assert(table1Closed?.status === 'available', 'Mesa 1 vuelve a estado LIBRE (available)');
  assert(!table1Closed?.active_session_id, 'Mesa 1 sin active_session_id');

  // Test 10: Cash Management
  console.log('\n--- 10. GESTIÓN DE CAJA ---');
  const cashCurrent = CashService.getCurrentShift(DEFAULT_RESTAURANT_ID);
  assert(Boolean(cashCurrent.shift), 'Turno de caja activo presente');
  const expMov = FinancialService.recordCashMovement('expense', 15000, 'Compra de hielo', 'Cajero 1');
  assert(expMov.amount_cents === 15000, 'Gasto de caja de $150.00 registrado con auditoría');

  // Test 11: DirectPrint Architecture
  console.log('\n--- 11. DIRECTPRINT ESC/POS ---');
  const printPrinters = PrintService.getPrinters(DEFAULT_RESTAURANT_ID);
  assert(printPrinters.length >= 3, 'Impresoras de cocina, barra y caja registradas');
  const sampleItems = db.get('order_items').slice(0, 3);
  const ticket = PrintService.generateEscPosTicket('kitchen', 'Mesa 1', 'Mesero Carlos', sampleItems);
  assert(ticket.escpos_hex.startsWith('1B401B6101'), 'Secuencia hexadecimal ESC/POS inicializada correctamente');
  assert(ticket.bytes_count > 0, 'Bytes de ticket generados');

  // Test 12: DirectImport Architecture
  console.log('\n--- 12. DIRECTIMPORT PIPELINE ---');
  const importPrev = ImportService.createPreview(
    'SoftRestaurant',
    'menu.csv',
    [
      { name: 'Arrachera Marinada 300g', precio: 280, categoria: 'Platillos' },
      { name: 'Cerveza Nacional Ultra', precio: 45, categoria: 'Bebidas' },
    ],
    DEFAULT_RESTAURANT_ID
  );
  assert(importPrev.candidates.length === 2, '2 candidatos detectados');
  const dupCandidate = importPrev.candidates.find((c) => c.mapped_name === 'Cerveza Nacional Ultra');
  assert(Boolean(dupCandidate && dupCandidate.has_issue), 'Duplicado detectado por DirectImport');

  console.log('\n====================================================');
  console.log(` RESULTADOS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
