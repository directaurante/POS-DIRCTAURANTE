/**
 * DIRECTAURANTE DIRECTPRINT — ESC/POS Thermal Slip Formatter
 * Generates standards-compliant monospaced thermal tickets for 80mm (48 chars) and 58mm (32 chars).
 */

export class EscPosFormatter {
  public static divider(char: string = '-', width: number = 42): string {
    return char.repeat(width);
  }

  public static doubleDivider(width: number = 42): string {
    return '='.repeat(width);
  }

  public static center(text: string, width: number = 42): string {
    if (text.length >= width) return text.slice(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    const rightPad = width - text.length - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  public static padBetween(left: string, right: string, width: number = 42): string {
    const spaceNeeded = width - left.length - right.length;
    if (spaceNeeded <= 0) {
      return `${left} ${right}`;
    }
    return left + ' '.repeat(spaceNeeded) + right;
  }

  public static formatMoney(cents: number): string {
    return `$${(cents / 100).toFixed(2)} MXN`;
  }

  /**
   * Generates Kitchen Production Ticket (Comanda Cocina)
   */
  public static formatKitchenComanda(data: {
    restaurantName: string;
    tableNumber: string;
    ticketNumber: string;
    waiter: string;
    timestamp: string;
    items: Array<{
      quantity: number;
      productName: string;
      seatNumber: string;
      guestName: string;
      notes?: string;
      modifiers?: string[];
      priority?: string;
    }>;
    width?: number;
  }): string {
    const w = data.width || 42;
    const lines: string[] = [];

    lines.push(this.center(data.restaurantName.toUpperCase(), w));
    lines.push(this.center('*** COMANDA DE PRODUCCION COCINA ***', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween(`MESA: ${data.tableNumber}`, data.ticketNumber, w));
    lines.push(this.padBetween(`MESERO: ${data.waiter}`, new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w));
    lines.push(this.divider('-', w));
    lines.push(this.padBetween('CANT  PRODUCTO / COMENSAL', 'ESTADO', w));
    lines.push(this.divider('-', w));

    data.items.forEach((item) => {
      const headerLine = `${item.quantity}x ${item.productName.toUpperCase()}`;
      const seatInfo = `[${item.seatNumber} ${item.guestName}]`;
      lines.push(this.padBetween(headerLine, item.priority === 'urgent' ? '¡URGENTE!' : 'PENDIENTE', w));
      lines.push(`   --> Para: ${seatInfo}`);

      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach((mod) => {
          lines.push(`   * Mod: ${mod}`);
        });
      }

      if (item.notes) {
        lines.push(`   * NOTA: "${item.notes.toUpperCase()}"`);
      }
      lines.push('');
    });

    lines.push(this.divider('-', w));
    lines.push(this.center(`TOTAL PRODUCTOS EN TICKET: ${data.items.reduce((acc, i) => acc + i.quantity, 0)}`, w));
    lines.push(this.center(`Fecha: ${new Date(data.timestamp).toLocaleDateString()}`, w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Generates Bar Production Ticket (Comanda Barra & Bebidas)
   */
  public static formatBarComanda(data: {
    restaurantName: string;
    tableNumber: string;
    ticketNumber: string;
    waiter: string;
    timestamp: string;
    items: Array<{
      quantity: number;
      productName: string;
      seatNumber: string;
      guestName: string;
      notes?: string;
      modifiers?: string[];
    }>;
    width?: number;
  }): string {
    const w = data.width || 42;
    const lines: string[] = [];

    lines.push(this.center(data.restaurantName.toUpperCase(), w));
    lines.push(this.center('*** COMANDA DE BARRA & BEBIDAS ***', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween(`MESA: ${data.tableNumber}`, data.ticketNumber, w));
    lines.push(this.padBetween(`MESERO: ${data.waiter}`, new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w));
    lines.push(this.divider('-', w));

    data.items.forEach((item) => {
      const headerLine = `${item.quantity}x ${item.productName.toUpperCase()}`;
      lines.push(this.padBetween(headerLine, `[${item.seatNumber}]`, w));
      lines.push(`   Comensal: ${item.guestName}`);
      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach((m) => lines.push(`   * ${m}`));
      }
      if (item.notes) {
        lines.push(`   * NOTA: "${item.notes}"`);
      }
      lines.push('');
    });

    lines.push(this.divider('-', w));
    lines.push(this.center(`TOTAL BEBIDAS: ${data.items.reduce((acc, i) => acc + i.quantity, 0)}`, w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Generates Pre-Bill / Full Table Bill (Pre-cuenta)
   */
  public static formatPreBill(data: {
    restaurantName: string;
    legalName: string;
    tableNumber: string;
    sessionId: string;
    serverName: string;
    timestamp: string;
    subaccounts: Array<{
      seatNumber: string;
      displayName: string;
      items: Array<{
        quantity: number;
        productName: string;
        unitPriceCents: number;
        totalPriceCents: number;
      }>;
      subtotalCents: number;
      totalCents: number;
      paidCents: number;
      balanceCents: number;
    }>;
    globalSubtotalCents: number;
    globalTaxCents: number;
    globalTotalCents: number;
    globalPaidCents: number;
    globalBalanceCents: number;
    width?: number;
  }): string {
    const w = data.width || 42;
    const lines: string[] = [];

    lines.push(this.center(data.restaurantName.toUpperCase(), w));
    lines.push(this.center(data.legalName, w));
    lines.push(this.center('ESTADO DE CUENTA / PRE-CUENTA', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween(`MESA: ${data.tableNumber}`, `SESION: #${data.sessionId.slice(-6)}`, w));
    lines.push(this.padBetween(`ATENDIO: ${data.serverName}`, new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w));
    lines.push(this.padBetween(`FECHA: ${new Date(data.timestamp).toLocaleDateString()}`, 'EXPEDIDA EN SALON', w));
    lines.push(this.divider('=', w));

    data.subaccounts.forEach((seat) => {
      lines.push(`>> COMENSAL [${seat.seatNumber}] ${seat.displayName.toUpperCase()}`);
      lines.push(this.divider('-', w));

      if (seat.items.length === 0) {
        lines.push('   (Sin consumos registrados)');
      } else {
        seat.items.forEach((item) => {
          const itemText = `${item.quantity} ${item.productName.slice(0, w - 16)}`;
          const priceText = this.formatMoney(item.totalPriceCents);
          lines.push(this.padBetween(itemText, priceText, w));
        });
      }

      lines.push(this.padBetween('   Subtotal Comensal:', this.formatMoney(seat.subtotalCents), w));
      if (seat.paidCents > 0) {
        lines.push(this.padBetween('   Abonado / Pagado:', `-${this.formatMoney(seat.paidCents)}`, w));
        lines.push(this.padBetween('   Saldo Pendiente:', this.formatMoney(seat.balanceCents), w));
      }
      lines.push('');
    });

    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween('SUBTOTAL CONSOLIDADO:', this.formatMoney(data.globalSubtotalCents), w));
    lines.push(this.padBetween('I.V.A. TRASLADADO (16%):', this.formatMoney(data.globalTaxCents), w));
    lines.push(this.divider('-', w));
    lines.push(this.padBetween('TOTAL A LIQUIDAR:', this.formatMoney(data.globalTotalCents), w));

    if (data.globalPaidCents > 0) {
      lines.push(this.padBetween('PAGADO A LA FECHA:', this.formatMoney(data.globalPaidCents), w));
      lines.push(this.padBetween('SALDO RESTANTE:', this.formatMoney(data.globalBalanceCents), w));
    }

    lines.push(this.doubleDivider(w));
    lines.push(this.center('LA PROPINA ES SUGERIDA Y OPCIONAL (10% / 15%)', w));
    lines.push(this.center('NO INCLUIDA EN ESTE TOTAL', w));
    lines.push(this.center('¡GRACIAS POR SU PREFERENCIA!', w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Generates Payment Receipt Ticket (Comprobante de Pago)
   */
  public static formatPaymentReceipt(data: {
    restaurantName: string;
    paymentId: string;
    tableNumber: string;
    sessionId: string;
    method: 'cash' | 'card' | 'transfer';
    amountCents: number;
    cashier: string;
    timestamp: string;
    reference?: string;
    seatNumber?: string;
    guestName?: string;
    remainingBalanceCents: number;
    width?: number;
  }): string {
    const w = data.width || 42;
    const lines: string[] = [];

    lines.push(this.center(data.restaurantName.toUpperCase(), w));
    lines.push(this.center('COMPROBANTE DE PAGO REGISTRADO', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween(`RECIBO: #${data.paymentId.slice(-8)}`, new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w));
    lines.push(this.padBetween(`MESA: ${data.tableNumber}`, `SESION: #${data.sessionId.slice(-6)}`, w));
    lines.push(this.padBetween(`CAJERO: ${data.cashier}`, new Date(data.timestamp).toLocaleDateString(), w));

    if (data.seatNumber && data.guestName) {
      lines.push(this.padBetween('PAGO DIRIGIDO A:', `[${data.seatNumber}] ${data.guestName}`, w));
    } else {
      lines.push(this.padBetween('PAGO DIRIGIDO A:', 'CUENTA GENERAL DE MESA', w));
    }

    lines.push(this.divider('-', w));
    const methodLabel =
      data.method === 'cash' ? 'EFECTIVO (CASH)' : data.method === 'card' ? 'TARJETA DE CREDITO/DEBITO' : 'TRANSFERENCIA SPEI';
    lines.push(this.padBetween('METODO DE PAGO:', methodLabel, w));

    if (data.reference) {
      lines.push(this.padBetween('AUTORIZACION / REF:', data.reference, w));
    }

    lines.push(this.padBetween('IMPORTE COBRADO:', this.formatMoney(data.amountCents), w));
    lines.push(this.divider('-', w));

    if (data.remainingBalanceCents <= 0) {
      lines.push(this.center('*** CUENTA TOTALMENTE LIQUIDADA ($0.00) ***', w));
    } else {
      lines.push(this.padBetween('SALDO RESTANTE DE MESA:', this.formatMoney(data.remainingBalanceCents), w));
    }

    lines.push(this.doubleDivider(w));
    lines.push(this.center('CONSERVE ESTE COMPROBANTE PARA CUALQUIER ACLARACION', w));
    lines.push(this.center('SISTEMA DIRECTAURANTE POS & DIRECTPRINT', w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Generates Cash Shift Cut / Z-Report (Corte de Turno)
   */
  public static formatCashShiftCut(data: {
    restaurantName: string;
    shiftId: string;
    openedBy: string;
    openedAt: string;
    closedBy: string;
    closedAt: string;
    initialFloatCents: number;
    cashSalesCents: number;
    cardSalesCents: number;
    transferSalesCents: number;
    expensesCents: number;
    withdrawalsCents: number;
    expectedCashCents: number;
    actualCashCents: number;
    differenceCents: number;
    movementsCount: number;
    notes?: string;
    width?: number;
  }): string {
    const w = data.width || 42;
    const lines: string[] = [];

    lines.push(this.center(data.restaurantName.toUpperCase(), w));
    lines.push(this.center('CORTE DE CAJA / CIERRE DE TURNO (REPORTE Z)', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween(`FOLIO TURNO: #${data.shiftId.slice(-8)}`, 'ESTADO: CERRADO', w));
    lines.push(this.padBetween('APERTURA:', `${new Date(data.openedAt).toLocaleDateString()} ${new Date(data.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, w));
    lines.push(this.padBetween('ABIERTO POR:', data.openedBy, w));
    lines.push(this.padBetween('CIERRE:', `${new Date(data.closedAt).toLocaleDateString()} ${new Date(data.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, w));
    lines.push(this.padBetween('CERRADO POR:', data.closedBy, w));
    lines.push(this.divider('=', w));

    lines.push(this.padBetween('(+) FONDO INICIAL DE CAJA:', this.formatMoney(data.initialFloatCents), w));
    lines.push(this.padBetween('(+) VENTAS EN EFECTIVO:', this.formatMoney(data.cashSalesCents), w));
    lines.push(this.padBetween('(-) GASTOS DE CAJA REGISTRADOS:', this.formatMoney(data.expensesCents), w));
    lines.push(this.padBetween('(-) RETIROS DE EFECTIVO:', this.formatMoney(data.withdrawalsCents), w));
    lines.push(this.divider('-', w));
    lines.push(this.padBetween('(=) EFECTIVO TEORICO ESPERADO:', this.formatMoney(data.expectedCashCents), w));
    lines.push(this.padBetween('(=) EFECTIVO REAL CONTADO (CIEGO):', this.formatMoney(data.actualCashCents), w));
    lines.push(this.divider('-', w));

    const diffLabel = data.differenceCents === 0 ? 'CUADRADO ($0.00)' : data.differenceCents > 0 ? `SOBRANTE (+${this.formatMoney(data.differenceCents)})` : `FALTANTE (${this.formatMoney(data.differenceCents)})`;
    lines.push(this.padBetween('DIFERENCIA DE ARQUEO:', diffLabel, w));

    lines.push(this.divider('-', w));
    lines.push(this.center('--- VENTAS EN OTROS MEDIOS (NO EN CAJA) ---', w));
    lines.push(this.padBetween('VENTAS TARJETA (TERMINAL):', this.formatMoney(data.cardSalesCents), w));
    lines.push(this.padBetween('VENTAS TRANSFERENCIA (SPEI):', this.formatMoney(data.transferSalesCents), w));
    lines.push(this.padBetween('TOTAL VENTA NO-EFECTIVO:', this.formatMoney(data.cardSalesCents + data.transferSalesCents), w));
    lines.push(this.divider('=', w));
    lines.push(this.padBetween('GRAN TOTAL VENDIDO EN TURNO:', this.formatMoney(data.cashSalesCents + data.cardSalesCents + data.transferSalesCents), w));

    if (data.notes) {
      lines.push(this.divider('-', w));
      lines.push(`OBSERVACIONES: ${data.notes}`);
    }

    lines.push(this.doubleDivider(w));
    lines.push(this.center(`MOVIMIENTOS EN TURNO: ${data.movementsCount}`, w));
    lines.push(this.center('FIRMA CAJERO / ENCARGADO:', w));
    lines.push('\n');
    lines.push(this.center('______________________________________', w));
    lines.push(this.center(`${data.closedBy.toUpperCase()}`, w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Generates Thermal Printer Self-Test Ticket
   */
  public static formatTestTicket(data: {
    printerName: string;
    station: string;
    address: string;
    paperWidth: number;
    timestamp: string;
  }): string {
    const w = data.paperWidth === 58 ? 32 : 42;
    const lines: string[] = [];

    lines.push(this.center('DIRECTAURANTE DIRECTPRINT v1.0', w));
    lines.push(this.center('*** TICKET DE PRUEBA DE IMPRESION ***', w));
    lines.push(this.doubleDivider(w));
    lines.push(this.padBetween('IMPRESORA:', data.printerName, w));
    lines.push(this.padBetween('ESTACION:', data.station.toUpperCase(), w));
    lines.push(this.padBetween('DIRECCION:', data.address, w));
    lines.push(this.padBetween('ANCHO PAPEL:', `${data.paperWidth}mm (${w} cols)`, w));
    lines.push(this.padBetween('FECHA / HORA:', new Date(data.timestamp).toLocaleTimeString(), w));
    lines.push(this.divider('-', w));
    lines.push(this.center('Caracteres de Prueba:', w));
    lines.push(this.center('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ 0123456789', w));
    lines.push(this.center('abcdefghijklmnñopqrstuvwxyz !@#$%^&*()', w));
    lines.push(this.divider('-', w));
    lines.push(this.center('¡COMUNICACION ESC/POS EXITOSA!', w));
    lines.push(this.center('[ DIRECTPRINT — CORTE AUTOMATICO ]', w));
    lines.push('\n\n\n');

    return lines.join('\n');
  }
}
