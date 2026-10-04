# DIRECTAURANTE — ARQUITECTURA DE DIRECTPRINT (FASE 5)

**Versión:** 0.5.0  
**Fecha:** 2026-10-04  
**Rol:** Arquitecto Senior de Software & Hardware Integration Specialist  

---

## 1. VISIÓN GENERAL Y PROPÓSITO
**DirectPrint** es el subsistema nativo de impresión térmica y emisión de documentos operacionales de Directaurante. Permite a los restaurantes gestionar múltiples impresoras térmicas de 80mm y 58mm conectadas vía Ethernet TCP/IP (puerto 9100), USB, Puerto Serie o emulación virtual.

### Principio Operacional:
```
POS / Comandero / KDS / Caja
         │
         ▼
  DirectauranteSDK
         │
         ▼
  PrintService & Routing Engine
         │
  ┌──────┴───────────────────────────┐
  ▼                                  ▼
Comandas Cocina / Barra       Tickets Fiscales / Caja
  │                                  │
  ▼                                  ▼
Impresoras Térmicas ESC/POS    Bitácora Inmutable (Audit Trail)
```

---

## 2. COMPONENTES DEL SUBSISTEMA DIRECTPRINT

1. **Gestor de Impresoras (`Printer`):**
   - Configuración de hardware: nombre, protocolo (`esc_pos`), ancho de papel (`80mm` o `58mm`), estación asignada (`kitchen`, `bar`, `cashier`, `all`), tipo de conexión (`ethernet`, `usb`, `wifi`, `serial`, `virtual`) y estado de salud (`online`, `offline`, `warning`).

2. **Motor de Enrutamiento (`PrinterRoutingRule`):**
   - Resuelve el destino de cada documento en función del tipo de trabajo (`job_type`) y estación de producción.
   - Enrutamiento inteligente: Si una comanda contiene platillos de cocina (ej. Boneless, Hamburguesas) y bebidas de barra (ej. Cervezas, Micheladas), DirectPrint genera dos trabajos de impresión independientes a sus respectivas impresoras **sin duplicar el `OrderItem`**.

3. **Formateador Térmico ESC/POS (`EscPosFormatter`):**
   - Generación determinista de texto monoespaciado alineado al ancho del rollo (42/48 columnas para 80mm, 32 columnas para 58mm).
   - Soporte para caracteres acentuados, líneas dobles continuas, cortes automáticos de papel y encabezados jerárquicos.

4. **Cola y Bitácora de Trabajos (`PrintJob`):**
   - Cada trabajo emitido se guarda de manera inmutable con identificador único (`pjob_...`), contenido sin formato, metadatos operativos y estado de ejecución.
   - Capacidad de previsualización en pantalla con aspecto de papel térmico realista y re-impresión inmediata con marca de agua `*** COPIA DE REIMPRESION ***`.

---

## 3. INTEGRACIÓN CON EVENTOS DE DOMINIO
DirectPrint se suscribe de manera no invasiva al `EventBus`:
- `ORDER_ITEM_SENT_TO_PRODUCTION`: Dispara automáticamente la impresión de comandas para Cocina y Barra si la regla tiene `auto_print: true`.
- `PAYMENT_CREATED`: Genera el comprobante de pago con desglose del medio de pago y saldo restante.
- `SHIFT_CLOSED`: Genera de inmediato el Reporte Z de corte de caja tras la captura del arqueo ciego.
