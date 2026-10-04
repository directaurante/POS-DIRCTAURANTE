/**
 * DIRECTAURANTE POS CORE — Table Map View
 * Visualizes table occupancy, active servers, diner metrics, and quick opening.
 */

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Users, Receipt, Plus, Sparkles, AlertCircle } from 'lucide-react';

interface TableMapViewProps {
  onSelectTable: (tableId: string) => void;
  onOpenComandero: () => void;
}

export const TableMapView: React.FC<TableMapViewProps> = ({ onSelectTable, onOpenComandero }) => {
  const { tables, openTable, loadCanonicalScenario } = usePos();
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [waiterName, setWaiterName] = useState('Mesero Sofía');
  const [guestCount, setGuestCount] = useState(4);

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingTableId) return;

    // Default guests list
    const initialGuests = [
      { name: 'Carlos' }, // 1.1
      { name: 'Carlos' }, // 1.2 (Doble Carlos)
      { name: 'Luis' },   // 1.3
      { name: 'Ana', allergy_ids: ['alg_cacahuate'] }, // 1.4
    ].slice(0, guestCount);

    try {
      await openTable(openingTableId, waiterName, initialGuests);
      setOpeningTableId(null);
      onSelectTable(openingTableId);
    } catch (err: any) {
      alert(err.message || 'Error al aperturar mesa');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Canonical Scenario and Comandero access */}
      <div className="bg-[#EAF0FF] border border-[#05268F]/30 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-[#05268F] text-white">
              Directaurante POS &amp; Salón
            </span>
            <span className="text-xs font-bold text-[#05268F]">
              Fase 5: DirectPrint Nativo &amp; Impresoras Térmicas
            </span>
          </div>
          <h2 className="text-lg font-black text-[#101828] mt-1">
            Mapa de Mesas y Sesiones Operativas
          </h2>
          <p className="text-xs text-[#667085]">
            Mesa &rarr; Sesión &rarr; Subcuenta (Doble Carlos) &rarr; Comandas &rarr; KDS &rarr; DirectPrint
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCanonicalScenario}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#FFD318] hover:bg-[#FFF7D6] text-[#101828] font-black text-xs shadow-xs transition"
          >
            <Sparkles className="w-4 h-4 text-[#05268F]" />
            <span>Cargar Escenario Canónico (Mesa 1)</span>
          </button>

          <button
            onClick={onOpenComandero}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#05268F] hover:bg-[#041E72] text-white font-black text-xs shadow-sm transition"
          >
            <span>Ir al Comandero Táctil</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
        {tables.map((tbl) => {
          const isOccupied = tbl.status === 'occupied';

          return (
            <div
              key={tbl.id}
              className={`rounded-3xl border p-5 flex flex-col justify-between transition-all relative shadow-sm ${
                isOccupied
                  ? 'bg-white border-[#05268F] ring-1 ring-[#05268F]/20'
                  : 'bg-white border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-lg font-black text-[#101828]">{tbl.number}</h3>
                    <span className="text-xs text-[#667085] font-semibold">
                      Capacidad: {tbl.capacity} personas
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                      isOccupied
                        ? 'bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/30'
                        : 'bg-[#F4F6F8] text-[#667085] border border-zinc-200'
                    }`}
                  >
                    {isOccupied ? 'Ocupada' : 'Disponible'}
                  </span>
                </div>

                {isOccupied && tbl.active_session && (
                  <div className="space-y-2 py-2 border-y border-zinc-100 my-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Sesión Activa:</span>
                      <strong className="font-mono text-[#05268F]">#{tbl.active_session.id.slice(-6)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Atiende:</span>
                      <strong className="text-[#101828]">{tbl.assigned_waiter || tbl.active_session.server_id}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Comensales:</span>
                      <span className="font-bold text-[#101828]">{tbl.guests_count || tbl.active_session.guest_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Items en Marcha:</span>
                      <span className="font-bold text-[#101828]">{tbl.active_items_count} productos</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#667085]">Total Consumo</span>
                  <div className="text-base font-black text-[#101828]">
                    ${((tbl.total_cents || 0) / 100).toFixed(2)} MXN
                  </div>
                </div>

                {isOccupied ? (
                  <button
                    onClick={() => onSelectTable(tbl.id)}
                    className="px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white font-black text-xs shadow-xs transition"
                  >
                    Abrir Comanda &rarr;
                  </button>
                ) : (
                  <button
                    onClick={() => setOpeningTableId(tbl.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Abrir Mesa</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Open Table Modal */}
      {openingTableId && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenSubmit}
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-zinc-200 space-y-4"
          >
            <h4 className="text-base font-black text-[#101828]">
              Aperturar {tables.find((t) => t.id === openingTableId)?.number}
            </h4>

            <div>
              <label className="block text-xs font-bold text-[#101828] mb-1">Mesero Asignado</label>
              <input
                type="text"
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#101828] mb-1">
                Número de Comensales Iniciales
              </label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
              >
                <option value={1}>1 Comensal</option>
                <option value={2}>2 Comensales</option>
                <option value={3}>3 Comensales</option>
                <option value={4}>4 Comensales (Carlos 1, Carlos 2, Luis, Ana)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setOpeningTableId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-[#101828]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#FFD318] text-[#101828] shadow-xs"
              >
                Iniciar Sesión
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
