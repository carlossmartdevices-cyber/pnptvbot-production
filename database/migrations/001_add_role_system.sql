-- Migration: 001_add_role_system.sql
-- Created: 2026-02-19
-- Description: Add complete role-based access control system

BEGIN;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  UNIQUE(user_id, role_id)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to users (for primary role backward compatibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER DEFAULT 1 REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_role VARCHAR(50) DEFAULT 'user';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Insert default roles
INSERT INTO roles (name, display_name, description, rank, is_system) VALUES
  ('superadmin', 'Super Administrador', 'Acceso absoluto a todo el sistema', 4, true),
  ('admin', 'Administrador', 'Administrador de la plataforma', 3, true),
  ('moderator', 'Moderador', 'Puede moderar contenido y usuarios', 2, true),
  ('model', 'Modelo/Creador', 'Creador de contenido', 1, true),
  ('user', 'Usuario', 'Usuario regular', 0, true)
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, display_name, description, category) VALUES
  -- Content Management
  ('upload_content', 'Subir Contenido', 'Puede subir videos y música', 'content'),
  ('edit_content', 'Editar Contenido', 'Puede editar su propio contenido', 'content'),
  ('approve_content', 'Aprobar Contenido', 'Puede aprobar contenido de otros', 'content'),
  ('reject_content', 'Rechazar Contenido', 'Puede rechazar contenido de otros', 'content'),
  ('delete_content', 'Eliminar Contenido', 'Puede eliminar contenido de otros', 'content'),
  ('view_content_reports', 'Ver Reportes de Contenido', 'Puede ver reportes de contenido', 'content'),

  -- User Management
  ('view_users', 'Ver Usuarios', 'Puede ver lista de usuarios', 'users'),
  ('edit_users', 'Editar Usuarios', 'Puede editar datos de usuarios', 'users'),
  ('suspend_users', 'Suspender Usuarios', 'Puede suspender usuarios temporalmente', 'users'),
  ('delete_users', 'Eliminar Usuarios', 'Puede eliminar usuarios permanentemente', 'users'),
  ('view_user_reports', 'Ver Reportes de Usuarios', 'Puede ver reportes de usuarios', 'users'),

  -- Role Management
  ('assign_roles', 'Asignar Roles', 'Puede asignar roles a usuarios', 'roles'),
  ('manage_moderators', 'Gestionar Moderadores', 'Puede gestionar permisos de moderadores', 'roles'),
  ('manage_admins', 'Gestionar Admins', 'Puede gestionar otros admins', 'roles'),

  -- Radio & Media
  ('manage_radio', 'Gestionar Radio', 'Acceso completo a radio', 'radio'),
  ('manage_videorama', 'Gestionar Videorama', 'Acceso completo a videorama', 'videorama'),

  -- Platform
  ('view_reports', 'Ver Reportes', 'Puede ver reportes de plataforma', 'reports'),
  ('manage_settings', 'Gestionar Configuración', 'Puede cambiar configuración del sistema', 'settings'),
  ('view_audit_logs', 'Ver Logs de Auditoría', 'Puede ver logs de auditoría', 'audit'),
  ('view_analytics', 'Ver Analíticas', 'Puede ver analíticas de plataforma', 'analytics')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to superadmin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN (
  'upload_content', 'edit_content', 'approve_content', 'reject_content', 'delete_content', 'view_content_reports',
  'view_users', 'edit_users', 'suspend_users', 'view_user_reports',
  'assign_roles', 'manage_moderators',
  'manage_radio', 'manage_videorama',
  'view_reports', 'view_audit_logs', 'view_analytics'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to moderator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.name IN (
  'upload_content', 'edit_content', 'approve_content', 'reject_content', 'view_content_reports',
  'view_users', 'suspend_users', 'view_user_reports',
  'view_reports', 'view_audit_logs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to model
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'model' AND p.name IN (
  'upload_content', 'edit_content', 'view_content_reports', 'view_analytics'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to user
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
  'upload_content', 'view_analytics'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
