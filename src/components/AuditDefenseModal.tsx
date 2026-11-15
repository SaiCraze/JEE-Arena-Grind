import React, { useState, useEffect } from 'react';
import { ShieldAlert, Upload, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AuditRecord } from '../types/warfare';
import { compressImageFile } from '../utils/image';

interface AuditDefenseModalProps {
  activeAudit: AuditRecord | null;
  onSubmitProof: (auditId: string, imageDataUrl: string) => Promise<void>;
  onExpireOrForfeit: (audit: AuditRecord) => Promise<void>;
}

export const AuditDefenseModal: React.FC<AuditDefenseModalProps> = ({
  activeAudit,
  onSubmitProof,
  onExpireOrForfeit
}) => {
  const [remainingSecs, setRemainingSecs] = useState<number>(600);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    if (!activeAudit || activeAudit.status !== 'pending') return;

    const tick = () => {
      const rem = Math.max(0, Math.floor((activeAudit.expiresAt - Date.now()) / 1000));
      setRemainingSecs(rem);
      if (rem <= 0) {
        onExpireOrForfeit(activeAudit);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeAudit, onExpireOrForfeit]);

  if (!activeAudit || activeAudit.status !== 'pending') return null;

  const mins = String(Math.floor(remainingSecs / 60)).padStart(2, '0');
  const secs = String(remainingSecs % 60).padStart(2, '0');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file, 900, 0.72);
      setPreviewUrl(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(String(reader.result || ''));
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDefend = async () => {
    if (!previewUrl || isUploading) return;
    setIsUploading(true);
    try {
      await onSubmitProof(activeAudit.id, previewUrl);
      setPreviewUrl('');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md surface-card rounded-3xl p-6 space-y-5 border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.3)] animate-modal">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Live Audit Dispatched
              </span>
              <h3 className="text-lg font-black text-white font-display">
                {activeAudit.auditorName} Audited Your Session!
              </h3>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono-num font-black text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-rose-400" />
            <span>{mins}:{secs}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>Target Session:</span>
            <strong className="text-white">{activeAudit.sessionSubject} ({activeAudit.sessionDuration}m)</strong>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>XP at Risk:</span>
            <strong className="text-rose-400 font-mono-num">{activeAudit.sessionXp} XP</strong>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
            Upload a quick photo of your rough notebook or tablet notes within 10 minutes. If the timer expires, <strong className="text-rose-300">{activeAudit.sessionXp} XP</strong> is stripped from you and awarded to <strong className="text-white">{activeAudit.auditorName}</strong>!
          </p>
        </div>

        <div className="space-y-3">
          <label className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-amber-400/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
            <Upload className="w-5 h-5 text-amber-300" />
            <span className="text-xs font-bold text-amber-200">
              {previewUrl ? 'Replace Notebook / Tablet Photo' : 'Upload Rough Notebook / Tablet Photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-emerald-400/40 max-h-44 bg-black flex items-center justify-center">
              <img src={previewUrl} alt="Audit verification proof" className="max-h-44 object-contain" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onExpireOrForfeit(activeAudit)}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 cursor-pointer flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Forfeit (-{activeAudit.sessionXp} XP)</span>
          </button>

          <button
            type="button"
            disabled={!previewUrl || isUploading}
            onClick={handleDefend}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              previewUrl && !isUploading
                ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/25'
                : 'bg-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isUploading ? 'Verifying...' : 'Submit Proof & Defend XP'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
