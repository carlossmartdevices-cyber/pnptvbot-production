# PNPtv Lifetime Pass - Guía Completa de Configuración

Esta guía explica cómo configurar y usar el sistema de Lifetime Pass para vender membresías permanentes a través de la landing page integrada con el bot de Telegram.

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Configuración Inicial](#configuración-inicial)
4. [Estructura de Firestore](#estructura-de-firestore)
5. [Uso del Sistema](#uso-del-sistema)
6. [Comandos del Bot](#comandos-del-bot)
7. [Scripts de Administración](#scripts-de-administración)
8. [Solución de Problemas](#solución-de-problemas)

---

## Descripción General

El sistema de Lifetime Pass permite vender acceso permanente a PNPtv a través de una landing page moderna que se integra automáticamente con tu bot de Telegram.

### Características Principales

- 🌐 Landing page bilingüe (Español/Inglés)
- 💳 Múltiples enlaces de pago
- 🔑 Sistema de códigos de activación únicos
- 🤖 Activación automática vía bot de Telegram
- 📊 Seguimiento de activaciones en Firestore
- 🔒 Validación y seguridad integrada

### Flujo de Usuario

1. Usuario visita la landing page (`/lifetime-pass`)
2. Selecciona un enlace de pago disponible
3. Completa el pago en la plataforma externa
4. Recibe código de activación por correo
5. Abre el bot de Telegram
6. Envía `/activate CODIGO`
7. Bot activa membresía permanente

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                  Landing Page                        │
│              (lifetime-pass.html)                    │
│                                                       │
│  - Muestra enlaces de pago                          │
│  - Marca enlaces como usados                        │
│  - Conecta con Firestore                            │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                  Firestore                           │
│                                                       │
│  Collections:                                        │
│  ├─ paymentLinks      (enlaces de pago)             │
│  ├─ activationCodes   (códigos únicos)              │
│  └─ activationLogs    (registro de activaciones)    │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│               Telegram Bot                           │
│                                                       │
│  Comandos:                                           │
│  ├─ /activate CODE   (activar membresía)            │
│  └─ /checkcode CODE  (verificar código - admin)     │
└─────────────────────────────────────────────────────┘
```

---

## Configuración Inicial

### Paso 1: Configurar Firebase

1. **Actualizar credenciales de Firebase:**

Edita el archivo `/public/firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

Estas credenciales las encuentras en:
- Firebase Console → Project Settings → General → Your apps → Web app

2. **Configurar reglas de seguridad en Firestore:**

Ve a Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Payment links - solo lectura para obtener links disponibles
    match /paymentLinks/{linkId} {
      allow read: if true;
      allow write: if request.auth != null; // Solo usuarios autenticados (o desde servidor)
    }

    // Activation codes - sin acceso directo desde cliente
    match /activationCodes/{code} {
      allow read, write: if false; // Solo acceso desde servidor
    }

    // Activation logs - sin acceso directo
    match /activationLogs/{logId} {
      allow read, write: if false; // Solo acceso desde servidor
    }
  }
}
```

**IMPORTANTE:** Para producción, necesitarás autenticación anónima de Firebase o manejar las actualizaciones desde el servidor.

### Paso 2: Ejecutar Setup Script

Ejecuta el script de configuración para crear las colecciones iniciales:

```bash
node scripts/setup-lifetime-pass.js
```

Este script crea:
- 5 enlaces de pago de ejemplo
- 3 códigos de activación de prueba
- Colección de logs de activación

### Paso 3: Configurar Enlaces de Pago Reales

Reemplaza los enlaces de ejemplo con tus enlaces de pago reales:

```bash
node scripts/setup-lifetime-pass.js add-links \
  https://tu-enlace-de-pago-1.com \
  https://tu-enlace-de-pago-2.com \
  https://tu-enlace-de-pago-3.com
```

### Paso 4: Actualizar Bot de Telegram

El bot ya está configurado con el comando `/activate`. Asegúrate de que:

1. Firebase esté correctamente configurado en `.env`:

```env
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
```

2. El bot esté ejecutándose:

```bash
docker-compose down && docker-compose build bot && docker-compose up -d
```

### Paso 5: Acceder a la Landing Page

La landing page está disponible en:

- `http://tu-dominio:3000/`
- `http://tu-dominio:3000/lifetime-pass`
- `http://tu-dominio:3000/promo`

---

## Estructura de Firestore

### Collection: `paymentLinks`

Almacena los enlaces de pago disponibles.

**Estructura del documento:**

```javascript
{
  url: "https://pay.example.com/abc123",
  used: false,
  product: "lifetime-pass",
  price: 80,
  currency: "USD",
  createdAt: Timestamp,
  usedAt: Timestamp | null,
  usedBy: string | null  // User ID que usó el link
}
```

**Índices recomendados:**
- `used` (ASC)
- `product` (ASC)

### Collection: `activationCodes`

Almacena los códigos de activación.

**Document ID:** El código mismo (ej: `A1B2C3D4E5F6`)

**Estructura:**

```javascript
{
  code: "A1B2C3D4E5F6",
  product: "lifetime-pass",
  used: false,
  email: "customer@example.com",
  createdAt: Timestamp,
  expiresAt: Timestamp | null,
  usedAt: Timestamp | null,
  usedBy: number | null,  // Telegram user ID
  usedByUsername: string | null
}
```

**Índices recomendados:**
- `used` (ASC)
- `product` (ASC)

### Collection: `activationLogs`

Registro de todas las activaciones.

**Estructura:**

```javascript
{
  userId: 123456789,
  username: "usuario_telegram",
  code: "A1B2C3D4E5F6",
  product: "lifetime-pass",
  activatedAt: Timestamp,
  success: true
}
```

---

## Uso del Sistema

### Workflow Completo

#### 1. Generar Códigos de Activación

Cuando un cliente compra, genera un código:

```bash
node scripts/setup-lifetime-pass.js generate-codes customer@email.com
```

Salida:
```
Generating 1 activation codes...
  ✓ A1B2C3D4E5F6 - customer@email.com

✓ All activation codes generated successfully

Send these codes to customers via email:

customer@email.com: A1B2C3D4E5F6
```

#### 2. Enviar Código al Cliente

Envía un correo con el código y las instrucciones:

**Ejemplo de email:**

```
Asunto: Tu código de activación PNPtv Lifetime Pass

¡Gracias por tu compra!

Tu código de activación es: A1B2C3D4E5F6

Para activar tu membresía de por vida:

1. Abre el bot de Telegram: https://t.me/pnptv_bot
2. Envía el comando: /activate A1B2C3D4E5F6
3. ¡Disfruta de acceso ilimitado!

Si tienes problemas, contacta soporte@pnptv.com
```

#### 3. Cliente Activa Membresía

El cliente:
1. Abre el bot
2. Envía `/activate A1B2C3D4E5F6`
3. Recibe confirmación de activación

El bot automáticamente:
- Valida el código
- Verifica que no esté usado
- Actualiza el usuario con membresía lifetime
- Marca el código como usado
- Registra la activación en logs

---

## Comandos del Bot

### `/activate CODE`

Activa una membresía usando un código de activación.

**Uso:**
```
/activate A1B2C3D4E5F6
```

**Respuestas:**

✅ **Éxito:**
```
🎉 ¡Felicidades! Tu Lifetime Pass ha sido activado con éxito.

✅ Tu membresía es ahora PERMANENTE
✅ Acceso ilimitado a todo el contenido
✅ Sin fechas de expiración
✅ Todas las funciones premium desbloqueadas

🔥 Disfruta de:
• Videos HD/4K completos
• Contenido exclusivo PNP
• Función "Quién está cerca"
• Soporte prioritario 24/7
• Actualizaciones futuras gratis

¡Bienvenido a la comunidad PNPtv! 🎊
```

❌ **Código inválido:**
```
❌ Código inválido. Por favor verifica que hayas ingresado el código correctamente.
```

❌ **Código usado:**
```
❌ Este código ya ha sido utilizado.

Cada código solo puede ser activado una vez.
```

### `/checkcode CODE` (Solo Admin)

Verifica el estado de un código de activación.

**Uso:**
```
/checkcode A1B2C3D4E5F6
```

**Respuesta:**
```
📊 Code Information:

Code: A1B2C3D4E5F6
Product: lifetime-pass
Used: Yes
Used At: 2024-01-15T10:30:00.000Z
Used By: 123456789
Username: usuario_telegram
Created At: 2024-01-10T09:00:00.000Z
Email: customer@example.com
```

---

## Scripts de Administración

### Setup Inicial

Crea las colecciones y datos de ejemplo:

```bash
node scripts/setup-lifetime-pass.js
```

### Agregar Enlaces de Pago

```bash
node scripts/setup-lifetime-pass.js add-links \
  https://pay.example.com/link1 \
  https://pay.example.com/link2
```

### Generar Códigos de Activación

Para un solo email:
```bash
node scripts/setup-lifetime-pass.js generate-codes customer@email.com
```

Para múltiples emails:
```bash
node scripts/setup-lifetime-pass.js generate-codes \
  customer1@email.com \
  customer2@email.com \
  customer3@email.com
```

---

## Solución de Problemas

### Landing Page no carga enlaces de pago

**Problema:** La landing page muestra "Cargando enlaces de pago..." indefinidamente.

**Solución:**
1. Verifica que `firebase-config.js` tenga las credenciales correctas
2. Abre la consola del navegador (F12) y verifica errores
3. Verifica que existan documentos en la colección `paymentLinks`:
   ```bash
   # Verifica en Firebase Console → Firestore
   ```

### Código de activación no funciona

**Problema:** El bot dice "Código inválido" pero el código es correcto.

**Solución:**
1. Verifica que el código existe en Firestore:
   - Firebase Console → Firestore → activationCodes
2. Usa `/checkcode` (como admin) para verificar el estado
3. Verifica que el código no tenga espacios o caracteres extra
4. El código debe estar en MAYÚSCULAS

### Error al activar: "Error al procesar tu activación"

**Problema:** El código es válido pero da error al activar.

**Solución:**
1. Verifica los logs del bot:
   ```bash
   docker logs pnptv-bot
   ```
2. Verifica que Firebase esté correctamente configurado en `.env`
3. Verifica que el usuario exista en la base de datos

### Enlaces de pago se marcan como usados muy rápido

**Problema:** Todos los enlaces se marcan como usados rápidamente.

**Solución:**
1. Esto es normal si muchos usuarios hacen clic
2. Agrega más enlaces de pago:
   ```bash
   node scripts/setup-lifetime-pass.js add-links URL1 URL2 URL3
   ```
3. Considera usar un sistema de generación dinámica de enlaces

### Landing page muestra diseño roto

**Problema:** Los estilos no se aplican correctamente.

**Solución:**
1. Verifica que el servidor esté sirviendo archivos estáticos
2. Limpia caché del navegador (Ctrl+Shift+R)
3. Verifica que `lifetime-pass.html` esté en `/public/`

---

## Personalización

### Cambiar el precio

Edita `lifetime-pass.html` y busca todas las apariciones de `$80 USD` y reemplázalas con tu precio.

### Cambiar el nombre del bot

Edita `lifetime-pass.html` y busca `https://t.me/pnptv_bot` y reemplázalo con tu bot.

### Agregar más idiomas

1. Duplica la sección `<div id="es" class="language active">`
2. Cambia el id al código del idioma (ej: `pt`, `fr`)
3. Traduce el contenido
4. Agrega botón en `.language-selector`

### Personalizar colores y diseño

Edita la sección `<style>` en `lifetime-pass.html`.

Variables de color principales:
- Gradiente principal: `#667eea 0%, #764ba2 100%`
- Precio: `#f093fb 0%, #f5576c 100%`
- Activación: `#11998e 0%, #38ef7d 100%`
- Dorado: `#ffd700`

---

## Seguridad

### Mejores Prácticas

1. **Códigos únicos:** Nunca reutilices códigos de activación
2. **HTTPS:** Siempre usa HTTPS en producción
3. **Rate limiting:** Ya está implementado en el servidor
4. **Validación:** El bot valida todos los códigos antes de activar
5. **Logs:** Todas las activaciones se registran en Firestore

### Firestore Security Rules

Para producción, considera implementar autenticación:

```javascript
// Opción 1: Autenticación anónima
match /paymentLinks/{linkId} {
  allow read: if request.auth != null;
  allow update: if request.auth != null
                && request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['used', 'usedAt']);
}

// Opción 2: Server-side updates only
// Crea un Cloud Function que maneje las actualizaciones
```

---

## Monitoreo

### Métricas a Revisar

1. **Conversión:** Enlaces usados vs códigos activados
2. **Tiempo de activación:** Tiempo entre pago y activación
3. **Códigos sin usar:** Códigos generados pero no activados
4. **Errores:** Revisa logs de activación fallida

### Consultas Útiles en Firestore

**Ver códigos no usados:**
```
activationCodes
  where used == false
  orderBy createdAt desc
```

**Ver activaciones recientes:**
```
activationLogs
  orderBy activatedAt desc
  limit 50
```

**Ver enlaces disponibles:**
```
paymentLinks
  where used == false
  where product == "lifetime-pass"
```

---

## Roadmap / Mejoras Futuras

- [ ] Dashboard de administración
- [ ] Generación automática de códigos después del pago
- [ ] Integración directa con procesadores de pago
- [ ] Notificaciones automáticas por email
- [ ] Sistema de referidos
- [ ] Códigos con descuento
- [ ] Estadísticas en tiempo real
- [ ] API REST para gestión de códigos

---

## Soporte

Si necesitas ayuda:

1. Revisa esta documentación
2. Verifica los logs: `docker logs pnptv-bot`
3. Revisa Firebase Console para errores
4. Contacta al equipo de desarrollo

---

## Changelog

### v1.0.0 (2024-11-16)
- ✅ Landing page bilingüe
- ✅ Sistema de códigos de activación
- ✅ Integración con bot de Telegram
- ✅ Scripts de administración
- ✅ Documentación completa
