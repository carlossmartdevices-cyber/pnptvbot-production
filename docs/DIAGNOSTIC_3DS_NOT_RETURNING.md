# Diagnóstico: ¿Por Qué 3DS NO Retorna URL/Data Aunque Esté Habilitado?

**Problema**: ePayco dice "3DS habilitado" pero retorna `urlbanco: null` y `3DS: null`

---

## 🔍 Causas Posibles (En Orden de Probabilidad)

### **1️⃣ Credenciales en TEST MODE pero Sin Test Configurado**

**Síntoma**:
```
EPAYCO_TEST_MODE = true   ✅
EPAYCO_PUBLIC_KEY = pk_test_...
EPAYCO_PRIVATE_KEY = sk_test_...
```

**El Problema**:
- El Dashboard de TEST podría tener 3DS deshabilitado
- O tener diferentes credenciales que la PRODUCCIÓN

**Solución**:
```bash
# Verificar qué modo estás usando
grep EPAYCO_TEST_MODE .env

# Si test mode = true:
# Ir a: https://sandbox.epayco.com (NO https://dashboard.epayco.com)
# Verificar que 3DS esté habilitado ALLÁ

# Si test mode = false:
# Ir a: https://dashboard.epayco.com (producción)
# Verificar que 3DS esté habilitado ALLÁ
```

---

### **2️⃣ Credenciales Incorrectas O Expiradas**

**Síntoma**:
```
Respuesta de ePayco siempre sin urlbanco, sin importar tarjeta
```

**Verificar**:
```bash
# 1. Comparar credenciales en .env con Dashboard
cat .env | grep EPAYCO_PUBLIC_KEY
cat .env | grep EPAYCO_PRIVATE_KEY

# 2. Copiar exactamente como aparecen en Dashboard
#    (Sin espacios, sin caracteres extras)

# 3. Reiniciar bot para cargar nuevas credenciales
pm2 restart pnptv-bot

# 4. Hacer pago de test nuevamente
```

---

### **3️⃣ Tarjeta NO Dispara 3DS Automáticamente**

**Síntoma**:
```
Usas 4111111111111111 pero ePayco no requiere 3DS para esa tarjeta
```

**Por Qué Sucede**:
- ePayco puede estar configurado para requerir 3DS SOLO para montos > $X
- O para ciertos tipos de tarjeta
- O para ciertos bancos

**Solución**:
```bash
# 1. Intenta con cantidad MÁS ALTA
   Monto actual: $249.99
   Intenta con: $1,000 o más

# 2. Intenta con tarjeta diferente
   Visa:  4111111111111111 (actual)
   MasterCard: 5555555555554444 (try this)

# 3. Verifica Dashboard si hay "Monto mínimo para 3DS"
   Dashboard → Configuración → Seguridad → 3D Secure
   Busca: "Monto mínimo" o "Min amount for 3DS"
```

---

### **4️⃣ Parámetro `three_d_secure` No Se Está Enviando**

**Tu código:**
```javascript
// src/bot/services/paymentService.js:1829
const chargeResult = await epaycoClient.charge.create({
  // ...
  three_d_secure: true,  ← ¿Esto se envía realmente?
  // ...
});
```

**Verificar con logs:**
```bash
# Ver qué parámetros se envían a ePayco
pm2 logs pnptv-bot | grep -A 20 "Creating ePayco tokenized charge"

# Debería mostrar:
# ePayco charge result
# chargeStatus: ...
# chargeResponse: ...
```

---

### **5️⃣ ePayco Retorna 3DS Pero En Formato Diferente**

**Tu código espera:**
```javascript
fullResponse.urlbanco     // 3DS 1.0
fullResponse['3DS']       // 3DS 2.0
```

**Pero ePayco podría retornar:**
```javascript
fullResponse.urlBanco       // Capital B
fullResponse.url_3ds        // Guión bajo
fullResponse.bank_url       // Inglés
fullResponse.three_d_secure // Completo
```

**Para Diagnosticar:**
```javascript
// En paymentService.js línea 1962, vemos:
logger.warn('ePayco returned Pendiente status - checking 3DS info', {
  chargeResultKeys: Object.keys(fullResponse),  // ← TODOS LOS CAMPOS
  fullResponse: { ... }  // ← RESPUESTA COMPLETA
});

// Ver en logs:
pm2 logs pnptv-bot | grep "ePayco returned Pendiente" -A 30
```

---

### **6️⃣ Dashboard 3DS Habilitado Pero Para Modo Diferente**

