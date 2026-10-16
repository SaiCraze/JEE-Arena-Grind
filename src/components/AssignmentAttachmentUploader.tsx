import React, { useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Video, Link as LinkIcon, ExternalLink, Plus } from 'lucide-react';
import { compressImageFile } from '../utils/image';

export interface AssignmentFile {
  name: string;
  type: 'image' | 'pdf' | 'video' | 'link' | 'file';
  url: string;
  size?: string;
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
  description = 'Add up to 10 files, PDFs, images, videos, or external links',
  disabled = false
}) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploadError(null);

    const availableSlots = maxFiles - files.length;
    if (availableSlots <= 0) {
      setUploadError(`Maximum limit of ${maxFiles} items reached.`);
      return;
    }

    const filesToProcess = Array.from(selectedFiles).slice(0, availableSlots);

    try {
      const processedFiles = await Promise.all(
        filesToProcess.map(async (file) => {
          let fileType: AssignmentFile['type'] = 'file';
          if (file.type.startsWith('image/')) fileType = 'image';
          else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) fileType = 'pdf';
          else if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv)$/i)) fileType = 'video';

          let url = '';
          if (fileType === 'image') {
            // High-resolution auto-compression for phone camera captures and handwritten notes
            url = await compressImageFile(file, 1600, 0.72);
          } else {
            // For PDFs, docs, videos, and general homework files:
            // Convert to dataURL so teachers can view/download
            try {
              const reader = new FileReader();
              url = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            } catch (readErr) {
              console.warn('Fallback to object URL for large file:', readErr);
              url = URL.createObjectURL(file);
            }
          }

          const sizeStr = file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`;

          return {
            name: file.name,
            type: fileType,
            url: url,
            size: sizeStr
          } as AssignmentFile;
        })
      );

      const validFiles = processedFiles.filter((f): f is AssignmentFile => Boolean(f));
      if (validFiles.length > 0) {
        onChange([...files, ...validFiles]);
      }
    } catch (err) {
      console.error('File processing error:', err);
      setUploadError('Failed to process one or more files.');
    }

    e.target.value = '';
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-300">
          {label} ({files.length}/{maxFiles})
        </label>
        <span className="text-[11px] text-zinc-500">{description}</span>
      </div>

      {uploadError && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload & Add Link Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`cursor-pointer px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all ${
            disabled || files.length >= maxFiles ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <Upload className="w-4 h-4 text-violet-400" />
          <span>Upload File (PDF / Image / Video)</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={handleFileUpload}
            disabled={disabled || files.length >= maxFiles}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowLinkInput(!showLinkInput)}
          disabled={disabled || files.length >= maxFiles}
          className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <LinkIcon className="w-4 h-4 text-cyan-400" />
          <span>Add URL / Video Link</span>
        </button>
      </div>

      {/* Link Input Row */}
      {showLinkInput && (
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 mt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Link Title (e.g. YouTube Explanation, Drive PDF)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs flex-1"
            />
            <input
              type="text"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs flex-1"
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
              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!linkUrl.trim()}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              Add Link
            </button>
          </div>
        </div>
      )}

      {/* Files Grid / List */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="group p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-2.5 text-xs transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-1.5 rounded-lg bg-zinc-800 shrink-0">
                  {getFileIcon(file.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-200 font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span className="uppercase font-mono">{file.type}</span>
                    {file.size && <span>• {file.size}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
                    title="Open attachment"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    title="Remove item"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
