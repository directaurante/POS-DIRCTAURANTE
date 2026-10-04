/**
 * DIRECTAURANTE — Unified Gastronomic Management System
 * POS Salón · Comandero Táctil · KDS Multicocina · Caja & Turnos · DirectPrint Nativo · DirectImport · Auditoría Inmutable
 *
 * Integrated workstation uniting all operational modules in a single seamless application.
 */

import React, { useState } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { TableMapView } from './components/pos/TableMapView';
import { QuickOrderView } from './components/pos/QuickOrderView';
import { BillModal } from './components/pos/BillModal';
import { AllergyWarningModal } from './components/pos/AllergyWarningModal';
import { ComanderoView } from './components/comandero/ComanderoView';
import { KdsView } from './components/kds/KdsView';
import { CashModal } from './components/cash/CashModal';
import { DirectPrintManagerModal } from './components/directprint/DirectPrintManagerModal';
import { ThermalTicketPreviewModal } from './components/directprint/ThermalTicketPreviewModal';
import { AuditModal } from './components/audit/AuditModal';
import { DirectImportModal } from './components/import/DirectImportModal';
import {
  UtensilsCrossed,
  Tablet,
  ChefHat,
  Banknote,
  Printer,
  Shield,
  RotateCcw,
  UploadCloud,
  LayoutGrid,
  Bell,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Product, GuestSubaccount } from './core/types';

export type ActiveView = 'salon' | 'comandero' | 'kds' | 'caja' | 'directprint' | 'import' | 'audit';

