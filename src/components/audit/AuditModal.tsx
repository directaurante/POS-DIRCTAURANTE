/**
 * DIRECTAURANTE POS CORE — Immutable Audit Log Modal
 * Displays tamper-resistant operational and financial events.
 */

import React, { useState, useEffect } from 'react';
import { directauranteSDK } from '../../sdk';
import { Shield, FileText, Printer, CheckCircle, Clock, X, RotateCcw } from 'lucide-react';
import { AuditLog } from '../../core/types';

interface AuditModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen = true, onClose, isEmbedded = false }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen && !isEmbedded) return;
    loadLogs();
  }, [isOpen, isEmbedded]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const all = await directauranteSDK.audit.listAuditEvents(100);
      setLogs(all);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isEmbedded) return null;

  const filteredLogs =
    filterType === 'all'
      ? logs
      : logs.filter((l) => l.entity_type === filterType || l.action.includes(filterType));

  const content = (
    <div
      className={`bg-white ${
        isEmbedded
          ? 'w-full flex-1 shadow-sm border border-zinc-200 rounded-3xl min-h-[750px]'
          : 'rounded-3xl max-w-4xl w-full shadow-2xl border border-zinc-200 max-h-[92vh]'
      } flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-[#05268F] p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFD318] text-[#05268F] rounded-2xl font-black">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Bitácora de Auditoría Inmutable</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                Audit Trail
              </span>
            </div>
            <p className="text-xs text-white/80">
              Registro cripto-operacional de eventos financieros, órdenes, anulaciones e impresiones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Refrescar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 p-2.5 bg-[#F4F6F8] border-b border-zinc-200 overflow-x-auto no-scrollbar">
          {['all', 'payment', 'cash_shift', 'print_job', 'order_item', 'allergy_override', 'table_session'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                filterType === f
                  ? 'bg-white text-[#05268F] shadow-xs font-black'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              {f === 'all'
                ? 'Todos los Eventos'
                : f === 'payment'
                ? 'Pagos'
                : f === 'cash_shift'
                ? 'Caja'
                : f === 'print_job'
                ? 'DirectPrint'
                : f === 'allergy_override'
                ? 'Alergias'
                : f}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-white divide-y divide-zinc-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#667085]">Cargando bitácora...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085]">No hay registros para este filtro.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="py-3.5 first:pt-0 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#05268F]">{log.action}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">
                      {log.entity_type}
                    </span>
                    <span className="text-xs font-black text-[#101828]">{log.actor}</span>
                  </div>
                  <p className="text-xs text-[#101828] font-medium">{log.notes || 'Operación registrada.'}</p>
                  <div className="text-[10px] font-mono text-[#667085]">
                    ID Entidad: {log.entity_id} · Folio Log: #{log.id.slice(-8)}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-[#101828]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-[#667085]">{new Date(log.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {onClose && (
          <div className="p-4 bg-[#F4F6F8] border-t border-zinc-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#101828] hover:bg-black text-white text-xs font-black transition"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      {content}
    </div>
  );
};
