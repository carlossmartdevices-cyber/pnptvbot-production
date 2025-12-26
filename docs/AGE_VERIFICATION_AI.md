# Verificación de Edad con IA usando Cámara

Esta funcionalidad permite verificar la edad de los usuarios usando inteligencia artificial para analizar fotos de sus rostros tomadas con la cámara del dispositivo.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Configuración](#configuración)
- [Proveedores de IA](#proveedores-de-ia)
- [Flujo de Usuario](#flujo-de-usuario)
- [Base de Datos](#base-de-datos)
- [API y Servicios](#api-y-servicios)
- [Seguridad y Privacidad](#seguridad-y-privacidad)

## 📖 Descripción

El sistema de verificación de edad con IA permite a los usuarios verificar su edad tomando una selfie. La foto es analizada por servicios de reconocimiento facial con IA que estiman la edad del usuario. Si la edad estimada cumple con el requisito mínimo (por defecto 18 años), el usuario es verificado automáticamente.

## ✨ Características

- **Verificación automática con IA**: Análisis facial para estimar la edad
- **Múltiples proveedores**: Soporte para Azure Face API y Face++
- **Opción de fallback**: Verificación manual si el usuario prefiere o si la IA falla
- **Historial de intentos**: Registro de todos los intentos de verificación
- **Expiración configurable**: La verificación expira después de un período configurable (por defecto 7 días)
- **Multiidioma**: Soporte para español e inglés
- **Estadísticas**: Panel de análisis de verificaciones

## ⚙️ Configuración

### Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Age Verification with AI

# Provider: 'azure' or 'facepp'
AGE_VERIFICATION_PROVIDER=azure

# Minimum age requirement (default: 18)
MIN_AGE_REQUIREMENT=18

# Microsoft Azure Face API (if using 'azure' provider)
AZURE_FACE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com
AZURE_FACE_API_KEY=your_azure_face_api_key

# Face++ API (if using 'facepp' provider)
FACEPP_API_KEY=your_facepp_api_key
FACEPP_API_SECRET=your_facepp_api_secret
```

### Migración de Base de Datos

Ejecuta la migración para crear las tablas necesarias:

```bash
psql -U your_user -d your_database -f database/migrations/age_verification_ai_schema.sql
```

O si tienes un script de migración:

```bash
npm run migrate
```

## 🤖 Proveedores de IA

### Microsoft Azure Face API

**Ventajas:**
- Alta precisión en detección de edad
- Infraestructura robusta de Microsoft
- Cumplimiento con GDPR y regulaciones de privacidad
- Nivel gratuito disponible

**Configuración:**

1. Crea una cuenta en [Azure Portal](https://portal.azure.com)
2. Crea un recurso de "Face API"
3. Obtén el endpoint y la API key
4. Configura las variables de entorno

**Precios:**
- Gratis: 20 transacciones por minuto, 30,000 transacciones por mes
- Estándar: $1.00 por 1,000 transacciones

### Face++ API

**Ventajas:**
- API simple y fácil de usar
- Buena documentación
- Nivel gratuito generoso
- Rápida velocidad de respuesta

**Configuración:**

1. Regístrate en [Face++ Console](https://console.faceplusplus.com)
2. Crea una aplicación
3. Obtén tu API Key y API Secret
4. Configura las variables de entorno

**Precios:**
- Gratis: 1,000 llamadas/mes
- Estándar: Consultar pricing

## 👤 Flujo de Usuario

### 1. Inicio del Proceso

Durante el onboarding, después de seleccionar el idioma, el usuario ve:

```
🔒 Verificación de Edad

Para cumplir con las regulaciones, necesitamos verificar que eres mayor de 18 años.

📸 Opción 1: Verificación con Foto (Recomendado)
Toma una selfie y nuestra IA verificará tu edad automáticamente.

✅ Opción 2: Confirmación Manual
Confirma manualmente que eres mayor de edad.

¿Cómo deseas verificar tu edad?
```

### 2. Verificación con Foto

Si el usuario selecciona "Verificación con Foto", recibe instrucciones:

```
📸 Instrucciones para la Foto

Para una verificación exitosa, por favor:

✓ Toma una selfie clara de tu rostro
✓ Asegúrate de tener buena iluminación
✓ Mira directamente a la cámara
✓ No uses filtros o efectos
✓ Tu rostro debe estar completamente visible

📷 Envía tu foto ahora
```

### 3. Análisis con IA

Una vez enviada la foto:

1. Se muestra "⏳ Analizando tu foto con IA, por favor espera..."
2. La foto se descarga del servidor de Telegram
3. Se envía al proveedor de IA seleccionado
4. Se analiza la respuesta

### 4. Resultados

#### ✅ Verificación Exitosa

```
✅ Verificación Exitosa

Tu edad ha sido verificada correctamente.

📊 Edad estimada: 25 años
🔒 Estado: Verificado

¡Gracias por completar la verificación!
```

#### ❌ No se detectó rostro

```
❌ No se detectó un rostro

No pudimos detectar un rostro claro en tu foto.

Por favor, intenta nuevamente con:
• Mejor iluminación
• Foto más cercana de tu rostro
• Sin gafas de sol u obstrucciones

¿Deseas intentar de nuevo?
```

#### ❌ Edad insuficiente

```
❌ Verificación No Exitosa

Según nuestro análisis, no cumples con el requisito de edad mínima (18 años).

📊 Edad estimada: 16 años

Si crees que esto es un error, puedes:
• Intentar con otra foto más clara
• Contactar a soporte
```

## 💾 Base de Datos

### Tabla `users` (campos agregados)

```sql
age_verification_method VARCHAR(50) DEFAULT 'manual'
```

Valores posibles:
- `manual`: Verificación manual (botón de confirmación)
- `ai_photo`: Verificación con IA usando foto
- `document`: Verificación con documento (futuro)

### Tabla `age_verification_attempts`

Almacena todos los intentos de verificación con IA:

```sql
CREATE TABLE age_verification_attempts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  photo_file_id VARCHAR(255) NOT NULL,
  estimated_age INTEGER,
  confidence DECIMAL(5,4),
  verified BOOLEAN DEFAULT FALSE,
  provider VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 API y Servicios

### AgeVerificationService

Ubicación: `/src/services/ageVerificationService.js`

**Métodos principales:**

#### `verifyAgeFromPhoto(ctx, photoFileId)`

Verifica la edad desde una foto de Telegram.

**Parámetros:**
- `ctx`: Contexto de Telegraf
- `photoFileId`: ID del archivo de foto en Telegram

**Retorna:**
```javascript
{
  success: true,
  verified: true,
  age: 25,
  confidence: 0.85,
  minAge: 18,
  provider: 'azure'
}
```

#### `isVerificationExpired(user)`

Verifica si la verificación de edad del usuario ha expirado.

**Parámetros:**
- `user`: Objeto de usuario

**Retorna:** `true` si expiró, `false` si aún es válida

#### `getStatistics()`

Obtiene estadísticas de verificaciones de los últimos 30 días.

**Retorna:**
```javascript
{
  total_attempts: 150,
  successful_verifications: 142,
  avg_estimated_age: 24.5,
  avg_confidence: 0.87
}
```

### Handlers

Ubicación: `/src/bot/handlers/user/ageVerificationHandler.js`

**Funciones exportadas:**

- `registerAgeVerificationHandlers(bot)`: Registra todos los handlers
- `showAgeVerificationOptions(ctx)`: Muestra opciones de verificación
- `startPhotoVerification(ctx)`: Inicia el proceso de foto
- `handleAgePhotoSubmission(ctx)`: Maneja la foto enviada

## 🔒 Seguridad y Privacidad

### Protección de Datos

1. **No almacenamiento de fotos**: Las fotos NO se almacenan después de la verificación. Solo se guarda el `file_id` de Telegram para referencia.

2. **Datos mínimos**: Solo se almacena:
   - Edad estimada (número entero)
   - Nivel de confianza
   - Resultado de verificación (true/false)
   - Proveedor usado
   - Fecha del intento

3. **Encriptación en tránsito**: Todas las comunicaciones con APIs de IA usan HTTPS.

4. **Cumplimiento de regulaciones**:
   - GDPR: Los usuarios tienen derecho a solicitar eliminación de datos
   - COPPA: Verificación obligatoria para menores
   - Transparencia: Los usuarios son informados del uso de IA

### Limitaciones de Responsabilidad

⚠️ **IMPORTANTE**: La detección de edad por IA es una estimación y puede tener errores. Este sistema debe usarse como:

1. **Primera línea de defensa**: Filtro automático inicial
2. **Con verificación manual de respaldo**: Opción alternativa disponible
3. **Complemento, no reemplazo**: No sustituye verificación legal cuando sea requerida

### Mejores Prácticas

1. **Configurar múltiples proveedores**: Tener fallback si uno falla
2. **Monitorear estadísticas**: Revisar precisión regularmente
3. **Límite de intentos**: Implementar límite de intentos por usuario
4. **Registro de auditoría**: Mantener logs de verificaciones
5. **Revisión manual**: Implementar proceso de revisión manual para casos dudosos

## 📊 Estadísticas y Monitoreo

### Query de estadísticas

```sql
SELECT
  provider,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE verified = true) as successful_verifications,
  ROUND(AVG(estimated_age)::numeric, 2) as avg_estimated_age,
  ROUND(AVG(confidence)::numeric, 4) as avg_confidence
FROM age_verification_attempts
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY provider;
```

### Uso en código

```javascript
const ageVerificationService = require('./src/services/ageVerificationService');

// Obtener estadísticas
const stats = await ageVerificationService.getStatistics();
console.log('Estadísticas de verificación:', stats);
```

## 🔄 Actualización de Verificación

Los usuarios deben re-verificar su edad después de 7 días (configurable). El sistema verifica automáticamente al iniciar el bot:

```javascript
if (ageVerificationService.isVerificationExpired(user)) {
  await showAgeVerificationOptions(ctx);
}
```

## 🛠️ Troubleshooting

### Error: "Azure Face API credentials not configured"

**Solución**: Verifica que `AZURE_FACE_ENDPOINT` y `AZURE_FACE_API_KEY` estén configuradas en `.env`

### Error: "No se detectó un rostro"

**Causas comunes**:
- Foto muy oscura o con poca iluminación
- Rostro muy pequeño en la foto
- Gafas de sol u obstrucciones
- Foto borrosa o de baja calidad

**Solución**: Pedir al usuario que tome otra foto siguiendo las instrucciones

### Error: "Failed to download photo"

**Causa**: Problema de red o token de bot inválido

**Solución**: Verificar conectividad y que `BOT_TOKEN` sea válido

## 📝 Ejemplo de Uso

```javascript
const ageVerificationService = require('./src/services/ageVerificationService');

// Verificar edad desde foto
const result = await ageVerificationService.verifyAgeFromPhoto(ctx, photoFileId);

if (result.success && result.verified) {
  console.log(`Usuario verificado con edad estimada: ${result.age} años`);
} else if (!result.faceDetected) {
  console.log('No se detectó rostro en la foto');
} else {
  console.log(`Usuario no cumple requisito de edad: ${result.age} años`);
}
```

## 🚀 Mejoras Futuras

- [ ] Verificación con documento de identidad
- [ ] ML local sin depender de APIs externas
- [ ] Detección de fotos falsas o manipuladas
- [ ] Soporte para más proveedores de IA
- [ ] Dashboard de administración para revisar verificaciones
- [ ] Notificaciones de re-verificación antes de expirar
- [ ] Integración con sistemas de KYC (Know Your Customer)

## 📚 Referencias

- [Azure Face API Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/face/)
- [Face++ API Documentation](https://console.faceplusplus.com/documents/5679127)
- [Age Detection Best Practices](https://www.ijcai.org/proceedings/2019/0124.pdf)

## 📞 Soporte

Para preguntas o problemas, contacta al equipo de desarrollo o abre un issue en el repositorio.

---

**Última actualización**: Diciembre 2025
**Versión**: 1.0.0