function MainLayout() {
  const {
    tables,
    selectedTableId,
    selectTable,
    addItemToSeat,
    refreshAll,
    kdsItems,
    currentShift,
    printJobs,
    openThermalPreview,
    loadCanonicalScenario,
  } = usePos();

  // Primary active workspace view
  const [activeView, setActiveView] = useState<ActiveView>('salon');

  // Focused modals state
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  // Allergy warning modal state
  const [allergyModalData, setAllergyModalData] = useState<{
    isOpen: boolean;
    guestSubaccount: GuestSubaccount | null;
    product: Product | null;
    conflicts: any[];
  }>({
    isOpen: false,
    guestSubaccount: null,
    product: null,
    conflicts: [],
  });

  const handleTriggerAllergyModal = (data: {
    guestSubaccount: GuestSubaccount;
    product: Product;
    conflicts: any[];
  }) => {
    setAllergyModalData({
      isOpen: true,
      guestSubaccount: data.guestSubaccount,
      product: data.product,
      conflicts: data.conflicts,
    });
  };

  const handleConfirmAllergyOverride = async (supervisorName: string, reason: string) => {
    if (!allergyModalData.guestSubaccount || !allergyModalData.product || !selectedTableId) return;

    try {
      await addItemToSeat(
        selectedTableId,
        allergyModalData.guestSubaccount.id,
        allergyModalData.product.id,
        1,
        `AUTORIZADO: ${reason}`,
        true
      );
      setAllergyModalData({ isOpen: false, guestSubaccount: null, product: null, conflicts: [] });
    } catch (err: any) {
      alert(err.message || 'Error al autorizar');
    }
  };

  // Kitchen items metrics
  const activeKdsCount = kdsItems.filter(
    (i) => i.preparation_status !== 'delivered' && i.preparation_status !== 'cancelled'
  ).length;

  // Waiter ready items count
  const readyItems = kdsItems.filter((i) => i.preparation_status === 'ready');

  // Shift status
  const isShiftOpen = Boolean(currentShift && currentShift.shift && currentShift.shift.status === 'open');

  // Most recent print job for quick preview
  const lastPrintJob = printJobs.length > 0 ? printJobs[0] : null;

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#101828] flex flex-col font-sans">
      {/* Top Navbar adhering to Directaurante visual identity */}
      <header className="bg-[#05268F] text-white px-3 sm:px-6 py-3 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => setActiveView('salon')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#FFD318] text-[#05268F] flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tight text-white">DIRECTAURANTE</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#FFD318] text-[#101828]">
                    Unificado
                  </span>
                </div>
                <p className="text-[11px] text-white/80 font-medium">
                  POS · Comandero · KDS · Caja · DirectPrint · DirectImport
                </p>
              </div>
            </div>

            {/* Mobile Ready Items Alert */}
            {readyItems.length > 0 && (
              <button
                onClick={() => setActiveView('comandero')}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-black animate-pulse"
              >
                <Bell className="w-3.5 h-3.5 text-[#FFD318]" />
                <span>{readyItems.length} listos</span>
              </button>
            )}
          </div>

          {/* Module Navigation Tabs (Conjugated Unified Workstation) */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1">
            {/* Salón / Mesas */}
            <button
              onClick={() => setActiveView('salon')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
                activeView === 'salon'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Mapa de Mesas y Salón POS"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Salón</span>
            </button>

            {/* Comandero Táctil */}
            <button
              onClick={() => setActiveView('comandero')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition relative whitespace-nowrap ${
                activeView === 'comandero'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Comandero táctil para meseros en tablets y móviles"
            >
              <Tablet className="w-4 h-4" />
              <span>Comandero</span>
              {readyItems.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                  {readyItems.length}
                </span>
              )}
            </button>

            {/* KDS Multicocina */}
            <button
              onClick={() => setActiveView('kds')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition relative whitespace-nowrap ${
                activeView === 'kds'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Pantalla KDS de producción para cocina y barra"
            >
              <ChefHat className="w-4 h-4" />
              <span>KDS</span>
              {activeKdsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {activeKdsCount}
                </span>
              )}
            </button>

            {/* Caja & Turnos */}
            <button
              onClick={() => setActiveView('caja')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
                activeView === 'caja'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Apertura, movimientos, arqueos ciegos y corte Z"
            >
              <Banknote className="w-4 h-4" />
              <span>Caja</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isShiftOpen ? 'bg-emerald-400' : 'bg-zinc-400'
                }`}
              />
            </button>

            {/* DirectPrint */}
            <button
              onClick={() => setActiveView('directprint')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
                activeView === 'directprint'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Configuración de impresoras térmicas ESC/POS y enrutamiento"
            >
              <Printer className="w-4 h-4" />
              <span>DirectPrint</span>
            </button>

            {/* DirectImport */}
            <button
              onClick={() => setActiveView('import')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
                activeView === 'import'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Migración de menús desde SoftRestaurant, Toast o Excel"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">DirectImport</span>
            </button>

            {/* Auditoría */}
            <button
              onClick={() => setActiveView('audit')}
              className={`p-2 rounded-xl transition ${
                activeView === 'audit'
                  ? 'bg-[#FFD318] text-[#101828] shadow-sm'
                  : 'bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10'
              }`}
              title="Bitácora de auditoría inmutable"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Quick Thermal Slip Viewer Action */}
            {lastPrintJob && (
              <button
                onClick={() => openThermalPreview(lastPrintJob)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFD318] text-xs font-bold transition whitespace-nowrap"
                title="Ver último ticket térmico emitido"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Último Ticket</span>
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => refreshAll()}
              className="p-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white/90 border border-white/10 transition"
              title="Refrescar base de datos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Operational Notification Bar */}
        {readyItems.length > 0 && (
          <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-[#041E72]/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-[#FFD318]">
                ¡Atención Meseros! Hay {readyItems.length} platillo(s) listo(s) para entregar en cocina/barra:
              </span>
              <span className="text-white font-medium hidden sm:inline">
                {readyItems.slice(0, 3).map((ri) => `${ri.table_number} (${ri.product_name})`).join(', ')}
              </span>
            </div>
            <button
              onClick={() => setActiveView('comandero')}
              className="px-3 py-1 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs transition shadow-xs"
            >
              Ir a Comandero &rarr;
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Body (Seamless View Rendering) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col">
        {/* VIEW 1: SALÓN / MESAS (POS) */}
        {activeView === 'salon' && (
          <div className="flex-1 flex flex-col">
            {selectedTableId ? (
              <QuickOrderView
                onBack={() => selectTable(null)}
                onOpenBill={() => setIsBillModalOpen(true)}
                onOpenComandero={() => setActiveView('comandero')}
                onTriggerAllergyModal={handleTriggerAllergyModal}
              />
            ) : (
              <TableMapView
                onSelectTable={(id) => selectTable(id)}
                onOpenComandero={() => setActiveView('comandero')}
              />
            )}
          </div>
        )}

        {/* VIEW 2: COMANDERO TÁCTIL (INTEGRATED) */}
        {activeView === 'comandero' && (
          <div className="flex-1 flex flex-col">
            <ComanderoView
              isEmbedded
              onClose={() => setActiveView('salon')}
              onOpenKds={() => setActiveView('kds')}
              onOpenDirectPrint={() => setActiveView('directprint')}
              onTriggerAllergyModal={handleTriggerAllergyModal}
            />
          </div>
        )}

        {/* VIEW 3: KDS MULTICOCINA (INTEGRATED) */}
        {activeView === 'kds' && (
          <div className="flex-1 flex flex-col">
            <KdsView
              isEmbedded
              onClose={() => setActiveView('salon')}
              onOpenDirectPrint={() => setActiveView('directprint')}
            />
          </div>
        )}

        {/* VIEW 4: CAJA & TURNOS (INTEGRATED) */}
        {activeView === 'caja' && (
          <div className="flex-1 flex flex-col">
            <CashModal isEmbedded onClose={() => setActiveView('salon')} />
          </div>
        )}

        {/* VIEW 5: DIRECTPRINT (INTEGRATED) */}
        {activeView === 'directprint' && (
          <div className="flex-1 flex flex-col">
            <DirectPrintManagerModal isEmbedded onClose={() => setActiveView('salon')} />
          </div>
        )}

        {/* VIEW 6: DIRECTIMPORT (INTEGRATED) */}
        {activeView === 'import' && (
          <div className="flex-1 flex flex-col">
            <DirectImportModal isEmbedded onClose={() => setActiveView('salon')} />
          </div>
        )}

        {/* VIEW 7: AUDITORÍA INMUTABLE (INTEGRATED) */}
        {activeView === 'audit' && (
          <div className="flex-1 flex flex-col">
            <AuditModal isEmbedded onClose={() => setActiveView('salon')} />
          </div>
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer className="bg-white border-t border-zinc-200 py-2.5 px-4 text-xs text-[#667085] shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="font-semibold text-[#101828]">Directaurante Core v0.5.0 Activo</span>
            <span>·</span>
            <span>SDK Unificado</span>
            <span>·</span>
            <span>ESC/POS Multi-estación</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadCanonicalScenario}
              className="flex items-center gap-1 text-[#05268F] hover:underline font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cargar Mesa 1 (Doble Carlos)</span>
            </button>
            <span>·</span>
            <div>
              Turno Caja:{' '}
              <strong className="text-[#101828]">
                {currentShift && currentShift.shift ? `Abierto (${currentShift.shift.opened_by})` : 'Cerrado'}
              </strong>
            </div>
          </div>
        </div>
      </footer>

      {/* Focused Modals (Settlement & Security) */}
      {selectedTableId && isBillModalOpen && (
        <BillModal
          isOpen={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          tableId={selectedTableId}
        />
      )}

      {allergyModalData.isOpen && (
        <AllergyWarningModal
          isOpen={allergyModalData.isOpen}
          onClose={() =>
            setAllergyModalData({ isOpen: false, guestSubaccount: null, product: null, conflicts: [] })
          }
          guestSubaccount={allergyModalData.guestSubaccount}
          product={allergyModalData.product}
          conflicts={allergyModalData.conflicts}
          onConfirmOverride={handleConfirmAllergyOverride}
        />
      )}

      {/* Real-time Thermal Slip Simulator Modal */}
      <ThermalTicketPreviewModal />
    </div>
  );
}

export default function App() {
  return (
    <PosProvider>
      <MainLayout />
    </PosProvider>
  );
}
