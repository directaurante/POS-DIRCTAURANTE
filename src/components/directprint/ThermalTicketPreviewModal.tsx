/**
 * DIRECTAURANTE DIRECTPRINT — Thermal Ticket Preview Modal
 * Renders realistic thermal receipts with monospaced typography, tear lines, and direct export.
 */

import React from 'react';
import { usePos } from '../../context/PosContext';
import { Printer, Copy, Download, RotateCcw, X, CheckCircle } from 'lucide-react';

export const ThermalTicketPreviewModal: React.FC = () => {
  const { previewJob, closeThermalPreview, reprintJob } = usePos();
  const [copied, setCopied] = React.useState(false);

  if (!previewJob) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(previewJob.raw_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([previewJob.raw_content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket_${previewJob.job_type}_${previewJob.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReprint = async () => {
    try {
      await reprintJob(previewJob.id);
    } catch (err: any) {
      alert(err.message || 'Error al reimprimir');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#05268F] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFD318] text-[#05268F] rounded-xl font-black">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">DirectPrint — Visor Térmico</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                  ESC/POS
                </span>
              </div>
              <p className="text-xs text-white/80">
                Impresora: <strong className="text-white">{previewJob.printer_name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={closeThermalPreview}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Realistic Thermal Receipt Slip */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F4F6F8] flex justify-center">
          <div className="w-full max-w-sm bg-[#FFFDF7] border border-zinc-300 rounded-lg p-5 shadow-md relative">
            {/* Top jagged tear edge */}
            <div className="absolute -top-1.5 left-0 right-0 h-2 bg-[#F4F6F8] border-b border-dashed border-zinc-400" />

            <div className="flex items-center justify-between text-[11px] text-[#667085] pb-2 mb-2 border-b border-zinc-200 font-mono">
              <span>TRABAJO: #{previewJob.id.slice(-8)}</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {previewJob.status.toUpperCase()}
              </span>
            </div>

            <pre className="font-mono text-xs text-[#101828] leading-tight whitespace-pre-wrap select-all font-semibold">
              {previewJob.raw_content}
            </pre>

            {/* Bottom jagged tear edge */}
            <div className="absolute -bottom-1.5 left-0 right-0 h-2 bg-[#F4F6F8] border-t border-dashed border-zinc-400" />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-[#101828] text-xs font-bold transition"
            >
              <Copy className="w-3.5 h-3.5 text-[#05268F]" />
              <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-[#101828] text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5 text-[#05268F]" />
              <span>Descargar .txt</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReprint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white text-xs font-black shadow-sm transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#FFD318]" />
              <span>Reimprimir</span>
            </button>
            <button
              onClick={closeThermalPreview}
              className="px-4 py-2 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] text-xs font-black shadow-sm transition"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
