# Integración de Daimo Pay - PNPtv

## 🌟 Descripción General

Daimo Pay permite a los usuarios de PNPtv pagar sus suscripciones utilizando **apps de pago populares** (Zelle, CashApp, Venmo, Revolut, Wise) que automáticamente se convierten a **USDC en Optimism**.

### ¿Por qué Daimo Pay?

- ✅ **Apps familiares**: Los usuarios pagan con Zelle, CashApp, Venmo, Revolut o Wise
- ✅ **Crypto simplificado**: Conversión automática a USDC (stablecoin 1:1 con USD)
- ✅ **Bajas comisiones**: Red Optimism (Layer 2 de Ethereum)
- ✅ **Rápido**: Confirmación en segundos
- ✅ **Global**: Funciona en cualquier país donde estén disponibles las apps

## 🔧 Configuración

### Red y Token

- **Red (Blockchain)**: Optimism (Chain ID: 10)
  - Layer 2 de Ethereum
  - Comisiones extremadamente bajas (~$0.01)
  - Finalidad en segundos
  - Compatible con todo el ecosistema Ethereum

- **Token**: USDC (USD Coin)
  - Stablecoin con paridad 1:1 al dólar USD
  - Auditable en blockchain
  - Amplio soporte en exchanges y wallets
  - Dirección del contrato en Optimism: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85`

### Apps de Pago Soportadas

Daimo Pay permite a los usuarios pagar con:

1. **Zelle** - Popular en USA
2. **CashApp** - USA, UK
3. **Venmo** - USA
4. **Revolut** - Europa, UK, USA
5. **Wise** - Global (anteriormente TransferWise)

El usuario elige su app preferida en la interfaz de Daimo y paga en dólares. Daimo convierte automáticamente a USDC y lo deposita en tu dirección de Optimism.

## 📋 Requisitos Previos

### 1. Billetera Crypto

Necesitas una billetera compatible con Optimism para recibir USDC:

**Opciones recomendadas:**
- **MetaMask** (más popular)
- **Coinbase Wallet**
- **Rainbow Wallet**
- **Trust Wallet**

**Configurar MetaMask para Optimism:**
1. Abre MetaMask
2. Click en la red (arriba)
3. "Add Network" → "Add network manually"
4. Configurar:
   - Network Name: `Optimism`
   - RPC URL: `https://mainnet.optimism.io`
   - Chain ID: `10`
   - Currency Symbol: `ETH`
   - Block Explorer: `https://optimistic.etherscan.io`

### 2. Direcciones de Wallet

Necesitas 2 direcciones de Optimism:

1. **Treasury Address** (Tesorería):
   - Donde se depositarán los USDC de los pagos exitosos
   - Debe ser una dirección que controles
   - Ejemplo: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

2. **Refund Address** (Reembolsos):
   - Para pagos fallidos o reembolsos
   - Debe ser válida en todas las redes soportadas por Daimo
   - Puede ser la misma que Treasury
   - Ejemplo: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

**IMPORTANTE:** Estas direcciones deben ser de Optimism (0x...) y estar bajo tu control.

### 3. Cuenta de Daimo

1. Contacta a Daimo: `founders@daimo.com`
2. Solicita acceso a Daimo Pay API
3. Proporciona:
   - Nombre de tu app: "PNPtv"
   - URL del webhook: `https://easybots.store/api/webhooks/daimo`
   - Descripción: Pagos de suscripciones para streaming

4. Recibirás:
   - `DAIMO_API_KEY`: Clave API
   - `DAIMO_WEBHOOK_SECRET`: Secret para verificar webhooks

## 🛠️ Variables de Entorno

Agregar al archivo `.env`:

```bash
# Daimo Pay Configuration
DAIMO_API_KEY=your_api_key_from_daimo
DAIMO_WEBHOOK_SECRET=your_webhook_secret_from_daimo
DAIMO_TREASURY_ADDRESS=0xYourOptimismAddress
DAIMO_REFUND_ADDRESS=0xYourOptimismAddress  # Puede ser la misma
```

## 📝 Flujo de Pago

### 1. Usuario Solicita Pago

