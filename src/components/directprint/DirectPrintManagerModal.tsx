/**
 * DIRECTAURANTE DIRECTPRINT — Thermal Print Manager Modal
 * Configures printers, multi-station routing, test prints, and print jobs history.
 */

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Printer as PrinterIcon, Plus, Eye, RotateCcw, Check, Trash2, X, Sliders } from 'lucide-react';
import { Printer, PrinterStation, PrinterConnectionType, PrintJobType } from '../../core/types';

interface DirectPrintManagerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const DirectPrintManagerModal: React.FC<DirectPrintManagerModalProps> = ({
  isOpen = true,
  onClose,
  isEmbedded = false,
}) => {
  const {
    printers,
    routingRules,
    printJobs,
    addPrinter,
    deletePrinter,
    setRoutingRule,
    testPrinter,
    openThermalPreview,
    reprintJob,
  } = usePos();

  const [activeTab, setActiveTab] = useState<'printers' | 'routing' | 'jobs'>('printers');
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);

  // New printer form state
  const [name, setName] = useState('');
  const [station, setStation] = useState<PrinterStation>('kitchen');
  const [paperWidth, setPaperWidth] = useState<80 | 58>(80);
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>('ethernet');
  const [address, setAddress] = useState('192.168.1.205');
  const [port, setPort] = useState(9100);

  if (!isOpen && !isEmbedded) return null;

  const handleCreatePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await addPrinter({
        restaurant_id: 'rest_directaurante_01',
        name: name.trim(),
        station,
        paper_width: paperWidth,
        connection_type: connectionType,
        address: address.trim(),
        port: Number(port) || 9100,
        protocol: 'esc_pos',
        enabled: true,
        status: 'online',
      });
      setName('');
      setShowAddPrinterModal(false);
    } catch (err: any) {
      alert(err.message || 'Error al agregar impresora');
    }
  };

  const handleTestPrint = async (printerId: string) => {
    try {
      await testPrinter(printerId);
    } catch (err: any) {
      alert(err.message || 'Error al emitir ticket de prueba');
    }
  };

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
            <PrinterIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">DirectPrint — Centro de Impresión</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                Fase 5 Oficial
              </span>
            </div>
            <p className="text-xs text-white/80">
              Impresoras térmicas ESC/POS, enrutamiento a cocina/barra y tickets de corte.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Tab selection */}
        <div className="flex items-center gap-1 p-2 bg-[#F4F6F8] border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('printers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'printers'
                ? 'bg-white text-[#05268F] shadow-xs font-black'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            <PrinterIcon className="w-4 h-4" />
            <span>Impresoras Configuradas ({printers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('routing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'routing'
                ? 'bg-white text-[#05268F] shadow-xs font-black'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Reglas de Enrutamiento ({routingRules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'jobs'
                ? 'bg-white text-[#05268F] shadow-xs font-black'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Historial de Trabajos ({printJobs.length})</span>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 bg-white">
          {activeTab === 'printers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div>
                  <h3 className="text-base font-black text-[#101828]">Impresoras Térmicas Activas</h3>
                  <p className="text-xs text-[#667085]">
                    Equipos conectados vía Red Ethernet (9100), USB o Puerto Serie para comanderos y comandas.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPrinterModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white text-xs font-black transition shadow-xs"
                >
                  <Plus className="w-4 h-4 text-[#FFD318]" />
                  <span>+ Agregar Impresora</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {printers.map((prn) => (
                  <div
                    key={prn.id}
                    className="p-4 rounded-2xl border border-zinc-200 bg-white hover:border-[#05268F]/40 shadow-xs flex flex-col justify-between transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-black text-[#101828]">{prn.name}</h4>
                          <span className="text-[11px] font-mono text-[#667085]">
                            {prn.connection_type.toUpperCase()} · {prn.address}:{prn.port}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                          {prn.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#667085] mt-2 pt-2 border-t border-zinc-100">
                        <span>Estación: <strong className="text-[#101828] uppercase">{prn.station}</strong></span>
                        <span>·</span>
                        <span>Papel: <strong className="text-[#101828]">{prn.paper_width}mm</strong></span>
                        <span>·</span>
                        <span>Protocolo: <strong className="text-[#101828]">{prn.protocol}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-100">
                      <button
                        onClick={() => handleTestPrint(prn.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF7D6] hover:bg-[#FFD318] text-[#101828] text-xs font-black border border-[#FFD318] transition"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" />
                        <span>Ticket de Prueba</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar impresora "${prn.name}"?`)) {
                            deletePrinter(prn.id);
                          }
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'routing' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-[#101828]">Reglas de Enrutamiento Automático</h3>
                <p className="text-xs text-[#667085]">
                  Define a qué impresora se despachan las comandas de cocina, bebidas de barra, pre-cuentas y recibos.
                </p>
              </div>

              <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden">
                {routingRules.map((rule) => {
                  const targetPrn = printers.find((p) => p.id === rule.printer_id);
                  const typeLabel =
                    rule.job_type === 'comanda_kitchen'
                      ? 'Comandas de Cocina (Platillos / Entradas)'
                      : rule.job_type === 'comanda_bar'
                      ? 'Comandas de Barra (Cervezas / Bebidas)'
                      : rule.job_type === 'pre_bill'
                      ? 'Pre-cuentas y Cuentas de Mesa'
                      : rule.job_type === 'payment_receipt'
                      ? 'Comprobantes de Pago Registrado'
                      : 'Cortes de Caja y Cierres Z';

                  return (
                    <div key={rule.id} className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
                      <div>
                        <div className="text-sm font-black text-[#101828]">{typeLabel}</div>
                        <div className="text-xs text-[#667085] mt-0.5">
                          Destino actual: <strong className="text-[#05268F]">{targetPrn ? targetPrn.name : 'No asignada'}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={rule.printer_id}
                          onChange={(e) => {
                            setRoutingRule({
                              restaurant_id: rule.restaurant_id,
                              job_type: rule.job_type,
                              station: rule.station,
                              printer_id: e.target.value,
                              auto_print: rule.auto_print,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                        >
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.station})
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => {
                            setRoutingRule({
                              restaurant_id: rule.restaurant_id,
                              job_type: rule.job_type,
                              station: rule.station,
                              printer_id: rule.printer_id,
                              auto_print: !rule.auto_print,
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                            rule.auto_print
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {rule.auto_print ? 'Auto-Imprimir: SÍ' : 'Auto-Imprimir: NO'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-[#101828]">Cola y Bitácora de Impresión DirectPrint</h3>
                <p className="text-xs text-[#667085]">
                  Todos los tickets generados se guardan de forma inmutable para auditoría y reimpresión inmediata.
                </p>
              </div>

              {printJobs.length === 0 ? (
                <div className="p-8 text-center text-[#667085] bg-[#F4F6F8] rounded-2xl">
                  <PrinterIcon className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-sm font-bold">No hay trabajos de impresión registrados.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                  {printJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3.5 flex flex-wrap items-center justify-between gap-2 hover:bg-zinc-50 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#05268F]">#{job.id.slice(-8)}</span>
                          <span className="text-sm font-black text-[#101828]">{job.title}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {job.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#667085] mt-1 flex items-center gap-2">
                          <span>Impresora: <strong>{job.printer_name}</strong></span>
                          <span>·</span>
                          <span>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openThermalPreview(job)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-[#EAF0FF] text-[#05268F] text-xs font-bold shadow-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ticket</span>
                        </button>
                        <button
                          onClick={() => reprintJob(job.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white text-xs font-bold shadow-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#FFD318]" />
                          <span>Reimprimir</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {onClose && (
          <div className="p-4 bg-[#F4F6F8] border-t border-zinc-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#101828] hover:bg-black text-white text-xs font-black transition"
            >
              Cerrar Centro de Impresión
            </button>
          </div>
        )}

        {/* Add Printer Modal */}
      {showAddPrinterModal && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePrinter}
            className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-zinc-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-base font-black text-[#101828]">Nueva Impresora Térmica</h4>
              <button
                type="button"
                onClick={() => setShowAddPrinterModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#101828] mb-1">Nombre Descriptivo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Impresora Cocina Fría (80mm)"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-[#101828]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Estación</label>
                <select
                  value={station}
                  onChange={(e) => setStation(e.target.value as PrinterStation)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                >
                  <option value="kitchen">Cocina</option>
                  <option value="bar">Barra</option>
                  <option value="cashier">Caja</option>
                  <option value="all">Todas (Global)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Ancho de Papel</label>
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(Number(e.target.value) as 80 | 58)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                >
                  <option value={80}>80 mm (Estándar)</option>
                  <option value={58}>58 mm (Compacto)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Conexión</label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value as PrinterConnectionType)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                >
                  <option value="ethernet">Ethernet / Red TCP</option>
                  <option value="usb">USB (/dev/usb/lp0)</option>
                  <option value="wifi">Wi-Fi</option>
                  <option value="serial">Serie / COM</option>
                  <option value="virtual">Virtual (Simulador)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">IP / Puerto / Dispositivo</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="192.168.1.205"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowAddPrinterModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-[#101828]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#FFD318] text-[#101828] shadow-xs"
              >
                Guardar Impresora
              </button>
            </div>
          </form>
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
