# DIRECTAURANTE — FORMATOS DE TICKETS ESC/POS DIRECTPRINT

**Versión:** 0.5.0  
**Fecha:** 2026-10-04  

---

## 1. FORMATO: COMANDA DE COCINA (80mm)
```text
      DIRECTAURANTE COCINA & BAR        
 *** COMANDA DE PRODUCCION COCINA ***   
==========================================
MESA: Mesa 1                 Comanda #001
MESERO: Mesero Sofía                14:32
------------------------------------------
CANT  PRODUCTO / COMENSAL          ESTADO
------------------------------------------
1x BONELESS BBQ CRUJIENTES     PENDIENTE
   --> Para: [1.1 Carlos]
   * Mod: Aderezo Ranch Aparte
   * NOTA: "BIEN DORADOS"

------------------------------------------
        TOTAL PRODUCTOS EN TICKET: 1      
             Fecha: 04/10/2026            
    [ DIRECTPRINT — CORTE AUTOMATICO ]    
```

---

## 2. FORMATO: COMANDA DE BARRA (80mm)
```text
      DIRECTAURANTE COCINA & BAR        
   *** COMANDA DE BARRA & BEBIDAS ***   
==========================================
MESA: Mesa 1                 Comanda #001
MESERO: Mesero Sofía                14:32
------------------------------------------
1x CERVEZA NACIONAL ULTRA          [1.1]
   Comensal: Carlos
   * NOTA: "Helada"

------------------------------------------
             TOTAL BEBIDAS: 1             
    [ DIRECTPRINT — CORTE AUTOMATICO ]    
```

---

## 3. FORMATO: PRE-CUENTA DE MESA (80mm)
```text
      DIRECTAURANTE COCINA & BAR        
Directaurante Gastronomía Integral S.A. 
      ESTADO DE CUENTA / PRE-CUENTA     
==========================================
MESA: Mesa 1               SESION: #sess_01
ATENDIO: Mesero Sofía               14:50
FECHA: 04/10/2026      EXPEDIDA EN SALON
==========================================
>> COMENSAL [1.1] CARLOS
------------------------------------------
1 Boneless BBQ Crujientes     $140.00 MXN
1 Cerveza Nacional Ultra       $45.00 MXN
   Subtotal Comensal:         $185.00 MXN

>> COMENSAL [1.2] CARLOS
------------------------------------------
1 Hamburguesa Directaurante   $150.00 MXN
   Subtotal Comensal:         $150.00 MXN

>> COMENSAL [1.3] LUIS
------------------------------------------
2 Burritos Norteños de Res    $220.00 MXN
1 Michelada Especial           $90.00 MXN
   Subtotal Comensal:         $310.00 MXN

==========================================
SUBTOTAL CONSOLIDADO:         $645.00 MXN
I.V.A. TRASLADADO (16%):      $103.20 MXN
------------------------------------------
TOTAL A LIQUIDAR:             $748.20 MXN
==========================================
 LA PROPINA ES SUGERIDA Y OPCIONAL (10%) 
        NO INCLUIDA EN ESTE TOTAL        
      ¡GRACIAS POR SU PREFERENCIA!       
    [ DIRECTPRINT — CORTE AUTOMATICO ]    
```

---

## 4. FORMATO: COMPROBANTE DE PAGO (80mm)
```text
      DIRECTAURANTE COCINA & BAR        
    COMPROBANTE DE PAGO REGISTRADO      
==========================================
RECIBO: #pay_0123                   15:10
MESA: Mesa 1               SESION: #sess_01
CAJERO: Cajero Roberto         04/10/2026
PAGO DIRIGIDO A:             [1.1] Carlos
------------------------------------------
METODO DE PAGO:          EFECTIVO (CASH)
IMPORTE COBRADO:              $214.60 MXN
------------------------------------------
SALDO RESTANTE DE MESA:       $533.60 MXN
==========================================
 CONSERVE ESTE COMPROBANTE PARA CUALQUIER 
               ACLARACION                
 SISTEMA DIRECTAURANTE POS & DIRECTPRINT 
    [ DIRECTPRINT — CORTE AUTOMATICO ]    
```

---

## 5. FORMATO: CORTE DE CAJA / REPORTE Z (80mm)
```text
      DIRECTAURANTE COCINA & BAR        
CORTE DE CAJA / CIERRE DE TURNO (REPORTE Z)
==========================================
FOLIO TURNO: #shift_01    ESTADO: CERRADO
APERTURA: 04/10/2026 08:00
ABIERTO POR: Cajero Roberto
CIERRE: 04/10/2026 16:00
CERRADO POR: Cajero Roberto
==========================================
(+) FONDO INICIAL DE CAJA:  $1,500.00 MXN
(+) VENTAS EN EFECTIVO:     $2,020.00 MXN
(-) GASTOS DE CAJA:           $180.00 MXN
(-) RETIROS DE EFECTIVO:      $500.00 MXN
------------------------------------------
(=) EFECTIVO TEORICO:       $2,840.00 MXN
(=) EFECTIVO REAL (CIEGO):  $2,840.00 MXN
------------------------------------------
DIFERENCIA DE ARQUEO:    CUADRADO ($0.00)
------------------------------------------
--- VENTAS EN OTROS MEDIOS (NO EN CAJA) ---
VENTAS TARJETA (TERMINAL):  $1,250.00 MXN
VENTAS TRANSFERENCIA SPEI:    $430.00 MXN
TOTAL VENTA NO-EFECTIVO:    $1,680.00 MXN
==========================================
GRAN TOTAL VENDIDO TURNO:   $3,700.00 MXN
==========================================
MOVIMIENTOS EN TURNO: 8
FIRMA CAJERO / ENCARGADO:


______________________________________
            CAJERO ROBERTO
    [ DIRECTPRINT — CORTE AUTOMATICO ]    
```