```javascript
const PaymentService = require('./services/paymentService');

const result = await PaymentService.createPayment({
  userId: '123456789',      // Telegram ID
  planId: 'premium_monthly',
  provider: 'daimo',        // Especificar Daimo
  chatId: '123456789',
  language: 'es',
});

// result.paymentUrl será un link de Daimo Pay
console.log(result.paymentUrl);
// https://pay.daimo.com/pay?intent={...}
```

### 2. Usuario Paga

1. Abre el link de pago
2. Ve la interfaz de Daimo con opciones de pago:
   - Zelle
   - CashApp
   - Venmo
   - Revolut
   - Wise
3. Elige su app preferida
4. Sigue las instrucciones para pagar
5. Daimo convierte USD → USDC
6. USDC se deposita en `DAIMO_TREASURY_ADDRESS`

### 3. Webhook Confirma Pago

Daimo envía un webhook a `https://easybots.store/api/webhooks/daimo`:

```json
{
  "id": "pay_abc123",
  "status": "payment_completed",
  "source": {
    "payerAddress": "0xuser...",
    "txHash": "0x123abc...",
    "chainId": 10,
    "amountUnits": "10000000",  // 10 USDC (6 decimals)
    "tokenSymbol": "USDC"
  },
  "destination": {
    "toAddress": "0xYourTreasury...",
    "toChain": 10,
    "toToken": "0x0b2C639..."
  },
  "metadata": {
    "userId": "123456789",
    "chatId": "123456789",
    "planId": "premium_monthly",
    "paymentId": "uuid-payment-id"
  }
}
```

### 4. Sistema Procesa

1. **Verificación de firma** (HMAC SHA-256)
2. **Actualizar payment** → status: 'completed'
3. **Activar suscripción** del usuario
4. **Enviar emails**:
   - Factura desde `easybots.store`
   - Bienvenida desde `pnptv.app`
5. **Responder webhook** → 200 OK

## 🔒 Seguridad del Webhook

### Verificación de Firma

Cada webhook incluye un header `x-daimo-signature` que debe verificarse:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const payloadString = JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**El sistema automáticamente verifica la firma.** Si la firma es inválida, el webhook se rechaza con `401 Unauthorized`.

### Idempotencia

Los webhooks pueden reenviarse. El sistema previene procesamiento duplicado:

```javascript
// Verifica si ya se procesó este pago
const payment = await PaymentModel.getById(paymentId);
if (payment.status === 'completed') {
  return { success: true, alreadyProcessed: true };
}
```

### HTTPS Obligatorio

El webhook **DEBE** estar en HTTPS. Daimo rechaza webhooks HTTP.

## 📊 Estados de Pago

| Estado Daimo | Descripción | Acción del Sistema |
|--------------|-------------|-------------------|
| `payment_unpaid` | Pago creado pero no iniciado | Marcar como pending |
| `payment_started` | Usuario comenzó a pagar | Marcar como pending |
| `payment_completed` | Pago exitoso ✅ | Activar suscripción + enviar emails |
| `payment_bounced` | Pago rechazado/devuelto | Marcar como failed |

## 💰 Manejo de USDC

### Recibir USDC

Los USDC se depositan automáticamente en `DAIMO_TREASURY_ADDRESS` en Optimism.

**Ver tu balance:**
1. Abre MetaMask
2. Selecciona red Optimism
3. Importa token USDC:
   - Address: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85`
   - Symbol: `USDC`
   - Decimals: `6`

### Convertir USDC a USD

**Opciones:**

1. **Centralized Exchanges:**
   - Coinbase
   - Binance
   - Kraken

   Pasos:
   - Enviar USDC desde Optimism a exchange
   - Vender USDC por USD
   - Retirar a banco

2. **Peer to Peer:**
   - LocalCryptos
   - Paxful

3. **Tarjetas Crypto:**
   - Coinbase Card
   - Crypto.com Visa

### Comisiones

- **Recibir USDC**: Gratis (Daimo cubre las comisiones de Optimism)
- **Enviar a exchange**: ~$0.01 - $0.10 en Optimism
- **Swap a otra crypto**: Variable según DEX

## 🧪 Testing

### Modo Sandbox

Daimo proporciona un entorno de pruebas. Contacta a `founders@daimo.com` para acceso.

### Test Manual

1. Crea un pago de prueba:
```javascript
const result = await PaymentService.createPayment({
  userId: 'test_user',
  planId: 'test_plan',
  provider: 'daimo',
  chatId: 'test_chat',
});
```

2. Abre el `paymentUrl` generado
3. Sigue el flujo en el sandbox de Daimo
4. Verifica que el webhook se reciba correctamente

### Verificar Logs

```bash
# En producción
pm2 logs pnptvbot --lines 100 | grep -i daimo

