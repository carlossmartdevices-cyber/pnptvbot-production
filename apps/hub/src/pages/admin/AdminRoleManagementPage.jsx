import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function AdminRoleManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadUsers();
    }
  }, [selectedRole, page]);

  const loadRoles = async () => {
    try {
      const response = await apiClient.getAdminRoles();
      setRoles(response.data);
      if (response.data.length > 0) {
        setSelectedRole(response.data[0].name);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      alert('Error al cargar roles: ' + error.message);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAdminUsersByRole(selectedRole, page, 20);
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Error al cargar usuarios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role || 'user');
    setReason('');
    setShowRoleModal(true);
  };

  const assignNewRole = async () => {
    if (!selectedUser || !newRole) return;

    setSaving(true);
    try {
      await apiClient.assignAdminUserRole(selectedUser.id, newRole, reason);
      alert('✅ Rol asignado exitosamente');
      setShowRoleModal(false);
      loadUsers();
      loadRoles();
    } catch (error) {
      alert('❌ Error al asignar rol: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Roles</h1>
      <p className="text-gray-600 mb-6">Asigna y gestiona roles de usuarios en la plataforma</p>

      <div className="mb-6 flex gap-4">
        <select
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white font-medium"
        >
          <option value="">Selecciona un rol</option>
          {roles.map((role) => (
            <option key={role.name} value={role.name}>
              {role.display_name} ({role.user_count} usuarios)
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="spinner-lg"></div>
          <p className="text-gray-600 mt-4">Cargando usuarios...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Username</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Rol Actual</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No hay usuarios con este rol
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{user.email}</td>
                      <td className="px-6 py-4 text-sm">{user.username || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                          {user.display_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openRoleModal(user)}
                          className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                        >
                          Cambiar Rol
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {users.length > 0 && (
            <div className="mt-6 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, total)} de {total} usuarios
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  ← Anterior
                </button>
                <span className="px-4 py-2 font-medium">
                  {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Cambiar rol de <span className="text-blue-600">{selectedUser.email}</span>
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Nuevo Rol</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium"
              >
                {roles.map((role) => (
                  <option key={role.name} value={role.name}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Razón (Opcional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Promoción a moderador por buen comportamiento"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                rows="3"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={assignNewRole}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
