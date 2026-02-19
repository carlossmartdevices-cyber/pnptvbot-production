# 🚀 GUÍA CONSOLIDADA - DESPLIEGUE & OPERACIONES

**Consolidado de**:
- `PLAN_MAESTRO_DESPLIEGUE_PNPTV.md` (825 líneas)
- `pnptv-operations-guide.md` (586 líneas)
- `pnptv-STACK-MINIMO-VIABLE.md` (598 líneas)

**Versión**: 1.0
**Fecha**: 2026-02-13
**Estado**: Production Ready
**Clasificación**: OPERACIONAL - Para DevOps/SysAdmin

---

## 📑 TABLA DE CONTENIDOS

1. [Arquitectura por Capas](#arquitectura-por-capas)
2. [Mapa de Dominios](#mapa-de-dominios)
3. [Distribución de Puertos](#distribución-de-puertos)
4. [Fases de Despliegue](#fases-de-despliegue)
5. [Procedimientos Operacionales](#procedimientos-operacionales)
6. [Stack Mínimo Viable](#stack-mínimo-viable)
7. [Recuperación ante Desastres](#recuperación-ante-desastres)

---

## ARQUITECTURA POR CAPAS

### Modelo de 7 Capas

```
┌────────────────────────────────────────┐
│ CAPA 7: CONTENIDO                      │
│ Navidrome - PREPARADO NO ACTIVO        │
│ (Activar solo en migración)            │
├────────────────────────────────────────┤
│ CAPA 6: OPERACIÓN                      │
│ Beszel, Duplicati, Grafana             │
├────────────────────────────────────────┤
│ CAPA 5: IA                             │
│ LiteLLM, MaxKB, Flowise, LibreTranslate│
├────────────────────────────────────────┤
│ CAPA 4: AUTOMATIZACIÓN                 │
│ RabbitMQ, n8n, OpenClaw                │
├────────────────────────────────────────┤
│ CAPA 3: COMUNIDAD                      │
│ PostgreSQL, Matrix, Mastodon           │
├────────────────────────────────────────┤
│ CAPA 2: IDENTIDAD                      │
│ Authentik, Vaultwarden, 2FAuth         │
├────────────────────────────────────────┤
│ CAPA 1: INFRAESTRUCTURA                │
│ WireGuard, Nginx, Dockge               │
└────────────────────────────────────────┘
```

### Independencia de Capas

**Cada capa**:
- ✅ Funciona de forma independiente
- ✅ Tiene su propia BD (si aplica)
- ✅ Puede desplegarse sin otras capas
- ✅ No rompe capas inferiores si falla

---

## MAPA DE DOMINIOS

### Dominios Principales

| Dominio | Servicio | Capa | Estado | Puerta |
|---------|----------|------|--------|--------|
| `pnptv.app` | Nginx Reverse Proxy | 1 | ✅ Live | 443 |
| `www.pnptv.app` | Alias | 1 | ✅ Live | 443 |
| `auth.pnptv.app` | Authentik (SSO) | 2 | Fase 2 | 443 |
| `vault.pnptv.app` | Vaultwarden | 2 | Fase 2 | 443 |
| `2fa.pnptv.app` | 2FAuth | 2 | Fase 2 | 443 |
| `chat.pnptv.app` | Element Web | 3 | Fase 3 | 443 |
| `matrix.pnptv.app` | Synapse API | 3 | Fase 3 | 443 |
| `social.pnptv.app` | Mastodon | 3 | Fase 3 | 443 |
| `admin.pnptv.app` | Admin Panel | 4,6 | Fase 4 | 443 |
| `ai.pnptv.app` | Flowise (IA) | 5 | Fase 5 | 443 |
| `ops.pnptv.app` | Operaciones | 6 | Fase 6 | 443 |
| `git.pnptv.app` | Forgejo | 1 | Fase 2 | 443 |

---

## DISTRIBUCIÓN DE PUERTOS

### Host (External)

```bash
HOST:80     → Nginx HTTP (redirige a HTTPS)
HOST:443    → Nginx HTTPS (reverse proxy principal)
HOST:8081   → Nginx HTTP (sandbox - opcional)
HOST:8444   → Nginx HTTPS (sandbox - opcional)
```

### Docker Network (Internal)

```
Red: pnptv-network (privada, no expuesta)

Servicios:
├─ pnptv-bot:3000            Hub API
├─ pnptv-bot:3001            Bot API + Webhooks
├─ pnptv-postgres:5432       PostgreSQL
├─ pnptv-redis:6379          Redis
├─ pnptv-matrix:8008         Synapse HTTP
├─ pnptv-synapse:8448        Synapse Federation
├─ pnptv-mastodon:3000       Mastodon
├─ pnptv-authentik:9000      Authentik
├─ pnptv-flowise:3000        Cristina (IA)
├─ pnptv-navidrome:4533      Navidrome (FASE 7)
├─ pnptv-rabbitmq:5672       RabbitMQ
├─ pnptv-n8n:5678            n8n Automation
└─ [otros servicios]
```

**Regla**: Ningún puerto interno es accesible desde Internet. Solo Nginx expone.

---

## FASES DE DESPLIEGUE

### FASE 1: INFRAESTRUCTURA BASE (Semana 1 - 3 días)

**Objetivo**: Cimientos para todo lo demás

**Servicios**:
```
☐ WireGuard Easy        (VPN segura)
☐ Nginx Proxy Manager   (Reverse proxy + TLS)
☐ Dockge                (Gestión Docker GUI)
☐ Cloudflare Tunnel     (Acceso seguro remoto)
```

**Checklist**:
- [ ] Servidor Linux funcionando
- [ ] Docker instalado
- [ ] DNS configurado (pnptv.app)
- [ ] Certificado wildcard Let's Encrypt
- [ ] Nginx respondiendo en 443
- [ ] WireGuard tunelado

**Duración**: 3 horas

---

### FASE 2: IDENTIDAD & ACCESO (Semana 1-2 - 4 días)

**Objetivo**: Autenticación centralizada

**Servicios**:
```
☐ PostgreSQL            (BD principal)
☐ Authentik             (SSO)
☐ 2FAuth                (Verificación 2FA)
☐ Vaultwarden           (Gestor contraseñas)
☐ Forgejo               (Repositorio)
```

**Flujo**:
1. PostgreSQL se inicia
2. Authentik se conecta a BD
3. Crear usuarios administrativos
4. Habilitar 2FA
5. Conectar Vaultwarden
6. Crear sistema de autorización

**Checklist**:
- [ ] Authentik accesible en auth.pnptv.app
- [ ] Login funciona
- [ ] 2FA activado
- [ ] PostgreSQL respaldando datos

**Duración**: 4 horas

---

### FASE 3: COMUNIDAD (Semana 2-3 - 5 días)

**Objetivo**: Redes sociales + comunicación

**Servicios**:
```
☐ Synapse Homeserver    (Matrix)
☐ Element Web           (Cliente Matrix)
☐ Mastodon              (Red social)
☐ Redis                 (Cache)
```

**Configuración**:
1. Redis inicia
2. PostgreSQL prepara esquema Matrix
3. Synapse inicia en matrix.pnptv.app
4. Element Web sirve desde chat.pnptv.app
5. Mastodon inicia en social.pnptv.app
6. Federación habilitada

**Checklist**:
- [ ] Element Web carga en chat.pnptv.app
- [ ] Puedo crear usuario en Synapse
- [ ] Puedo chatear E2E
- [ ] Mastodon lista usuarios
- [ ] Federación external funciona

**Duración**: 5 horas

---

### FASE 4: AUTOMATIZACIÓN (Semana 3-4 - 4 días)

**Objetivo**: Flujos de trabajo automáticos

**Servicios**:
```
☐ RabbitMQ              (Message queue)
☐ n8n                   (No-code automation)
☐ OpenClaw              (Webhook management)
```

**Flujos de Ejemplo**:
- Nuevo usuario en Mastodon → Crear en Synapse
- Evento de pago → Enviar notificación
- Backup completado → Alertar en Slack

**Duración**: 4 horas

---

### FASE 5: INTELIGENCIA ARTIFICIAL (Semana 4-5 - 3 días)

**Objetivo**: Cristina IA + procesamiento

**Servicios**:
```
☐ Flowise               (Orquestación IA)
☐ LiteLLM               (Enrutador LLM)
☐ LibreTranslate        (Traducciones)
☐ MaxKB                 (Knowledge base)
```

**Funcionalidades**:
- Asistente Cristina responde en chat
- Traducción automática
- Base de conocimiento sobre servicio

**Duración**: 3 horas

---

### FASE 6: OPERACIÓN & MONITOREO (Semana 5-6 - 3 días)

**Objetivo**: Visibilidad total del sistema

**Servicios**:
```
☐ Beszel                (Monitoreo de sistema)
☐ Grafana               (Visualización métricas)
☐ Duplicati             (Backups encriptados)
☐ Healthchecks          (Alertas de servicio)
```

**Dashboards**:
- Sistema (CPU, RAM, Disk)
- Aplicaciones (latencia, requests)
- Usuarios (activos, nuevos)
- Almacenamiento
- Seguridad

**Duración**: 3 horas

---

### FASE 7: CONTENIDO (Semana 6-7 - 2 días)

**Objetivo**: Streaming de música/audio

**Servicios**:
```
☐ Navidrome             (Music server)
├─ Configuración: NO EXPUESTO INICIALMENTE
├─ Activar solo si: Migración de BD o upgrade
└─ Test en sandbox primero
```

**Estado**: PREPARADO, NO ACTIVO

**Razón**: No necesario para lanzamiento. Integrar cuando sea requerido.

**Duración**: 2 horas (cuando se active)

---

## PROCEDIMIENTOS OPERACIONALES

### Deployment Workflow

```
1. Preparar cambios
   ├─ Git commit con mensajes claros
   └─ Testing en sandbox

2. Notificar usuarios
   ├─ Anuncio en Matrix
   ├─ Email si es critical
   └─ Twitter si es feature importante

3. Backup pre-deployment
   ├─ Snapshot de base de datos
   ├─ Backup de configuraciones
   └─ Registrar versión actual

4. Deploy
   ├─ Pull código latest
   ├─ Build/pull imágenes Docker
   ├─ Reiniciar servicios afectados
   └─ Verificar logs

5. Validación
   ├─ Health checks pasan
   ├─ Usuarios pueden conectar
   ├─ Funcionalidad OK
   └─ Logs sin errores

6. Post-deployment
   ├─ Monitoreo 30 minutos
   ├─ Responder a reportes
   └─ Documentar cambios
```

### Rollback de Emergencia

```
Si algo sale mal:

1. PARAR despliegue
   docker-compose stop [service]

2. RESTAURAR backup
   duplicati-restore [latest-backup]

3. VERIFICAR datos
   SELECT COUNT(*) FROM [tabla];

4. REINICIAR servicios
   docker-compose up -d

5. COMUNICAR a usuarios
   Mensaje en Matrix + Twitter
```

**Tiempo**: < 5 minutos objetivo

### Mantenimiento Programado

```
SEMANAL:
├─ Lunes: Backup y verificación
├─ Miércoles: Limpieza de logs
└─ Viernes: Actualización de paquetes

MENSUAL:
├─ Verificación de seguridad
├─ Renovación de certificados
└─ Análisis de performance

TRIMESTRAL:
├─ Disaster recovery drill
├─ Actualización mayor si aplica
└─ Revisión de arquitectura
```

---

## STACK MÍNIMO VIABLE

### Para Lanzamiento Mínimo

```
┌─ CAPA 1: INFRAESTRUCTURA
│  ├─ Nginx (reverse proxy)
│  └─ Dockge (gestión)
│
├─ CAPA 2: IDENTIDAD
│  ├─ Authentik (SSO básico)
│  └─ PostgreSQL
│
└─ CAPA 3: COMUNIDAD
   ├─ Synapse (Matrix)
   ├─ Element Web
   └─ Redis (caché)
```

**Sin**: Mastodon, n8n, IA, Navidrome
**Resultado**: Plataforma comunicación privada funcional

### Upgrade a Producción

```
MVP (Semana 1)
   ↓
+ Mastodon (Semana 2)
   ↓
+ 2FA + Vaultwarden (Semana 2)
   ↓
+ n8n (Semana 3)
   ↓
+ IA (Semana 4)
   ↓
+ Monitoreo (Semana 5)
   ↓
= FULL PRODUCTION
```

---

## RECUPERACIÓN ANTE DESASTRES

### Escenarios y Planes

#### **Escenario 1: Pérdida de Servidor**

```
Problema: Servidor muere, perdemos todo
Tiempo a resolver: 1-2 horas
Proceso:
1. Provisionar nuevo servidor
2. Instalar Docker
3. Restaurar Duplicati backup
4. Iniciar servicios
5. Verificar datos
```

**Prevención**: Backups diarios offsite

---

#### **Escenario 2: Corrupción de BD**

```
Problema: PostgreSQL corrupta
Tiempo a resolver: 30 minutos
Proceso:
1. Parar Synapse/Mastodon
2. RESTAURAR PostgreSQL de backup
3. Verificar integridad
4. Reiniciar servicios
```

**Prevención**: Backups antes de cada update

---

#### **Escenario 3: SSL Certificado Vencido**

```
Problema: *.pnptv.app certificado expirado
Tiempo a resolver: 5 minutos
Proceso:
1. Let's Encrypt auto-renueva (automático)
2. Nginx recarga config
3. ✅ Listo
```

**Prevención**: Alertas 30 días antes

---

#### **Escenario 4: DDoS Attack**

```
Problema: Miles de requests de atacante
Tiempo a resolver: < 1 minuto
Proceso:
1. Cloudflare detecta automáticamente
2. Activa WAF
3. Inyecta CAPTCHA
4. Traffic limpiado
5. Nginx solo recibe tráfico legítimo
```

**Prevención**: Cloudflare adelante

---

## CHECKLIST PRE-PRODUCCIÓN

```
INFRAESTRUCTURA:
[ ] DNS configurado (A records)
[ ] Certificado SSL válido
[ ] Nginx respondiendo en 443
[ ] Redirección HTTP → HTTPS funciona
[ ] WireGuard configurado

IDENTIDAD:
[ ] Authentik login funciona
[ ] 2FA habilitado para admin
[ ] Usuarios pueden crear cuentas
[ ] Roles y permisos configurados

COMUNIDAD:
[ ] Synapse acepta usuarios
[ ] Element Web conecta
[ ] E2E encryption funciona
[ ] Federation habilitada

OPERACIÓN:
[ ] Backups automáticos corriendo
[ ] Monitoreo activo
[ ] Alertas configuradas
[ ] Logs se rotan

SEGURIDAD:
[ ] Contraseñas strong
[ ] 2FA activo
[ ] VPN funcionando
[ ] Audit logs habilitados
```

---

**Para Seguridad Detallada**: Ver `GUIA_INFRAESTRUCTURA_SEGURIDAD.md`

**Para Pagos**: Ver `GUIA_PAGOS_INTEGRACIONES.md`

**Para Referencia Rápida**: Ver `REFERENCIA_RAPIDA.md`
