import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Copy, Trash2, X } from 'lucide-react';
import { Button } from '../../components/Button';

interface CsvUploaderProps {
  onRecipientsChange: (recipients: string[]) => void;
  recipients: string[];
}

interface ValidationSummary {
  valid: string[];
  invalid: { value: string; reason: string }[];
  duplicates: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CsvUploader: React.FC<CsvUploaderProps> = ({
  onRecipientsChange,
  recipients,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [manualText, setManualText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRawEmails = (rawEmails: string[], sourceName?: string) => {
    const validEmails: string[] = [];
    const invalidEmails: { value: string; reason: string }[] = [];
    const duplicateEmails: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawEmails) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      if (!EMAIL_REGEX.test(trimmed)) {
        invalidEmails.push({ value: trimmed, reason: 'Invalid email syntax' });
        continue;
      }

      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) {
        duplicateEmails.push(trimmed);
      } else {
        seen.add(lower);
        validEmails.push(trimmed);
      }
    }

    const nextSummary: ValidationSummary = {
      valid: validEmails,
      invalid: invalidEmails,
      duplicates: duplicateEmails,
    };

    setSummary(nextSummary);
    if (sourceName) setFileName(sourceName);
    onRecipientsChange(validEmails);
  };

  const handleFileUpload = (file: File) => {
    const name = file.name;
    const isCsv = name.endsWith('.csv');
    const isTxt = name.endsWith('.txt');

    if (!isCsv && !isTxt) {
      alert('Please upload a .csv or .txt file');
      return;
    }

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rawEmails: string[] = [];
          
          if (results.data && results.data.length > 0) {
            // Find an email column
            const firstRow = results.data[0] as Record<string, string>;
            const emailKey = Object.keys(firstRow).find(
              (k) =>
                k.toLowerCase() === 'email' ||
                k.toLowerCase() === 'email address' ||
                k.toLowerCase() === 'recipient' ||
                k.toLowerCase() === 'to'
            ) || Object.keys(firstRow)[0]; // fallback to first column

            results.data.forEach((row: any) => {
              if (row && emailKey && row[emailKey]) {
                rawEmails.push(String(row[emailKey]));
              }
            });
          }

          // If header-based parse found nothing or file was simple list, fallback to unparsed rows
          if (rawEmails.length === 0) {
            Papa.parse(file, {
              header: false,
              skipEmptyLines: true,
              complete: (res) => {
                const list: string[] = [];
                res.data.forEach((row: any) => {
                  if (Array.isArray(row)) {
                    row.forEach((cell) => {
                      if (cell && typeof cell === 'string') list.push(cell);
                    });
                  }
                });
                processRawEmails(list, file.name);
              },
            });
          } else {
            processRawEmails(rawEmails, file.name);
          }
        },
      });
    } else {
      // TXT file - one address per line
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const lines = text.split(/[\r\n,;]+/);
          processRawEmails(lines, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleManualParse = () => {
    if (!manualText.trim()) return;
    const items = manualText.split(/[\r\n,;]+/);
    processRawEmails(items, 'Manual Entry');
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    const next = recipients.filter((r) => r.toLowerCase() !== emailToRemove.toLowerCase());
    onRecipientsChange(next);
    if (summary) {
      setSummary({
        ...summary,
        valid: next,
      });
    }
  };

  const clearAll = () => {
    onRecipientsChange([]);
    setSummary(null);
    setFileName(null);
    setManualText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Upload mode tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === 'upload'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          CSV / Text File Upload
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === 'manual'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Manual Paste
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/60'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .txt, text/csv, text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Click to browse or drag and drop your file
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports <span className="font-medium text-slate-700">.CSV</span> (with email column) or{' '}
              <span className="font-medium text-slate-700">.TXT</span> (one address per line)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={4}
            placeholder="Paste email addresses separated by commas or newlines:&#10;alice@example.com&#10;bob@example.com"
            className="w-full text-sm font-mono p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualParse}
              disabled={!manualText.trim()}
            >
              Parse & Validate
            </Button>
          </div>
        </div>
      )}

      {/* Validation Counts Summary */}
      {summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px] sm:max-w-xs">
                {fileName || 'Processed addresses'}
              </span>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200/70 p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-700 mb-0.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Valid</span>
              </div>
              <span className="text-lg font-bold text-emerald-800">{summary.valid.length}</span>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200/70 p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-rose-700 mb-0.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Invalid</span>
              </div>
              <span className="text-lg font-bold text-rose-800">{summary.invalid.length}</span>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200/70 p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-700 mb-0.5">
                <Copy className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Duplicates</span>
              </div>
              <span className="text-lg font-bold text-amber-800">{summary.duplicates.length}</span>
            </div>
          </div>

          {/* Invalid warning */}
          {summary.invalid.length > 0 && (
            <div className="text-xs text-rose-700 bg-rose-50/70 rounded-lg p-2.5 border border-rose-200">
              <p className="font-semibold mb-1">
                {summary.invalid.length} invalid email(s) excluded:
              </p>
              <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px]">
                {summary.invalid.map((inv, idx) => (
                  <div key={idx} className="truncate">
                    &bull; {inv.value} ({inv.reason})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recipient Chips Preview */}
          {recipients.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Verified Recipients Preview ({recipients.length})</span>
                <span className="text-[11px]">Click &times; to remove</span>
              </div>
              <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap gap-1.5">
                {recipients.map((rec) => (
                  <span
                    key={rec}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs"
                  >
                    <span className="truncate max-w-[200px]">{rec}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(rec)}
                      className="text-slate-400 hover:text-rose-600 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
