'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  UserPlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, Button, Badge, LoadingPage, Spinner } from '@/components/ui';
import { apiClient } from '@/lib/api/client';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  source_display: string;
  status: string;
  status_display: string;
  message: string;
  notes: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadsResponse {
  results: Lead[];
  count: number;
  next: string | null;
  previous: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Todas las fuentes' },
  { value: 'contact_form', label: 'Formulario de contacto' },
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'quote_request', label: 'Solicitud de cotización' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Llamada telefónica' },
  { value: 'referral', label: 'Referido' },
  { value: 'other', label: 'Otro' },
];

const getStatusColor = (status: string): 'default' | 'info' | 'warning' | 'success' | 'error' => {
  switch (status) {
    case 'new': return 'info';
    case 'contacted': return 'warning';
    case 'qualified': return 'cyan' as 'info';
    case 'converted': return 'success';
    case 'lost': return 'error';
    default: return 'default';
  }
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'contact_form': return '📝';
    case 'chatbot': return '🤖';
    case 'quote_request': return '📋';
    case 'whatsapp': return '💬';
    case 'phone': return '📞';
    case 'referral': return '👥';
    default: return '📌';
  }
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const permissions = usePermissions();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const pageSize = 20;

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('page_size', pageSize.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);

      const response = await apiClient.get<LeadsResponse>(`/chatbot/leads/?${params.toString()}`);
      setLeads(response.results);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Error al cargar los leads');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, sourceFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard/leads`);
      } else if (!permissions.canAccessAdmin) {
        router.push(`/${locale}`);
      } else {
        fetchLeads();
      }
    }
  }, [authLoading, isAuthenticated, permissions.canAccessAdmin, router, locale, fetchLeads]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      setIsUpdating(true);
      await apiClient.patch(`/chatbot/leads/${leadId}/`, { status: newStatus });
      toast.success('Estado actualizado');
      fetchLeads();
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Error al actualizar el estado');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !permissions.canAccessAdmin) {
    return null;
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="pb-8">
      <div>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Leads</h1>
            <p className="text-neutral-400">
              Gestiona los leads capturados ({totalCount} en total)
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o empresa..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-neutral-500" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads List */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlusIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400">No se encontraron leads</p>
                </div>
              ) : (
                <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Lead</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Fuente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {leads.map((lead) => (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`cursor-pointer transition-colors hover:bg-neutral-800/50 ${
                            selectedLead?.id === lead.id ? 'bg-neutral-800/70' : ''
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-white">{lead.name}</p>
                              <p className="text-sm text-neutral-400">{lead.email}</p>
                              {lead.company && (
                                <p className="text-xs text-neutral-500">{lead.company}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm">
                              {getSourceIcon(lead.source)} {lead.source_display}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={getStatusColor(lead.status)}>
                              {lead.status_display}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-sm text-neutral-400">
                            {formatDate(lead.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2 p-3">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedLead?.id === lead.id
                          ? 'border-cyan-500/40 bg-neutral-800/70'
                          : 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{lead.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{lead.email}</p>
                        </div>
                        <Badge variant={getStatusColor(lead.status)}>
                          {lead.status_display}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-neutral-400 truncate">
                          {getSourceIcon(lead.source)} {lead.source_display}
                        </span>
                        <span className="text-neutral-500">{formatDate(lead.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
                  <p className="text-sm text-neutral-400">
                    Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Lead Detail */}
          <div className="lg:col-span-1">
            {selectedLead ? (
              <Card className="p-6 sticky top-4">
                <h3 className="text-lg font-semibold text-white mb-4">Detalle del Lead</h3>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <p className="text-sm text-neutral-400">Nombre</p>
                    <p className="text-white font-medium">{selectedLead.name}</p>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col gap-2">
                    <a
                      href={`mailto:${selectedLead.email}`}
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      {selectedLead.email}
                    </a>
                    {selectedLead.phone && (
                      <a
                        href={`tel:${selectedLead.phone}`}
                        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                      >
                        <PhoneIcon className="h-4 w-4" />
                        {selectedLead.phone}
                      </a>
                    )}
                    {selectedLead.company && (
                      <div className="flex items-center gap-2 text-neutral-300">
                        <BuildingOfficeIcon className="h-4 w-4" />
                        {selectedLead.company}
                      </div>
                    )}
                  </div>

                  {/* Source & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-neutral-400">Fuente</p>
                      <p className="text-white">
                        {getSourceIcon(selectedLead.source)} {selectedLead.source_display}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-400 mb-1">Estado</p>
                      <select
                        value={selectedLead.status}
                        onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                        disabled={isUpdating}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        {STATUS_OPTIONS.filter(o => o.value).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  {selectedLead.message && (
                    <div>
                      <p className="text-sm text-neutral-400 mb-1">Mensaje</p>
                      <p className="text-neutral-300 text-sm bg-neutral-800/50 p-3 rounded-lg">
                        {selectedLead.message}
                      </p>
                    </div>
                  )}

                  {/* Assigned To */}
                  {selectedLead.assigned_to_name && (
                    <div>
                      <p className="text-sm text-neutral-400">Asignado a</p>
                      <p className="text-white">{selectedLead.assigned_to_name}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="pt-4 border-t border-neutral-800">
                    <p className="text-xs text-neutral-500">
                      Creado: {formatDate(selectedLead.created_at)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Actualizado: {formatDate(selectedLead.updated_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(`https://wa.me/${selectedLead.phone?.replace(/\D/g, '')}`, '_blank')}
                      disabled={!selectedLead.phone}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.location.href = `mailto:${selectedLead.email}`}
                    >
                      Email
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <UserPlusIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-400">Selecciona un lead para ver sus detalles</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
