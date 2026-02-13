# Manual del Bot - Gestión de Membresías y Activaciones

Este documento detalla el ciclo de vida completo de una membresía de usuario, desde su activación y almacenamiento hasta el control de acceso y el proceso de expiración.

## 1. El Modelo de Datos del Usuario

El corazón del sistema de membresías reside en la tabla `users` de la base de datos PostgreSQL. El modelo de datos (`src/models/userModel.js`) define los campos clave que determinan el estado de un usuario:

- **`subscription_status`**: Un campo de texto que indica el estado actual (ej: `'active'`, `'free'`, `'churned'`).
- **`plan_id`**: Identifica el plan específico al que está suscrito el usuario (ej: `'monthly_plan'`, `'lifetime_pass'`).
- **`plan_expiry`**: Una marca de tiempo (timestamp) que define la fecha y hora exactas en que expira la membresía. Para las membresías vitalicias, este campo es `NULL`.
- **`tier`**: Un campo derivado (`'Prime'` o `'Free'`) que se utiliza para simplificar las comprobaciones de acceso.
- **`subscription.isPrime`**: Para facilitar el desarrollo, el objeto `user` que se maneja en el código incluye una propiedad booleana `user.subscription.isPrime`, que es `true` si el `subscription_status` es `'active'`.

## 2. Activación de Membresías

La activación es el proceso de convertir a un usuario en miembro "Prime". Generalmente ocurre después de un pago exitoso, aunque también puede ser un proceso manual.

### 2.1 Activación por Pago (Epayco/Daimo)

- Cuando un webhook de pago es procesado exitosamente por `paymentService.js`, este servicio llama a `UserModel.updateSubscription()`.
- Para una suscripción con tiempo limitado (ej: 1 mes), la llamada incluye una fecha de expiración:
  ```javascript
  UserModel.updateSubscription(userId, {
    status: 'active',
    planId: 'monthly_plan',
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días desde ahora
  });
  ```
- Esto establece el `plan_expiry` en la base de datos, iniciando el "reloj" de la suscripción.

### 2.2 Activación de Pases Vitalicios y Códigos

- Existe una función especializada `activateMembership` en `src/bot/handlers/payments/activation.js`.
- Esta función es una variante de la activación normal que establece la expiración en `NULL`, creando una membresía permanente.
  ```javascript
  UserModel.updateSubscription(userId, {
    status: 'active',
    planId: 'lifetime_pass',
    expiry: null
  });
  ```
- Este método se usa en flujos como la activación de un pase Meru o la activación manual de un código de la tabla `activation_codes` por parte de un administrador.

## 3. Control de Acceso a Funciones Premium

Una vez que un usuario es "Prime", el sistema debe concederle acceso a funciones exclusivas. Este control se implementa en múltiples capas:

1.  **Nivel de Interfaz (Menús Dinámicos)**:
    - Los menús que ve el usuario se generan dinámicamente. La función `buildMainMenuKeyboard` (`src/handlers/menu/menuHandler.js`) recibe un parámetro `isPrime` y muestra botones diferentes para usuarios gratuitos y premium. Los usuarios gratuitos a menudo ni siquiera ven las opciones para las funciones de pago.

2.  **Nivel de Lógica (Comprobaciones en Handlers)**:
    - Dentro del código de los manejadores de comandos o acciones, se realizan comprobaciones directas antes de ejecutar una función. Se utiliza una función centralizada `isPrimeUser(user)` de `src/bot/utils/helpers.js` para verificar el estado.
      ```javascript
      // Ejemplo en un handler
      const isPrime = isPrimeUser(user);
      if (!isPrime) {
        // Responder que esta función es solo para miembros PRIME
        return;
      }
      // Continuar con la lógica de la función...
      ```

3.  **Nivel de Middleware**:
    - Para proteger grupos enteros de funcionalidades (ej: acceso a canales específicos), se utiliza middleware que se ejecuta antes que cualquier handler. Un ejemplo es `src/bot/core/middleware/topicPermissions.js`, que verifica `!user?.subscription?.isPrime` y corta la ejecución si el usuario no es premium.

## 4. Proceso de Expiración y Baja

El manejo de las membresías que llegan a su fin es un proceso automatizado gestionado por trabajos programados (cron jobs).

### 4.1 Identificación de Miembros Expirados

- El archivo `scripts/cron.js` define un trabajo (`MEMBERSHIP_CLEANUP_CRON`) que se ejecuta diariamente (a medianoche, según la configuración por defecto).
- Este trabajo invoca a la función `MembershipCleanupService.runFullCleanup()`.

### 4.2 Proceso de Limpieza y Baja

El `MembershipCleanupService` realiza las siguientes acciones:

1.  **Obtiene Usuarios Expirados**: Llama a `UserModel.getExpiredSubscriptions()`, que ejecuta la siguiente consulta SQL para encontrar a todos los usuarios cuya membresía debería haber terminado:
    ```sql
    SELECT * FROM users WHERE subscription_status = 'active' AND plan_expiry <= NOW()
    ```
2.  **Actualiza el Estado en la Base de Datos**: Para cada usuario expirado, llama a `UserModel.updateSubscription` para degradar su estado:
    ```javascript
    UserModel.updateSubscription(user.id, {
      status: 'free', // o 'churned'
      planId: null,
      expiry: null,
    });
    ```
3.  **Notifica al Usuario**: Envía un mensaje directo al usuario informándole que su suscripción ha expirado y le invita a renovar.
4.  **Expulsión de Canales (Opcional pero probable)**: El servicio también contiene la lógica para expulsar al usuario del canal privado de PRIME, revocando su acceso al contenido exclusivo.

### 4.3 Recordatorios

- Además del proceso de baja, otros trabajos programados (`REMINDER_3DAY_CRON`, `REMINDER_1DAY_CRON`) se ejecutan diariamente para llamar al `SubscriptionReminderService`.
- Este servicio busca a los usuarios cuyas membresías están a punto de expirar (en 3 días o en 1 día) y les envía un mensaje de recordatorio para que renueven.
