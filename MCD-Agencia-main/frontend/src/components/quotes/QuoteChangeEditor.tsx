'use client';

import { useState, useMemo, useRef } from 'react';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  ArrowUturnLeftIcon,
  InformationCircleIcon,
  PhotoIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { Button, Card } from '@/components/ui';
import { QuoteLine, ProposedLine, SubmitChangeRequestData, QuoteAttachment } from '@/lib/api/quotes';
import {
  ServiceFormFields,
  type ServiceDetailsData,
  serviceDetailsFromRequest,
  cleanServiceDetailsForApi,
  serviceHasOwnQuantity,
} from '@/components/quotes/ServiceFormFields';
import {
  SERVICE_LABELS,
  SERVICE_SUBCATEGORIES,
  SERVICE_IDS,
  type ServiceId,
} from '@/lib/service-ids';

interface EditingLine extends QuoteLine {
  isNew?: boolean;
  isDeleted?: boolean;
  isModified?: boolean;
  newQuantity?: number;
  newDescription?: string;
  newConcept?: string;
  serviceType?: string;
  subtype?: string;
  dimensions?: string;
  serviceDetails?: ServiceDetailsData;
  attachments?: File[];
  existingAttachments?: QuoteAttachment[];
}

interface NewItemForm {
  serviceType: ServiceId | '';
  subtype: string;
  quantity: string;
  unit: string;
  description: string;
  serviceDetails?: ServiceDetailsData;
  attachments?: File[];
}

