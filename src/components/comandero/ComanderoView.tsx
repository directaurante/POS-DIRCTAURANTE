/**
 * DIRECTAURANTE COMANDERO — Mobile & Tablet Fast Order Application
 * Designed for minimum taps, Double Carlos diner separation, persistent allergy guards,
 * one-tap comanda dispatch, and real-time READY item notifications.
 */

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, GuestSubaccount } from '../../core/types';
import {
  ChefHat,
  Tablet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Send,
  Plus,
  X,
  Clock,
  Printer,
  Bell,
  Trash2,
} from 'lucide-react';

interface ComanderoViewProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenKds?: () => void;
  onOpenDirectPrint?: () => void;
  onTriggerAllergyModal: (data: {
    guestSubaccount: GuestSubaccount;
    product: Product;
    conflicts: any[];
  }) => void;
  isEmbedded?: boolean;
}

interface StagedItem {
  id: string;
  guestSubaccount: GuestSubaccount;
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

export const ComanderoView: React.FC<ComanderoViewProps> = ({
  isOpen = true,
  onClose,
  onOpenKds,
  onOpenDirectPrint,
  onTriggerAllergyModal,
  isEmbedded = false,
}) => {
  const {
    tables,
    selectedTableId,
    selectedTableDetails,
    selectTable,
    products,
    kdsItems,
    addItemToSeat,
    updateItemStatus,
    printComanda,
  } = usePos();

  const [activeTableId, setActiveTableId] = useState<string>(selectedTableId || (tables.length > 0 ? tables[0].id : 'tbl_1'));
  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Platillos');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [activeNotes, setActiveNotes] = useState('');

  // Sync selectedTableId from external POS clicks
  React.useEffect(() => {
    if (selectedTableId) {
      setActiveTableId(selectedTableId);
    }
  }, [selectedTableId]);

  if (!isOpen && !isEmbedded) return null;

  const activeTable = tables.find((t) => t.id === activeTableId) || tables[0];
  const subaccounts: GuestSubaccount[] = selectedTableDetails?.subaccounts || [];
  const currentSeat = subaccounts.find((s) => s.id === selectedSeatId) || subaccounts[0];

  // Filter items in status 'ready' for this table (Ready Notification for Waiter)
  const readyItems = kdsItems.filter(
    (i) => i.preparation_status === 'ready' && i.table_number === activeTable?.number
  );

  const categories = ['Platillos', 'Bebidas', 'Entradas', 'Snacks', 'Postres'];

  const filteredProducts = products.filter(
    (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
  );

  const handleSelectTable = async (tableId: string) => {
    setActiveTableId(tableId);
    await selectTable(tableId);
  };

  const handleAddProductToStaging = (product: Product) => {
    if (!currentSeat) {
      alert('Selecciona un comensal primero.');
      return;
    }

    // Check allergy conflict
    const hasAllergy = currentSeat.allergy_ids && currentSeat.allergy_ids.includes('alg_cacahuate');
    if (hasAllergy && product.ingredient_ids.includes('ing_cacahuate')) {
      onTriggerAllergyModal({
        guestSubaccount: currentSeat,
        product,
        conflicts: [
          {
            allergy: { name: 'Alergia Grave a Cacahuate' },
            conflicting_ingredient: { name: 'Cacahuate' },
            product,
          },
        ],
      });
      return;
    }

    const newItem: StagedItem = {
      id: `staged_${Date.now()}_${Math.random()}`,
      guestSubaccount: currentSeat,
      product,
      quantity: 1,
      notes: activeNotes.trim() || undefined,
    };

    setStagedItems((prev) => [...prev, newItem]);
    setActiveNotes('');
  };

  const handleRemoveStagedItem = (id: string) => {
    setStagedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSendComanda = async () => {
    if (stagedItems.length === 0) return;
    try {
      for (const stg of stagedItems) {
        await addItemToSeat(
          activeTable.id,
          stg.guestSubaccount.id,
          stg.product.id,
          stg.quantity,
          stg.notes,
          false
        );
      }

      setStagedItems([]);
      alert(`¡Comanda enviada exitosamente a Cocina y Barra! Enrutada vía DirectPrint.`);
    } catch (err: any) {
      alert(err.message || 'Error al enviar comanda');
    }
  };

  const handleDeliverItem = async (itemId: string) => {
    try {
      await updateItemStatus(itemId, 'delivered', 'Entregado en mesa por mesero');
    } catch (err: any) {
      alert(err.message || 'Error al entregar');
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
      {/* Top Navigation Bar */}
      <div className="bg-[#05268F] border-b border-[#041E72] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#FFD318] text-[#05268F] font-black">
            <Tablet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Comandero Táctil — Directaurante</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                Tablet &amp; Mobile
              </span>
            </div>
            <p className="text-xs text-white/80">
              Mesa &rarr; Comensal (Doble Carlos) &rarr; Producto &rarr; Enviar (DirectPrint automático).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenKds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-[#FFD318] text-xs font-black border border-[#FFD318]/30 transition"
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>KDS Cocina/Barra</span>
          </button>

          <button
            onClick={onOpenDirectPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white text-xs font-bold transition"
          >
            <Printer className="w-3.5 h-3.5 text-[#FFD318]" />
            <span>DirectPrint</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Real-Time "Platillos Listos" Notification Bar */}
      {readyItems.length > 0 && (
        <div className="bg-emerald-600 px-4 py-2.5 flex items-center justify-between text-xs font-black shadow-md">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 animate-bounce text-[#FFD318]" />
            <span>
              ¡{readyItems.length} PLATILLO(S) LISTOS PARA SERVIR EN {activeTable?.number}!
            </span>
          </div>

          <div className="flex items-center gap-2">
            {readyItems.slice(0, 2).map((ri) => (
              <button
                key={ri.id}
                onClick={() => handleDeliverItem(ri.id)}
                className="px-3 py-1 rounded-xl bg-white text-emerald-900 font-extrabold hover:bg-emerald-50 transition shadow-xs"
              >
                Entregar {ri.quantity}x {ri.product_name} ({ri.seat_number})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#101828]">
        {/* Left Column: Table Selection + Diners Selection */}
        <div className="w-full md:w-64 bg-[#0a101d] border-r border-zinc-800 p-3 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                1. Seleccionar Mesa
              </span>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTable(t.id)}
                    className={`p-2.5 rounded-xl text-left border text-xs transition ${
                      activeTableId === t.id
                        ? 'bg-[#05268F] text-white border-[#FFD318] font-black shadow-xs'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-bold">{t.number}</div>
                    <div className="text-[10px] opacity-75">{t.status === 'occupied' ? 'Ocupada' : 'Libre'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Diners list (Double Carlos separation visible) */}
            <div className="pt-2 border-t border-zinc-800">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                2. Comensal Asignado (Doble Carlos)
              </span>
              <div className="space-y-1.5 mt-1.5">
                {subaccounts.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Mesa sin comensales activos.</p>
                ) : (
                  subaccounts.map((seat) => {
                    const isSelected = (currentSeat?.id || '') === seat.id;
                    const hasAllergy = seat.allergy_ids && seat.allergy_ids.length > 0;

                    return (
                      <button
                        key={seat.id}
                        onClick={() => setSelectedSeatId(seat.id)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between border text-xs transition ${
                          isSelected
                            ? 'bg-[#FFD318] text-[#101828] border-[#FFD318] font-black shadow-md ring-2 ring-white/20'
                            : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono opacity-80">[{seat.seat_number}]</span>
                          <span className="font-bold">{seat.display_name}</span>
                        </div>

                        {hasAllergy && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Alergia
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 mt-3">
            Atendiendo en: <strong className="text-white">{activeTable?.number}</strong>
          </div>
        </div>

        {/* Center: Products Catalog & Fast Buttons */}
        <div className="flex-1 flex flex-col bg-[#101828] overflow-hidden p-3 sm:p-4">
          {/* Persistent Allergy Guard Banner */}
          {currentSeat && currentSeat.allergy_ids && currentSeat.allergy_ids.includes('alg_cacahuate') && (
            <div className="bg-rose-950/80 border border-rose-500 rounded-2xl p-2.5 px-3 mb-3 flex items-center gap-2 text-xs font-black text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                🚨 ALERTA ACTIVA: Comensal [{currentSeat.seat_number}] {currentSeat.display_name} tiene ALERGIA GRAVE A CACAHUATE.
              </span>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar border-b border-zinc-800">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Notes input for next item */}
          <div className="py-2.5 flex items-center gap-2">
            <input
              type="text"
              value={activeNotes}
              onChange={(e) => setActiveNotes(e.target.value)}
              placeholder="Nota rápida para el platillo (ej. 'Sin cebolla', 'Término medio')..."
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 font-medium"
            />
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto flex-1 pr-1">
            {filteredProducts.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleAddProductToStaging(prod)}
                className="p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-[#FFD318] text-left transition flex flex-col justify-between h-28 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-black text-white group-hover:text-[#FFD318] transition line-clamp-2">
                      {prod.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        prod.destination_station === 'bar'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-[#05268F] text-[#FFD318]'
                      }`}
                    >
                      {prod.destination_station === 'bar' ? 'Barra' : 'Cocina'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                  <span className="text-xs font-black text-zinc-300">
                    ${(prod.price_cents / 100).toFixed(2)}
                  </span>
                  <span className="w-6 h-6 rounded-lg bg-[#FFD318] text-[#101828] flex items-center justify-center font-black text-xs group-hover:scale-110 transition">
                    +
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Comanda Staging Drawer ("Comanda por Enviar") */}
        <div className="w-full md:w-80 bg-[#0a101d] border-t md:border-t-0 md:border-l border-zinc-800 p-3 sm:p-4 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                Comanda por Enviar ({stagedItems.length})
              </h3>
              <span className="text-[10px] font-mono text-[#FFD318]">DirectPrint Ready</span>
            </div>

            <div className="divide-y divide-zinc-800/80 max-h-72 overflow-y-auto mt-2">
              {stagedItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  Toca productos para preparar la ronda.
                </div>
              ) : (
                stagedItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#05268F] text-[#FFD318] font-bold">
                          [{item.guestSubaccount.seat_number}]
                        </span>
                        <span className="text-xs font-bold text-white">{item.product.name}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Para: {item.guestSubaccount.display_name}
                      </div>
                      {item.notes && (
                        <p className="text-[10px] text-[#FFD318] italic mt-0.5">"{item.notes}"</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveStagedItem(item.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 space-y-2 mt-2">
            <button
              onClick={handleSendComanda}
              disabled={stagedItems.length === 0}
              className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md ${
                stagedItems.length > 0
                  ? 'bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828]'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>ENVIAR COMANDA A PRODUCCION (1 TAP)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
