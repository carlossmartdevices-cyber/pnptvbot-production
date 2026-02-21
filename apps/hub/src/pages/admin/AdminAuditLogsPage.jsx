import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: ''
  });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        ...filters
      };

      const response = await apiClient.getAdminAuditLogs(params);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading logs:', error);
      alert('Error al cargar logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Logs de Auditoría</h1>
      <p className="text-gray-600 mb-6">Historial completo de cambios en la plataforma</p>

      <div className="mb-6 flex gap-4 bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          placeholder="Filtrar por acción..."
          value={filters.action}
          onChange={(e) => handleFilterChange('action', e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg flex-1"
        />
        <select
          value={filters.resourceType}
          onChange={(e) => handleFilterChange('resourceType', e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todos los tipos</option>
          <option value="user">Usuario</option>
          <option value="content">Contenido</option>
          <option value="role">Rol</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="spinner-lg"></div>
          <p className="text-gray-600 mt-4">Cargando logs...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Acción</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Recurso</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No hay logs de auditoría
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{log.actor_email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {log.resource_type} #{log.resource_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.metadata && (
                          <span title={JSON.stringify(log.metadata, null, 2)}>
                            {JSON.stringify(log.metadata).substring(0, 40)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {logs.length > 0 && (
            <div className="mt-6 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, total)} de {total} logs
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
    </div>
  );
}
