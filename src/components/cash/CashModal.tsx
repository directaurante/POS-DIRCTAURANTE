/**
 * DIRECTAURANTE POS CORE — Cash Register & Shift Modal
 * Implements float opening, operational cash movements, blind counts,
 * difference calculations, and DirectPrint Z-report thermal cuts.
 */

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Banknote,
  Printer,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle,
  X,
} from 'lucide-react';

interface CashModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const CashModal: React.FC<CashModalProps> = ({ isOpen = true, onClose, isEmbedded = false }) => {
  const {
    currentShift,
    openShift,
    recordCashMovement,
    closeShift,
    printShiftReport,
  } = usePos();

  const [activeTab, setActiveTab] = useState<'status' | 'movement' | 'close'>('status');

  // Open shift state
  const [initialFloat, setInitialFloat] = useState('1500.00');
  const [cashierName, setCashierName] = useState('Cajero Principal');
  const [notes, setNotes] = useState('Fondo inicial de turno matutino');

  // Movement state
  const [movementType, setMovementType] = useState<'expense' | 'withdrawal' | 'deposit'>('expense');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Blind count state
  const [blindCountCash, setBlindCountCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  if (!isOpen && !isEmbedded) return null;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const floatAmount = parseFloat(initialFloat);
    if (isNaN(floatAmount) || floatAmount < 0) {
      alert('Introduce un fondo inicial válido.');
      return;
    }

    try {
      await openShift(Math.round(floatAmount * 100), cashierName, notes);
      setActiveTab('status');
    } catch (err: any) {
      alert(err.message || 'Error al abrir turno');
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(movementAmount);
    if (isNaN(amt) || amt <= 0 || !movementDescription.trim()) {
      alert('Introduce un monto mayor a 0 y una descripción válida.');
      return;
    }

    try {
      await recordCashMovement(movementType, Math.round(amt * 100), movementDescription.trim(), cashierName);
      setMovementAmount('');
      setMovementDescription('');
      setActiveTab('status');
    } catch (err: any) {
      alert(err.message || 'Error al registrar movimiento');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const counted = parseFloat(blindCountCash);
    if (isNaN(counted) || counted < 0) {
      alert('Introduce el efectivo real contado (Arqueo Ciego).');
      return;
    }

    if (confirm('¿Confirmar arqueo ciego y cierre definitivo de turno de caja?')) {
      try {
        const closed = await closeShift(Math.round(counted * 100), cashierName, closeNotes);
        alert(`Turno cerrado exitosamente. Diferencia: $${((closed.difference_cents || 0) / 100).toFixed(2)} MXN.`);
        // Trigger auto print or manual print
        await printShiftReport(closed.id);
        onClose?.();
      } catch (err: any) {
        alert(err.message || 'Error al cerrar turno');
      }
    }
  };

  const handlePrintCurrentReport = async () => {
    if (!currentShift || !currentShift.shift) return;
    try {
      await printShiftReport(currentShift.shift.id);
    } catch (err: any) {
      alert(err.message || 'Error al imprimir corte de turno');
    }
  };

  const isShiftOpen = Boolean(currentShift && currentShift.shift && currentShift.shift.status === 'open');

  const content = (
    <div
      className={`bg-white ${
        isEmbedded
          ? 'w-full flex-1 shadow-sm border border-zinc-200 rounded-3xl min-h-[750px]'
          : 'rounded-3xl max-w-2xl w-full shadow-2xl border border-zinc-200 max-h-[92vh]'
      } flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-[#05268F] p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFD318] text-[#05268F] rounded-2xl font-black">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Caja & Turnos Operativos</h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isShiftOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-zinc-700 text-zinc-300 border-zinc-600'
                }`}
              >
                {isShiftOpen ? 'TURNO ABIERTO' : 'CAJA CERRADA'}
              </span>
            </div>
            <p className="text-xs text-white/80">
              Arqueos ciegos, movimientos de efectivo y emisión de cortes Z térmicos.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Tab selection */}
        {isShiftOpen && (
          <div className="flex items-center gap-1 p-2 bg-[#F4F6F8] border-b border-zinc-200">
            <button
              onClick={() => setActiveTab('status')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'status'
                  ? 'bg-white text-[#05268F] shadow-xs font-black'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              Estado del Turno
            </button>
            <button
              onClick={() => setActiveTab('movement')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'movement'
                  ? 'bg-white text-[#05268F] shadow-xs font-black'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              + Gasto / Retiro
            </button>
            <button
              onClick={() => setActiveTab('close')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'close'
                  ? 'bg-white text-rose-700 shadow-xs font-black'
                  : 'text-[#667085] hover:text-rose-700'
              }`}
            >
              Cierre & Arqueo Ciego
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 bg-white">
          {!isShiftOpen ? (
            /* Open shift form */
            <form onSubmit={handleOpenShift} className="space-y-4 max-w-md mx-auto py-4">
              <div className="text-center space-y-1 mb-4">
                <Unlock className="w-10 h-10 text-[#05268F] mx-auto" />
                <h4 className="text-base font-black text-[#101828]">Apertura de Turno de Caja</h4>
                <p className="text-xs text-[#667085]">
                  Introduce el fondo inicial en efectivo para iniciar operaciones.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">
                  Fondo Inicial de Caja ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialFloat}
                  onChange={(e) => setInitialFloat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 font-mono text-lg font-black text-[#101828]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Cajero / Encargado *</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Observaciones de Apertura</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ej. Billetes y monedas contadas conforme"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white font-black text-sm shadow-md transition"
              >
                Abrir Turno de Caja
              </button>
            </form>
          ) : activeTab === 'status' ? (
            /* Shift status view */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h4 className="text-base font-black text-[#101828]">
                    Turno #{currentShift.shift.id.slice(-8)}
                  </h4>
                  <p className="text-xs text-[#667085]">
                    Abierto por: <strong className="text-[#101828]">{currentShift.shift.opened_by}</strong> ·{' '}
                    {new Date(currentShift.shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={handlePrintCurrentReport}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFF7D6] hover:bg-[#FFD318] text-[#101828] text-xs font-black border border-[#FFD318] transition shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Corte de Turno</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-[#F4F6F8] border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-[#667085]">Fondo Inicial</span>
                  <div className="text-base font-black text-[#101828]">
                    ${(currentShift.shift.initial_float_cents / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Ventas Efectivo</span>
                  <div className="text-base font-black text-emerald-900">
                    +${(currentShift.totals.sales_cents / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-800">Gastos / Retiros</span>
                  <div className="text-base font-black text-rose-900">
                    -${((currentShift.totals.expenses_cents + currentShift.totals.withdrawals_cents) / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#EAF0FF] border border-[#05268F]/30">
                  <span className="text-[10px] uppercase font-bold text-[#05268F]">Efectivo Esperado</span>
                  <div className="text-base font-black text-[#05268F]">
                    ${(currentShift.totals.net_cash_cents / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h5 className="text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                  Movimientos Registrados ({currentShift.movements.length})
                </h5>
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl max-h-52 overflow-y-auto">
                  {currentShift.movements.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#667085]">
                      Sin movimientos adicionales en este turno.
                    </div>
                  ) : (
                    currentShift.movements.map((m: any) => (
                      <div key={m.id} className="p-3 flex items-center justify-between text-xs hover:bg-zinc-50">
                        <div>
                          <div className="font-bold text-[#101828]">{m.description}</div>
                          <div className="text-[10px] text-[#667085]">
                            {m.performed_by} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span
                          className={`font-black ${
                            m.type === 'expense' || m.type === 'withdrawal'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {m.type === 'expense' || m.type === 'withdrawal' ? '-' : '+'}$
                          {(m.amount_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'movement' ? (
            /* Register movement form */
            <form onSubmit={handleRecordMovement} className="space-y-4 max-w-md mx-auto py-2">
              <h4 className="text-sm font-black text-[#101828]">Registrar Movimiento de Efectivo</h4>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Tipo de Movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('expense')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      movementType === 'expense'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-black'
                        : 'bg-white text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Gasto (Menor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('withdrawal')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      movementType === 'withdrawal'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-black'
                        : 'bg-white text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Retiro Parcial
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('deposit')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      movementType === 'deposit'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-black'
                        : 'bg-white text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Depósito
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Monto ($ MXN) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-mono text-base font-black text-[#101828]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Concepto / Motivo *</label>
                <input
                  type="text"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  placeholder="ej. Compra urgente de hielo / Garrafón de agua"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-[#101828]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#05268F] text-white shadow-xs"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          ) : (
            /* Blind count closure form */
            <form onSubmit={handleCloseShift} className="space-y-4 max-w-md mx-auto py-2">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
                <div>
                  <strong>Arqueo Ciego Oficial:</strong> No reveles el total esperado al cajero. Introduce el efectivo físicamente contado en la gaveta.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">
                  Efectivo Físico Contado ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={blindCountCash}
                  onChange={(e) => setBlindCountCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 font-mono text-xl font-black text-[#101828]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Observaciones de Cierre</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="ej. Turno cerrado sin incidencias mayores"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-[#101828]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Realizar Corte Z y Cerrar</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      {content}
    </div>
  );
};
