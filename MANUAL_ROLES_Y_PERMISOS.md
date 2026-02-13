# Manual del Bot - Sistema de Roles y Permisos

Este documento describe el sistema de Control de Acceso Basado en Roles (RBAC) del bot, que define qué acciones puede realizar cada tipo de usuario.

El sistema es jerárquico y permite una gestión granular de los permisos.

## 1. Componentes del Sistema RBAC

1.  **Modelo de Permisos (`src/models/permissionModel.js`)**: Este archivo es el corazón del sistema. Define:
    - La **jerarquía de roles**.
    - La **lista de todos los permisos** disponibles en el sistema.
    - La **asociación** entre cada rol y los permisos que tiene concedidos.

2.  **Servicio de Permisos (`src/bot/services/permissionService.js`)**: Contiene toda la lógica de negocio para:
    - Comprobar si un usuario tiene un permiso específico (`hasPermission`).
    - Asignar o remover roles (`assignRole`, `removeRole`), respetando la jerarquía.

3.  **Manejadores de Admin**: Archivos como `userManagementHandler.js` y `roleManagement.js` que proporcionan los comandos y menús para que los administradores gestionen a otros usuarios.

## 2. Jerarquía de Roles

El sistema define 4 roles con diferentes niveles de autoridad:

1.  **🔴 Super Admin (`superadmin`) - Nivel 3**:
    - **Definición**: El "dueño" del bot. Su ID de Telegram se define en la variable de entorno `ADMIN_ID`.
    - **Permisos**: Tiene acceso total y absoluto a todas las funciones del sistema, incluyendo la capacidad de gestionar a otros administradores y modificar la configuración del bot.

2.  **🟡 Admin (`admin`) - Nivel 2**:
    - **Definición**: Usuarios de confianza con amplios poderes de gestión. Sus IDs se pueden definir en la variable de entorno `ADMIN_USER_IDS` o se les puede asignar el rol mediante un comando.
    - **Permisos**: Pueden gestionar usuarios, enviar difusiones (broadcasts), ver analíticas y realizar la mayoría de las tareas administrativas que no comprometen la configuración central del bot. No pueden gestionar a los `superadmin`.

3.  **🟢 Moderador (`moderator`) - Nivel 1**:
    - **Definición**: Rol de nivel de entrada para el equipo de soporte.
    - **Permisos**: Tienen permisos muy limitados, principalmente para ver la información de los usuarios con el fin de poder ayudarles en el grupo de soporte. No pueden realizar cambios significativos.

4.  **👤 Usuario (`user`) - Nivel 0**:
    - **Definición**: Cualquier usuario regular del bot.
    - **Permisos**: No tienen ningún permiso administrativo.

## 3. Funcionamiento de los Permisos

- **Fuente de Verdad Híbrida**: Para determinar el rol de un usuario, el sistema primero comprueba las variables de entorno (`ADMIN_ID`, `ADMIN_USER_IDS`). Si el ID del usuario está ahí, se le concede el rol correspondiente. Si no, el sistema consulta el campo `role` en la base de datos para ese usuario.

- **Comprobación Jerárquica**: El `permissionService` implementa una lógica que impide que un rol inferior modifique a un rol superior. Por ejemplo, un `admin` (nivel 2) no puede cambiarle el rol a un `superadmin` (nivel 3).

## 4. Comandos de Administración

Los administradores (con los permisos adecuados) gestionan a los usuarios a través de una serie de menús y comandos interactivos.

### 4.1 Gestión de Usuarios (`userManagementHandler.js`)

- **Activación**: Un administrador inicia el flujo buscando a un usuario por su ID, username o email.
- **Menú de Acciones**: Una vez encontrado el usuario, se presenta un menú para:
    - **Banear/Desbanear**: Cambia el `status` del usuario a `'banned'`, lo que le impide usar el bot.
    - **Cambiar Username/Email**: Modifica los datos del perfil del usuario.
    - **Cambiar Tier/Suscripción**: Modifica manualmente el estado de la membresía de un usuario (ej: de `Free` a `Prime`).
    - **Enviar Mensaje Directo**: Permite a un admin enviar un mensaje a un usuario. De forma inteligente, el mensaje se enruta a través del sistema de soporte para que quede un registro de la comunicación en el "ticket" del usuario.

### 4.2 Gestión de Roles (`roleManagement.js`)

- **Activación**: Un administrador accede a un panel de gestión de roles (ej: con un comando `/roles`).
- **Panel de Roles**: Este panel muestra una lista de todos los usuarios que tienen los roles de `superadmin`, `admin` y `moderator`.
- **Acciones**:
    - **Añadir Rol**: Un botón de "➕ Agregar Moderador/Admin" permite al administrador proporcionar el ID de un usuario para promoverlo.
    - **Gestionar Roles Existentes**: Junto al nombre de cada administrador/moderador existente, aparecen botones para "Promover", "Degradar" o "Remover" su rol, siempre respetando la jerarquía del sistema.
