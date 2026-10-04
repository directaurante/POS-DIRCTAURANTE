/**
 * DIRECTAURANTE POS CORE — Quick Order & Table Service View
 * High-speed POS station view with DirectPrint comanda & pre-bill buttons,
 * seat switching, and allergy alerts.
 */

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, GuestSubaccount, OrderItemStatus } from '../../core/types';
import {
  ArrowLeft,
  Receipt,
  Printer,
  Plus,
  AlertTriangle,
  Clock,
  Flame,
  Check,
  CheckCircle2,
  XCircle,
  Trash2,
  Tablet,
} from 'lucide-react';

interface QuickOrderViewProps {
  onBack: () => void;
  onOpenBill: () => void;
  onOpenComandero?: () => void;
  onTriggerAllergyModal: (data: {
    guestSubaccount: GuestSubaccount;
    product: Product;
    conflicts: any[];
  }) => void;
}

export const QuickOrderView: React.FC<QuickOrderViewProps> = ({
  onBack,
  onOpenBill,
  onOpenComandero,
  onTriggerAllergyModal,
}) => {
  const {
    selectedTableDetails,
    products,
    addGuest,
    createOrderTicket,
    addItemToSeat,
    updateItemStatus,
    removeOrderItem,
    printComanda,
    printPreBill,
  } = usePos();

  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [newGuestName, setNewGuestName] = useState('');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [selectedAllergiesForNewGuest, setSelectedAllergiesForNewGuest] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState<{ [productId: string]: string }>({});

  if (!selectedTableDetails) {
    return (
      <div className="p-8 text-center text-[#667085]">
        <p>No hay mesa seleccionada.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#05268F] text-white font-bold rounded-xl text-sm"
        >
          Volver al Mapa de Mesas
        </button>
      </div>
    );
  }

  const { table, session, subaccounts, orders, items } = selectedTableDetails;
  const currentSeat = subaccounts.find((s: any) => s.id === selectedSeatId) || subaccounts[0];

  const categories = ['Todos', 'Platillos', 'Bebidas', 'Entradas', 'Postres', 'Snacks'];

  const filteredProducts =
    selectedCategory === 'Todos'
      ? products
      : products.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());

  const handleProductClick = async (product: Product) => {
    if (!currentSeat) return;

    try {
      const res = await addItemToSeat(
        table.id,
        currentSeat.id,
        product.id,
        1,
        itemNotes[product.id] || undefined,
        false
      );

      if (res.allergy_warning) {
        onTriggerAllergyModal({
          guestSubaccount: currentSeat,
          product,
          conflicts: res.conflicts || [],
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error al agregar producto');
    }
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;
    const seat = await addGuest(table.id, newGuestName, selectedAllergiesForNewGuest);
    setSelectedSeatId(seat.id);
    setNewGuestName('');
    setSelectedAllergiesForNewGuest([]);
    setShowAddGuestModal(false);
  };

  const handlePrintCurrentComanda = async () => {
    const latestOrder = orders[orders.length - 1];
    if (!latestOrder) {
      alert('No hay comanda activa para imprimir.');
      return;
    }
    try {
      await printComanda(latestOrder.id);
    } catch (err: any) {
      alert(err.message || 'Error al imprimir comanda');
    }
  };

  const handlePrintPreBill = async () => {
    if (!session) return;
    try {
      await printPreBill(session.id);
    } catch (err: any) {
      alert(err.message || 'Error al imprimir pre-cuenta');
    }
  };

  const getItemStatusBadge = (status: OrderItemStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendiente', bg: 'bg-[#F4F6F8] text-[#667085] border-zinc-200', icon: Clock };
      case 'preparing':
        return { label: 'Preparando', bg: 'bg-[#EAF0FF] text-[#05268F] border-[#05268F]/30', icon: Flame };
      case 'ready':
        return { label: '¡Listo!', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: Check };
      case 'delivered':
        return { label: 'Entregado', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200', icon: CheckCircle2 };
      case 'cancelled':
      default:
        return { label: 'Cancelado', bg: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle };
    }
  };

  const tableTotalCents = items
    .filter((i: any) => i.preparation_status !== 'cancelled')
    .reduce((acc: number, i: any) => acc + i.total_price_cents, 0);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 flex flex-col h-[calc(100vh-100px)]">
      {/* Top action bar */}
      <div className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#F4F6F8] hover:bg-zinc-200 text-[#101828] transition"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#101828] tracking-tight">{table.number}</h2>
              {session && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFF7D6] text-[#101828] border border-[#FFD318]">
                  Sesión #{session.id.slice(-6)}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
                {subaccounts.length} Comensales
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right pr-2">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Total Sesión</span>
            <div className="text-lg font-black text-[#101828] leading-none">
              ${(tableTotalCents / 100).toFixed(2)} MXN
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const ticket = await createOrderTicket(table.id);
                alert(`Nueva ${ticket.ticket_number} creada.`);
              } catch (err: any) {
                alert(err.message || 'Error al aperturar comanda');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#05268F]/30 hover:bg-[#EAF0FF] text-[#05268F] font-bold text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Comanda</span>
          </button>

          {onOpenComandero && (
            <button
              onClick={onOpenComandero}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs shadow-xs transition"
              title="Abrir esta mesa directamente en el Comandero Táctil"
            >
              <Tablet className="w-3.5 h-3.5 text-[#05268F]" />
              <span className="hidden sm:inline">Modo Comandero</span>
            </button>
          )}

          {/* DirectPrint Comanda Button */}
          <button
            onClick={handlePrintCurrentComanda}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-[#FFD318] font-black text-xs shadow-xs transition"
            title="Imprimir comanda a impresoras de producción (DirectPrint)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Comanda</span>
          </button>

          {/* DirectPrint Pre-bill Button */}
          <button
            onClick={handlePrintPreBill}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4F6F8] hover:bg-zinc-200 text-[#101828] font-bold text-xs border border-zinc-300 transition"
            title="Imprimir estado de cuenta preliminar"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Pre-cuenta</span>
          </button>

          <button
            onClick={onOpenBill}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs shadow-xs transition"
          >
            <span>Cobrar / Liquidar</span>
          </button>
        </div>
      </div>

      {/* Subaccounts bar (Guarantees Double Carlos separation) */}
      <div className="bg-[#05268F] rounded-2xl p-3 shadow-md mb-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-white/80 uppercase tracking-wider shrink-0 pl-1">
            Comensal:
          </span>

          {subaccounts.map((seat: any) => {
            const isSelected = (currentSeat?.id || '') === seat.id;
            const seatItems = items.filter(
              (i: any) => i.guest_subaccount_id === seat.id && i.preparation_status !== 'cancelled'
            );
            const seatTotalCents = seatItems.reduce((acc: number, i: any) => acc + i.total_price_cents, 0);
            const hasAllergy = seat.allergy_ids && seat.allergy_ids.length > 0;

            return (
              <button
                key={seat.id}
                onClick={() => setSelectedSeatId(seat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 border ${
                  isSelected
                    ? 'bg-[#FFD318] text-[#101828] border-[#FFD318] shadow-md ring-2 ring-white/50 font-black'
                    : 'bg-[#041E72] text-white border-white/20 hover:bg-[#031758]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="opacity-80 font-mono">[{seat.seat_number}]</span>
                  <span>{seat.display_name}</span>
                </div>

                {hasAllergy && (
                  <span className="p-0.5 rounded-full bg-rose-600 text-white font-black" title="Alergia">
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}

                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    isSelected ? 'bg-[#101828] text-white' : 'bg-white/15 text-white/90'
                  }`}
                >
                  ${(seatTotalCents / 100).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowAddGuestModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-[#FFD318] text-xs font-extrabold border border-white/20 transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Comensal</span>
        </button>
      </div>

      {/* Main Grid: Products Catalog & Ticket by Diner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left: Products */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-zinc-200 p-4 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto no-scrollbar border-b border-zinc-100">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#05268F] text-white shadow-sm'
                    : 'bg-[#F4F6F8] text-[#667085] hover:bg-[#EAF0FF] hover:text-[#05268F]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="py-2 px-1 text-xs text-[#667085] flex items-center justify-between">
            <span>
              Ordenando para:{' '}
              <strong className="text-[#05268F] font-black">
                {currentSeat ? `[${currentSeat.seat_number}] ${currentSeat.display_name}` : 'Ninguno'}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto flex-1 pr-1">
            {filteredProducts.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleProductClick(prod)}
                className="group p-3 rounded-2xl border border-zinc-200 hover:border-[#05268F] hover:bg-[#EAF0FF]/25 text-left transition flex flex-col justify-between h-28 relative bg-white shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-black text-[#101828] group-hover:text-[#05268F] transition line-clamp-2">
                      {prod.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                        prod.destination_station === 'bar' ? 'bg-purple-100 text-purple-800' : 'bg-[#EAF0FF] text-[#05268F]'
                      }`}
                    >
                      {prod.destination_station === 'bar' ? 'Barra' : 'Cocina'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#667085] line-clamp-1 mt-0.5">{prod.description}</p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                  <span className="text-sm font-black text-[#101828]">
                    ${(prod.price_cents / 100).toFixed(2)}
                  </span>
                  <span className="w-6 h-6 rounded-lg bg-[#FFD318] text-[#101828] flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition">
                    +
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Items grouped by diner with strict state machine & cancellation */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-zinc-200 p-4 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-black text-[#101828]">Comanda Activa por Comensal</h3>
            <span className="text-xs text-[#667085] font-semibold">{items.length} productos</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 pr-1 mt-1">
            {subaccounts.map((seat: any) => {
              const seatItems = items.filter((i: any) => i.guest_subaccount_id === seat.id);
              const seatTotalCents = seatItems
                .filter((i: any) => i.preparation_status !== 'cancelled')
                .reduce((acc: number, i: any) => acc + i.total_price_cents, 0);

              return (
                <div key={seat.id} className="py-2.5 first:pt-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-[#05268F] text-white">
                        [{seat.seat_number}]
                      </span>
                      <span className="font-black text-sm text-[#101828]">{seat.display_name}</span>
                    </div>
                    <span className="text-xs font-black text-[#101828]">${(seatTotalCents / 100).toFixed(2)}</span>
                  </div>

                  {seatItems.length === 0 ? (
                    <p className="text-xs text-[#667085] italic pl-6">Sin productos ordenados.</p>
                  ) : (
                    <div className="space-y-1.5 pl-1">
                      {seatItems.map((item: any) => {
                        const statusBadge = getItemStatusBadge(item.preparation_status);
                        const StatusIcon = statusBadge.icon;

                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-2xl border text-xs flex flex-col gap-1.5 transition ${
                              item.preparation_status === 'cancelled'
                                ? 'bg-[#F4F6F8] opacity-60 border-zinc-200'
                                : 'bg-white border-zinc-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-bold text-[#101828]">
                                  {item.quantity}x {item.product_name}
                                </span>
                                {item.notes && <p className="text-[10px] text-[#667085] italic mt-0.5">"{item.notes}"</p>}
                              </div>
                              <span className="font-black text-[#101828]">
                                ${(item.total_price_cents / 100).toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.bg}`}>
                                <StatusIcon className="w-3 h-3" />
                                <span>{statusBadge.label}</span>
                              </span>

                              {item.preparation_status !== 'cancelled' && item.preparation_status !== 'delivered' && (
                                <div className="flex items-center gap-1">
                                  {item.preparation_status === 'pending' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'preparing', 'Iniciado')}
                                      className="px-2 py-0.5 rounded bg-[#05268F] text-white font-bold text-[10px]"
                                    >
                                      Preparar
                                    </button>
                                  )}
                                  {item.preparation_status === 'preparing' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'ready', 'Listo')}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]"
                                    >
                                      Listo
                                    </button>
                                  )}
                                  {item.preparation_status === 'ready' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'delivered', 'Entregado')}
                                      className="px-2.5 py-0.5 rounded bg-[#FFD318] text-[#101828] font-black text-[10px]"
                                    >
                                      Entregar
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      const reason = prompt('Razón obligatoria de cancelación:');
                                      if (reason) {
                                        try {
                                          await removeOrderItem(item.id, reason);
                                        } catch (err: any) {
                                          alert(err.message);
                                        }
                                      }
                                    }}
                                    className="p-1 rounded text-rose-600 hover:bg-rose-50"
                                    title="Cancelar con justificación"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add guest modal */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateGuest} className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border">
            <h4 className="text-base font-black text-[#101828] mb-3">Agregar Comensal a la Mesa</h4>
            <input
              type="text"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder="Nombre del comensal"
              className="w-full px-3 py-2 rounded-xl border text-sm mb-3 font-semibold text-[#101828]"
              required
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddGuestModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-[#FFD318] text-[#101828]"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
