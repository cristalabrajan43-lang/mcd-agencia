'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon, PencilIcon, TrashIcon, PhotoIcon,
  EyeIcon, EyeSlashIcon, PlayIcon, FilmIcon,
  UserGroupIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';

import {
  getAdminCarouselSlides, createCarouselSlideWithFile, updateCarouselSlideWithFile,
  updateCarouselSlide, deleteCarouselSlide, CarouselSlideAdmin,
  getAdminServices, syncServices, updateService, ServiceAdmin,
  getAdminServiceImages, createServiceImage, deleteServiceImage, updateServiceImageWithFile, ServiceImageAdmin,
  getAdminPortfolioVideos, createPortfolioVideo, updatePortfolioVideo,
  deletePortfolioVideo, PortfolioVideoAdmin,
  getAdminPortfolioItems, createPortfolioItem, updatePortfolioItem,
  deletePortfolioItem, PortfolioItemAdmin,
  getAdminClientLogos, createClientLogo, updateClientLogo, deleteClientLogo, ClientLogoAdmin,
  getAdminPromoBanners, PromoBannerAdmin,
} from '@/lib/api/content';
import { Card, Button, Input, Textarea, Modal, Badge, LoadingPage } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PromoBannersTab } from '@/components/admin/PromoBannersTab';
import {
  SERVICE_IDS, SERVICE_LABELS, type ServiceId,
  ALL_SERVICE_SUBCATEGORIES, SERVICE_SYNC_DEFINITIONS,
} from '@/lib/service-ids';

// ═══════════════════════════════════════════════════════════════════════════
const MAX_HERO_SLIDES = 10;
const MAX_SERVICE_IMAGES = 10;
const MAX_PORTFOLIO_VIDEOS = 2;
const MAX_IMAGE_SIZE_MB = 5;
const HERO_DIMENSIONS = '1920 × 800 px';
const SERVICE_DIMENSIONS = '800 × 600 px (4:3)';

/** Extract a readable message from an API error object. */
function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; data?: Record<string, unknown> };
    if (err.data) {
      const msgs = Object.entries(err.data)
        .map(([key, val]) => {
          const txt = Array.isArray(val) ? val.join(', ') : String(val);
          return key === 'non_field_errors' ? txt : `${key}: ${txt}`;
        })
        .join(' · ');
      if (msgs) return msgs;
    }
    if (err.message && err.message !== 'An error occurred') return err.message;
  }
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
function ImageUploadInput({ label, required, hint, currentUrl, onChange }: {
  label: string; required?: boolean; hint?: string; currentUrl?: string;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) { toast.error(`Máximo ${MAX_IMAGE_SIZE_MB} MB.`); return; }
      setPreview(URL.createObjectURL(file));
      setFileName(file.name);
    } else { setPreview(null); setFileName(''); }
    onChange(file);
  }, [onChange]);

  const displayUrl = preview || currentUrl;
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-14 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-neutral-700">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="preview" className="w-full h-full object-cover" />
          ) : <PhotoIcon className="h-6 w-6 text-neutral-600" />}
        </div>
        <div className="flex-1">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 rounded-lg border border-neutral-700 transition-colors">
            {fileName || 'Seleccionar imagen…'}
          </button>
          {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="hidden" />
    </div>
  );
}

