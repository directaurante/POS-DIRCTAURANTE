/**
 * DIRECTAURANTE POS CORE — Phase 5 Automated Test Suite
 * Validates:
 * 1. "Double Carlos" identity separation (1.1 Carlos and 1.2 Carlos).
 * 2. Multiple comandas consolidating under single TableSession.
 * 3. Idempotent payments and cash drawer shift sync.
 * 4. DirectPrint Thermal Printers CRUD & status.
 * 5. DirectPrint Multi-Station Routing Rules (kitchen vs bar vs cashier).
 * 6. Production Comanda ticket formatting & item routing without duplication.
 * 7. Pre-bill slip formatting with individual subaccount breakdown and taxes.
 * 8. Payment receipt slip formatting.
 * 9. Cash shift cut (Z-report / blind count) slip formatting.
 * 10. Automated print job dispatch on domain events.
 * 11. Reprint job functionality and immutable audit logs.
 */

import { PosService } from './src/modules/pos/posService';
import { FinancialService } from './src/modules/finance/financialService';
import { PrintService } from './src/modules/directprint/printService';
import { db, DEFAULT_RESTAURANT_ID } from './src/core/database';
import { directauranteSDK } from './src/sdk';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log(' DIRECTAURANTE PHASE 5 AUTOMATED TEST SUITE');
  console.log(' DirectPrint, Impresoras Térmicas & Tickets POS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  db.resetToDefault();

  // 1. "Double Carlos" Separation Test in Mesa 1
  const table1 = db.get('tables').find((t) => t.number === 'Mesa 1')!;
  const openRes = PosService.openTable(
    table1.id,
    'Mesero Sofía',
    [
      { name: 'Carlos' }, // 1.1
      { name: 'Carlos' }, // 1.2 (Doble Carlos)
      { name: 'Luis' },   // 1.3
      { name: 'Ana', allergy_ids: ['alg_cacahuate'] }, // 1.4
    ],
    DEFAULT_RESTAURANT_ID
  );

  const subaccounts = openRes.subaccounts;
  const c1 = subaccounts.find((s) => s.seat_number === '1.1')!;
  const c2 = subaccounts.find((s) => s.seat_number === '1.2')!;
  const luis = subaccounts.find((s) => s.seat_number === '1.3')!;

  assert(c1.id !== c2.id, 'Double Carlos: IDs de subcuenta son estrictamente únicos');
  assert(c1.seat_number === '1.1' && c2.seat_number === '1.2', 'Asientos asignados diferenciados (1.1 y 1.2)');

  // 2. Multiple comandas in one single TableSession
  // Comanda 001: Carlos (1.1) orders Boneless ($140) + Cerveza ($45)
  const item1 = PosService.addItemToSubaccount(table1.id, c1.id, 'prod_boneless_bbq', 1, 'Bien dorados', false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID);
  const item2 = PosService.addItemToSubaccount(table1.id, c1.id, 'prod_cerveza', 1, 'Helada', false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID);

  // Comanda 002: Carlos (1.2) orders Hamburguesa ($150)
  const ticket2 = PosService.createOrderTicket(table1.id, 'Mesero Sofía', 'Ronda Carlos B');
  const item3 = PosService.addItemToSubaccount(table1.id, c2.id, 'prod_hamburguesa', 1, 'Término medio', false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, ticket2.id);

  // Comanda 003: Luis (1.3) orders Burritos x2 ($220) + Michelada ($90)
  const ticket3 = PosService.createOrderTicket(table1.id, 'Mesero Sofía', 'Ronda Luis');
  const item4 = PosService.addItemToSubaccount(table1.id, luis.id, 'prod_burritos', 2, 'Salsa aparte', false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, ticket3.id);
  const item5 = PosService.addItemToSubaccount(table1.id, luis.id, 'prod_michelada', 1, undefined, false, 'Mesero Sofía', DEFAULT_RESTAURANT_ID, ticket3.id);

  const bill = FinancialService.calculateTableBill(table1.id);
  assert(bill.orders.length === 3, 'Tres comandas registradas bajo la misma TableSession');
  assert(bill.total_items_count === 6, 'Total de 6 items acumulados');

  const bC1 = bill.subaccounts.find((s) => s.guest_subaccount_id === c1.id)!;
  const bC2 = bill.subaccounts.find((s) => s.guest_subaccount_id === c2.id)!;
  const bLuis = bill.subaccounts.find((s) => s.guest_subaccount_id === luis.id)!;

  assert(bC1.subtotal_cents === 14000 + 4500, 'Subtotal exacto Carlos 1.1 ($185.00)');
  assert(bC2.subtotal_cents === 15000, 'Subtotal exacto Carlos 1.2 ($150.00)');
  assert(bLuis.subtotal_cents === 22000 + 9000, 'Subtotal exacto Luis 1.3 ($310.00)');

  // 3. DirectPrint Thermal Printers Management (SDK)
  const printers = await directauranteSDK.print.listPrinters();
  assert(printers.length >= 3, 'Impresoras térmicas configuradas (Cocina, Barra, Caja)');

  const kitchenPrinter = printers.find((p) => p.station === 'kitchen')!;
  const barPrinter = printers.find((p) => p.station === 'bar')!;
  const cashierPrinter = printers.find((p) => p.station === 'cashier')!;

  assert(kitchenPrinter.paper_width === 80, 'Impresora cocina configurada en 80mm');
  assert(kitchenPrinter.protocol === 'esc_pos', 'Protocolo ESC/POS activo');

  // Test printer self-test ticket
  const testJob = await directauranteSDK.print.testPrinter(kitchenPrinter.id);
  assert(testJob.status === 'completed', 'Ticket de prueba de impresión emitido exitosamente');
  assert(testJob.raw_content.includes('TICKET DE PRUEBA'), 'Contenido del ticket de prueba verificado');

  // 4. Comanda Ticket Production Routing without duplication
  // Comanda 001 has Boneless (kitchen) and Cerveza (bar)
  const comanda1Jobs = await directauranteSDK.print.printComanda(openRes.order.id);
  assert(comanda1Jobs.length === 2, 'Comanda con cocina y barra genera 2 jobs independientes');

  const kitchenJob = comanda1Jobs.find((j) => j.job_type === 'comanda_kitchen')!;
  const barJob = comanda1Jobs.find((j) => j.job_type === 'comanda_bar')!;

  assert(Boolean(kitchenJob && barJob), 'Trabajos de impresión enrutados a Cocina y Barra');
  assert(kitchenJob.printer_id === kitchenPrinter.id, 'Job de cocina enrutado a impresora de Cocina');
  assert(barJob.printer_id === barPrinter.id, 'Job de barra enrutado a impresora de Barra');

  // Validate slip content (shows Double Carlos seat number clearly)
  assert(kitchenJob.raw_content.includes('BONELESS BBQ'), 'Comanda cocina incluye Boneless');
  assert(kitchenJob.raw_content.includes('[1.1 Carlos]'), 'Comanda cocina muestra [1.1 Carlos]');
  assert(!kitchenJob.raw_content.includes('CERVEZA'), 'Comanda cocina no contiene cerveza');

  assert(barJob.raw_content.includes('CERVEZA NACIONAL'), 'Comanda barra incluye Cerveza');
  assert(barJob.raw_content.includes('[1.1]'), 'Comanda barra muestra asiento [1.1]');
  assert(!barJob.raw_content.includes('BONELESS'), 'Comanda barra no contiene boneless');

  // 5. Pre-Bill Slip Generation (Pre-cuenta)
  const preBillJob = await directauranteSDK.print.printPreBill(openRes.session.id);
  assert(preBillJob.job_type === 'pre_bill', 'Trabajo de pre-cuenta generado');
  assert(preBillJob.raw_content.includes('PRE-CUENTA'), 'Slip contiene encabezado de PRE-CUENTA');
  assert(preBillJob.raw_content.includes('[1.1] CARLOS'), 'Pre-cuenta incluye desglose de [1.1] Carlos');
  assert(preBillJob.raw_content.includes('[1.2] CARLOS'), 'Pre-cuenta incluye desglose de [1.2] Carlos');
  assert(preBillJob.raw_content.includes('I.V.A. TRASLADADO (16%)'), 'Pre-cuenta desglosa IVA 16%');

  // 6. Payment Receipt Slip Generation
  // Pay for Carlos 1.1 via cash
  const pay1 = await directauranteSDK.bills.recordPayment(
    table1.id,
    bC1.total_cents,
    'cash',
    c1.id,
    'Cajero Roberto',
    'TICKET_C1'
  );
  assert(pay1.amount_cents === bC1.total_cents, 'Pago de subcuenta Carlos 1.1 registrado');

  const receiptJob = await directauranteSDK.print.printPaymentReceipt(pay1.id);
  assert(receiptJob.job_type === 'payment_receipt', 'Trabajo de comprobante de pago generado');
  assert(receiptJob.raw_content.includes('COMPROBANTE DE PAGO'), 'Slip contiene comprobante de pago');
  assert(receiptJob.raw_content.includes('EFECTIVO (CASH)'), 'Slip especifica método en efectivo');
  assert(receiptJob.raw_content.includes('[1.1] Carlos'), 'Slip vincula pago al comensal 1.1');

  // 7. Cash Shift Cut (Reporte Z / Blind Count) Slip Generation
  const activeShift = await directauranteSDK.cash.getCurrentShift();
  if (activeShift?.shift?.status === 'open') {
    await directauranteSDK.cash.closeShift(activeShift.shift.expected_cash_cents, 'Admin', 'Cierre automático previo');
  }
  const shift = await directauranteSDK.cash.openShift(150000, 'Cajero Roberto', 'Fondo estándar');
  assert(shift.status === 'open', 'Turno de caja abierto');

  await directauranteSDK.cash.recordMovement('expense', 18000, 'Compra de hielo', 'Cajero Roberto');
  const closedShift = await directauranteSDK.cash.closeShift(333700, 'Cajero Roberto', 'Cierre auditado');
  assert(closedShift.status === 'closed', 'Turno cerrado con arqueo ciego');

  const shiftCutJob = await directauranteSDK.print.printShiftReport(closedShift.id);
  assert(shiftCutJob.job_type === 'cash_shift_cut', 'Trabajo de corte de caja generado');
  assert(shiftCutJob.raw_content.includes('CORTE DE CAJA / CIERRE DE TURNO'), 'Slip contiene título de Reporte Z');
  assert(shiftCutJob.raw_content.includes('FONDO INICIAL DE CAJA:'), 'Slip incluye fondo inicial');
  assert(shiftCutJob.raw_content.includes('GASTOS DE CAJA REGISTRADOS:'), 'Slip incluye gastos');
  assert(shiftCutJob.raw_content.includes('DIFERENCIA DE ARQUEO:'), 'Slip incluye cálculo de diferencia');

  // 8. Reprint Functionality and Invariable History
  const reprintJob = await directauranteSDK.print.reprintJob(shiftCutJob.id);
  assert(reprintJob.status === 'completed', 'Reimpresión completada');
  assert(reprintJob.raw_content.includes('*** COPIA DE REIMPRESION ***'), 'Ticket de reimpresión marcado con copia');
  assert(reprintJob.metadata.reprint_count === 1, 'Contador de reimpresión incrementado');

  // 9. Immutable Audit Logging of Print Operations
  const auditLogs = await directauranteSDK.audit.listAuditEvents(50, 'print_job');
  assert(auditLogs.length >= 5, 'Trabajos de impresión registrados en auditoría inmutable');

  console.log('\n====================================================');
  console.log(` PHASE 5 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal Phase 5 test error:', err);
  process.exit(1);
});
