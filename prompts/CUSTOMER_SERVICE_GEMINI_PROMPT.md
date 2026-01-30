# Prompt para Gemini CLI — Sistema de Atención al Cliente

Este prompt está diseñado para ejecutar **Gemini CLI** y pedirle que revise y complete un **sistema de atención al cliente** en este repositorio. 

## ✅ Cómo usarlo

1. Exporta tu API key de Gemini en una variable de entorno:

```bash
export GEMINI_API_KEY="TU_API_KEY_AQUI"
```

2. Ejecuta el comando con el prompt completo:

```bash
gemini-cli --markdown -t "$GEMINI_API_KEY" "Actúa como ingeniero principal. Necesito que completes y verifiques el **sistema de atención al cliente** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Implementar un flujo completo de soporte/atención al cliente (tickets, seguimiento y resolución).
- Integrar el sistema con menús, notificaciones y panel de administración.
- Corregir cualquier TODO, bug o flujo roto relacionado con atención al cliente.

Instrucciones:
1) Revisa la documentación general del bot (README.md, START_HERE.md, QUICK_START.md, DEPLOYMENT*.md).
2) Recorre el código relacionado con soporte (handlers, services, models, migrations) y detecta piezas faltantes.
3) Valida que el sistema tenga:
   - Creación de tickets por usuarios.
   - Asignación y seguimiento por administradores.
   - Estados (abierto, en progreso, resuelto, cerrado).
   - Notificaciones claras para usuarios y admins.
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
  "Actúa como ingeniero principal. Necesito que completes y verifiques el **sistema de atención al cliente** en este repositorio: /workspace/pnptvbot-production.

Objetivo:
- Implementar un flujo completo de soporte/atención al cliente (tickets, seguimiento y resolución).
- Integrar el sistema con menús, notificaciones y panel de administración.
- Corregir cualquier TODO, bug o flujo roto relacionado con atención al cliente.

Instrucciones:
1) Revisa la documentación general del bot (README.md, START_HERE.md, QUICK_START.md, DEPLOYMENT*.md).
2) Recorre el código relacionado con soporte (handlers, services, models, migrations) y detecta piezas faltantes.
3) Valida que el sistema tenga:
   - Creación de tickets por usuarios.
   - Asignación y seguimiento por administradores.
   - Estados (abierto, en progreso, resuelto, cerrado).
   - Notificaciones claras para usuarios y admins.
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
  -c "Contexto breve del estado actual del sistema de atención al cliente y objetivos." \
  "Actúa como ingeniero principal. Necesito que completes y verifiques el **sistema de atención al cliente** en este repositorio: /workspace/pnptvbot-production."
```

## ✅ Nota de seguridad

Nunca subas ni hagas commit de tu API key. Usa siempre variables de entorno.

```