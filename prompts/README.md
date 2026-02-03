# 🤖 Sistema de Generación de Bots de Telegram

Esta carpeta contiene el **sistema completo** para generar bots de Telegram profesionales basados en la arquitectura de PNPtv Bot.

---

## 📂 ARCHIVOS EN ESTA CARPETA

### 1. **BOT_GENERATOR_INDEX.md** ⭐ EMPIEZA AQUÍ
- **Qué es:** Índice de navegación y guía principal del sistema
- **Cuándo leer:** Primera vez que usas el sistema
- **Contenido:**
  - Descripción de todos los archivos
  - Flujos recomendados según tu nivel
  - Mapa conceptual del sistema
  - FAQ completo
  - Casos de uso reales

---

- **MASTER_BOT_PROMPT_TEMPLATE.md**
- **Qué es:** Template maestro con ~15,000 palabras
- **Cuándo usar:** Para generar cualquier tipo de bot desde cero
- **Contenido:**
  - Arquitectura completa (estructura de carpetas)
  - Sistema de roles (user, admin, super_admin)
  - Modelos de datos parametrizables
  - Patrones de diseño obligatorios
  - Configuración de servicios (PostgreSQL, Redis, Pagos)
  - i18n multi-idioma
  - API REST y webhooks idempotentes
  - Deployment ready

**Cómo usar:**
1. Copia todo el contenido
2. Reemplaza variables `{{VARIABLE}}` con tus valores
3. Pega en Mistral/Claude/ChatGPT
4. El LLM genera el código completo

---

### 3. **PROMPT_EXAMPLES.md**
- **Qué es:** 5 ejemplos completos con variables pre-llenadas
- **Cuándo usar:** Para acelerar la generación usando casos predefinidos
- **Ejemplos incluidos:**
  1. 🍕 **Bot de Restaurante** - Pedidos, delivery, reservas
  2. 🏨 **Bot de Alojamiento** - Tipo Airbnb
  3. 💆 **Bot de Servicios** - Citas, terapias, wellness
  4. 🛍️ **Bot de E-commerce** - Tienda online
  5. 🎫 **Bot de Tours** - Experiencias turísticas

**Cómo usar:**
1. Encuentra el ejemplo más cercano a tu caso
2. Copia el bloque de variables
3. Úsalas para llenar MASTER_BOT_PROMPT_TEMPLATE.md

---

### 4. **QUICK_START_GUIDE.md**
- **Qué es:** Tutorial paso a paso
- **Cuándo usar:** Si es tu primera vez o necesitas ayuda
- **Contenido:**
  - ⚡ Inicio rápido en 3 pasos
  - 🎯 Flujo completo (de 0 a producción en 1-2 horas)
  - ✅ Checklist de verificación
  - 🐛 Troubleshooting común
  - 💡 Tips profesionales
  - 🔧 Setup local y deployment

---

## 🚀 INICIO RÁPIDO

### Para principiantes:

```
1. Lee: BOT_GENERATOR_INDEX.md (10 min)
2. Elige: Tu tipo de bot en PROMPT_EXAMPLES.md (5 min)
3. Copia: Las variables del ejemplo (2 min)
4. Genera: Personaliza MASTER_BOT_PROMPT_TEMPLATE.md (15 min)
5. Pega: El prompt en Mistral (30-60 min de generación)
```

**Total:** 1-2 horas para un bot completo

---

### Para usuarios avanzados:

```
1. Abre: MASTER_BOT_PROMPT_TEMPLATE.md
2. Define: Tus propias variables personalizadas
3. Genera: Múltiples bots en paralelo
4. Deploy: Railway/Render/VPS
```

**Total:** 1 hora por bot adicional

---

## 📊 ¿QUÉ PUEDES GENERAR?

Usando estos templates puedes crear bots para:

- 🍕 **Restaurantes** - Pedidos, delivery, reservas de mesas
- 🏨 **Alojamiento** - Bookings tipo Airbnb
- 💆 **Servicios** - Citas para terapias, masajes, consultas
- 🛍️ **E-commerce** - Tiendas online con carrito y pagos
- 🎫 **Tours** - Experiencias turísticas
- 🎓 **Educación** - Cursos, tareas, evaluaciones
- 🏋️ **Fitness** - Rutinas, nutrición, tracking
- 🚗 **Transporte** - Reservas de taxis/rideshare
- 🏥 **Salud** - Citas médicas, telemedicina
- 💼 **Freelancing** - Proyectos, proposals, pagos
- **...y cualquier otro tipo de negocio**

