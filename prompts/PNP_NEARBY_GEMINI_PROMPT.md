# Prompt para Gemini CLI — Módulo PNP Nearby

Este prompt está diseñado para ejecutar **Gemini CLI** y pedirle que revise y complete el módulo **PNP Nearby** en este repositorio. 

## ✅ Cómo usarlo

1. Exporta tu API key de Gemini en una variable de entorno:

```bash
export GEMINI_API_KEY="TU_API_KEY_AQUI"
```

2. Ejecuta el comando con el prompt completo:

```bash
gemini-cli --markdown -t "$GEMINI_API_KEY" "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Nearby** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Asegurar que el flujo PNP Nearby esté completo, estable y listo para producción.
- Validar integración con menús, filtros de ubicación y permisos de usuario.
- Corregir cualquier TODO, bug o flujo roto relacionado con PNP Nearby.

Instrucciones:
1) Revisa la documentación relevante (README.md, START_HERE.md, QUICK_START.md, DEPLOYMENT*.md).
2) Recorre el código relacionado con PNP Nearby (handlers, services, models, migrations) para detectar inconsistencias o piezas faltantes.
3) Valida que el sistema tenga:
   - Captura/actualización de ubicación del usuario.
   - Búsqueda por cercanía y filtros relevantes.
   - Menús de usuario y admin funcionando.
   - Notificaciones y mensajes claros.
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
  "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Nearby** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Asegurar que el flujo PNP Nearby esté completo, estable y listo para producción.
- Validar integración con menús, filtros de ubicación y permisos de usuario.
- Corregir cualquier TODO, bug o flujo roto relacionado con PNP Nearby.

Instrucciones:
1) Revisa la documentación relevante (README.md, START_HERE.md, QUICK_START.md, DEPLOYMENT*.md).
2) Recorre el código relacionado con PNP Nearby (handlers, services, models, migrations) para detectar inconsistencias o piezas faltantes.
3) Valida que el sistema tenga:
   - Captura/actualización de ubicación del usuario.
   - Búsqueda por cercanía y filtros relevantes.
   - Menús de usuario y admin funcionando.
   - Notificaciones y mensajes claros.
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

Si quieres incluir **contexto adicional**, puedes agregarlo con `-c`:

```bash
gemini-cli \
  -t "$GEMINI_API_KEY" \
  --markdown \
  -c "Contexto breve del estado actual del módulo PNP Nearby y objetivos." \
  "Actúa como ingeniero principal. Necesito que completes y verifiques el módulo **PNP Nearby** en este repositorio: /workspace/pnptvbot-production."
```

## ✅ Nota de seguridad

Nunca subas ni hagas commit de tu API key. Usa siempre variables de entorno.

```