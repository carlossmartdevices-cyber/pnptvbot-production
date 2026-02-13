# Guía: Habilitar 3D Secure en ePayco

**Fecha**: 2026-02-13
**Problema**: ePayco no retorna URL de 3DS (bank_url_available = false)
**Solución**: Configurar 3DS en ePayco Dashboard

---

## 🔴 Problema Actual

El pago `5473d882-c110-47ab-985f-203d72543345` no tiene URL de 3DS disponible:

```
Status:        Pendiente (esperando 3DS)
Bank URL:      ❌ NO disponible
3DS 2.0 Data:  ❌ NO disponible
Resultado:     Pago stuck sin poder continuar
```

---

## 🔧 Solución: 4 Pasos para Habilitar 3DS

### **PASO 1: Verificar Credenciales ePayco**

```bash
# Obtener las credenciales actuales
cat .env | grep EPAYCO

# Esperado:
# EPAYCO_PUBLIC_KEY=xxxxx
# EPAYCO_PRIVATE_KEY=xxxxx
# EPAYCO_TEST_MODE=true (o false para producción)
```

---

### **PASO 2: Acceder a ePayco Dashboard**

#### **Para PRODUCCIÓN:**
```
URL: https://dashboard.epayco.com
Usuario: [tu email]
Contraseña: [tu password]
```

#### **Para TESTING:**
```
URL: https://sandbox.epayco.com
Usuario: [tu email de sandbox]
Contraseña: [tu password de sandbox]
```

---

### **PASO 3: Habilitar 3D Secure**

#### **En ePayco Dashboard:**

1. **Ir a**: Configuración → Seguridad
2. **Buscar**: "3D Secure" o "Autenticación de Banco"
3. **Opciones disponibles**:
   - ☑️ Habilitar 3D Secure (activar)
   - ☑️ 3DS 1.0 - Simple banco redirect
   - ☑️ 3DS 2.0 - Cardinal Commerce (recomendado)
   - ☑️ Forzar 3DS para montos > $X (opcional)

4. **Guardar cambios**

---

### **PASO 4: Verificar Configuración en Código**

El código ya está listo. Solo necesita que ePayco Dashboard esté configurado:

```javascript
// En src/bot/services/paymentService.js línea 1728:
chargeResult = await epaycoClient.charge.create({
  // ...
  three_d_secure: true,  ✅ Ya está habilitado
  // ...
});

// En src/bot/api/controllers/paymentController.js:
// También soporta 3DS 2.0:
POST /api/payment/complete-3ds-2  ✅ Endpoint listo
```

---

## 📊 Configuración Recomendada

### **Para Testing (Sandbox)**

```
3D Secure: ✅ HABILITADO
Modo: 3DS 2.0 (Cardinal Commerce) + 3DS 1.0 Fallback
Protocolo: HTTPS requerido
Redirect URLs:
  - https://localhost:3001/checkout/pnp
  - https://pnptv.app/checkout/pnp
  - https://easybots.store/checkout/pnp
```

### **Para Producción**

```
3D Secure: ✅ HABILITADO
Modo: 3DS 2.0 (Cardinal Commerce) - Recomendado
Protocolo: HTTPS requerido (obligatorio)
Redirect URLs:
  - https://pnptv.app/checkout/pnp
  - https://easybots.store/checkout/pnp
Monto mínimo: Opcional (ej: $100+ requiere 3DS)
```

---

## 🧪 Tarjetas de Test para 3DS

### **Para Disparar 3DS 1.0 (Bank Redirect):**

```
Número:     4111111111111111
Exp:        12/2025
CVC:        123
Resultado:  ✅ Retorna urlbanco
```

### **Para Disparar 3DS 2.0 (Cardinal Commerce):**

```
Número:     5555555555554444 (Mastercard)
Exp:        12/2025
CVC:        123
Resultado:  ✅ Retorna 3DS 2.0 device data
```

### **Para No Disparar 3DS:**

```
Número:     4111111111111111
Exp:        12/2025
CVC:        123
Configuración: Si 3DS está deshabilitado en dashboard
Resultado:  ❌ No retorna 3DS data
```

---

## 🔍 Verificar si 3DS Está Habilitado

### **Opción 1: Revisar API de ePayco**

```bash
# Via API de ePayco (requiere credenciales)
curl -X GET "https://api.epayco.co/merchant/info" 
  -H "Authorization: Bearer YOUR_TOKEN"

# Buscar en respuesta:
# "threeDSecure": true
# "threeDSecureProtocol": "3DS2"
```

