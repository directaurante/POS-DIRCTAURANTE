# DIRECTAURANTE — ESPECIFICACIÓN DE ENRUTAMIENTO DIRECTPRINT

**Versión:** 0.5.0  
**Fecha:** 2026-10-04  

---

## 1. TIPOS DE TRABAJO DE IMPRESIÓN (`PrintJobType`)
1. `comanda_kitchen`: Comandas de producción destinadas a la estación de cocina (Platillos, Entradas, Snacks).
2. `comanda_bar`: Comandas de bebidas y coctelería para la barra.
3. `pre_bill`: Estados de cuenta preliminares (pre-cuentas) solicitadas en mesa antes de pagar.
4. `payment_receipt`: Comprobantes de pago expedidos al liquidar (total o parcialmente) una comanda o subcuenta.
5. `cash_shift_cut`: Reporte Z de corte de caja tras realizar el arqueo ciego al cerrar turno.
6. `test`: Ticket de autodiagnóstico de impresora térmica.

---

## 2. MATRIZ DE ENRUTAMIENTO ESTÁNDAR

| Tipo de Trabajo | Estación | Impresora Asignada | Ancho | Auto-Imprimir |
| :--- | :--- | :--- | :--- | :--- |
| `comanda_kitchen` | `kitchen` | Térmica Cocina Caliente (`prn_kitchen_01`) | 80mm | Sí (al enviar a producción) |
| `comanda_bar` | `bar` | Térmica Barra & Bebidas (`prn_bar_01`) | 80mm | Sí (al enviar a producción) |
| `pre_bill` | `cashier` | Ticketera de Caja & Recibos (`prn_cashier_01`) | 80mm | Opcional (bajo demanda) |
| `payment_receipt` | `cashier` | Ticketera de Caja & Recibos (`prn_cashier_01`) | 80mm | Sí (al confirmar pago) |
| `cash_shift_cut` | `cashier` | Ticketera de Caja & Recibos (`prn_cashier_01`) | 80mm | Sí (al cerrar turno) |

---

## 3. SEPARACIÓN ESTRICTA EN PRODUCCIÓN (CASO MULTIESTACIÓN)
Cuando una comanda agrupa platillos y bebidas:
- **Ejemplo:** Mesa 1 / Comanda #001
  - 1.1 Carlos: Boneless BBQ (Cocina) + Cerveza Ultra (Barra)
- **Comportamiento del Enrutador:**
  1. Filtra los items pertenecientes a `destination_station == 'kitchen'` y genera el PrintJob para la impresora de cocina.
  2. Filtra los items pertenecientes a `destination_station == 'bar'` y genera el PrintJob para la impresora de barra.
  3. No duplica el objeto `OrderItem` en base de datos.
  4. Mantiene el identificador unificado de la sesión (`table_session_id`) y del comensal (`[1.1 Carlos]`).
