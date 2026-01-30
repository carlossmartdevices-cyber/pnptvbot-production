# Prompt para Gemini CLI — Módulo PNP Latino Live

Este prompt está diseñado para ejecutar **Gemini CLI** y pedirle que revise y complete el módulo **PNP Latino Live** en este repositorio. 

## ✅ Cómo usarlo

1. Exporta tu API key de Gemini en una variable de entorno:

```bash
export GEMINI_API_KEY="TU_API_KEY_AQUI"
```

2. Ejecuta el comando con el prompt completo:

```bash
gemini-cli --markdown -t "$GEMINI_API_KEY" "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Latino Live** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Asegurar que todo el flujo PNP Latino Live esté completo, estable y listo para producción.
- Validar que el módulo esté integrado en menús, planes, pagos, notificaciones y flujos de administración.
- Corregir cualquier TODO, bug o flujo roto relacionado con PNP Latino Live.

Instrucciones:
1) Revisa la documentación específica del módulo (PNP_LATINO_LIVE_ENHANCEMENTS.md, DEPLOYMENT_CHECKLIST.md, FINAL_DEPLOYMENT_SUMMARY.md).
2) Recorre el código relacionado con PNP Live (handlers, services, models y migrations) para encontrar inconsistencias o piezas faltantes.
3) Valida que el sistema tenga:
   - Menús de usuario y admin funcionando.
   - Promocodes, booking y notificaciones activos.
   - Integración con planes/pagos (si aplica).
4) Implementa los cambios necesarios directamente en el código.
5) Si falta configuración, usa env.template como guía y explica qué variables deben configurarse.
6) Al final, entrega:
   - Resumen de cambios.
   - Archivos modificados.
   - Comandos para pruebas/verificación.
   - Siguientes pasos recomendados.

Formato de salida:
- Resumen breve
- Lista de cambios (con rutas de archivo)
- Comandos ejecutables
- Pendientes (si aplica)"
```

## ✅ Formato solicitado (plantilla de CLI)

Si necesitas el **formato exacto de uso** que muestra `gemini-cli -h`, aquí tienes un ejemplo **relleno** con el prompt anterior:

```bash
gemini-cli \
  -t "$GEMINI_API_KEY" \
  --markdown \
  "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Latino Live** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Asegurar que todo el flujo PNP Latino Live esté completo, estable y listo para producción.
- Validar que el módulo esté integrado en menús, planes, pagos, notificaciones y flujos de administración.
- Corregir cualquier TODO, bug o flujo roto relacionado con PNP Latino Live.

Instrucciones:
1) Revisa la documentación específica del módulo (PNP_LATINO_LIVE_ENHANCEMENTS.md, DEPLOYMENT_CHECKLIST.md, FINAL_DEPLOYMENT_SUMMARY.md).
2) Recorre el código relacionado con PNP Live (handlers, services, models y migrations) para encontrar inconsistencias o piezas faltantes.
3) Valida que el sistema tenga:
   - Menús de usuario y admin funcionando.
   - Promocodes, booking y notificaciones activos.
   - Integración con planes/pagos (si aplica).
4) Implementa los cambios necesarios directamente en el código.
5) Si falta configuración, usa env.template como guía y explica qué variables deben configurarse.
6) Al final, entrega:
   - Resumen de cambios.
   - Archivos modificados.
   - Comandos para pruebas/verificación.
   - Siguientes pasos recomendados.

Formato de salida:
- Resumen breve
- Lista de cambios (con rutas de archivo)
- Comandos ejecutables
- Pendientes (si aplica)"
```

Si quieres incluir **contexto adicional** (por ejemplo, un resumen del estado actual), puedes agregarlo con `-c`:

```bash
gemini-cli \
  -t "$GEMINI_API_KEY" \
  --markdown \
  -c "Contexto breve del estado actual del bot y objetivos del módulo PNP Latino Live." \
  "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Latino Live** en este repositorio: /workspace/pnptvbot-production."
```

## ✅ Nota de seguridad

Nunca subas ni hagas commit de tu API key. Usa siempre variables de entorno.

```