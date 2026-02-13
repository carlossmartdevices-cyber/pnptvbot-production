# Manual de Sistemas de Pago

Este documento proporciona una visión general de los diferentes proveedores de pago integrados en el bot y enlaza a la documentación detallada de cada uno.

El bot utiliza múltiples pasarelas para procesar pagos, cada una con un flujo de integración y confirmación distinto.

## Proveedores de Pago

### 1. Daimo

- **Uso Principal**: Pagos P2P (Zelle, CashApp, Venmo).
- **Mecanismo de Confirmación**: **Webhooks**. Es un sistema moderno y fiable donde Daimo notifica activamente al bot cuando un pago se ha completado.
- **Documentación Detallada**: **[Ver el flujo de pago de Daimo](./MANUAL_BOT_DAIMO.md)**

### 2. ePayco

- **Uso Principal**: Pagos con tarjeta de crédito/débito y suscripciones recurrentes.
- **Mecanismo de Confirmación**: **Webhooks**. Similar a Daimo, ePayco notifica al bot sobre el estado de las transacciones. También utiliza una URL de redirección como método de confirmación secundario.
- **Documentación Detallada**: **[Ver el flujo de pago de ePayco](./MANUAL_BOT_EPAYCO.md)**

### 3. Meru

- **Uso Principal**: Activación de pases vitalicios (`Lifetime Pass`) mediante códigos predefinidos.
- **Mecanismo de Confirmación**: **Scraping con Puppeteer**. A diferencia de los otros sistemas, este flujo no utiliza webhooks. El bot abre una instancia de un navegador web en segundo plano, visita la página del link de pago de Meru y lee el contenido para verificar si el pago fue realizado. Este método es más frágil y depende del contenido de la página de Meru.
- **Documentación Detallada**: **[Ver el flujo de pago de Meru](./MANUAL_BOT_MERU.md)**