const INITIAL_NEW_ITEM: NewItemForm = {
  serviceType: '',
  subtype: '',
  quantity: '1',
  unit: 'pz',
  description: '',
  serviceDetails: undefined,
  attachments: [],
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

interface QuoteChangeEditorProps {
  lines: QuoteLine[];
  existingAttachmentsByLineId?: Record<string, QuoteAttachment[]>;
  onSubmit: (data: SubmitChangeRequestData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function QuoteChangeEditor({
  lines,
  existingAttachmentsByLineId,
  onSubmit,
  onCancel,
  isSubmitting,
}: QuoteChangeEditorProps) {
  // Convert QuoteLine[] to EditingLine[] with editable state
  const [editingLines, setEditingLines] = useState<EditingLine[]>(() =>
    lines.map((line) => {
      const editLine: EditingLine = { ...line };
      // Reconstruct serviceDetails from service_details if present
      if (line.service_details && typeof line.service_details === 'object') {
        const sd = line.service_details as Record<string, unknown>;
        const serviceType = (sd.service_type as string) || '';
        if (serviceType) {
          editLine.serviceDetails = serviceDetailsFromRequest(serviceType, sd);
          editLine.serviceType = serviceType;
          editLine.subtype = (sd.subtipo as string) || '';
        }
      }
      editLine.existingAttachments = existingAttachmentsByLineId?.[line.id] || [];
      return editLine;
    })
  );
  const [newLines, setNewLines] = useState<EditingLine[]>([]);
  const [customerComments, setCustomerComments] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState<NewItemForm>(INITIAL_NEW_ITEM);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<SubmitChangeRequestData | null>(null);
  // Per-element attachments are stored in EditingLine.attachments and NewItemForm.attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track which element's file input is active
  const activeFileTarget = useRef<{ type: 'editing' | 'newItem' | 'newLine'; id?: string } | null>(null);

  // Calculate if there are any changes
  const hasChanges = useMemo(() => {
    const hasModifiedLines = editingLines.some(
      (line) => line.isModified || line.isDeleted
    );
    const hasNewLines = newLines.length > 0;
    // Also consider an unsaved new item form with a service type selected
    const hasUnsavedNewItem = showNewItemForm && !!newItemForm.serviceType;
    return hasModifiedLines || hasNewLines || hasUnsavedNewItem;
  }, [editingLines, newLines, showNewItemForm, newItemForm.serviceType]);

  // Calculate remaining lines (not deleted)
  const remainingLinesCount = useMemo(() => {
    return editingLines.filter((line) => !line.isDeleted).length + newLines.length;
  }, [editingLines, newLines]);

  const handleModifyLine = (lineId: string, field: 'quantity' | 'description' | 'serviceDetails', value: string | number | ServiceDetailsData) => {
    setEditingLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;

        const originalLine = lines.find((l) => l.id === lineId);
        const newLine = { ...line };

        if (field === 'quantity') {
          newLine.newQuantity = Number(value);
        } else if (field === 'description') {
          newLine.newDescription = String(value);
        } else if (field === 'serviceDetails') {
          newLine.serviceDetails = value as ServiceDetailsData;
        }

        // Check if actually modified compared to original
        const qtyChanged =
          newLine.newQuantity !== undefined &&
          newLine.newQuantity !== originalLine?.quantity;
        const descChanged =
          newLine.newDescription !== undefined &&
          newLine.newDescription.trim() !== '';
        const serviceChanged = newLine.serviceDetails !== undefined;
        newLine.isModified = qtyChanged || descChanged || serviceChanged;

        return newLine;
      })
    );
  };

  const handleDeleteLine = (lineId: string) => {
    setEditingLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, isDeleted: true } : line
      )
    );
  };

  const handleRestoreLine = (lineId: string) => {
    setEditingLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, isDeleted: false } : line
      )
    );
  };

  const handleResetLine = (lineId: string) => {
    const originalLine = lines.find((l) => l.id === lineId);
    if (!originalLine) return;

    // Reconstruct original serviceDetails
    let originalServiceDetails: ServiceDetailsData | undefined;
    if (originalLine.service_details && typeof originalLine.service_details === 'object') {
      const sd = originalLine.service_details as Record<string, unknown>;
      const serviceType = (sd.service_type as string) || '';
      if (serviceType) {
        originalServiceDetails = serviceDetailsFromRequest(serviceType, sd);
      }
    }

    setEditingLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...originalLine,
              isModified: false,
              newQuantity: undefined,
              newDescription: undefined,
              serviceDetails: originalServiceDetails,
            }
          : line
      )
    );
    setEditingLineId(null);
  };

  const handleAddNewLine = () => {
    setShowNewItemForm(true);
    setNewItemForm(INITIAL_NEW_ITEM);
  };

  const buildNewLineConcept = (form: NewItemForm) => {
    const serviceLabel = SERVICE_LABELS[form.serviceType as ServiceId] || form.serviceType;
    const subcats = SERVICE_SUBCATEGORIES[form.serviceType as keyof typeof SERVICE_SUBCATEGORIES];
    const subtypeLabel = subcats?.find(s => s.id === form.subtype)?.label || '';
    return subtypeLabel ? `${serviceLabel} — ${subtypeLabel}` : serviceLabel;
  };

  const buildNewLineDescription = (form: NewItemForm) => {
    const parts: string[] = [];
    if (form.description) parts.push(form.description);
    return parts.join('\n');
  };

  const handleConfirmNewItem = () => {
    if (!newItemForm.serviceType) {
      toast.error('Selecciona un tipo de servicio');
      return;
    }

    const qty = parseInt(newItemForm.quantity) || 1;

    const tempId = `new-${Date.now()}`;
    setNewLines(prev => [
      ...prev,
      {
        id: tempId,
        concept: buildNewLineConcept(newItemForm),
        description: buildNewLineDescription(newItemForm),
        quantity: qty,
        unit: newItemForm.unit,
        unit_price: '0',
        line_total: '0',
        position: editingLines.length + newLines.length,
        isNew: true,
        serviceType: newItemForm.serviceType,
        subtype: newItemForm.subtype,
        serviceDetails: newItemForm.serviceDetails,
        attachments: newItemForm.attachments || [],
      },
    ]);

    setShowNewItemForm(false);
    setNewItemForm(INITIAL_NEW_ITEM);
  };

  // Edit an existing new line (re-open mini-quoter populated with its data)
  const handleEditNewLine = (lineId: string) => {
    const line = newLines.find(l => l.id === lineId);
    if (!line) return;
    setNewItemForm({
      serviceType: (line.serviceType as ServiceId) || '',
      subtype: line.subtype || '',
      quantity: String(line.quantity),
      unit: line.unit,
      description: line.description?.replace(/^Medidas: .+\n?/, '').trim() || '',
      serviceDetails: line.serviceDetails,
      attachments: line.attachments || [],
    });
    // Remove the line being edited — it'll be re-added on confirm
    setNewLines(prev => prev.filter(l => l.id !== lineId));
    setShowNewItemForm(true);
  };

  // Image attachment handlers — per element
  const openFilePickerFor = (target: { type: 'editing' | 'newItem' | 'newLine'; id?: string }) => {
    activeFileTarget.current = target;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || !activeFileTarget.current) return;
    const target = activeFileTarget.current;
    const valid: File[] = [];
    Array.from(files).forEach(file => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" no es un formato permitido`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede 10 MB`);
        return;
      }
      valid.push(file);
    });
    if (valid.length === 0) return;

    if (target.type === 'editing' && target.id) {
      setEditingLines(prev =>
        prev.map(l => {
          if (l.id !== target.id) return l;
          const current = l.attachments || [];
          const existingCount = l.existingAttachments?.length || 0;
          if (current.length + existingCount + valid.length > 5) {
            toast.error('Máximo 5 archivos por elemento');
            return l;
          }
          return { ...l, attachments: [...current, ...valid], isModified: true };
        })
      );
    } else if (target.type === 'newItem') {
      setNewItemForm(prev => {
        const current = prev.attachments || [];
        if (current.length + valid.length > 5) {
          toast.error('Máximo 5 archivos por elemento');
          return prev;
        }
        return { ...prev, attachments: [...current, ...valid] };
      });
    } else if (target.type === 'newLine' && target.id) {
      setNewLines(prev =>
        prev.map(l => {
          if (l.id !== target.id) return l;
          const current = l.attachments || [];
          if (current.length + valid.length > 5) {
            toast.error('Máximo 5 archivos por elemento');
            return l;
          }
          return { ...l, attachments: [...current, ...valid] };
        })
      );
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (target: { type: 'editing' | 'newItem' | 'newLine'; id?: string }, index: number) => {
    if (target.type === 'editing' && target.id) {
      setEditingLines(prev =>
        prev.map(l =>
          l.id === target.id
            ? { ...l, attachments: (l.attachments || []).filter((_, i) => i !== index) }
            : l
        )
      );
    } else if (target.type === 'newItem') {
      setNewItemForm(prev => ({
        ...prev,
        attachments: (prev.attachments || []).filter((_, i) => i !== index),
      }));
    } else if (target.type === 'newLine' && target.id) {
      setNewLines(prev =>
        prev.map(l =>
          l.id === target.id
            ? { ...l, attachments: (l.attachments || []).filter((_, i) => i !== index) }
            : l
        )
      );
    }
  };

  const handleRemoveNewLine = (tempId: string) => {
    setNewLines((prev) => prev.filter((line) => line.id !== tempId));
  };

  const handleSubmit = async () => {
    // Auto-confirm an unsaved new item form if the user filled it out
    let effectiveNewLines = [...newLines];
    if (showNewItemForm && newItemForm.serviceType) {
      const qty = parseInt(newItemForm.quantity) || 1;
      const tempId = `new-${Date.now()}`;
      effectiveNewLines.push({
        id: tempId,
        concept: buildNewLineConcept(newItemForm),
        description: buildNewLineDescription(newItemForm),
        quantity: qty,
        unit: newItemForm.unit,
        unit_price: '0',
        line_total: '0',
        position: editingLines.length + newLines.length,
        isNew: true,
        serviceType: newItemForm.serviceType,
        subtype: newItemForm.subtype,
        serviceDetails: newItemForm.serviceDetails,
        attachments: newItemForm.attachments || [],
      });
      // Update state so the UI reflects the auto-confirmed item
      setNewLines(effectiveNewLines);
      setShowNewItemForm(false);
      setNewItemForm(INITIAL_NEW_ITEM);
    }

    // Validate we have at least one remaining line
    const effectiveRemainingCount = editingLines.filter((line) => !line.isDeleted).length + effectiveNewLines.length;
    if (effectiveRemainingCount === 0) {
      toast.error('Debe quedar al menos un elemento en la cotización');
      return;
    }

    // Validate new lines have concept
    const incompleteNewLines = effectiveNewLines.filter((line) => !line.concept?.trim());
    if (incompleteNewLines.length > 0) {
      toast.error('Los nuevos elementos deben tener un concepto');
      return;
    }

    // Build proposed_lines array
    const proposedLines: ProposedLine[] = [];

    // Add modified lines
    editingLines.forEach((line) => {
      const originalLine = lines.find((l) => l.id === line.id);
      if (!originalLine) return;

      if (line.isDeleted) {
        proposedLines.push({
          id: line.id,
          action: 'delete',
        });
      } else if (line.isModified) {
        const hasChangeNotes = line.newDescription !== undefined && line.newDescription.trim() !== '';
        const proposed: ProposedLine = {
          id: line.id,
          action: 'modify',
          quantity: line.newQuantity ?? originalLine.quantity,
          description: hasChangeNotes ? line.newDescription!.trim() : originalLine.description,
          original_values: {
            quantity: String(originalLine.quantity),
            description: originalLine.description,
          },
        };
        // Include updated service_details if present
        if (line.serviceDetails && line.serviceDetails.service_type) {
          proposed.service_details = cleanServiceDetailsForApi(line.serviceDetails) ?? undefined;
        }
        proposedLines.push(proposed);
      }
    });

    // Add new lines
    effectiveNewLines.forEach((line) => {
      if (line.concept?.trim()) {
        const proposed: ProposedLine = {
          action: 'add',
          concept: line.concept,
          description: line.description || '',
          quantity: line.quantity,
          unit: line.unit,
        };
        // Include service_details for new items
        if (line.serviceDetails && line.serviceDetails.service_type) {
          proposed.service_details = cleanServiceDetailsForApi(line.serviceDetails) ?? undefined;
        }
        proposedLines.push(proposed);
      }
    });

    if (proposedLines.length === 0) {
      toast.error('No hay cambios para enviar');
      return;
    }

    // Collect all per-element attachments into a single array
    const allAttachments: File[] = [];
    editingLines.forEach(l => {
      if (l.attachments && l.attachments.length > 0 && (l.isModified || l.isDeleted)) {
        allAttachments.push(...l.attachments);
      }
    });
    effectiveNewLines.forEach(l => {
      if (l.attachments && l.attachments.length > 0) {
        allAttachments.push(...l.attachments);
      }
    });

    // Show confirmation dialog instead of submitting directly
    setPendingSubmitData({
      proposed_lines: proposedLines,
      customer_comments: customerComments.trim() || undefined,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
    });
    setShowConfirmDialog(true);
  };
  const handleConfirmSubmit = async () => {
    if (!pendingSubmitData) return;
    setShowConfirmDialog(false);
    await onSubmit(pendingSubmitData);
    setPendingSubmitData(null);
  };

  /** Cancel the confirmation dialog */
  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingSubmitData(null);
  };

  /** Build summary data for the confirmation dialog from pendingSubmitData */
  const confirmSummary = useMemo(() => {
    if (!pendingSubmitData) return null;
    const pl = pendingSubmitData.proposed_lines;
    const added = pl.filter(l => l.action === 'add');
    const modified = pl.filter(l => l.action === 'modify');
    const deleted = pl.filter(l => l.action === 'delete');
    // For deleted, resolve concept from original lines
    const deletedWithConcept = deleted.map(d => {
      const orig = lines.find(l => l.id === d.id);
      return { ...d, concept: orig?.concept || 'Elemento' };
    });
    // For modified, resolve concept from original lines
    const modifiedWithConcept = modified.map(m => {
      const orig = lines.find(l => l.id === m.id);
      return { ...m, concept: orig?.concept || 'Elemento' };
    });
    return {
      added,
      modified: modifiedWithConcept,
      deleted: deletedWithConcept,
      totalAttachments: pendingSubmitData.attachments?.length || 0,
      hasComments: !!pendingSubmitData.customer_comments,
    };
  }, [pendingSubmitData, lines]);

  /** Inline image upload UI — reused per element */
  const renderImageUpload = (
    files: File[],
    existingFiles: QuoteAttachment[],
    target: { type: 'editing' | 'newItem' | 'newLine'; id?: string },
  ) => (
    <div className="pt-3 border-t border-neutral-700/50">
      <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1.5">
        <PhotoIcon className="h-3.5 w-3.5" />
        Imágenes de referencia (opcional, máx. 5)
      </p>
      {(existingFiles.length > 0 || files.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {existingFiles.map((file) => {
            const isImage = (file.file_type || '').startsWith('image/');
            return (
              <div
                key={`existing-${file.id}`}
                className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800"
                title={file.filename}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.file}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-1">
                    <PhotoIcon className="h-4 w-4 text-neutral-500" />
                    <span className="text-[9px] text-neutral-500 text-center truncate w-full">{file.filename}</span>
                  </div>
                )}
              </div>
            );
          })}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800"
            >
              {file.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                  <PhotoIcon className="h-4 w-4 text-neutral-500" />
                  <span className="text-[9px] text-neutral-500 text-center truncate w-full">{file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleRemoveAttachment(target, index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {existingFiles.length + files.length < 5 && (
        <button
          type="button"
          onClick={() => openFilePickerFor(target)}
          className="w-full py-2 border border-dashed border-neutral-700 rounded-lg hover:border-cmyk-cyan/50 transition-colors text-center cursor-pointer text-xs text-neutral-400 flex items-center justify-center gap-1.5"
        >
          <PhotoIcon className="h-4 w-4" />
          Agregar imágenes
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="p-4 bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg flex gap-3">
        <InformationCircleIcon className="h-5 w-5 text-cmyk-cyan flex-shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-300">
          <p className="font-medium text-white mb-1">Editor de cambios</p>
          <p>
            Revisa los detalles de cada elemento, modifica cantidades, describe los
            cambios que necesitas, elimina elementos o agrega nuevos. El vendedor
            revisará tus cambios y te enviará una cotización actualizada.
          </p>
        </div>
      </div>

      {/* Existing lines */}
      <Card className="p-4">
        <h3 className="font-semibold text-white mb-4">Elementos actuales</h3>
        <div className="space-y-3">
          {editingLines.map((line) => {
            const originalLine = lines.find((l) => l.id === line.id);
            const isEditing = editingLineId === line.id;

            return (
              <div
                key={line.id}
                className={`p-3 rounded-lg border transition-colors ${
                  line.isDeleted
                    ? 'bg-red-500/10 border-red-500/30'
                    : line.isModified
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-neutral-800/50 border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium ${
                        line.isDeleted
                          ? 'text-red-400 line-through'
                          : 'text-white'
                      }`}
                    >
                      {line.concept}
                    </p>

                    {isEditing && !line.isDeleted ? (
                      <div className="mt-3 space-y-3">
                        {/* Current details - read-only reference */}
                        <div className="p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 font-medium">Detalles actuales</p>
                          <div>
                            <p className="text-xs text-neutral-500">Concepto</p>
                            <p className="text-sm text-white">{line.concept}</p>
                          </div>
                          {line.description && (
                            <div className="mt-2">
                              <p className="text-xs text-neutral-500">Descripción</p>
                              <p className="text-sm text-neutral-300 whitespace-pre-line mt-0.5">{line.description}</p>
                            </div>
                          )}
                        </div>

                        {/* Editable fields — hide qty if service manages its own */}
                        {!serviceHasOwnQuantity(line.serviceType || '', line.subtype) && (
                          <div className="flex items-center gap-4">
                            <div>
                              <label className="text-xs text-neutral-400">
                                Nueva cantidad
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={line.newQuantity ?? line.quantity}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  handleModifyLine(
                                    line.id,
                                    'quantity',
                                    raw === '' ? 0 : parseInt(raw) || 0
                                  );
                                }}
                                onBlur={(e) => {
                                  const v = parseInt(e.target.value);
                                  if (!v || v < 1) handleModifyLine(line.id, 'quantity', 1);
                                }}
                                className="w-24 px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none"
                              />
                            </div>
                            <div className="text-neutral-400 text-sm pt-5">
                              {line.unit}
                            </div>
                          </div>
                        )}
                        {/* Service detail fields for items with service_details */}
                        {line.serviceDetails && (
                          <div className="pt-3 border-t border-neutral-700/50">
                            <div className="flex items-center gap-2 text-xs font-medium text-cmyk-cyan mb-3">
                              <WrenchScrewdriverIcon className="h-4 w-4" />
                              <span>Detalle de servicio</span>
                            </div>
                            <ServiceFormFields
                              value={line.serviceDetails}
                              onChange={(details) => handleModifyLine(line.id, 'serviceDetails', details)}
                              hideRoutePricing
                            />
                          </div>
                        )}

                        {/* Imágenes por elemento */}
                        {renderImageUpload(line.attachments || [], line.existingAttachments || [], { type: 'editing', id: line.id })}

                        {/* Cambios solicitados — debajo de imágenes */}
                        <div>
                          <label className="text-xs text-neutral-400">
                            Cambios solicitados
                          </label>
                          <textarea
                            value={line.newDescription ?? ''}
                            onChange={(e) =>
                              handleModifyLine(line.id, 'description', e.target.value)
                            }
                            placeholder="Describe aquí los cambios que necesitas para este elemento..."
                            className="w-full px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none resize-none"
                            rows={2}
                          />
                          <p className="text-xs text-neutral-600 mt-1">Ej: Cambiar medidas a 4x3m, usar material diferente, etc.</p>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => setEditingLineId(null)}
                            leftIcon={<CheckIcon className="h-4 w-4" />}
                          >
                            Listo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetLine(line.id)}
                            leftIcon={<ArrowUturnLeftIcon className="h-4 w-4" />}
                          >
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {line.description && (
                          <p
                            className={`text-sm whitespace-pre-line ${
                              line.isDeleted
                                ? 'text-red-400/70 line-through'
                                : line.isModified && line.newDescription !== undefined && line.newDescription.trim() !== ''
                                ? 'text-neutral-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {line.description}
                          </p>
                        )}
                        {line.isModified && line.newDescription !== undefined && line.newDescription.trim() !== '' && (
                          <div className="mt-1 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                            <p className="text-xs text-yellow-500 font-medium mb-0.5">Cambios solicitados:</p>
                            <p className="text-sm text-yellow-400 whitespace-pre-line">{line.newDescription}</p>
                          </div>
                        )}
                        {!serviceHasOwnQuantity(line.serviceType || '', line.subtype) && (
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-sm ${
                                line.isDeleted
                                  ? 'text-red-400/70 line-through'
                                  : line.isModified &&
                                    line.newQuantity !== undefined &&
                                    line.newQuantity !== originalLine?.quantity
                                  ? 'text-yellow-400'
                                  : 'text-neutral-300'
                              }`}
                            >
                              {line.newQuantity ?? line.quantity} {line.unit}
                            </span>
                            {line.isModified &&
                              line.newQuantity !== undefined &&
                              line.newQuantity !== originalLine?.quantity && (
                                <span className="text-xs text-neutral-500">
                                  (antes: {originalLine?.quantity})
                                </span>
                              )}
                          </div>
                        )}
                        {/* Thumbnails de imágenes adjuntas */}
                        {((line.existingAttachments && line.existingAttachments.length > 0) || (line.attachments && line.attachments.length > 0)) && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {(line.existingAttachments || []).map((file) => {
                              const isImage = (file.file_type || '').startsWith('image/');
                              return (
                                <div key={`existing-thumb-${file.id}`} className="w-10 h-10 rounded overflow-hidden border border-neutral-700 bg-neutral-800">
                                  {isImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={file.file} alt={file.filename} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <PhotoIcon className="h-3 w-3 text-neutral-500" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {(line.attachments || []).map((file, idx) => (
                              <div key={`${file.name}-${idx}`} className="w-10 h-10 rounded overflow-hidden border border-neutral-700 bg-neutral-800">
                                {file.type.startsWith('image/') ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <PhotoIcon className="h-3 w-3 text-neutral-500" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-start gap-1">
                    {line.isDeleted ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestoreLine(line.id)}
                        className="text-neutral-400 hover:text-white"
                        title="Restaurar"
                      >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                      </Button>
                    ) : (
                      <>
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingLineId(line.id)}
                            className="text-neutral-400 hover:text-cmyk-cyan"
                            title="Editar"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteLine(line.id)}
                          className="text-neutral-400 hover:text-red-400"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                {(line.isDeleted || line.isModified) && (
                  <div className="mt-2 pt-2 border-t border-neutral-700/50">
                    {line.isDeleted && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                        Será eliminado
                      </span>
                    )}
                    {line.isModified && !line.isDeleted && (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                        Modificado
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* New lines */}
      {newLines.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-white mb-4">Nuevos elementos</h3>
          <div className="space-y-3">
            {newLines.map((line) => (
              <div
                key={line.id}
                className="p-3 rounded-lg border bg-green-500/10 border-green-500/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{line.concept}</p>
                    {line.description && (
                      <p className="text-sm text-neutral-400 whitespace-pre-line mt-1">
                        {line.description}
                      </p>
                    )}
                    {!serviceHasOwnQuantity(line.serviceType || '', line.subtype) && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-neutral-300">
                        <span>{line.quantity} {line.unit}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditNewLine(line.id)}
                      className="text-neutral-400 hover:text-cmyk-cyan"
                      title="Editar"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveNewLine(line.id)}
                      className="text-neutral-400 hover:text-red-400"
                      title="Eliminar"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* Imágenes adjuntas de este nuevo elemento */}
                {(line.attachments && line.attachments.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {line.attachments.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="w-10 h-10 rounded overflow-hidden border border-neutral-700 bg-neutral-800">
                        {file.type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PhotoIcon className="h-3 w-3 text-neutral-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-neutral-700/50">
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                    Nuevo elemento
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mini-quoter: add new item form */}
      {showNewItemForm && (
        <Card className="p-4 border-cmyk-cyan/30">
          <h3 className="font-semibold text-white mb-4">Nuevo elemento</h3>
          <div className="space-y-3">
            {/* Service type */}
            <div>
              <label className="text-xs text-neutral-400">Tipo de servicio *</label>
              <select
                value={newItemForm.serviceType}
                onChange={(e) => {
                  const val = e.target.value as ServiceId | '';
                  const details: ServiceDetailsData | undefined = val
                    ? { service_type: val }
                    : undefined;
                  setNewItemForm(prev => ({
                    ...prev,
                    serviceType: val,
                    subtype: '',
                    serviceDetails: details,
                  }));
                }}
                className="w-full px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none"
              >
                <option value="">Selecciona un servicio</option>
                {SERVICE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SERVICE_LABELS[id] || id}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtype (dynamic based on service) */}
            {newItemForm.serviceType && newItemForm.serviceType !== 'otros' &&
              SERVICE_SUBCATEGORIES[newItemForm.serviceType as keyof typeof SERVICE_SUBCATEGORIES] && (
              <div>
                <label className="text-xs text-neutral-400">Subtipo</label>
                <select
                  value={newItemForm.subtype}
                  onChange={(e) => setNewItemForm(prev => ({
                    ...prev,
                    subtype: e.target.value,
                    serviceDetails: prev.serviceDetails
                      ? { ...prev.serviceDetails, subtipo: e.target.value }
                      : prev.serviceDetails,
                  }))}
                  className="w-full px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none"
                >
                  <option value="">Selecciona subtipo</option>
                  {SERVICE_SUBCATEGORIES[newItemForm.serviceType as keyof typeof SERVICE_SUBCATEGORIES]?.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity + Unit — hidden when service handles its own quantity */}
            {!serviceHasOwnQuantity(newItemForm.serviceType, newItemForm.subtype) && (
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-neutral-400">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      if (!v || v < 1) setNewItemForm(prev => ({ ...prev, quantity: '1' }));
                    }}
                    className="w-24 px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400">Unidad</label>
                  <select
                    value={newItemForm.unit}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-28 px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none"
                  >
                    <option value="pz">pz</option>
                    <option value="m²">m²</option>
                    <option value="ml">ml</option>
                    <option value="hr">hr</option>
                    <option value="servicio">servicio</option>
                  </select>
                </div>
              </div>
            )}

            {/* Additional notes */}
            <div>
              <label className="text-xs text-neutral-400">Detalles adicionales (opcional)</label>
              <textarea
                value={newItemForm.description}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Material, acabado, colores, uso interior/exterior, etc."
                rows={2}
                className="w-full px-3 py-2 mt-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:border-cmyk-cyan focus:outline-none resize-none"
              />
            </div>

            {/* Service-specific fields — always visible */}
            {newItemForm.serviceDetails && newItemForm.serviceType && (
              <div className="pt-3 border-t border-neutral-700/50">
                <div className="flex items-center gap-2 text-xs font-medium text-cmyk-cyan mb-3">
                  <WrenchScrewdriverIcon className="h-4 w-4" />
                  <span>Detalle de servicio</span>
                </div>
                <ServiceFormFields
                  value={newItemForm.serviceDetails}
                  onChange={(details) => setNewItemForm(prev => ({ ...prev, serviceDetails: details }))}
                  hideRoutePricing
                />
              </div>
            )}

            {/* Imágenes por elemento */}
                    {renderImageUpload(newItemForm.attachments || [], [], { type: 'newItem' })}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleConfirmNewItem}
                leftIcon={<CheckIcon className="h-4 w-4" />}
              >
                Agregar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowNewItemForm(false); setNewItemForm(INITIAL_NEW_ITEM); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add new line button */}
      {!showNewItemForm && (
        <Button
          variant="outline"
          onClick={handleAddNewLine}
          className="w-full"
          leftIcon={<PlusIcon className="h-5 w-5" />}
        >
          Agregar elemento
        </Button>
      )}

      {/* Hidden file input for per-element uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Comments */}
      <Card className="p-4">
        <h3 className="font-semibold text-white mb-3">
          Comentarios adicionales (opcional)
        </h3>
        <textarea
          value={customerComments}
          onChange={(e) => setCustomerComments(e.target.value)}
          placeholder="Escribe aquí cualquier aclaración o detalle adicional para el vendedor..."
          rows={3}
          className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cmyk-cyan resize-none"
        />
      </Card>

      {/* Summary */}
      {hasChanges && (
        <Card className="p-4 bg-neutral-800/50">
          <h4 className="text-sm font-medium text-neutral-400 mb-2">
            Resumen de cambios
          </h4>
          <div className="flex flex-wrap gap-3 text-sm">
            {editingLines.filter((l) => l.isModified && !l.isDeleted).length >
              0 && (
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                {editingLines.filter((l) => l.isModified && !l.isDeleted).length}{' '}
                modificado(s)
              </span>
            )}
            {editingLines.filter((l) => l.isDeleted).length > 0 && (
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
                {editingLines.filter((l) => l.isDeleted).length} eliminado(s)
              </span>
            )}
            {newLines.length > 0 && (
              <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                {newLines.length} agregado(s)
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!hasChanges || isSubmitting}
          isLoading={isSubmitting}
          className="flex-1"
        >
          Enviar solicitud de cambios
        </Button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-5 border-b border-neutral-700">
              <h3 className="text-lg font-semibold text-white">Confirmar envío de cambios</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Revisa el resumen antes de enviar tu solicitud al vendedor.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Added items */}
              {confirmSummary.added.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-medium">
                      +{confirmSummary.added.length} nuevo(s)
                    </span>
                  </div>
                  <ul className="space-y-1 ml-1">
                    {confirmSummary.added.map((item, i) => (
                      <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                        <PlusIcon className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>
                          <span className="text-white font-medium">{item.concept}</span>
                          {item.quantity && (
                            <span className="text-neutral-500 ml-1">
                              — {item.quantity} {item.unit || 'pz'}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Modified items */}
              {confirmSummary.modified.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                      {confirmSummary.modified.length} modificado(s)
                    </span>
                  </div>
                  <ul className="space-y-1 ml-1">
                    {confirmSummary.modified.map((item, i) => (
                      <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                        <PencilIcon className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white font-medium">{item.concept}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deleted items */}
              {confirmSummary.deleted.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                      −{confirmSummary.deleted.length} eliminado(s)
                    </span>
                  </div>
                  <ul className="space-y-1 ml-1">
                    {confirmSummary.deleted.map((item, i) => (
                      <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                        <TrashIcon className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white font-medium line-through">{item.concept}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Attachments & comments info */}
              {(confirmSummary.totalAttachments > 0 || confirmSummary.hasComments) && (
                <div className="pt-3 border-t border-neutral-700/50 space-y-1">
                  {confirmSummary.totalAttachments > 0 && (
                    <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <PhotoIcon className="h-3.5 w-3.5" />
                      {confirmSummary.totalAttachments} imagen(es) adjunta(s)
                    </p>
                  )}
                  {confirmSummary.hasComments && (
                    <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <InformationCircleIcon className="h-3.5 w-3.5" />
                      Incluye comentarios adicionales
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-neutral-700 flex gap-3">
              <Button
                onClick={handleCancelConfirm}
                variant="outline"
                className="flex-1"
              >
                Revisar de nuevo
              </Button>
              <Button
                onClick={handleConfirmSubmit}
                isLoading={isSubmitting}
                className="flex-1"
              >
                Confirmar y enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
