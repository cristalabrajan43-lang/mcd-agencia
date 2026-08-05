'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import { getAdminUsers, activateUser, deactivateUser, changeUserRole, assignUserGroup, createUserWithPassword, deleteAdminUser, AdminUser } from '@/lib/api/admin';
import { apiClient } from '@/lib/api/client';
import { Card, Badge, Button, Input, Select, Pagination, LoadingPage, Modal } from '@/components/ui';
import { formatDate, getInitials } from '@/lib/utils';

interface Role {
  id: number;
  name: string;
  display_name: string;
}

// Only 3 roles: admin, sales, customer
const ROLE_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: 'customer', label: 'Cliente' },
  { value: 'sales', label: 'Ventas' },
  { value: 'admin', label: 'Administrador' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    role: '',
    is_active: '',
    search: '',
    page: 1,
  });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [userToPromote, setUserToPromote] = useState<{ id: string; name: string } | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showTemporaryPasswordModal, setShowTemporaryPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [showAssignGroupModal, setShowAssignGroupModal] = useState(false);
  const [userToAssignGroup, setUserToAssignGroup] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<'production_supervisors' | 'operations_supervisors'>('production_supervisors');
  
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => getAdminUsers({
      ...filters,
      is_active: filters.is_active === '' ? undefined : filters.is_active === 'true',
    }),
  });

  // Fetch roles to get the sales role ID
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<{ results: Role[] }>('/users/roles/'),
  });

  const salesRole = rolesData?.results?.find((r) => r.name === 'sales');

  const activateMutation = useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      toast.success('Vendedor activado');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Error al activar vendedor'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast.success('Vendedor desactivado');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Error al desactivar vendedor'),
  });

  const promoteToSalesMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      changeUserRole(userId, roleId),
    onSuccess: () => {
      toast.success('Usuario promovido a Vendedor');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowPromoteModal(false);
      setUserToPromote(null);
    },
    onError: () => toast.error('Error al cambiar rol'),
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof createUserForm) => createUserWithPassword(data),
    onSuccess: (data) => {
      toast.success(data.message);
      if (!data.email_sent && data.email_error) {
        toast.error(`Error de correo: ${data.email_error}`);
      }
      setNewUserEmail(data.email);
      if (!data.email_sent && data.temporary_password) {
        setTemporaryPassword(data.temporary_password);
        setShowTemporaryPasswordModal(true);
      }
      setShowCreateUserModal(false);
      setCreateUserForm({ email: '', first_name: '', last_name: '', phone: '', role_id: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Error al crear usuario');
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: ({ userId, group }: { userId: string; group: 'production_supervisors' | 'operations_supervisors' }) =>
      assignUserGroup(userId, group),
    onSuccess: (data) => {
      toast.success(`Usuario asignado al grupo`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAssignGroupModal(false);
      setUserToAssignGroup(null);
    },
    onError: () => toast.error('Error al asignar grupo'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      toast.success('Usuario eliminado');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowDeleteModal(false);
      setUserToDelete(null);
    },
    onError: () => toast.error('Error al eliminar usuario'),
  });

  const handlePromoteToSales = () => {
    if (userToPromote && salesRole) {
      promoteToSalesMutation.mutate({
        userId: userToPromote.id,
        roleId: salesRole.id.toString(),
      });
    }
  };

  const users = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-neutral-400">
            Gestiona los usuarios del sistema
          </p>
        </div>
        <Button
          onClick={() => setShowCreateUserModal(true)}
          className="flex items-center gap-2"
        >
          <UserPlusIcon className="h-5 w-5" />
          Crear Usuario
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre o email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
            />
          </div>
          <Select
            value={filters.role}
            onChange={(value) => setFilters({ ...filters, role: value, page: 1 })}
            options={ROLE_OPTIONS}
            className="w-40"
          />
          <Select
            value={filters.is_active}
            onChange={(value) => setFilters({ ...filters, is_active: value, page: 1 })}
            options={STATUS_OPTIONS}
            className="w-32"
          />
        </div>
      </Card>

      {/* Users Table */}
      {isLoading ? (
        <LoadingPage message="Cargando usuarios..." />
      ) : users.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-neutral-400">No se encontraron usuarios</p>
        </Card>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Usuario
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Rol
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Estado
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Pedidos
                  </th>
                  <th className="text-left text-sm font-medium text-neutral-400 py-3 px-4">
                    Registro
                  </th>
                  <th className="text-right text-sm font-medium text-neutral-400 py-3 px-4">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: AdminUser) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-800 hover:bg-neutral-900/50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(user.full_name || user.email)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.full_name}</p>
                          <p className="text-sm text-neutral-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={user.role?.name === 'admin' ? 'cyan' : user.role?.name === 'sales' ? 'warning' : 'default'}>
                        {user.role?.display_name || 'Cliente'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={user.is_active ? 'success' : 'error'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-neutral-400">
                      {user.orders_count}
                    </td>
                    <td className="py-4 px-4 text-neutral-400">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser(user.id)}
                          title="Ver detalles"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Button>

                        {['sales', 'admin', 'superadmin'].includes(user.role?.name || '') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToAssignGroup({ id: user.id, name: user.full_name || user.email });
                              setShowAssignGroupModal(true);
                            }}
                            title="Asignar a grupo de producción u ოპeraciones"
                          >
                            <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
                            <span className="ml-1 hidden xl:inline text-xs text-blue-400">Grupo</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserToDelete({ id: user.id, name: user.full_name || user.email });
                            setShowDeleteModal(true);
                          }}
                          title="Eliminar usuario"
                        >
                          <TrashIcon className="h-5 w-5 text-red-400" />
                        </Button>

                        {/* Solo mostrar activar/desactivar para vendedores */}
                        {user.role?.name === 'sales' && (
                          user.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deactivateMutation.mutate(user.id)}
                              title="Desactivar vendedor"
                            >
                              <XCircleIcon className="h-5 w-5 text-red-400" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => activateMutation.mutate(user.id)}
                              title="Activar vendedor"
                            >
                              <CheckCircleIcon className="h-5 w-5 text-green-400" />
                            </Button>
                          )
                        )}

                        {/* Opción para promover cliente a vendedor */}
                        {user.role?.name === 'customer' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToPromote({ id: user.id, name: user.full_name || user.email });
                              setShowPromoteModal(true);
                            }}
                            title="Promover a Vendedor"
                          >
                            <ArrowPathIcon className="h-5 w-5 text-yellow-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {users.map((user: AdminUser) => (
              <Card key={user.id} padding="sm" className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(user.full_name || user.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{user.full_name}</p>
                    <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                  </div>
                  <Badge variant={user.is_active ? 'success' : 'error'}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <Badge variant={user.role?.name === 'admin' ? 'cyan' : user.role?.name === 'sales' ? 'warning' : 'default'}>
                    {user.role?.display_name || 'Cliente'}
                  </Badge>
                  <span className="text-neutral-500">{user.orders_count} pedidos</span>
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-neutral-800 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user.id)} title="Ver detalles">
                    <EyeIcon className="h-5 w-5" />
                  </Button>

                  {['sales', 'admin', 'superadmin'].includes(user.role?.name || '') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserToAssignGroup({ id: user.id, name: user.full_name || user.email });
                        setShowAssignGroupModal(true);
                      }}
                      title="Asignar grupo"
                    >
                      <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserToDelete({ id: user.id, name: user.full_name || user.email });
                      setShowDeleteModal(true);
                    }}
                    title="Eliminar"
                  >
                    <TrashIcon className="h-5 w-5 text-red-400" />
                  </Button>

                  {user.role?.name === 'sales' && (
                    user.is_active ? (
                      <Button variant="ghost" size="sm" onClick={() => deactivateMutation.mutate(user.id)} title="Desactivar vendedor">
                        <XCircleIcon className="h-5 w-5 text-red-400" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(user.id)} title="Activar vendedor">
                        <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      </Button>
                    )
                  )}

                  {user.role?.name === 'customer' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserToPromote({ id: user.id, name: user.full_name || user.email });
                        setShowPromoteModal(true);
                      }}
                      title="Promover a vendedor"
                    >
                      <ArrowPathIcon className="h-5 w-5 text-yellow-400" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </>
      )}

      {/* Modal para promover a vendedor */}
      <Modal
        isOpen={showPromoteModal}
        onClose={() => {
          setShowPromoteModal(false);
          setUserToPromote(null);
        }}
        title="Promover a Vendedor"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            ¿Estás seguro de que deseas promover a <strong className="text-white">{userToPromote?.name}</strong> al rol de Vendedor?
          </p>
          <p className="text-sm text-neutral-400">
            Esta acción le dará acceso al panel de ventas y la capacidad de gestionar cotizaciones y pedidos.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowPromoteModal(false);
                setUserToPromote(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePromoteToSales}
              isLoading={promoteToSalesMutation.isPending}
            >
              Promover a Vendedor
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para crear usuario */}
      <Modal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        title="Crear Nuevo Usuario"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Email *</label>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={createUserForm.email}
              onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Nombre</label>
              <Input
                placeholder="Juan"
                value={createUserForm.first_name}
                onChange={(e) => setCreateUserForm({ ...createUserForm, first_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Apellido</label>
              <Input
                placeholder="Pérez"
                value={createUserForm.last_name}
                onChange={(e) => setCreateUserForm({ ...createUserForm, last_name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Teléfono</label>
            <Input
              placeholder="+54 9 11 1234-5678"
              value={createUserForm.phone}
              onChange={(e) => setCreateUserForm({ ...createUserForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Rol</label>
            <Select
              value={createUserForm.role_id}
              onChange={(value) => setCreateUserForm({ ...createUserForm, role_id: value })}
              options={[
                { value: '', label: 'Selecciona un rol' },
                ...(rolesData?.results?.map((role) => ({ value: role.id.toString(), label: role.display_name })) || []),
              ]}
            />
          </div>
          <p className="text-xs text-neutral-400">
            Se enviará un correo al usuario para completar su registro y crear su contraseña final.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateUserModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createUserMutation.mutate(createUserForm)}
              isLoading={createUserMutation.isPending}
              disabled={!createUserForm.email}
            >
              Crear Usuario
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para mostrar contraseña temporal */}
      <Modal
        isOpen={showTemporaryPasswordModal}
        onClose={() => setShowTemporaryPasswordModal(false)}
        title="Usuario Creado"
      >
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-green-400 mb-2">✓ Usuario creado exitosamente</h3>
            <p className="text-sm text-green-300">
              Email: <span className="font-mono text-white">{newUserEmail}</span>
            </p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-300 font-semibold mb-2">Contraseña Temporal:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={temporaryPassword}
                readOnly
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white font-mono text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(temporaryPassword);
                  toast.success('Contraseña copiada');
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
          <p className="text-xs text-neutral-400">
            Comparte esta contraseña con el usuario. Debe cambiarla en su primer acceso.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setShowTemporaryPasswordModal(false)}
            >
              Entendido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para asignar grupo */}
      <Modal
        isOpen={showAssignGroupModal}
        onClose={() => {
          setShowAssignGroupModal(false);
          setUserToAssignGroup(null);
        }}
        title="Asignar Grupo"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            Asignar <strong className="text-white">{userToAssignGroup?.name}</strong> a un grupo operacional:
          </p>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value as 'production_supervisors' | 'operations_supervisors')}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
            >
              <option value="production_supervisors">Supervisores de Producción</option>
              <option value="operations_supervisors">Supervisores de Operaciones (Logística e Instalación)</option>
            </select>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              {selectedGroup === 'production_supervisors'
                ? 'Este usuario podrá gestionar y actualizar el estado de trabajos de producción.'
                : 'Este usuario podrá gestionar y actualizar el estado de entregas e instalaciones.'}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignGroupModal(false);
                setUserToAssignGroup(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (userToAssignGroup) {
                  assignGroupMutation.mutate({
                    userId: userToAssignGroup.id,
                    group: selectedGroup,
                  });
                }
              }}
              isLoading={assignGroupMutation.isPending}
            >
              Asignar Grupo
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        title="Eliminar Usuario"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            ¿Quieres eliminar a <strong className="text-white">{userToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-neutral-400">
            Esta acción aplica soft delete y quita el acceso del usuario.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setUserToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (userToDelete) {
                  deleteUserMutation.mutate(userToDelete.id);
                }
              }}
              isLoading={deleteUserMutation.isPending}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