**Escenario**:
```
TEST Dashboard: 3DS ❌ Deshabilitado
PROD Dashboard: 3DS ✅ Habilitado

Pero tu código usa TEST_MODE = true
```

**Solución**:
```bash
# 1. Verificar qué modo tienes configurado
cat .env | grep EPAYCO_TEST_MODE

# 2. Ir al dashboard CORRESPONDIENTE
if [ "$TEST_MODE" = "true" ]; then
  # Ir a: https://sandbox.epayco.com
  # Habilitar 3DS ALLÁ
else
  # Ir a: https://dashboard.epayco.com
  # Habilitar 3DS ALLÁ (ya lo hiciste)
fi
```

---

## 🧪 Plan de Diagnóstico (Paso a Paso)

### **Paso 1: Verificar Credenciales y Modo**

```bash
echo "=== CONFIGURACIÓN ACTUAL ==="
cat .env | grep EPAYCO

echo "=== DASHBOARD A REVISAR ==="
if grep -q "EPAYCO_TEST_MODE=true" .env; then
  echo "TEST Mode: https://sandbox.epayco.com"
else
  echo "PROD Mode: https://dashboard.epayco.com"
fi
```

### **Paso 2: Habilitar 3DS en Dashboard Correcto**

```
1. Ve al dashboard (sandbox o prod, según modo)
2. Configuración → Seguridad → 3D Secure
3. ☑️ Habilitar 3DS
4. Elige: 3DS 1.0 + 3DS 2.0
5. Guarda
6. ESPERA 5-10 MINUTOS (importante!)
```

### **Paso 3: Reiniciar Bot**

```bash
pm2 restart pnptv-bot
sleep 5
pm2 status pnptv-bot
```

### **Paso 4: Hacer Pago de Test**

```
1. Abre: https://easybots.store/checkout/pnp?paymentId=[nuevo-id]
2. Usa tarjeta: 4111111111111111
3. Monto > $250 para asegurar 3DS
4. Clickea PAY
```

### **Paso 5: Revisar Logs**

```bash
pm2 logs pnptv-bot | grep -i "epayco\|urlbanco\|3ds" | tail -50

# Busca estas líneas:
# ✅ "3DS bank redirect URL obtained from ePayco"
# ✅ "Cardinal Commerce 3DS 2.0 device data collection"
# ❌ "CRITICAL: 3DS payment pending but no bank redirect URL"
```

---

## 📊 Checklist de Diagnóstico

```
□ Verificar .env EPAYCO_TEST_MODE (true o false)
□ Ir a dashboard correcto (sandbox o prod)
□ Confirmar 3DS HABILITADO en ese dashboard
□ Confirmar URLs de webhook configuradas
□ Esperar 5-10 minutos después de cambios
□ Reiniciar bot: pm2 restart pnptv-bot
□ Usar tarjeta 4111... para Visa 3DS
□ Usar tarjeta 5555... para MasterCard 3DS 2.0
□ Usar monto > $250 para forzar 3DS
□ Revisar logs para "3DS" o "urlbanco"
□ Si aún no funciona, contactar ePayco support
```

---

## 🆘 Si Nada de Esto Funciona

**Contactar ePayco Support:**
```
Email: soporte@epayco.com
Teléfono: +57 (1) 747-2100
Chat: https://www.epayco.com/es/contacto

Decirles:
- "Tengo 3DS habilitado en Dashboard"
- "Pero charge.create() no retorna urlbanco"
- "Retorna: estado: Pendiente, urlbanco: null, 3DS: null"
- "Referencia pago stuck: 5473d882-c110-47ab-985f-203d72543345"
- "Public Key: [pk_...]"
- "¿Necesito parámetro adicional en charge.create()?"
```

---

## 📝 Resumen

| Elemento | Check |
|----------|-------|
| TEST vs PROD mode | Ir al dashboard correcto |
| Credenciales | Copiar exactamente de Dashboard |
| 3DS Habilitado | ☑️ checkeado en dashboard correcto |
| Esperaste 5-10min | Sí |
| Bot reiniciado | pm2 restart pnptv-bot |
| Tarjeta correcta | 4111... o 5555... |
| Monto alto | > $250 |
| Logs revisados | grep "3DS\|urlbanco" |

Si todo esto está ✅ pero 3DS sigue sin retornarse = **contactar ePayco**

---

**Tu código ya está listo. El problema es en la configuración de ePayco.**
