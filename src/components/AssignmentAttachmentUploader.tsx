import React, { useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Video, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { compressImageFile } from '../utils/image';

export interface AssignmentFile {
  name: string;
  type: 'image' | 'pdf' | 'video' | 'link' | 'file';
  url: string;
  size: string;
}

interface AssignmentAttachmentUploaderProps {
  files: AssignmentFile[];
  onChange: (files: AssignmentFile[]) => void;
  maxFiles?: number;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const AssignmentAttachmentUploader: React.FC<AssignmentAttachmentUploaderProps> = ({
  files,
  onChange,
  maxFiles = 10,
  label = 'Attached Materials & Files (Max 10)',
  description = 'Add up to 10 files, PDFs, images, camera photos, or external links',
  disabled = false
}) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFileList = async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    if (fileArray.length === 0) return;
    setUploadError(null);

    const availableSlots = maxFiles - files.length;
    if (availableSlots <= 0) {
      setUploadError(`Maximum limit of ${maxFiles} items reached.`);
      return;
    }

    const filesToProcess = fileArray.slice(0, availableSlots);
    setIsProcessing(true);

    try {
      const processedFiles = await Promise.all(
        filesToProcess.map(async (file) => {
          let fileType: AssignmentFile['type'] = 'file';
          if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)) {
            fileType = 'image';
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            fileType = 'pdf';
          } else if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
            fileType = 'video';
          }

          let url = '';
          if (fileType === 'image') {
            url = await compressImageFile(file, 1200, 0.65);
          } else if (file.size <= 350 * 1024) {
            try {
              const reader = new FileReader();
              url = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve((reader.result as string) || '');
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            } catch (readErr) {
              console.warn('Fallback to object URL for file:', readErr);
              url = URL.createObjectURL(file);
            }
          } else {
            url = URL.createObjectURL(file);
          }

          const sizeStr = file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.max(1, Math.round(file.size / 1024))} KB`;

          return {
            name: file.name || 'Homework_Attachment',
            type: fileType,
            url: url || '',
            size: sizeStr
          } as AssignmentFile;
        })
      );

      const validFiles = processedFiles.filter((f): f is AssignmentFile => Boolean(f && f.name));
      if (validFiles.length > 0) {
        onChange([...files, ...validFiles]);
      }
    } catch (err) {
      console.error('File processing error:', err);
      setUploadError('Failed to process one or more files. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFileList(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || files.length >= maxFiles) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files);
    }
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    setUploadError(null);
    if (files.length >= maxFiles) {
      setUploadError(`Maximum limit of ${maxFiles} items reached.`);
      return;
    }

    let formattedUrl = linkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: AssignmentFile = {
      name: linkTitle.trim() || formattedUrl,
      type: 'link',
      url: formattedUrl,
      size: 'Web Link'
    };

    onChange([...files, newLink]);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  };

  const getFileIcon = (type: AssignmentFile['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-indigo-400" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-cyan-400" />;
      default:
        return <FileText className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label className="block text-xs font-semibold text-slate-200">
          {label} <span className="text-emerald-400 font-mono-num">({files.length}/{maxFiles})</span>
        </label>
        <span className="text-[11px] text-slate-400">{description}</span>
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag & Drop + File Browser Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && files.length < maxFiles) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
          isDragging
            ? 'border-emerald-400 bg-emerald-400/10'
            : 'border-slate-800 bg-[#050811]/90 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {isProcessing ? 'Processing attachment(s)...' : 'Drop solution photos, PDFs, or docs here'}
              </div>
              <div className="text-[11px] text-slate-400">
                Supports handwritten notebook photos, camera captures, PDFs, & Word/Excel files
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            <label
              className={`cursor-pointer btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                disabled || isProcessing || files.length >= maxFiles ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isProcessing ? 'Uploading...' : 'Browse Files / Photos'}</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileUpload}
                disabled={disabled || isProcessing || files.length >= maxFiles}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowLinkInput(!showLinkInput)}
              disabled={disabled || files.length >= maxFiles}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>+ Add Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* Link Input Row */}
      {showLinkInput && (
        <div className="p-3 rounded-xl bg-[#050811] border border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Link Title (e.g. Drive Solution PDF, GitHub Repo)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs flex-1 focus:outline-none focus:border-cyan-400"
            />
            <input
              type="text"
              placeholder="https://drive.google.com/..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs flex-1 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLinkInput(false);
                setLinkTitle('');
                setLinkUrl('');
              }}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!linkUrl.trim()}
              className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold disabled:opacity-50"
            >
              Attach Link
            </button>
          </div>
        </div>
      )}

      {/* Files Grid / List with Image Thumbnail Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {files.map((file, idx) => {
            const isImage = file.type === 'image' || (file.url && file.url.startsWith('data:image'));
            return (
              <div
                key={idx}
                className="group p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2.5 text-xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isImage && file.url ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 font-semibold truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="uppercase font-mono-num text-emerald-400/90">{file.type}</span>
                      {file.size && <span>· {file.size}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                      title="Preview attachment"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