# Buscar procesamiento de webhooks
grep "Daimo webhook" logs/*.log
```

## 📈 Monitoreo

### Logs Importantes

```javascript
// Webhook recibido
logger.info('Daimo Pay webhook received', {
  eventId, status, txHash, userId, planId
});

// Pago completado
logger.info('User subscription activated via Daimo webhook', {
  userId, planId, expiryDate, txHash
});

// Email enviado
logger.info('Invoice email sent successfully (Daimo)', {
  to, txHash
});
```

### Métricas a Monitorear

1. **Tasa de éxito de pagos**
   - `payment_completed` vs `payment_bounced`

2. **Tiempo de procesamiento**
   - Desde `payment_started` hasta `payment_completed`

3. **Apps más usadas**
   - Estadísticas de qué app de pago prefieren los usuarios

4. **Volumen de USDC**
   - Total recibido por período

## ⚠️ Troubleshooting

### Webhook no se recibe

1. **Verificar URL**:
   - Debe ser: `https://easybots.store/api/webhooks/daimo`
   - No `http://`
   - No IPs locales

2. **Verificar SSL**:
   ```bash
   curl -I https://easybots.store/api/webhooks/daimo
   # Debe retornar código HTTP, no error SSL
   ```

3. **Revisar logs de Daimo**:
   - Contactar a founders@daimo.com
   - Solicitar logs de reintentos de webhook

### Firma inválida

1. **Verificar DAIMO_WEBHOOK_SECRET**:
   - Debe coincidir con el secret configurado en Daimo
   - Sin espacios extra
   - Case-sensitive

2. **Revisar formato del payload**:
   - Daimo envía JSON
   - Express debe tener `bodyParser.json()`

### Pago completado pero suscripción no activa

1. **Verificar logs**:
   ```bash
   pm2 logs | grep -A 10 "Daimo webhook received"
   ```

2. **Verificar metadata**:
   - `userId` debe ser válido
   - `planId` debe existir en DB

3. **Verificar UserModel.updateSubscription()**:
   - Debe ejecutarse sin errores

### USDC no llega a wallet

1. **Verificar dirección**:
   - Debe ser correcta en `DAIMO_TREASURY_ADDRESS`
   - Debe ser de Optimism (no Ethereum Mainnet)

2. **Revisar en block explorer**:
   - https://optimistic.etherscan.io/
   - Buscar tu dirección
   - Verificar transacciones de USDC

3. **Verificar red en wallet**:
   - MetaMask debe estar en red Optimism
   - No Ethereum Mainnet

## 🔗 Enlaces Útiles

- **Daimo Pay Docs**: https://docs.daimo.com/pay
- **Optimism Explorer**: https://optimistic.etherscan.io/
- **USDC en Optimism**: https://optimistic.etherscan.io/token/0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
- **Agregar Optimism a MetaMask**: https://chainlist.org/chain/10
- **Soporte de Daimo**: founders@daimo.com

## 📞 Soporte

### Problemas Técnicos

- **Integración**: Revisar logs en `/logs`
- **Webhook**: Contactar a Daimo (founders@daimo.com)
- **Blockchain**: Revisar en Optimistic Etherscan

### Preguntas Frecuentes

**P: ¿Los usuarios necesitan crypto para pagar?**
R: No. Pagan con USD usando Zelle, CashApp, etc. Daimo convierte a USDC automáticamente.

**P: ¿Cuánto tarda en confirmarse un pago?**
R: Normalmente 5-30 segundos después de que el usuario envíe el pago desde su app.

**P: ¿Puedo retirar el USDC inmediatamente?**
R: Sí, puedes enviarlo a un exchange o usarlo directamente.

**P: ¿Qué comisiones cobra Daimo?**
R: Consulta con Daimo directamente. Típicamente 1-2% + comisiones de red (muy bajas en Optimism).

**P: ¿Funciona en todos los países?**
R: Depende de la disponibilidad de las apps de pago. Zelle es USA, Revolut es Europa/UK/USA, Wise es global.