### **Opción 2: Hacer Un Pago de Prueba**

Usa la página de checkout:
```
https://easybots.store/checkout/pnp?paymentId=[test-payment-id]
```

Resultado esperado:
- ✅ Si 3DS habilitado: Verás formulario de banco o Cardinal Commerce
- ❌ Si 3DS deshabilitado: Pago se rechaza o se aprueba sin 3DS

### **Opción 3: Revisar Logs del Bot**

```bash
pm2 logs pnptv-bot | grep -i "3ds\|urlbanco\|threeds"

# Buscar:
# "3DS bank redirect URL obtained from ePayco"
# o
# "Cardinal Commerce 3DS 2.0 device data collection"
```

---

## ✅ Checklist de Habilitación

Marca cada paso cuando lo completes:

```
□ 1. Accedí a ePayco Dashboard (sandbox o producción)
□ 2. Navigué a Configuración → Seguridad
□ 3. Habilitée 3D Secure (checkbox activado)
□ 4. Seleccioné 3DS 2.0 (Cardinal Commerce) + Fallback 1.0
□ 5. Agregué redirect URLs:
     □ https://localhost:3001/checkout/pnp (testing)
     □ https://pnptv.app/checkout/pnp
     □ https://easybots.store/checkout/pnp
□ 6. Guardé cambios
□ 7. Esperé 5-10 minutos (cambios se propagan)
□ 8. Hice un pago de test
□ 9. Verifiqué que aparece URL de 3DS o formulario de banco
□ 10. Checké logs: grep "3DS\|urlbanco" pnptv-bot logs
```

---

## 🆘 Troubleshooting

### **Problema: 3DS No Aparece**

**Causa 1: No está habilitado en Dashboard**
```
Solución: Ir a Dashboard → Configuración → Seguridad → Habilitar 3DS
```

**Causa 2: Credenciales incorrectas**
```
Solución: Verificar que EPAYCO_PUBLIC_KEY y EPAYCO_PRIVATE_KEY sean correctas
# Ver: grep EPAYCO .env
# Cambiar si es necesario: nano .env
```

**Causa 3: URL de Redirect incorrecta**
```
Solución: Agregar la URL exacta del checkout en ePayco Dashboard
Actual: https://easybots.store/checkout/pnp
        https://pnptv.app/checkout/pnp
```

**Causa 4: Tarjeta no dispara 3DS**
```
Solución: Usar tarjetas de test que disparan 3DS:
- 4111111111111111 (Visa - 3DS 1.0)
- 5555555555554444 (Mastercard - 3DS 2.0)
```

**Causa 5: Cambios no propagados**
```
Solución: Esperar 5-10 minutos después de guardar en Dashboard
           Reiniciar bot: pm2 restart pnptv-bot
```

---

## 📞 Contacto ePayco Support

Si necesitas ayuda:

```
Email: soporte@epayco.com
Teléfono: +57 (1) 747-2100
Chat: https://www.epayco.com/es/contacto

Mención en ticket:
- Referencia del pago: 5473d882-c110-47ab-985f-203d72543345
- Problema: bank_url_available = false
- Necesidad: Habilitar 3DS para pagos
```

---

## ✨ Resultado Esperado

Después de habilitar 3DS en ePayco:

```
ANTES:
Status:        Pendiente (stuck)
Bank URL:      ❌ NO
3DS 2.0 Data:  ❌ NO
Resultado:     💥 Pago falla

DESPUÉS:
Status:        Pendiente (esperando confirmación)
Bank URL:      ✅ SÍ (redirect URL disponible)
3DS 2.0 Data:  ✅ SÍ (Cardinal Commerce data)
Resultado:     ✅ Usuario completa 3DS y pago se aprueba
```

---

## 📝 Checklist Final

Una vez habilitado 3DS:

- [ ] Pago original se puede recuperar manualmente via API
- [ ] Nuevos pagos tendrán URL de 3DS disponible
- [ ] FIX 2 no será necesario (pero está como fallback)
- [ ] Auditoría completa con user_id (FIX 1)
- [ ] Usuarios recibirán experiencia 3DS fluida

---

**Próximos Pasos:**
1. Habilitar 3DS en ePayco Dashboard
2. Esperar 5-10 minutos
3. Hacer pago de test
4. Verificar que URL de 3DS aparece
5. Completar autenticación bancaria

¿Necesitas ayuda con alguno de estos pasos?