---

## ✨ CARACTERÍSTICAS DE LOS BOTS GENERADOS

Todos los bots incluyen:

✅ **Arquitectura profesional** con separación de responsabilidades
✅ **Sistema de roles** (user, admin, super_admin)
✅ **Pagos integrados** (ePayco, Daimo)
✅ **Multi-idioma** (i18n con soporte en/es extensible)
✅ **Cache con Redis** (con fallback in-memory)
✅ **Webhooks idempotentes** con distributed locking
✅ **Rate limiting** por usuario
✅ **Error handling** completo y resiliente
✅ **Panel de admin** con estadísticas
✅ **API REST** con Express
✅ **Health checks** para producción
✅ **Logging estructurado** con Winston
✅ **Deployment ready** (Railway, Render, VPS)

---

## 🎯 FLUJO RECOMENDADO

```
Día 1: Generación
├─ 10 min: Leer BOT_GENERATOR_INDEX.md
├─ 5 min: Elegir ejemplo en PROMPT_EXAMPLES.md
├─ 15 min: Personalizar variables
├─ 60 min: Generar con Mistral
└─ 30 min: Revisar código generado

Día 2: Setup
├─ 15 min: Setup local (npm install, .env)
├─ 20 min: Configurar PostgreSQL + Redis
├─ 10 min: Obtener token de Telegram
└─ 15 min: Testing local

Día 3: Deployment
├─ 20 min: Configurar Railway/Render
├─ 10 min: Variables de entorno producción
├─ 10 min: Deploy y verificar
└─ 20 min: Testing en producción

Total: ~3-4 horas para un bot completo en producción
```

---

## 🎓 NIVELES DE APRENDIZAJE

### 📗 Nivel 1: Principiante
- **Objetivo:** Generar tu primer bot funcional
- **Lee:** QUICK_START_GUIDE.md + PROMPT_EXAMPLES.md
- **Resultado:** Bot funcional en local

### 📘 Nivel 2: Intermedio
- **Objetivo:** Bot en producción con pagos
- **Lee:** MASTER_BOT_PROMPT_TEMPLATE.md (secciones de pagos)
- **Resultado:** Bot en producción aceptando pagos

### 📕 Nivel 3: Avanzado
- **Objetivo:** Múltiples bots optimizados
- **Lee:** Código fuente de PNPtv + architecture patterns
- **Resultado:** Sistema multi-bot profesional

---

## 💡 TIPS

1. **Empieza con un ejemplo** - Más rápido que crear desde cero
2. **Prueba localmente primero** - npm run dev antes de deploy
3. **Lee los logs** - Winston loggea todo para debugging
4. **Usa el modo degradado** - El bot siempre arranca (ver docs/ERROR_HANDLING.md)
5. **Genera en paralelo** - Usa múltiples ventanas de Mistral para varios bots

---

## 📚 DOCUMENTACIÓN RELACIONADA

- **../docs/ERROR_HANDLING.md** - Sistema de errores resiliente del bot
- **../docs/architecture.md** - Arquitectura de PNPtv (referencia)
- **../README.md** - Documentación principal del proyecto

---

## 🤝 SOPORTE

**¿Tienes preguntas?**

1. Revisa **BOT_GENERATOR_INDEX.md** (FAQ section)
2. Lee **QUICK_START_GUIDE.md** (Troubleshooting)
3. Revisa el código de **PNPtv** como referencia (../src/)
4. Usa el LLM para debugging específico

---

## 📝 ESTRUCTURA COMPLETA

```
prompts/
├── README.md                        ← Este archivo
├── BOT_GENERATOR_INDEX.md           ← 🎯 Empieza aquí
├── MASTER_BOT_PROMPT_TEMPLATE.md    ← Template maestro
├── PROMPT_EXAMPLES.md               ← 5 ejemplos listos
└── QUICK_START_GUIDE.md             ← Tutorial paso a paso
```

---

**¡Listo para generar tu primer bot! 🚀**

**Siguiente paso:** Abre `BOT_GENERATOR_INDEX.md`

---

_Última actualización: 2025-11-16_
_Versión: 1.0_
