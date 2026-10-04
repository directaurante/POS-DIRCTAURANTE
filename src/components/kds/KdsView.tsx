/**
 * DIRECTAURANTE KDS — Kitchen Display System (Interactive Multistation)
 * Live production queues for Kitchen and Bar with SLA traffic lights,
 * real timers, and strict OrderItem lifecycle.
 */

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { KdsItemView } from '../../modules/kds/kdsService';
import {
  ChefHat,
  Wine,
  Clock,
  Flame,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Printer,
  X,
  RotateCcw,
} from 'lucide-react';

interface KdsViewProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDirectPrint?: () => void;
  isEmbedded?: boolean;
}

export const KdsView: React.FC<KdsViewProps> = ({
  isOpen = true,
  onClose,
  onOpenDirectPrint,
  isEmbedded = false,
}) => {
  const { kdsItems, updateItemStatus, refreshAll, printComanda } = usePos();
  const [stationFilter, setStationFilter] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!isOpen && !isEmbedded) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [isOpen, isEmbedded]);

  if (!isOpen && !isEmbedded) return null;

  const filteredItems = kdsItems.filter((i) => {
    if (stationFilter === 'all') return true;
    return i.destination_station === stationFilter;
  });

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleAdvanceStatus = async (item: KdsItemView) => {
    try {
      if (item.preparation_status === 'pending') {
        await updateItemStatus(item.id, 'preparing', 'Iniciado en KDS');
      } else if (item.preparation_status === 'preparing') {
        await updateItemStatus(item.id, 'ready', 'Platillo terminado en KDS');
      } else if (item.preparation_status === 'ready') {
        await updateItemStatus(item.id, 'delivered', 'Entregado a comensal');
      }
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado');
    }
  };

  const handleReprintComanda = async (orderId: string, station: 'kitchen' | 'bar') => {
    try {
      await printComanda(orderId, station);
      alert('Comanda reenviada a la impresora térmica.');
    } catch (err: any) {
      alert(err.message || 'Error al reimprimir comanda');
    }
  };

  return (
    <div
      className={
        isEmbedded
          ? 'w-full flex-1 flex flex-col bg-[#101828] text-white rounded-3xl overflow-hidden shadow-xl border border-zinc-800 min-h-[750px]'
          : 'fixed inset-0 z-50 bg-[#101828] text-white flex flex-col overflow-hidden animate-in fade-in duration-150'
      }
    >
      {/* Top Header */}
      <div className="bg-[#05268F] border-b border-[#041E72] p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#FFD318] text-[#05268F] font-black">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">
                KDS — Pantalla de Producción
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                Directaurante KDS
              </span>
            </div>
            <p className="text-xs text-white/80">
              Unidad operativa: OrderItem. Enrutamiento automático a cocina y barra.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStationFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              stationFilter === 'all'
                ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                : 'bg-[#041E72] text-white/90 hover:bg-[#031758]'
            }`}
          >
            Todas ({kdsItems.length})
          </button>
          <button
            onClick={() => setStationFilter('kitchen')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              stationFilter === 'kitchen'
                ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                : 'bg-[#041E72] text-white/90 hover:bg-[#031758]'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Cocina ({kdsItems.filter((i) => i.destination_station === 'kitchen').length})</span>
          </button>
          <button
            onClick={() => setStationFilter('bar')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              stationFilter === 'bar'
                ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                : 'bg-[#041E72] text-white/90 hover:bg-[#031758]'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            <span>Barra ({kdsItems.filter((i) => i.destination_station === 'bar').length})</span>
          </button>

          {onOpenDirectPrint && (
            <button
              onClick={onOpenDirectPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white text-xs font-bold transition ml-1"
            >
              <Printer className="w-3.5 h-3.5 text-[#FFD318]" />
              <span>DirectPrint</span>
            </button>
          )}

          <button
            onClick={() => refreshAll()}
            className="p-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white ml-1 transition"
            title="Refrescar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#101828]">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center">
            <CheckCircle className="w-12 h-12 text-zinc-700 mb-2" />
            <h3 className="text-lg font-bold text-zinc-400">¡Línea de producción despejada!</h3>
            <p className="text-xs text-zinc-600">No hay órdenes pendientes en esta estación.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const isOverdue = item.is_overdue;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between h-56 transition shadow-md ${
                    isOverdue
                      ? 'bg-rose-950/60 border-rose-500 text-rose-100 ring-1 ring-rose-500'
                      : item.preparation_status === 'ready'
                      ? 'bg-emerald-950/50 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50'
                      : item.preparation_status === 'preparing'
                      ? 'bg-[#041E72]/40 border-[#05268F] text-blue-100 ring-1 ring-[#05268F]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black px-2 py-0.5 rounded bg-[#05268F] text-white font-mono">
                          {item.table_number}
                        </span>
                        {/* Double Carlos identity separation strictly via seat_number and guest_name */}
                        <span className="text-xs font-bold text-zinc-200">
                          {item.seat_number} — {item.guest_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReprintComanda(item.order_id, item.destination_station)}
                          className="p-1 rounded text-zinc-400 hover:text-white"
                          title="Imprimir comanda térmica"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.destination_station === 'bar'
                              ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                              : 'bg-[#05268F]/80 text-[#FFD318] border border-[#FFD318]/40'
                          }`}
                        >
                          {item.destination_station === 'bar' ? 'Barra' : 'Cocina'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-lg font-black tracking-tight text-white">
                        {item.quantity}x {item.product_name}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-[#FFD318] font-medium italic mt-0.5">
                          Nota: "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Transcurrido:</span>
                        <strong className={isOverdue ? 'text-rose-400 font-black' : 'text-zinc-200'}>
                          {formatElapsed(item.elapsed_seconds)}
                        </strong>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${item.traffic_light_color}`}
                      >
                        {isOverdue ? (
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                        ) : item.preparation_status === 'preparing' ? (
                          <Flame className="w-3 h-3 text-[#05268F]" />
                        ) : (
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{item.traffic_light_label}</span>
                      </span>
                    </div>

                    <button
                      onClick={() => handleAdvanceStatus(item)}
                      className={`w-full py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm ${
                        item.preparation_status === 'pending'
                          ? 'bg-[#05268F] hover:bg-[#041E72] text-white font-bold'
                          : item.preparation_status === 'preparing'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-black'
                          : 'bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black'
                      }`}
                    >
                      {item.preparation_status === 'pending' && <span>Comenzar (Preparing)</span>}
                      {item.preparation_status === 'preparing' && <span>Marcar Listo (Ready)</span>}
                      {item.preparation_status === 'ready' && <span>Entregar (Delivered)</span>}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
