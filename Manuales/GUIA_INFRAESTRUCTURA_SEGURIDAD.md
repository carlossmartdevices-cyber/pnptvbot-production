# 🔒 GUÍA CONSOLIDADA - INFRAESTRUCTURA & SEGURIDAD

**Consolidado de**:
- `pnptv-infrastructure-specification.md` (3,777 líneas)
- `pnptv-security-operations-complete.md` (1,062 líneas)

**Versión**: 1.0
**Fecha**: 2026-02-13
**Estado**: Production-Grade
**Clasificación**: TÉCNICO - Para DevOps/SysAdmin

---

## 📑 TABLA DE CONTENIDOS

1. [Especificación de Infraestructura](#especificación-de-infraestructura)
2. [Arquitectura de Dominios](#arquitectura-de-dominios)
3. [Modelo de Seguridad Zero-Trust](#modelo-de-seguridad-zero-trust)
4. [Layers de Seguridad](#layers-de-seguridad)
5. [Gestión de Identidades](#gestión-de-identidades)
6. [Certificados y TLS](#certificados-y-tls)
7. [Backups y Recuperación](#backups-y-recuperación)
8. [Monitoreo y Alertas](#monitoreo-y-alertas)

---

## ESPECIFICACIÓN DE INFRAESTRUCTURA

### Principio Core

**User identities** en forma `@username:pnptv.app` deben permanecer válidas y transferibles **sin importar cambios de infraestructura física**.

### Capas de la Plataforma

| Capa | Propósito | Tecnología |
|------|----------|-----------|
| **Pública** | Descubrimiento social | Mastodon (ActivityPub) |
| **Privada** | Comunicación encriptada | Matrix Synapse |
| **Control** | Autorización | Authentik (SSO) |
| **Media** | Almacenamiento + WebRTC | S3-compatible + Coturn |

---

## ARQUITECTURA DE DOMINIOS

### Mapeo de Subdominios

```
pnptv.app (Root)
├── social.pnptv.app        → Mastodon (descubrimiento público)
├── chat.pnptv.app          → Element Web (interfaz usuario)
├── matrix.pnptv.app        → Synapse Homeserver (federación)
├── turn.pnptv.app          → Coturn (WebRTC TURN/STUN)
├── media.pnptv.app         → Almacenamiento Matrix
├── ampache.pnptv.app       → Servidor media (Videorama + PRIME)
├── translate.pnptv.app     → LibreTranslate
├── auth.pnptv.app          → Authentik (SSO)
├── vault.pnptv.app         → Vaultwarden (contraseñas)
├── 2fa.pnptv.app           → 2FAuth (verificación)
├── admin.pnptv.app         → Panel admin (n8n, Dockge)
├── ops.pnptv.app           → Operaciones (Beszel, Grafana)
└── git.pnptv.app           → Repositorio (Forgejo)
```

### Responsabilidades por Dominio

#### **pnptv.app (Root)**
- **Función**: DNS delegation y service discovery
- **Contenido**: Solo JSON en `/.well-known/`
- **Endpoints**:
  ```
  GET /.well-known/matrix/server    → Delegación Matrix
  GET /.well-known/matrix/client    → Descubrimiento cliente
  GET /.well-known/matrix/support   → Config soporte
  ```
- **Autoridad**: Raíz de todas las identidades Matrix

#### **social.pnptv.app (Mastodon)**
- **Tipo**: Red social pública ActivityPub
- **Usuarios**: Cualquiera (federación habilitada)
- **Features**:
  - Perfiles públicos
  - Directorio de usuarios
  - Federación con otras instancias Mastodon
  - OAuth para autenticación externa
- **BD**: PostgreSQL aislada
- **Auth**: Cuentas internas Mastodon (sin relación con Matrix)

#### **chat.pnptv.app (Element Web)**
- **Tipo**: SPA (Single Page Application)
- **Contenido**: Servido desde CDN/estático
- **Sin BD**: Todo en localStorage del cliente
- **Funciones**:
  - Descubrimiento de rooms
  - Composición y visualización de mensajes
  - Gestión de dispositivos/sesiones
  - Preview de media

#### **matrix.pnptv.app (Synapse Homeserver)**
- **Función**: Motor de comunicación encriptada
- **Protocolo**: Matrix Protocol (federado)
- **Usuarios**: Accounts `@username:pnptv.app`
- **Encriptación**: E2E nativa
- **Almacenamiento**: Eventos de chat + metadata

---

## MODELO DE SEGURIDAD ZERO-TRUST

### Arquitectura en Capas

```
┌─────────────────────────────────────────────┐
│ 1. EXTERNAL SECURITY (Nginx, TLS)          │
├─────────────────────────────────────────────┤
│ 2. IDENTITY & ACCESS (Authentik, 2FA)      │
├─────────────────────────────────────────────┤
│ 3. VPN (WireGuard - acceso interno)        │
├─────────────────────────────────────────────┤
│ 4. APPLICATION LAYER (Synapse, Mastodon)   │
├─────────────────────────────────────────────┤
│ 5. DATA LAYER (PostgreSQL encriptada)      │
├─────────────────────────────────────────────┤
│ 6. BACKUP LAYER (Duplicati - offsite)      │
└─────────────────────────────────────────────┘
```

---

## LAYERS DE SEGURIDAD

### LAYER 1: NGINX PROXY MANAGER

**Propósito**: Gestión centralizada de dominios y certificados TLS

```yaml
Características:
├─ GUI fácil (sin editar YAML)
├─ Auto-renovación de certificados (Let's Encrypt)
├─ Wildcard: *.pnptv.app
├─ OCSP stapling habilitado
├─ Redirección HTTPS forzada
└─ HSTS: max-age=31536000

Rate Limiting:
├─ Login endpoints: 5/min por IP
├─ API endpoints: 100/min por usuario
└─ File upload: 10/min por usuario

Access Logs:
└─ Rotación: 30 días
```

### LAYER 2: CLOUDFLARE (DDoS Protection)

```
Internet
    ↓ (HTTPS)
Cloudflare (DDoS mitigation)
    ↓ (Cleaned traffic)
Nginx (TLS termination)
    ↓
Authentik (SSO)
```

**Beneficios**:
- Protección DDoS automática
- Cache global
- WAF (Web Application Firewall)
- Validación de certificados

### LAYER 3: AUTENTICACIÓN (Authentik)

**Tipo**: Single Sign-On (SSO) centralizado

```
Usuarios finales
    ↓ (Login único)
Authentik (contraseña)
    ↓ (Generador de token)
Servicios internos
```

**Flujo**:
1. Usuario intenta acceder a cualquier servicio
2. Se redirige a `auth.pnptv.app`
3. Authentik valida credenciales
4. Genera token de sesión
5. Usuario accede al servicio

**Ventajas**:
- Una contraseña para todos los servicios
- 2FA centralizado
- Auditoría de accesos
- Revocación instantánea

### LAYER 4: 2FA (Two-Factor Authentication)

**Servicio**: 2FAuth

```
Después de contraseña:
├─ TOTP (Google Authenticator)
├─ SMS (si está configurado)
├─ WebAuthn/FIDO2
└─ Códigos de respaldo
```

### LAYER 5: VPN (WireGuard)

**Acceso**: Solo usuarios autenticados

```
Admin/Staff
    ↓ (conecta a VPN)
WireGuard Tunnel (10.x.x.x/24)
    ↓
Red interna (Docker)
    ↓
Servicios sin exposición pública
```

**Beneficios**:
- Zero exposure de servicios internos
- Conexión encriptada E2E
- IP privada interna
- Control granular de permisos

### LAYER 6: ALMACENAMIENTO (Vaultwarden)

**Función**: Gestión de secretos y contraseñas

```
Secretos:
├─ API keys
├─ Tokens
├─ Credenciales de BD
├─ Certificados privados
└─ Todo encriptado localmente
```

---

## GESTIÓN DE IDENTIDADES

### Flujo de Autenticación (SSO)

```
Usuario intenta acceder a chat.pnptv.app
    ↓
Element Web redirige a Authentik
    ↓
Authentik solicita:
├─ Username (@usuario:pnptv.app)
├─ Contraseña
└─ 2FA (TOTP/SMS)
    ↓
Authentik genera token JWT
    ↓
Token enviado a Element Web
    ↓
Element Web usa token para conectar a Synapse
    ↓
✅ Acceso concedido
```

### Modelo de Identidad Matrix

```
Usuario: @juan:pnptv.app
├─ @juan        → Localpart (identificador local)
├─ pnptv.app    → Homeserver (dominio de autoridad)
└─ Portable     → Puede migrarse a otro homeserver
                  manteniendo identidad social
```

**Portabilidad**:
```
Si pnptv.app necesita migrar a nuevo servidor:
    ↓
1. Cambiar DNS: pnptv.app apunta a nuevo servidor
2. Nuevo servidor tiene backup de datos
3. Identidades @user:pnptv.app siguen siendo válidas
4. Contactos externos siguen funcionando
5. Zero downtime (idealmente)
```

---

## CERTIFICADOS Y TLS

### Let's Encrypt Configuration

```bash
Certificado: *.pnptv.app
Tipo: Wildcard
Renovación automática: 90 días
Próxima renovación: [fecha]
Status: ✅ Activo
```

### OCSP Stapling

```
Cliente conecta → Servidor envía certificado
+ Respuesta OCSP precargada
```

**Beneficios**:
- No hay latencia de validación
- Mejor privacidad del cliente
- Respuesta más rápida

### HSTS (HTTP Strict Transport Security)

```
Header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Tiempo: 1 año
Efecto: Navegadores siempre usan HTTPS
```

---

## BACKUPS Y RECUPERACIÓN

### Estrategia con Duplicati

**Frecuencia**: Diaria

```
Backups Encriptados:
├─ Destino: Google Drive / AWS S3 / B2
├─ Encriptación: AES 256-bit (offline)
├─ Retención: 30 días (rotación)
└─ Verificación: Integridad SHA256
```

**Bases de Datos Incluidas**:
```
├─ PostgreSQL (Synapse, Mastodon, Authentik)
├─ Redis (caché, sesiones)
├─ Vaultwarden (secretos)
└─ Configuraciones
```

### Procedimiento de Recuperación

```
1. Detectar problema / pérdida de datos
    ↓
2. Parar servicios afectados
    ↓
3. Restaurar desde Duplicati
    ↓
4. Verificar integridad
    ↓
5. Reiniciar servicios
    ↓
6. Validar datos
    ↓
7. ✅ Operación normal
```

**Tiempo estimado**: 10-30 minutos

---

## MONITOREO Y ALERTAS

### Beszel (Monitoring Central)

```
Monitorea en tiempo real:
├─ CPU, RAM, Disk usage
├─ Tráfico de red
├─ Latencia de servicios
├─ Temperatura de servidor
└─ Estado de procesos
```

### Grafana (Visualización)

```
Dashboards:
├─ Sistema (CPU, RAM, Disk)
├─ Aplicación (requests, latencia)
├─ Usuarios (activos, nuevos)
├─ Almacenamiento (BD, backups)
└─ Seguridad (logins fallidos, alertas)
```

### Healthchecks (Alertas)

```
Monitores activos:
├─ Nginx: responde en < 500ms
├─ Synapse: sync API activa
├─ Mastodon: timeline actualizada
├─ PostgreSQL: conexiones OK
├─ Redis: evictions normales
├─ Backups: Duplicati completó
└─ SSL: certificados válidos
```

### Alertas por Email

```
Condiciones que generan alertas:
├─ ⚠️ CPU > 80% por 5 min
├─ ⚠️ RAM > 90%
├─ ⚠️ Disk > 85%
├─ 🚨 Servicio no responde
├─ 🚨 Fallo de backup
├─ 🚨 Certificado venciendo en 7 días
└─ 🚨 DDoS detectado (Cloudflare)
```

---

## CHECKLIST DE SEGURIDAD DIARIO

```
[ ] Verificar Beszel - ¿Alertas?
[ ] Revisar logs de Authentik - ¿Intentos fallidos?
[ ] Comprobar backup del día - ¿Completó?
[ ] SSL certificate status - ¿Válido?
[ ] Usuarios activos - ¿Normal?
[ ] Latencia de servicios - ¿< 500ms?
```

---

**Para Despliegue**: Ver `GUIA_DESPLIEGUE_OPERACIONES.md`

**Para Pagos**: Ver `GUIA_PAGOS_INTEGRACIONES.md`

**Para Referencia Rápida**: Ver `REFERENCIA_RAPIDA.md`
