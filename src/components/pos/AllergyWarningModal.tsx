/**
 * DIRECTAURANTE POS CORE — Deterministic Allergy Warning Modal
 * Enforces explicit authorization with actor and reason logging.
 */

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Check, X } from 'lucide-react';
import { Product, GuestSubaccount } from '../../core/types';

interface AllergyWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestSubaccount: GuestSubaccount | null;
  product: Product | null;
  conflicts: any[];
  onConfirmOverride: (supervisorName: string, reason: string) => void;
}

export const AllergyWarningModal: React.FC<AllergyWarningModalProps> = ({
  isOpen,
  onClose,
  guestSubaccount,
  product,
  conflicts,
  onConfirmOverride,
}) => {
  const [supervisorName, setSupervisorName] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen || !guestSubaccount || !product) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorName.trim() || !reason.trim()) {
      alert('Se requiere el nombre del encargado y el motivo explícito.');
      return;
    }
    onConfirmOverride(supervisorName.trim(), reason.trim());
    setSupervisorName('');
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-2 border-rose-500 overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="bg-rose-600 p-4 text-white flex items-center gap-3">
          <div className="p-2 bg-white text-rose-600 rounded-2xl font-black">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wide">
              ¡Alerta Crítica de Alergia Alimentaria!
            </h3>
            <p className="text-xs text-rose-100 font-medium">
              Validación determinista: conflicto severo detectado en catálogo.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-[#101828] font-bold">
              <span>Comensal Afectado:</span>
              <span className="font-black text-rose-900 font-mono">
                [{guestSubaccount.seat_number}] {guestSubaccount.display_name}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#101828] font-bold">
              <span>Producto Solicitado:</span>
              <span className="font-black text-rose-900">{product.name}</span>
            </div>

            <div className="pt-2 border-t border-rose-200/80">
              <span className="font-bold text-rose-900">Ingredientes Conflictivos:</span>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-rose-800 font-semibold">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {c.message || `${c.allergy?.name}: contiene ${c.conflicting_ingredient?.name}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-xs text-[#667085] leading-relaxed">
            Por seguridad del cliente, esta orden está <strong>bloqueada</strong>. Si el comensal confirma expresamente que puede consumirlo bajo su propia responsabilidad, se requiere autorización formal que quedará asentada en la <strong>bitácora inmutable de auditoría</strong>.
          </div>

          <form onSubmit={handleConfirm} className="space-y-3 pt-2 border-t border-zinc-100">
            <div>
              <label className="block text-xs font-bold text-[#101828] mb-1">
                Encargado / Capitán que Autoriza *
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="ej. Capitán Roberto Méndez"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#101828] mb-1">
                Motivo / Justificación *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ej. Comensal indica que tolera trazas y asume consentimiento"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-[#101828] hover:bg-zinc-200 transition"
              >
                Cancelar y Rechazar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Autorizar Override con Auditoría</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