type ContentTab = 'carousel' | 'promos' | 'portfolio' | 'clients';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminContentPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ContentTab>('carousel');

  const { data: slides = [], isLoading: l1 } = useQuery({ queryKey: ['admin-carousel'], queryFn: getAdminCarouselSlides });
  const { data: promos = [], isLoading: lPromos } = useQuery({ queryKey: ['admin-promo-banners'], queryFn: getAdminPromoBanners });
  const { data: portfolios = [], isLoading: l2 } = useQuery({ queryKey: ['admin-portfolio-items'], queryFn: getAdminPortfolioItems });
  const { data: clientLogos = [], isLoading: l3 } = useQuery({ queryKey: ['admin-client-logos'], queryFn: getAdminClientLogos });

  if (l1 || lPromos || l2 || l3) return <LoadingPage message="Cargando contenido..." />;

  const tabs: { id: ContentTab; label: string; count: number }[] = [
    { id: 'carousel', label: '🖼️ Hero Carrusel', count: slides.length },
    { id: 'promos', label: '🏷️ Banners de descuento', count: promos.length },
    { id: 'portfolio', label: '📷 Trabajos que hablan por nosotros', count: portfolios.length },
    { id: 'clients', label: '🏢 Logos Clientes', count: clientLogos.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contenido del Landing</h1>
        <p className="text-neutral-400 text-sm">Gestiona Hero Carrusel, Banners de descuento, Trabajos (imágenes y videos unificados) y Logos de Clientes</p>
      </div>

      {/* Info banner */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
        <p className="text-sm text-cyan-300">
          💡 El landing muestra <strong>contenido por defecto</strong> mientras estas secciones estén vacías. Agrega tu propio contenido aquí para reemplazarlo.
        </p>
      </div>

      <div className="flex gap-2 border-b border-neutral-800 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-xs sm:text-sm',
              activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white')}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === 'carousel' && <CarouselTab slides={slides} queryClient={queryClient} />}
      {activeTab === 'promos' && <PromoBannersTab promos={promos} queryClient={queryClient} />}
      {activeTab === 'portfolio' && <PortfolioTab portfolios={portfolios} queryClient={queryClient} />}
      {activeTab === 'clients' && <ClientLogosTab logos={clientLogos} queryClient={queryClient} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAROUSEL TAB — Admin selects a service from dropdown, title auto-fills
// ═══════════════════════════════════════════════════════════════════════════
function CarouselTab({ slides, queryClient }: { slides: CarouselSlideAdmin[]; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CarouselSlideAdmin | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({ service_key: '', title: '', title_en: '', subtitle: '', subtitle_en: '', position: 0, is_active: true });

  const createMut = useMutation({
    mutationFn: createCarouselSlideWithFile,
    onSuccess: () => { toast.success('Slide creado'); queryClient.invalidateQueries({ queryKey: ['admin-carousel'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear slide')),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: Record<string, unknown>; file?: File }) => updateCarouselSlideWithFile(id, data, file),
    onSuccess: () => { toast.success('Slide actualizado'); queryClient.invalidateQueries({ queryKey: ['admin-carousel'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });
  const deleteMut = useMutation({
    mutationFn: deleteCarouselSlide,
    onSuccess: () => { toast.success('Slide eliminado'); queryClient.invalidateQueries({ queryKey: ['admin-carousel'] }); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const toggleActive = (slide: CarouselSlideAdmin) => {
    updateCarouselSlide(slide.id, { is_active: !slide.is_active }).then(() => queryClient.invalidateQueries({ queryKey: ['admin-carousel'] }));
  };

  const openCreate = () => {
    setEditing(null); setImageFile(null);
    setForm({ service_key: '', title: '', title_en: '', subtitle: '', subtitle_en: '', position: slides.length, is_active: true });
    setShowModal(true);
  };
  const openEdit = (s: CarouselSlideAdmin) => {
    setEditing(s); setImageFile(null);
    setForm({
      service_key: s.service_key || '',
      title: s.title,
      title_en: s.title_en,
      subtitle: s.subtitle || '',
      subtitle_en: s.subtitle_en || '',
      position: s.position,
      is_active: s.is_active,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setImageFile(null); };

  const handleServiceSelect = (key: string) => {
    const label = SERVICE_LABELS[key as ServiceId] || key;
    setForm((f) => ({ ...f, service_key: key, title: label, title_en: label }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      cta_text: 'Cotizar', cta_text_en: 'Quote',
      cta_url: form.service_key ? `#cotizar?servicio=${form.service_key}` : '#cotizar',
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload, file: imageFile || undefined });
    } else {
      if (!imageFile) { toast.error('Selecciona una imagen'); return; }
      createMut.mutate({ ...payload, image: imageFile });
    }
  };

  const sorted = [...slides].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-neutral-400">Cada slide representa un servicio cotizable. Recomendado: <strong>{HERO_DIMENSIONS}</strong>.</p>
          <p className="text-xs text-neutral-500 mt-1">Máximo {MAX_HERO_SLIDES} slides · JPEG, PNG o WebP · Máx {MAX_IMAGE_SIZE_MB} MB</p>
        </div>
        <Button onClick={openCreate} disabled={slides.length >= MAX_HERO_SLIDES} className="flex-shrink-0"><PlusIcon className="h-5 w-5 mr-1" /> Nuevo Slide</Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <PhotoIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">No hay slides — el landing muestra imágenes por defecto</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>Agregar primer slide</Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((slide) => (
            <Card key={slide.id} className="p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-full sm:w-36 h-36 sm:h-20 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {slide.image ? <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><PhotoIcon className="h-8 w-8 text-neutral-600" /></div>}
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                    <h3 className="font-medium text-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{slide.title || 'Sin título'}</h3>
                    <Badge variant={slide.is_active ? 'success' : 'default'} className="text-[10px] sm:text-xs">{slide.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  {slide.subtitle && <p className="text-xs text-neutral-400 truncate">{slide.subtitle}</p>}
                  {slide.service_key && <p className="text-[11px] sm:text-xs text-cyan-400">Servicio: {SERVICE_LABELS[slide.service_key as ServiceId] || slide.service_key}</p>}
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Pos: {slide.position}</p>
                </div>
                <div className="flex items-center gap-1 w-full sm:w-auto justify-end border-t sm:border-t-0 border-neutral-800 pt-2 sm:pt-0 mt-1 sm:mt-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(slide)}>{slide.is_active ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(slide)}><PencilIcon className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(slide.id); }}><TrashIcon className="h-5 w-5 text-red-400" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar Slide' : 'Nuevo Slide'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ImageUploadInput label="Imagen" required={!editing} hint={`Recomendado: ${HERO_DIMENSIONS}. Máx ${MAX_IMAGE_SIZE_MB} MB.`} currentUrl={editing?.image} onChange={setImageFile} />

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Servicio que representa <span className="text-red-400">*</span></label>
            <select value={form.service_key} onChange={(e) => handleServiceSelect(e.target.value)} required
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm">
              <option value="">— Selecciona un servicio —</option>
              {SERVICE_IDS.map((sid) => (
                <option key={sid} value={sid}>{SERVICE_LABELS[sid]}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">El título se auto-genera del servicio. Al dar clic, redirige al cotizador.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Título (ES)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Título (EN)" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Descripción bajo título (ES)"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              rows={3}
              placeholder="Describe este servicio para el hero"
            />
            <Textarea
              label="Descripción bajo título (EN)"
              value={form.subtitle_en}
              onChange={(e) => setForm({ ...form, subtitle_en: e.target.value })}
              rows={3}
              placeholder="Describe this service for the hero"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="number" label="Posición" value={form.position.toString()} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} />
            <div className="flex items-center gap-2 pt-8">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500" />
              <label className="text-sm text-white">Activo</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES TAB — Auto-synced 9 services with per-subtype image management
// ═══════════════════════════════════════════════════════════════════════════
function ServicesTab({ services, queryClient }: { services: ServiceAdmin[]; queryClient: ReturnType<typeof useQueryClient> }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSvc, setEditingSvc] = useState<ServiceAdmin | null>(null);
  const [editForm, setEditForm] = useState({ name: '', name_en: '', description: '', description_en: '', icon: '', cta_text: 'Cotizar', cta_text_en: 'Quote', cta_url: '#cotizar', is_featured: false, is_active: true });

  // Auto-sync: ensure all 9 services exist in the backend
  useEffect(() => {
    if (synced) return;
    const existingKeys = new Set(services.map((s) => s.service_key).filter(Boolean));
    const missing = SERVICE_SYNC_DEFINITIONS.filter((d) => !existingKeys.has(d.service_key));
    if (missing.length === 0) { setSynced(true); return; }
    syncServices(SERVICE_SYNC_DEFINITIONS)
      .then((res) => {
        if (res.created.length > 0) {
          toast.success(`${res.created.length} servicio(s) sincronizado(s)`);
          queryClient.invalidateQueries({ queryKey: ['admin-services'] });
        }
      })
      .catch(() => toast.error('Error al sincronizar servicios'))
      .finally(() => setSynced(true));
  }, [services, synced, queryClient]);

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceAdmin> }) => updateService(id, data),
    onSuccess: () => { toast.success('Servicio actualizado'); queryClient.invalidateQueries({ queryKey: ['admin-services'] }); setShowEditModal(false); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });

  const openEdit = (s: ServiceAdmin) => {
    setEditingSvc(s);
    setEditForm({ name: s.name, name_en: s.name_en, description: s.description, description_en: s.description_en, icon: s.icon, cta_text: s.cta_text, cta_text_en: s.cta_text_en, cta_url: s.cta_url, is_featured: s.is_featured, is_active: s.is_active });
    setShowEditModal(true);
  };
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSvc) updateMut.mutate({ id: editingSvc.id, data: editForm });
  };

  const sorted = [...services].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-neutral-400">Los <strong>9 servicios</strong> del sistema. Clic en cada uno para gestionar <strong>imágenes por subtipo</strong>.</p>
        <p className="text-xs text-neutral-500 mt-1">1 imagen por subtipo · Recomendado: <strong>{SERVICE_DIMENSIONS}</strong></p>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12"><PhotoIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" /><p className="text-neutral-400">Sincronizando servicios…</p></Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((svc) => {
            const key = svc.service_key || '';
            const subtypes = ALL_SERVICE_SUBCATEGORIES[key] || [];
            const isExpanded = expandedKey === svc.id;

            return (
              <div key={svc.id}>
                <Card className="p-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center flex-shrink-0 text-xl">{svc.icon || '📋'}</div>
                    <div className="flex-1 min-w-0 cursor-pointer w-full" onClick={() => setExpandedKey(isExpanded ? null : svc.id)}>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                        <h3 className="font-medium text-white truncate">{svc.name}</h3>
                        <Badge variant={svc.is_active ? 'success' : 'default'}>{svc.is_active ? 'Activo' : 'Inactivo'}</Badge>
                        {svc.is_featured && <Badge variant="cyan">Destacado</Badge>}
                        {subtypes.length > 0 && <span className="text-[10px] text-neutral-500">{subtypes.length} subtipos</span>}
                      </div>
                      <p className="text-sm text-neutral-400 truncate">{svc.description}</p>
                      <p className="text-xs text-cyan-400 mt-0.5 flex items-center gap-1">
                        <PhotoIcon className="h-3.5 w-3.5" />
                        {isExpanded ? 'Clic para cerrar' : 'Clic para gestionar imágenes por subtipo'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: svc.id, data: { is_active: !svc.is_active } })}>
                        {svc.is_active ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(svc)}><PencilIcon className="h-5 w-5" /></Button>
                    </div>
                  </div>
                </Card>
                {isExpanded && (
                  <div className="sm:ml-6 mt-2 mb-4">
                    <ServiceSubtypeImagesPanel serviceId={svc.id} serviceKey={key} queryClient={queryClient} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Servicio" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre (ES)" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            <Input label="Nombre (EN)" value={editForm.name_en} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea label="Descripción (ES)" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} required />
            <Textarea label="Descripción (EN)" value={editForm.description_en} onChange={(e) => setEditForm({ ...editForm, description_en: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Icono (emoji)" value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} placeholder="🖨️" />
            <Input label="Texto CTA" value={editForm.cta_text} onChange={(e) => setEditForm({ ...editForm, cta_text: e.target.value })} />
            <Input label="URL CTA" value={editForm.cta_url} onChange={(e) => setEditForm({ ...editForm, cta_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500" />
              <label className="text-sm text-white">Activo</label>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={editForm.is_featured} onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500" />
              <label className="text-sm text-white">Destacado</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={updateMut.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Service Subtype Images Panel — 1 image per subtype ──────────────────
function ServiceSubtypeImagesPanel({ serviceId, serviceKey, queryClient }: {
  serviceId: string; serviceKey: string; queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['admin-service-images', serviceId],
    queryFn: () => getAdminServiceImages(serviceId),
  });
  const uploadMut = useMutation({
    mutationFn: createServiceImage,
    onSuccess: () => {
      toast.success('Imagen subida');
      queryClient.invalidateQueries({ queryKey: ['admin-service-images', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['landing-data'] });
    },
    onError: (err) => {
      console.error('[Upload] Error uploading service image:', { serviceId, serviceKey, err });
      toast.error(getApiErrorMessage(err, 'Error al subir imagen'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteServiceImage,
    onSuccess: () => {
      toast.success('Imagen eliminada');
      queryClient.invalidateQueries({ queryKey: ['admin-service-images', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['landing-data'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const subtypes = ALL_SERVICE_SUBCATEGORIES[serviceKey] || [];

  // Build a map: subtype_key → image
  const imageBySubtype = new Map<string, ServiceImageAdmin>();
  images.forEach((img) => {
    if (img.subtype_key) imageBySubtype.set(img.subtype_key, img);
  });

  const handleUpload = useCallback((subtypeId: string, subtypeLabel: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) { toast.error(`Máximo ${MAX_IMAGE_SIZE_MB} MB`); return; }
    uploadMut.mutate({
      service: serviceId,
      image: file,
      alt_text: subtypeLabel,
      subtype_key: subtypeId,
      position: images.length,
    });
    const ref = fileRefs.current[subtypeId];
    if (ref) ref.value = '';
  }, [serviceId, images.length, uploadMut]);

  if (isLoading) return <p className="text-sm text-neutral-500 py-2">Cargando imágenes…</p>;

  if (subtypes.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 text-center">Este servicio no tiene subtipos definidos.</p>
      </div>
    );
  }

  const completedCount = subtypes.filter((st) => imageBySubtype.has(st.id)).length;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-neutral-200">
        Imágenes por subtipo ({completedCount}/{subtypes.length})
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {subtypes.map((st) => {
          const existing = imageBySubtype.get(st.id);
          return (
            <div key={st.id} className="relative rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800">
              {/* Subtype label */}
              <div className="px-2 py-1.5 bg-neutral-700/50 border-b border-neutral-700">
                <p className="text-xs font-medium text-neutral-200 truncate">{st.label}</p>
              </div>

              <div className="aspect-[4/3] relative">
                {existing ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={existing.image} alt={existing.alt_text} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => { if (confirm(`¿Eliminar imagen de "${st.label}"?`)) deleteMut.mutate(existing.id); }}
                        className="p-1.5 bg-red-500/80 rounded-full text-white hover:bg-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1 right-1 text-[10px] bg-green-500/80 text-white px-1.5 py-0.5 rounded">✓</span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRefs.current[st.id]?.click()}
                    disabled={uploadMut.isPending}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-cyan-400 hover:bg-neutral-700/30 transition-colors"
                  >
                    <PhotoIcon className="h-8 w-8" />
                    <span className="text-[10px]">{uploadMut.isPending ? 'Subiendo…' : 'Subir imagen'}</span>
                  </button>
                )}
              </div>

              <input
                ref={(el) => { fileRefs.current[st.id] = el; }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload(st.id, st.label)}
                className="hidden"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIDEOS TAB — Max 2 videos
// ═══════════════════════════════════════════════════════════════════════════
function VideosTab({ videos, queryClient }: { videos: PortfolioVideoAdmin[]; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PortfolioVideoAdmin | null>(null);
  const [form, setForm] = useState({ youtube_id: '', title: '', title_en: '', orientation: 'vertical' as 'vertical' | 'horizontal', position: 0, is_active: true });

  const createMut = useMutation({
    mutationFn: createPortfolioVideo,
    onSuccess: () => { toast.success('Video agregado'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio-videos'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear')),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PortfolioVideoAdmin> }) => updatePortfolioVideo(id, data),
    onSuccess: () => { toast.success('Video actualizado'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio-videos'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });
  const deleteMut = useMutation({
    mutationFn: deletePortfolioVideo,
    onSuccess: () => { toast.success('Video eliminado'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio-videos'] }); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const openCreate = () => { setEditing(null); setForm({ youtube_id: '', title: '', title_en: '', orientation: 'vertical', position: videos.length, is_active: true }); setShowModal(true); };
  const openEdit = (v: PortfolioVideoAdmin) => { setEditing(v); setForm({ youtube_id: v.youtube_id, title: v.title, title_en: v.title_en, orientation: v.orientation, position: v.position, is_active: v.is_active }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form as Omit<PortfolioVideoAdmin, 'id' | 'thumbnail_url'>);
  };

  const sorted = [...videos].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-neutral-400">Videos de YouTube para &quot;Trabajos que hablan por nosotros&quot;.</p>
          <p className="text-xs text-neutral-500 mt-1">Máximo {MAX_PORTFOLIO_VIDEOS} videos · Pega URL o solo el ID</p>
          <p className="text-xs text-neutral-500">Ambos vertical → lado a lado · Si alguno es horizontal → carrusel manual</p>
        </div>
        <Button onClick={openCreate} disabled={videos.length >= MAX_PORTFOLIO_VIDEOS} className="flex-shrink-0"><PlusIcon className="h-5 w-5 mr-1" /> Nuevo Video</Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12"><FilmIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" /><p className="text-neutral-400">No hay videos — el landing muestra videos por defecto</p><Button variant="outline" className="mt-4" onClick={openCreate}>Agregar primer video</Button></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className={cn('relative bg-neutral-800 overflow-hidden', v.orientation === 'vertical' ? 'aspect-[9/16] max-h-72' : 'aspect-video')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center"><PlayIcon className="h-6 w-6 text-white ml-0.5" /></div></div>
                <Badge variant="default" className="absolute top-2 right-2 text-[10px]">{v.orientation === 'vertical' ? '9:16' : '16:9'}</Badge>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate flex-1">{v.title || v.youtube_id}</p>
                  <Badge variant={v.is_active ? 'success' : 'default'} className="text-[10px]">{v.is_active ? 'Activo' : 'Oculto'}</Badge>
                </div>
                <p className="text-xs text-neutral-500">ID: {v.youtube_id}</p>
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(v)}><PencilIcon className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: v.id, data: { is_active: !v.is_active } })}>{v.is_active ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Eliminar?')) deleteMut.mutate(v.id); }}><TrashIcon className="h-4 w-4 text-red-400" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar Video' : 'Nuevo Video'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="URL o ID de YouTube" value={form.youtube_id} onChange={(e) => setForm({ ...form, youtube_id: e.target.value })} placeholder="https://youtube.com/shorts/sqOb-gSSQq8" required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Título (ES)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Título (EN)" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Orientación</label>
              <select value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value as 'vertical' | 'horizontal' })} className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm">
                <option value="vertical">Vertical (9:16) — Shorts</option>
                <option value="horizontal">Horizontal (16:9) — Estándar</option>
              </select>
            </div>
            <Input type="number" label="Posición" value={form.position.toString()} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500" />
            <label className="text-sm text-white">Activo (visible en el landing)</label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT LOGOS TAB — Carousel of client logos (scalable 20-30+)
// ═══════════════════════════════════════════════════════════════════════════
const MAX_CLIENT_LOGOS = 50;

function ClientLogosTab({ logos, queryClient }: { logos: ClientLogoAdmin[]; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClientLogoAdmin | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', website: '', position: 0, is_active: true });

  const createMut = useMutation({
    mutationFn: createClientLogo,
    onSuccess: () => { toast.success('Logo agregado'); queryClient.invalidateQueries({ queryKey: ['admin-client-logos'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear logo')),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: Record<string, unknown>; file?: File }) => updateClientLogo(id, data, file),
    onSuccess: () => { toast.success('Logo actualizado'); queryClient.invalidateQueries({ queryKey: ['admin-client-logos'] }); closeModal(); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });
  const deleteMut = useMutation({
    mutationFn: deleteClientLogo,
    onSuccess: () => { toast.success('Logo eliminado'); queryClient.invalidateQueries({ queryKey: ['admin-client-logos'] }); },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const isLegacyClient = (logoId: string) => logoId.startsWith('legacy-client-');

  const toggleActive = (logo: ClientLogoAdmin) => {
    if (isLegacyClient(logo.id)) {
      toast.error('Logo de referencia del landing. Sube este logo al CMS para poder gestionarlo.');
      return;
    }
    updateClientLogo(logo.id, { is_active: !logo.is_active }).then(() => queryClient.invalidateQueries({ queryKey: ['admin-client-logos'] }));
  };

  const openCreate = () => {
    setEditing(null); setLogoFile(null);
    setForm({ name: '', website: '', position: logos.length, is_active: true });
    setShowModal(true);
  };
  const openEdit = (l: ClientLogoAdmin) => {
    if (isLegacyClient(l.id)) {
      toast.error('Logo de referencia del landing. Súbelo como nuevo para editarlo desde CMS.');
      return;
    }
    setEditing(l); setLogoFile(null);
    setForm({ name: l.name, website: l.website || '', position: l.position, is_active: l.is_active });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setLogoFile(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form, file: logoFile || undefined });
    } else {
      if (!logoFile) { toast.error('Selecciona una imagen de logo'); return; }
      createMut.mutate({ ...form, logo: logoFile });
    }
  };

  const sorted = [...logos].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-neutral-400">Logos de clientes mostrados en carrusel infinito en el landing.</p>
          <p className="text-xs text-neutral-500 mt-1">Máximo {MAX_CLIENT_LOGOS} logos · PNG transparente recomendado · Máx {MAX_IMAGE_SIZE_MB} MB</p>
        </div>
        <Button onClick={openCreate} disabled={logos.length >= MAX_CLIENT_LOGOS} className="flex-shrink-0">
          <PlusIcon className="h-5 w-5 mr-1" /> Nuevo Logo
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <UserGroupIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">No hay logos de clientes — agrega el primero</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>Agregar primer logo</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sorted.map((logo) => (
            <Card key={logo.id} className="overflow-hidden group relative">
              <div className="aspect-[3/2] bg-neutral-800 flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.logo} alt={logo.name} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-white truncate flex-1">{logo.name}</p>
                  <Badge variant={logo.is_active ? 'success' : 'default'} className="text-[10px] flex-shrink-0">
                    {logo.is_active ? 'Activo' : 'Oculto'}
                  </Badge>
                </div>
                {logo.website && (
                  <a href={logo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:underline truncate">
                    <GlobeAltIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{logo.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                <div className="flex gap-0.5 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(logo)} className="!p-1"><PencilIcon className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(logo)} className="!p-1">
                    {logo.is_active ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeSlashIcon className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isLegacyClient(logo.id)) {
                        toast.error('Logo de referencia del landing. Súbelo al CMS para poder eliminarlo desde aquí.');
                        return;
                      }
                      if (confirm('¿Eliminar logo?')) deleteMut.mutate(logo.id);
                    }}
                    className="!p-1"
                  >
                    <TrashIcon className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar Logo de Cliente' : 'Nuevo Logo de Cliente'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ImageUploadInput
            label="Logo del cliente"
            required={!editing}
            hint={`PNG transparente recomendado. Máx ${MAX_IMAGE_SIZE_MB} MB.`}
            currentUrl={editing?.logo}
            onChange={setLogoFile}
          />

          <Input
            label="Nombre del cliente"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre de la empresa"
            required
          />

          <Input
            label="Sitio web (opcional)"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://www.ejemplo.com"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Posición"
              value={form.position.toString()}
              onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })}
            />
            <div className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-800 text-cyan-500"
              />
              <label className="text-sm text-white">Activo (visible en el landing)</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIO TAB — Unified image + video gallery "Trabajos que hablan por nosotros"
// ═══════════════════════════════════════════════════════════════════════════
function PortfolioTab({ portfolios, queryClient }: { portfolios: PortfolioItemAdmin[]; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PortfolioItemAdmin | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [form, setForm] = useState<{
    media_type: 'image' | 'video';
    youtube_id?: string;
    title: string;
    title_en: string;
    aspect_ratio: 'landscape_16_9' | 'portrait_reel_9_16';
    position: number;
    is_active: boolean;
  }>({
    media_type: 'image',
    youtube_id: '',
    title: '',
    title_en: '',
    aspect_ratio: 'landscape_16_9',
    position: 0,
    is_active: true,
  });

  const createMut = useMutation({
    mutationFn: createPortfolioItem,
    onSuccess: () => {
      toast.success('Trabajo agregado');
      queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al crear')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: Partial<PortfolioItemAdmin>; file?: File }) =>
      updatePortfolioItem(id, data, file),
    onSuccess: () => {
      toast.success('Trabajo actualizado');
      queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al actualizar')),
  });

  const deleteMut = useMutation({
    mutationFn: deletePortfolioItem,
    onSuccess: () => {
      toast.success('Trabajo eliminado');
      queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Error al eliminar')),
  });

  const isLegacyItem = (itemId: string) => itemId.startsWith('legacy-');
  const getLegacySource = (itemId: string): { kind: 'video' | 'image'; id: string } | null => {
    if (itemId.startsWith('legacy-video-')) return { kind: 'video', id: itemId.replace('legacy-video-', '') };
    if (itemId.startsWith('legacy-image-')) return { kind: 'image', id: itemId.replace('legacy-image-', '') };
    return null;
  };

  const openCreate = () => {
    setEditing(null);
    setMediaFile(null);
    setForm({
      media_type: 'image',
      youtube_id: '',
      title: '',
      title_en: '',
      aspect_ratio: 'landscape_16_9',
      position: portfolios.length,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEdit = (item: PortfolioItemAdmin) => {
    setEditing(item);
    setMediaFile(null);
    setForm({
      media_type: item.media_type,
      youtube_id: item.youtube_id || '',
      title: item.title,
      title_en: item.title_en,
      aspect_ratio: item.aspect_ratio,
      position: item.position,
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setMediaFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.media_type === 'image' && !mediaFile && !editing?.image) {
      toast.error('Debes seleccionar una imagen');
      return;
    }

    if (form.media_type === 'video' && !form.youtube_id) {
      toast.error('YouTube ID es requerido para videos');
      return;
    }

    if (editing) {
      const legacy = getLegacySource(editing.id);
      if (legacy) {
        try {
          if (legacy.kind === 'video') {
            await updatePortfolioVideo(legacy.id, {
              youtube_id: form.youtube_id || '',
              title: form.title,
              title_en: form.title_en,
              orientation: form.aspect_ratio === 'portrait_reel_9_16' ? 'vertical' : 'horizontal',
              position: form.position,
              is_active: form.is_active,
            });
          } else {
            await updateServiceImageWithFile(
              legacy.id,
              {
                alt_text: form.title,
                alt_text_en: form.title_en,
                display_format: form.aspect_ratio === 'portrait_reel_9_16' ? 'reel' : 'landscape',
                position: form.position,
                is_active: form.is_active,
              } as Partial<ServiceImageAdmin>,
              mediaFile || undefined,
            );
          }
          toast.success('Trabajo actualizado');
          queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
          closeModal();
          return;
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Error al actualizar trabajo legacy'));
          return;
        }
      }

      updateMut.mutate({
        id: editing.id,
        data: form,
        file: mediaFile || undefined,
      });
    } else {
      createMut.mutate({
        media_type: form.media_type,
        youtube_id: form.media_type === 'video' ? form.youtube_id : undefined,
        title: form.title,
        title_en: form.title_en,
        aspect_ratio: form.aspect_ratio,
        position: form.position,
        is_active: form.is_active,
        image: form.media_type === 'image' ? mediaFile || undefined : undefined,
      } as any);
    }
  };

  const toggleActive = async (item: PortfolioItemAdmin) => {
    const legacy = getLegacySource(item.id);
    if (legacy) {
      try {
        if (legacy.kind === 'video') {
          await updatePortfolioVideo(legacy.id, { is_active: !item.is_active });
        } else {
          await updateServiceImageWithFile(
            legacy.id,
            { is_active: !item.is_active } as Partial<ServiceImageAdmin>,
          );
        }
        queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
        return;
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Error al actualizar estado legacy'));
        return;
      }
    }

    updateMut.mutate({
      id: item.id,
      data: { is_active: !item.is_active },
    });
  };

  const sorted = [...portfolios].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-neutral-400">Galería unificada de imágenes y videos para &quot;Trabajos que hablan por nosotros&quot;.</p>
          <p className="text-xs text-neutral-500 mt-1">
            Mezcla imágenes (16:9 landscape o 9:16 reel) con videos de YouTube. Las transiciones en el landing serán suaves.
          </p>
          {sorted.some((item) => isLegacyItem(item.id)) && (
            <p className="text-xs text-amber-400 mt-1">Mostrando contenido legacy del landing de forma dinámica.</p>
          )}
        </div>
        <Button onClick={openCreate} className="gap-2">
          <PlusIcon className="h-4 w-4" /> Agregar
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <PhotoIcon className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">Sin trabajos aún. ¡Comienza agregando tus primeros trabajos!</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((item) => (
            <Card key={item.id} className="p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-20 h-14 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-700">
                  {item.media_type === 'image' && item.image ? (
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  ) : item.media_type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-700">
                      <FilmIcon className="h-6 w-6 text-cyan-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="h-6 w-6 text-neutral-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <Badge variant={item.media_type === 'image' ? 'success' : 'cyan'}>
                      {item.media_type === 'image' ? '🖼️ Imagen' : '🎥 Video'}
                    </Badge>
                    <Badge variant={item.is_active ? 'success' : 'default'}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="default">
                      {item.aspect_ratio === 'landscape_16_9' ? '16:9 Land' : '9:16 Reel'}
                    </Badge>
                  </div>
                  <p className="text-sm text-white font-medium truncate">{item.title || '(Sin título)'}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Pos: {item.position}</p>
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto justify-end border-t sm:border-t-0 border-neutral-800 pt-2 sm:pt-0 mt-1 sm:mt-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(item)}>
                    {item.is_active ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <PencilIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('¿Eliminar?')) return;

                      const legacy = getLegacySource(item.id);
                      if (legacy) {
                        try {
                          if (legacy.kind === 'video') {
                            await deletePortfolioVideo(legacy.id);
                          } else {
                            await deleteServiceImage(legacy.id);
                          }
                          toast.success('Trabajo eliminado');
                          queryClient.invalidateQueries({ queryKey: ['admin-portfolio-items'] });
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, 'Error al eliminar trabajo legacy'));
                        }
                        return;
                      }

                      deleteMut.mutate(item.id);
                    }}
                  >
                    <TrashIcon className="h-5 w-5 text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar Trabajo' : 'Agregar Trabajo'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Tipo <span className="text-red-400">*</span></label>
            <div className="flex gap-4">
              <button type="button" onClick={() => setForm((f) => ({ ...f, media_type: 'image' }))}
                className={cn('flex-1 px-4 py-3 rounded-lg border-2 transition-all',
                  form.media_type === 'image' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-700 bg-neutral-800 text-neutral-400')}>
                <PhotoIcon className="h-5 w-5 inline mr-2" />
                Imagen
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, media_type: 'video' }))}
                className={cn('flex-1 px-4 py-3 rounded-lg border-2 transition-all',
                  form.media_type === 'video' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-neutral-700 bg-neutral-800 text-neutral-400')}>
                <FilmIcon className="h-5 w-5 inline mr-2" />
                Video
              </button>
            </div>
          </div>

          {form.media_type === 'image' && (
            <ImageUploadInput label="Imagen" required={!editing} hint="Máx 5 MB." currentUrl={editing?.image} onChange={setMediaFile} />
          )}

          {form.media_type === 'video' && (
            <Input label="YouTube ID" placeholder="e.g., sqOb-gSSQq8" value={form.youtube_id || ''} onChange={(e) => setForm((f) => ({ ...f, youtube_id: e.target.value }))} required />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Título (ES)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input label="Título (EN)" value={form.title_en} onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Formato <span className="text-red-400">*</span></label>
            <select value={form.aspect_ratio} onChange={(e) => setForm((f) => ({ ...f, aspect_ratio: e.target.value as any }))}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 text-sm">
              <option value="landscape_16_9">📺 Landscape 16:9</option>
              <option value="portrait_reel_9_16">📱 Portrait Reel 9:16</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="number" label="Posición" value={form.position.toString()} onChange={(e) => setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))} />
            <div className="flex items-center gap-2 pt-8">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500" />
              <label className="text-sm text-white">Activo</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}