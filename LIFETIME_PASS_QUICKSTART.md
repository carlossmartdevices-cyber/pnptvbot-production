# 🚀 Lifetime Pass - Quick Start

Guía rápida para poner en marcha la landing page de Lifetime Pass.

## ⚡ Configuración Rápida (5 minutos)

### 1. Configurar Firebase

Edita `/public/firebase-config.js` con tus credenciales:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

👉 Obtén estas credenciales en: [Firebase Console](https://console.firebase.google.com) → Settings → General → Your apps

### 2. Ejecutar Setup

```bash
node scripts/setup-lifetime-pass.js
```

Esto crea las colecciones en Firestore y códigos de prueba.

### 3. Reiniciar Bot

```bash
docker-compose down && docker-compose build bot && docker-compose up -d
```

### 4. ¡Listo! 🎉

Accede a: `http://localhost:3000/lifetime-pass`

---

## 📝 Uso Diario

### Agregar enlaces de pago

```bash
node scripts/setup-lifetime-pass.js add-links \
  https://pay.ejemplo.com/link1 \
  https://pay.ejemplo.com/link2
```

### Generar códigos de activación

```bash
node scripts/setup-lifetime-pass.js generate-codes \
  cliente1@email.com \
  cliente2@email.com
```

### Cliente activa membresía

El cliente abre Telegram y envía:
```
/activate ABC123XYZ
```

---

## 🔗 URLs Disponibles

- Landing page: `http://tu-dominio:3000/`
- Lifetime pass: `http://tu-dominio:3000/lifetime-pass`
- Promo: `http://tu-dominio:3000/promo`

---

## 📊 Firestore Collections

El sistema crea 3 colecciones:

1. **paymentLinks** - Enlaces de pago disponibles
2. **activationCodes** - Códigos de activación
3. **activationLogs** - Registro de activaciones

---

## 🎯 Workflow

```
1. Cliente ve landing → 2. Hace clic en pago → 3. Paga
                                                    ↓
6. Bot activa ← 5. Envía /activate CODE ← 4. Recibe código
```

---

## 🛠️ Solución Rápida de Problemas

### Landing page no carga
- Verifica `firebase-config.js`
- Abre consola del navegador (F12)

### Código no funciona
- Verifica que el código esté en MAYÚSCULAS
- Usa `/checkcode CODE` (como admin) para verificar

### Bot no responde
- Verifica logs: `docker logs pnptv-bot`
- Verifica que Firebase esté configurado en `.env`

---

## 📚 Documentación Completa

Ver: [docs/LIFETIME_PASS_SETUP.md](docs/LIFETIME_PASS_SETUP.md)

---

## ✅ Checklist de Producción

- [ ] Actualizar `firebase-config.js` con credenciales reales
- [ ] Configurar reglas de seguridad en Firestore
- [ ] Agregar enlaces de pago reales
- [ ] Generar códigos de activación
- [ ] Probar activación end-to-end
- [ ] Configurar HTTPS
- [ ] Actualizar URL del bot en landing page
- [ ] Configurar email para enviar códigos

---

## 💡 Tips

1. **Genera códigos después de cada pago** - Automatiza con webhooks
2. **Monitorea activaciones** - Revisa `activationLogs` en Firestore
3. **Mantén enlaces frescos** - Agrega nuevos enlaces regularmente
4. **Personaliza** - Cambia colores, textos y precios en `lifetime-pass.html`

---

## 🆘 Soporte

- Documentación completa: `/docs/LIFETIME_PASS_SETUP.md`
- Logs del bot: `docker logs pnptv-bot`
- Firebase Console: https://console.firebase.google.com
