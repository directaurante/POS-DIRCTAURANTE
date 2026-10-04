/**
 * DIRECTAURANTE POS CORE — Financial Settlement & Bill Modal
 * Manages consolidated table bill, individual subaccount bills, mixed payments,
 * idempotency, and DirectPrint pre-bills & receipts.
 */

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { TableBill, Payment } from '../../core/types';
import {
  Receipt,
  Printer,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
}

export const BillModal: React.FC<BillModalProps> = ({ isOpen, onClose, tableId }) => {
  const {
    getTableBill,
    recordPayment,
    closeTable,
    printPreBill,
    printPaymentReceipt,
  } = usePos();

  const [bill, setBill] = useState<TableBill | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string>('all'); // 'all' or subaccount id
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [reference, setReference] = useState('');
  const [cashierName, setCashierName] = useState('Cajero Turno');
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tableId) return;
    loadBill();
  }, [isOpen, tableId]);

  const loadBill = async () => {
    try {
      const b = await getTableBill(tableId);
      setBill(b);

      // default payment amount based on selection
      if (selectedSeatId === 'all') {
        setPaymentAmount((b.balance_cents / 100).toFixed(2));
      } else {
        const seat = b.subaccounts.find((s) => s.guest_subaccount_id === selectedSeatId);
        setPaymentAmount(seat ? (seat.balance_cents / 100).toFixed(2) : '0.00');
      }
    } catch (err: any) {
      console.error('Error loading bill:', err);
    }
  };

  const handleSeatChange = (seatId: string) => {
    setSelectedSeatId(seatId);
    if (!bill) return;
    if (seatId === 'all') {
      setPaymentAmount((bill.balance_cents / 100).toFixed(2));
    } else {
      const seat = bill.subaccounts.find((s) => s.guest_subaccount_id === seatId);
      setPaymentAmount(seat ? (seat.balance_cents / 100).toFixed(2) : '0.00');
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountFloat = parseFloat(paymentAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      alert('Introduce un monto válido mayor a 0.');
      return;
    }

    const amountCents = Math.round(amountFloat * 100);
    setLoading(true);

    try {
      const targetSeat = selectedSeatId === 'all' ? undefined : selectedSeatId;
      const payment = await recordPayment(
        tableId,
        amountCents,
        paymentMethod,
        targetSeat,
        cashierName,
        reference.trim() || undefined
      );

      setLastPayment(payment);
      setReference('');
      await loadBill();
    } catch (err: any) {
      alert(err.message || 'Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPreBill = async () => {
    if (!bill) return;
    try {
      const targetSeat = selectedSeatId === 'all' ? undefined : selectedSeatId;
      await printPreBill(bill.table_session_id, targetSeat);
    } catch (err: any) {
      alert(err.message || 'Error al imprimir pre-cuenta');
    }
  };

  const handlePrintReceipt = async (paymentId: string) => {
    try {
      await printPaymentReceipt(paymentId);
    } catch (err: any) {
      alert(err.message || 'Error al imprimir comprobante');
    }
  };

  const handleCloseTable = async () => {
    if (!bill) return;
    if (bill.balance_cents > 0) {
      alert(`No se puede cerrar la mesa con saldo pendiente ($${(bill.balance_cents / 100).toFixed(2)} MXN).`);
      return;
    }
    if (confirm('¿Confirmar liquidación completa y liberación de la mesa?')) {
      try {
        await closeTable(tableId);
        onClose();
      } catch (err: any) {
        alert(err.message || 'Error al cerrar mesa');
      }
    }
  };

  if (!isOpen || !bill) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#05268F] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FFD318] text-[#05268F] rounded-2xl font-black">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">{bill.table_number} — Cuenta y Liquidación</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                  Sesión #{bill.table_session_id.slice(-6)}
                </span>
              </div>
              <p className="text-xs text-white/80">
                Soporte de pagos por subcuenta, pago consolidado de sesión e impresión térmica nativa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPreBill}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-[#FFD318] text-xs font-black border border-[#FFD318]/30 transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Pre-cuenta</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left: Subaccount breakdown */}
          <div className="lg:col-span-7 p-5 overflow-y-auto border-r border-zinc-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#101828]">Desglose de Consumo por Comensal</h4>
              <span className="text-xs text-[#667085] font-semibold">{bill.subaccounts.length} subcuentas</span>
            </div>

            <div className="space-y-3">
              {bill.subaccounts.map((seat) => {
                const isSelected = selectedSeatId === seat.guest_subaccount_id;

                return (
                  <div
                    key={seat.guest_subaccount_id}
                    onClick={() => handleSeatChange(seat.guest_subaccount_id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-[#05268F] bg-[#EAF0FF]/30 ring-1 ring-[#05268F]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[#05268F] text-white">
                          [{seat.seat_number}]
                        </span>
                        {/* Double Carlos separation guaranteed via distinct ID and seat number */}
                        <span className="font-black text-sm text-[#101828]">{seat.display_name}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-[#101828]">
                          ${(seat.total_cents / 100).toFixed(2)} MXN
                        </span>
                        {seat.paid_cents > 0 && (
                          <div className="text-[10px] text-emerald-700 font-bold">
                            Pagado: ${(seat.paid_cents / 100).toFixed(2)}
                          </div>
                        )}
                        <div
                          className={`text-[11px] font-black ${
                            seat.balance_cents === 0 ? 'text-emerald-700' : 'text-[#05268F]'
                          }`}
                        >
                          Saldo: ${(seat.balance_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-[#667085] space-y-1 pl-1 pt-1 border-t border-zinc-100">
                      {seat.items.map((i) => (
                        <div key={i.id} className="flex justify-between">
                          <span>
                            {i.quantity}x {i.product_name}
                          </span>
                          <span>${(i.total_price_cents / 100).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global Summary */}
            <div className="p-4 rounded-2xl bg-[#F4F6F8] border border-zinc-200 space-y-2">
              <div className="flex justify-between text-xs text-[#667085]">
                <span>Subtotal Consolidado:</span>
                <span className="font-bold text-[#101828]">${(bill.subtotal_cents / 100).toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-xs text-[#667085]">
                <span>I.V.A. (16% Trasladado):</span>
                <span className="font-bold text-[#101828]">${(bill.tax_cents / 100).toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#101828] pt-1 border-t border-zinc-200">
                <span>Gran Total a Pagar:</span>
                <span className="text-base text-[#05268F]">${(bill.total_cents / 100).toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-emerald-700">
                <span>Pagos Realizados:</span>
                <span>-${(bill.paid_cents / 100).toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between text-sm font-black text-rose-800 pt-1 border-t border-zinc-200">
                <span>Saldo Pendiente de Mesa:</span>
                <span>${(bill.balance_cents / 100).toFixed(2)} MXN</span>
              </div>
            </div>
          </div>

          {/* Right: Payment Processor */}
          <div className="lg:col-span-5 p-5 bg-[#F4F6F8] flex flex-col justify-between overflow-y-auto">
            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <h4 className="text-sm font-black text-[#101828]">Registrar Pago</h4>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSeatChange('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      selectedSeatId === 'all'
                        ? 'bg-[#05268F] text-white'
                        : 'bg-white text-[#667085] border border-zinc-200'
                    }`}
                  >
                    Toda la Mesa
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Cobro Dirigido a</label>
                <select
                  value={selectedSeatId}
                  onChange={(e) => handleSeatChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
                >
                  <option value="all">Cuenta General de Mesa</option>
                  {bill.subaccounts.map((s) => (
                    <option key={s.guest_subaccount_id} value={s.guest_subaccount_id}>
                      [{s.seat_number}] {s.display_name} — Saldo: ${(s.balance_cents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'cash'
                        ? 'bg-[#05268F] text-white border-[#05268F] shadow-xs'
                        : 'bg-white text-[#101828] border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 mb-1" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'card'
                        ? 'bg-[#05268F] text-white border-[#05268F] shadow-xs'
                        : 'bg-white text-[#101828] border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mb-1" />
                    <span>Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'transfer'
                        ? 'bg-[#05268F] text-white border-[#05268F] shadow-xs'
                        : 'bg-white text-[#101828] border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4 mb-1" />
                    <span>SPEI</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Monto a Cobrar ($ MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white font-mono text-base font-black text-[#101828]"
                  required
                />
              </div>

              {paymentMethod !== 'cash' && (
                <div>
                  <label className="block text-xs font-bold text-[#101828] mb-1">
                    {paymentMethod === 'card' ? 'No. de Autorización / Voucher' : 'Clave de Rastreo SPEI'}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="ej. AUTH_987456"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-bold"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white font-black text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Cobrar ${(parseFloat(paymentAmount) || 0).toFixed(2)} MXN</span>
              </button>
            </form>

            {/* Last payment action */}
            {lastPayment && (
              <div className="p-3 bg-white rounded-2xl border border-emerald-300 mt-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    ¡Pago Registrado!
                  </span>
                  <span>${(lastPayment.amount_cents / 100).toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(lastPayment.id)}
                  className="w-full py-1.5 rounded-lg bg-[#FFF7D6] hover:bg-[#FFD318] text-[#101828] text-xs font-black border border-[#FFD318] transition flex items-center justify-center gap-1.5 mt-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Comprobante de Pago</span>
                </button>
              </div>
            )}

            {/* Close table button */}
            <div className="pt-4 border-t border-zinc-200 mt-4">
              <button
                onClick={handleCloseTable}
                disabled={bill.balance_cents > 0}
                className={`w-full py-3 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 shadow-sm ${
                  bill.balance_cents === 0
                    ? 'bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828]'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {bill.balance_cents === 0
                    ? 'Liquidar y Liberar Mesa'
                    : `Saldo Pendiente ($${(bill.balance_cents / 100).toFixed(2)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
