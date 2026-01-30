# Prompt para Gemini CLI — Sistema de Perfil de Usuario

Este prompt está diseñado para ejecutar **Gemini CLI** y pedirle que revise y complete el **sistema de perfil de usuario** en este repositorio. 

## ✅ Cómo usarlo

1. Exporta tu API key de Gemini en una variable de entorno:

```bash
export GEMINI_API_KEY="TU_API_KEY_AQUI"
```

2. Ejecuta el comando con el prompt completo:

```bash
gemini-cli --markdown -t "$GEMINI_API_KEY" "Actúa como ingeniero principal. Necesito que completes y verifiques el **sistema de perfil de usuario** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Completar y validar el flujo de creación y edición de perfiles.
- Asegurar coherencia con reglas de cumplimiento, moderación y visibilidad.
- Corregir cualquier TODO, bug o flujo roto relacionado con perfiles.

Instrucciones:
1) Revisa la documentación relevante (PROFILE_COMPLIANCE_*.md, README.md, START_HERE.md, QUICK_START.md).
2) Recorre el código relacionado con perfiles (handlers, services, models, migrations) y detecta piezas faltantes.
3) Valida que el sistema tenga:
   - Captura y edición de datos del perfil.
   - Reglas de visibilidad y privacidad claras.
   - Validaciones/formatos consistentes (edad, contenido, idioma).
   - Notificaciones y mensajes de estado para usuarios/admins.
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
  "Actúa como ingeniero principal. Necesito que completes y verifiques el **sistema de perfil de usuario** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Completar y validar el flujo de creación y edición de perfiles.
- Asegurar coherencia con reglas de cumplimiento, moderación y visibilidad.
- Corregir cualquier TODO, bug o flujo roto relacionado con perfiles.

Instrucciones:
1) Revisa la documentación relevante (PROFILE_COMPLIANCE_*.md, README.md, START_HERE.md, QUICK_START.md).
2) Recorre el código relacionado con perfiles (handlers, services, models, migrations) y detecta piezas faltantes.
3) Valida que el sistema tenga:
   - Captura y edición de datos del perfil.
   - Reglas de visibilidad y privacidad claras.
   - Validaciones/formatos consistentes (edad, contenido, idioma).
   - Notificaciones y mensajes de estado para usuarios/admins.
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