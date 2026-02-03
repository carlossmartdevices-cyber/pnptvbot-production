# 📚 EJEMPLOS DE PROMPTS PARA DIFERENTES TIPOS DE BOTS

Este archivo contiene ejemplos concretos de cómo usar el `MASTER_BOT_PROMPT_TEMPLATE.md` para generar diferentes tipos de bots.

---

## 🍕 EJEMPLO 1: Bot de Restaurante

### Variables a reemplazar:

```plaintext
{{TIPO_DE_NEGOCIO}} = "Restaurante"
{{DESCRIPCION_NEGOCIO}} = "pedidos de comida, delivery y reservas de mesas"
{{DESCRIPCION_DETALLADA}} = "Un restaurante con servicio de delivery que necesita automatizar pedidos, gestionar inventario, coordinar entregas y permitir reservas de mesas"
{{TIPO_DE_USUARIOS}} = "Clientes que desean ordenar comida a domicilio o reservar mesas"

{{CASO_USO_1}} = "Cliente ordena comida para delivery"
{{CASO_USO_2}} = "Cliente reserva mesa para 4 personas"
{{CASO_USO_3}} = "Admin actualiza menú y precios en tiempo real"

{{nombre-bot}} = "restaurantbot"

{{modelo_principal}} = "orderModel"
{{modelo_secundario}} = "productModel, tableModel"

{{modulo_especifico_1}} = "orders"
{{modulo_especifico_2}} = "menu"

{{servicio_1}} = "orderService"
{{servicio_2}} = "deliveryService"

{{campos_especificos_negocio}} = "deliveryAddress, allergies, favoriteItems"
{{metodos_especificos}} = "getActiveOrders, getNearbyOrders"

{{feature_premium_1}} = "Delivery gratis en todos los pedidos"
{{feature_premium_2}} = "Descuento del 15% en todos los pedidos"
{{feature_premium_3}} = "Acceso prioritario a reservas y menú exclusivo"

{{feature_free_1}} = "Hacer hasta 3 pedidos/mes"
{{feature_free_2}} = "Ver menú completo"
{{feature_free_3}} = "Reservar mesa (con cargo extra)"

{{limites_free}} = "Máximo 3 pedidos al mes, delivery con cargo adicional"

{{beneficio_1}} = "Delivery gratis ilimitado"
{{beneficio_2}} = "15% descuento permanente"
{{beneficio_3}} = "Acceso a menú VIP"

{{recurso}} = "pedidos"

{{opcion_1}} = "🍕 Ver Menú"
{{opcion_2}} = "🛒 Mi Carrito"
{{opcion_3}} = "📦 Mis Pedidos"
{{opcion_4}} = "🪑 Reservar Mesa"

{{paso_especifico_1}} = "Solicitar dirección de entrega"
{{paso_especifico_2}} = "Preguntar sobre alergias alimentarias"
{{paso_especifico_3}} = "Configurar preferencias de notificaciones de pedidos"

{{lista_providers}} = "ePayco, Daimo"

{{idiomas}} = "['en', 'es']"

{{seccion_especifica_1}} = "🍽️ Gestión de Menú"
{{seccion_especifica_2}} = "📦 Gestión de Pedidos"
{{seccion_especifica_3}} = "🚚 Gestión de Delivery"

{{metrica_especifica_1}} = "Pedidos completados hoy"
{{metrica_especifica_2}} = "Revenue del día/mes"
{{metrica_especifica_3}} = "Tiempo promedio de entrega"

{{segmento_custom}} = "Clientes VIP (más de 10 pedidos)"

{{Gestión_Entidad_Principal}} = "Gestión de Pedidos"
{{entidades}} = "pedidos"
{{entidad}} = "pedido"
{{entidades_criticas}} = "pedidos pagados"
{{accion_especifica}} = "Marcar pedido como entregado"

{{feature_exclusivo}} = "Chef's Table: menú degustación exclusivo"

{{Flujo_Especifico_1}} = "Flujo de Pedido de Comida"

{{entity}} = "order"
{{collection}} = "orders"
{{related_pattern}} = "menu"

{{entityId}} = "orderId"

{{PROVIDER1_API_KEY}} = "EPAYCO_PUBLIC_KEY"
{{PROVIDER1_SECRET}} = "EPAYCO_PRIVATE_KEY"
{{PROVIDER2_API_KEY}} = "DAIMO_API_KEY"
{{PROVIDER2_SECRET}} = "DAIMO_SECRET_KEY"

{{CONFIG_CUSTOM_1}} = "DELIVERY_RADIUS_KM=10"
{{CONFIG_CUSTOM_2}} = "MIN_ORDER_AMOUNT=15"

{{comando_deploy}} = "npm run build && railway up"

{{endpoint_especifico_1}} = "GET /api/menu - Obtener menú completo"
{{endpoint_especifico_2}} = "POST /api/orders - Crear nuevo pedido"

{{doc_especifica}} = "menu-management"

{{servicio_externo}} = "UberEats, Rappi"

{{feature_especifica_1}} = "Sistema de pedidos con tracking en tiempo real"
{{feature_especifica_2}} = "Reserva de mesas con confirmación automática"
```

---

## 🏨 EJEMPLO 2: Bot de Alojamiento (Airbnb-style)

### Variables a reemplazar:

```plaintext
{{TIPO_DE_NEGOCIO}} = "Alojamiento Privado"
{{DESCRIPCION_NEGOCIO}} = "reservas de alojamientos tipo Airbnb, gestión de propiedades y comunicación con huéspedes"
{{DESCRIPCION_DETALLADA}} = "Plataforma de alquileres vacacionales que necesita gestionar múltiples propiedades, reservas, check-in/check-out y comunicación automatizada con huéspedes"
{{TIPO_DE_USUARIOS}} = "Viajeros buscando alojamiento temporal y propietarios gestionando sus propiedades"

{{CASO_USO_1}} = "Viajero busca apartamento disponible para fechas específicas"
{{CASO_USO_2}} = "Host publica nueva propiedad con fotos y descripción"
{{CASO_USO_3}} = "Sistema envía códigos de check-in automáticamente"

{{nombre-bot}} = "staybot"

{{modelo_principal}} = "bookingModel"
{{modelo_secundario}} = "propertyModel, reviewModel"

{{modulo_especifico_1}} = "bookings"
{{modulo_especifico_2}} = "properties"

{{servicio_1}} = "bookingService"
{{servicio_2}} = "propertyService"

{{campos_especificos_negocio}} = "travelPurpose, guestCount, propertyPreferences"
{{metodos_especificos}} = "getAvailableProperties, getBookingsByHost"

{{feature_premium_1}} = "Comisión reducida del 5% (vs 15% free)"
{{feature_premium_2}} = "Prioridad en resultados de búsqueda"
{{feature_premium_3}} = "Calendario de disponibilidad sincronizado con otras plataformas"

{{feature_free_1}} = "Listar hasta 2 propiedades"
{{feature_free_2}} = "Comisión del 15% por reserva"
{{feature_free_3}} = "Soporte básico"

{{limites_free}} = "Máximo 2 propiedades listadas, comisión 15%"

{{beneficio_1}} = "Propiedades ilimitadas"
{{beneficio_2}} = "Comisión reducida al 5%"
{{beneficio_3}} = "Sincronización con Airbnb/Booking.com"

{{recurso}} = "propiedades"

{{opcion_1}} = "🏠 Buscar Alojamiento"
{{opcion_2}} = "📅 Mis Reservas"
{{opcion_3}} = "🏘️ Mis Propiedades (Host)"
{{opcion_4}} = "💳 Suscripción Premium"

{{paso_especifico_1}} = "¿Eres viajero o host (propietario)?"
{{paso_especifico_2}} = "Solicitar destinos preferidos"
{{paso_especifico_3}} = "Configurar notificaciones de disponibilidad"

{{lista_providers}} = "PayPal, Daimo"
{{PROVIDER1_API_KEY}} = "PAYPAL_CLIENT_ID"
{{PROVIDER1_SECRET}} = "PAYPAL_CLIENT_SECRET"

{{CONFIG_CUSTOM_1}} = "CANCELLATION_HOURS=24"
{{CONFIG_CUSTOM_2}} = "AUTO_CHECKIN_TIME=15:00"

{{comando_deploy}} = "npm run build && vercel --prod"

{{endpoint_especifico_1}} = "GET /api/properties/available - Propiedades disponibles"
{{endpoint_especifico_2}} = "POST /api/bookings - Crear reserva"

{{doc_especifica}} = "property-guidelines"

{{servicio_externo}} = "Airbnb, Booking.com"

{{feature_especifica_1}} = "Calendario de disponibilidad con sincronización externa"
{{feature_especifica_2}} = "Sistema de reviews bidireccional (guest-host)"
```

---

## 💆 EJEMPLO 3: Bot de Reserva de Servicios (Spa, Masajes, Psicólogos)

### Variables a reemplazar:

```plaintext
{{TIPO_DE_NEGOCIO}} = "Reserva de Servicios Profesionales"
{{DESCRIPCION_NEGOCIO}} = "reservas de servicios como masajes, terapias, consultas psicológicas y wellness"
{{DESCRIPCION_DETALLADA}} = "Plataforma de reserva de servicios profesionales que conecta clientes con terapeutas, masajistas, psicólogos y coaches, gestionando agenda, pagos y recordatorios"
{{TIPO_DE_USUARIOS}} = "Clientes buscando servicios de wellness y profesionales ofreciendo sus servicios"

{{CASO_USO_1}} = "Cliente reserva sesión de masaje para mañana a las 3pm"
{{CASO_USO_2}} = "Terapeuta publica disponibilidad semanal"
{{CASO_USO_3}} = "Sistema envía recordatorio 1 hora antes de la cita"

{{nombre-bot}} = "wellnessbot"

{{modelo_principal}} = "appointmentModel"
{{modelo_secundario}} = "serviceModel, providerModel"

{{modulo_especifico_1}} = "appointments"
{{modulo_especifico_2}} = "services"

{{servicio_1}} = "appointmentService"
{{servicio_2}} = "providerService"

{{campos_especificos_negocio}} = "healthConditions, preferredProviders, serviceHistory"
{{metodos_especificos}} = "getUpcomingAppointments, getProviderSchedule"

{{feature_premium_1}} = "Reservas ilimitadas al mes"
{{feature_premium_2}} = "20% descuento en todos los servicios"
{{feature_premium_3}} = "Sesiones de urgencia (disponibilidad same-day)"

{{feature_free_1}} = "Hasta 2 reservas/mes"
{{feature_free_2}} = "Ver todos los proveedores"
{{feature_free_3}} = "Recordatorios básicos"

{{limites_free}} = "Máximo 2 citas al mes, sin descuentos"

{{beneficio_1}} = "Reservas ilimitadas"
{{beneficio_2}} = "20% descuento permanente"
{{beneficio_3}} = "Prioridad en agenda"

{{recurso}} = "citas"

{{opcion_1}} = "🗓️ Reservar Servicio"
{{opcion_2}} = "📅 Mis Citas"
{{opcion_3}} = "👨‍⚕️ Mis Proveedores Favoritos"
{{opcion_4}} = "💎 Suscripción Premium"

{{paso_especifico_1}} = "Tipo de servicio que buscas (masaje, terapia, coaching)"
{{paso_especifico_2}} = "¿Tienes condiciones de salud relevantes?"
{{paso_especifico_3}} = "Preferencias de horario y ubicación"

{{lista_providers}} = "Stripe, Daimo"

{{idiomas}} = "['en', 'es']"

{{seccion_especifica_1}} = "👨‍⚕️ Gestión de Proveedores"
{{seccion_especifica_2}} = "📅 Gestión de Citas"
{{seccion_especifica_3}} = "💰 Reportes Financieros"

{{metrica_especifica_1}} = "Citas completadas hoy"
{{metrica_especifica_2}} = "Tasa de no-shows"
{{metrica_especifica_3}} = "Revenue por tipo de servicio"

{{segmento_custom}} = "Clientes frecuentes (más de 5 citas)"

{{Gestión_Entidad_Principal}} = "Gestión de Citas"
{{entidades}} = "citas"
{{entidad}} = "cita"
{{entidades_criticas}} = "citas confirmadas"
{{accion_especifica}} = "Marcar como completada y solicitar review"

{{feature_exclusivo}} = "Paquetes de sesiones con descuento adicional"

{{Flujo_Especifico_1}} = "Flujo de Reserva de Cita"

{{entity}} = "appointment"
{{collection}} = "appointments"
{{related_pattern}} = "provider"

{{entityId}} = "appointmentId"

{{PROVIDER1_API_KEY}} = "STRIPE_PUBLIC_KEY"
{{PROVIDER1_SECRET}} = "STRIPE_SECRET_KEY"
{{PROVIDER2_API_KEY}} = "DAIMO_API_KEY"
{{PROVIDER2_SECRET}} = "DAIMO_SECRET_KEY"

{{CONFIG_CUSTOM_1}} = "REMINDER_HOURS_BEFORE=1"
{{CONFIG_CUSTOM_2}} = "CANCELLATION_HOURS=2"

{{comando_deploy}} = "npm run build && railway up"

{{endpoint_especifico_1}} = "GET /api/providers/available - Proveedores disponibles"
{{endpoint_especifico_2}} = "POST /api/appointments - Crear cita"

{{doc_especifica}} = "provider-onboarding"

{{servicio_externo}} = "Google Calendar, Calendly"

{{feature_especifica_1}} = "Sistema de recordatorios automáticos (1 hora, 1 día antes)"
{{feature_especifica_2}} = "Reviews y ratings de proveedores"
```

---

## 🛍️ EJEMPLO 4: Bot de Tienda de Artículos (E-commerce)

### Variables a reemplazar:

```plaintext
{{TIPO_DE_NEGOCIO}} = "Tienda Online (E-commerce)"
{{DESCRIPCION_NEGOCIO}} = "venta de productos físicos con catálogo, carrito de compras y envíos"
{{DESCRIPCION_DETALLADA}} = "Tienda online completa con catálogo de productos organizados por categorías, sistema de carrito, pagos integrados y tracking de envíos"
{{TIPO_DE_USUARIOS}} = "Compradores buscando productos y navegando catálogo"

{{CASO_USO_1}} = "Cliente busca productos por categoría y añade al carrito"
{{CASO_USO_2}} = "Cliente completa compra y rastrea envío"
{{CASO_USO_3}} = "Admin actualiza stock y agrega nuevos productos"

{{nombre-bot}} = "shopbot"

{{modelo_principal}} = "orderModel"
{{modelo_secundario}} = "productModel, categoryModel"

{{modulo_especifico_1}} = "products"
{{modulo_especifico_2}} = "orders"

{{servicio_1}} = "orderService"
{{servicio_2}} = "inventoryService"

{{campos_especificos_negocio}} = "shippingAddress, favoriteCategories, wishlist"
{{metodos_especificos}} = "searchProducts, getProductsByCategory"

{{feature_premium_1}} = "Envío gratis en todos los pedidos"
{{feature_premium_2}} = "10% descuento en todos los productos"
{{feature_premium_3}} = "Acceso anticipado a nuevos productos"

{{feature_free_1}} = "Comprar productos (envío con cargo)"
{{feature_free_2}} = "Lista de deseos limitada (10 productos)"
{{feature_free_3}} = "Ver catálogo completo"

{{limites_free}} = "Envío con cargo, sin descuentos"

{{beneficio_1}} = "Envío gratis siempre"
{{beneficio_2}} = "10% descuento permanente"
{{beneficio_3}} = "Acceso VIP a lanzamientos"

{{recurso}} = "productos en wishlist"

{{opcion_1}} = "🛍️ Ver Catálogo"
{{opcion_2}} = "🛒 Mi Carrito"
{{opcion_3}} = "📦 Mis Pedidos"
{{opcion_4}} = "❤️ Lista de Deseos"

{{paso_especifico_1}} = "¿Qué categorías te interesan?"
{{paso_especifico_2}} = "Solicitar dirección de envío predeterminada"
{{paso_especifico_3}} = "Configurar notificaciones de ofertas"

{{lista_providers}} = "Stripe, PayPal, ePayco"

{{idiomas}} = "['en', 'es']"

{{seccion_especifica_1}} = "📦 Gestión de Productos"
{{seccion_especifica_2}} = "🛒 Gestión de Pedidos"
{{seccion_especifica_3}} = "📊 Inventario y Stock"

{{metrica_especifica_1}} = "Ventas del día"
{{metrica_especifica_2}} = "Productos más vendidos"
{{metrica_especifica_3}} = "Tasa de abandono de carrito"

{{segmento_custom}} = "Clientes VIP (más de $500 en compras)"

{{Gestión_Entidad_Principal}} = "Gestión de Productos"
{{entidades}} = "productos"
{{entidad}} = "producto"
{{entidades_criticas}} = "pedidos pagados"
{{accion_especifica}} = "Actualizar stock masivamente"

{{feature_exclusivo}} = "Productos exclusivos solo para miembros premium"

{{Flujo_Especifico_1}} = "Flujo de Compra con Carrito"

{{entity}} = "product"
{{collection}} = "products"
{{related_pattern}} = "cart"

{{entityId}} = "orderId"

{{PROVIDER1_API_KEY}} = "STRIPE_PUBLIC_KEY"
{{PROVIDER1_SECRET}} = "STRIPE_SECRET_KEY"
{{PROVIDER2_API_KEY}} = "PAYPAL_CLIENT_ID"
{{PROVIDER2_SECRET}} = "PAYPAL_CLIENT_SECRET"

{{CONFIG_CUSTOM_1}} = "MIN_ORDER_AMOUNT=20"
{{CONFIG_CUSTOM_2}} = "FREE_SHIPPING_THRESHOLD=50"

{{comando_deploy}} = "npm run build && render deploy"

{{endpoint_especifico_1}} = "GET /api/products - Obtener catálogo"
{{endpoint_especifico_2}} = "POST /api/cart - Añadir al carrito"

{{doc_especifica}} = "inventory-management"

{{servicio_externo}} = "Shopify, WooCommerce"

{{feature_especifica_1}} = "Sistema de búsqueda de productos con filtros"
{{feature_especifica_2}} = "Tracking de envíos con APIs de courier"
```

---

## 🎫 EJEMPLO 5: Bot de Tours y Experiencias

### Variables a reemplazar:

```plaintext
{{TIPO_DE_NEGOCIO}} = "Tours y Experiencias"
{{DESCRIPCION_NEGOCIO}} = "reservas de tours turísticos, experiencias locales y actividades guiadas"
{{DESCRIPCION_DETALLADA}} = "Plataforma de reserva de tours y experiencias que conecta viajeros con guías locales, gestionando disponibilidad, grupos, pagos y comunicación pre-tour"
{{TIPO_DE_USUARIOS}} = "Turistas buscando experiencias auténticas y guías locales ofreciendo tours"

{{CASO_USO_1}} = "Turista reserva tour gastronómico para 2 personas"
{{CASO_USO_2}} = "Guía publica nuevo tour de fotografía urbana"
{{CASO_USO_3}} = "Sistema envía punto de encuentro 2 horas antes del tour"

{{nombre-bot}} = "tourbot"

{{modelo_principal}} = "bookingModel"
{{modelo_secundario}} = "tourModel, guideModel"

{{modulo_especifico_1}} = "tours"
{{modulo_especifico_2}} = "bookings"

{{servicio_1}} = "bookingService"
{{servicio_2}} = "tourService"

{{campos_especificos_negocio}} = "interests, languages, mobilityNeeds"
{{metodos_especificos}} = "getAvailableTours, getToursByCategory"

{{feature_premium_1}} = "Reservas ilimitadas"
{{feature_premium_2}} = "15% descuento en todos los tours"
{{feature_premium_3}} = "Tours privados sin costo extra de grupo reducido"

{{feature_free_1}} = "Hasta 2 reservas/mes"
{{feature_free_2}} = "Ver todos los tours disponibles"
{{feature_free_3}} = "Reviews y ratings"

{{limites_free}} = "Máximo 2 tours/mes, precio regular"

{{beneficio_1}} = "Tours ilimitados"
{{beneficio_2}} = "15% descuento siempre"
{{beneficio_3}} = "Prioridad en tours populares"

{{recurso}} = "tours"

{{opcion_1}} = "🗺️ Explorar Tours"
{{opcion_2}} = "🎫 Mis Reservas"
{{opcion_3}} = "⭐ Tours Favoritos"
{{opcion_4}} = "💳 Membresía Premium"

{{paso_especifico_1}} = "¿Qué tipo de experiencias te interesan?"
{{paso_especifico_2}} = "Idiomas que hablas"
{{paso_especifico_3}} = "Necesidades especiales o restricciones"

{{lista_providers}} = "Stripe, PayPal"

{{idiomas}} = "['en', 'es', 'fr', 'pt']"

{{seccion_especifica_1}} = "🗺️ Gestión de Tours"
{{seccion_especifica_2}} = "🎫 Gestión de Reservas"
{{seccion_especifica_3}} = "👨‍🏫 Gestión de Guías"

{{metrica_especifica_1}} = "Tours completados hoy"
{{metrica_especifica_2}} = "Ocupación promedio por tour"
{{metrica_especifica_3}} = "Rating promedio de guías"

{{segmento_custom}} = "Viajeros frecuentes (más de 3 tours)"

{{Gestión_Entidad_Principal}} = "Gestión de Tours"
{{entidades}} = "tours"
{{entidad}} = "tour"
{{entidades_criticas}} = "tours con reservas confirmadas"
{{accion_especifica}} = "Cancelar tour por clima y reembolsar"

{{feature_exclusivo}} = "Acceso a tours exclusivos no publicados"

{{Flujo_Especifico_1}} = "Flujo de Reserva de Tour"

{{entity}} = "booking"
{{collection}} = "bookings"
{{related_pattern}} = "tour"

{{entityId}} = "bookingId"

{{PROVIDER1_API_KEY}} = "STRIPE_PUBLIC_KEY"
{{PROVIDER1_SECRET}} = "STRIPE_SECRET_KEY"
{{PROVIDER2_API_KEY}} = "PAYPAL_CLIENT_ID"
{{PROVIDER2_SECRET}} = "PAYPAL_CLIENT_SECRET"

{{CONFIG_CUSTOM_1}} = "MIN_PARTICIPANTS=2"
{{CONFIG_CUSTOM_2}} = "CANCELLATION_HOURS=24"

{{comando_deploy}} = "npm run build && railway up"

{{endpoint_especifico_1}} = "GET /api/tours/available - Tours disponibles"
{{endpoint_especifico_2}} = "POST /api/bookings - Crear reserva"

{{doc_especifica}} = "guide-guidelines"

{{servicio_externo}} = "GetYourGuide, Viator"

{{feature_especifica_1}} = "Sistema de grupos y capacidad máxima"
{{feature_especifica_2}} = "Weather check automático y alertas de cancelación"
```

---

## 📝 CÓMO USAR ESTOS EJEMPLOS

1. **Copia el MASTER_BOT_PROMPT_TEMPLATE.md completo**
2. **Elige el ejemplo que más se parezca a tu caso de uso**
3. **Reemplaza TODAS las variables `{{VARIABLE}}` con los valores del ejemplo**
4. **Personaliza valores adicionales según tus necesidades específicas**
5. **Pega el prompt completo en Mistral/Claude/ChatGPT**
6. **El LLM generará el código siguiendo la arquitectura exacta**

---

## 💡 TIPS PARA PERSONALIZAR

1. **Identifica el modelo principal de tu negocio:**
   - Restaurante → OrderModel
   - Alojamiento → BookingModel
   - Servicios → AppointmentModel
   - Tienda → ProductModel + OrderModel

2. **Define roles y permisos según tu caso:**
   - ¿Los usuarios pueden ser también proveedores? (ej: Airbnb)
   - ¿Hay diferentes tipos de admin? (ej: manager vs staff)

3. **Planea el flujo principal:**
   - ¿Cómo descubre el usuario tu producto/servicio?
   - ¿Cómo reserva/compra?
   - ¿Qué pasa después del pago?
   - ¿Cómo se confirma/entrega el servicio?

4. **Define features premium vs free:**
   - Límites cuantitativos (ej: 2 vs ilimitado)
   - Features exclusivos (ej: prioridad, descuentos)
   - Servicios adicionales (ej: soporte 24/7)

5. **Piensa en integraciones externas:**
   - Pagos (Stripe, PayPal, etc.)
   - Calendarios (Google Calendar)
   - Mapas (Google Maps)
   - Notificaciones (SMS, Email)
   - APIs de terceros (weather, shipping, etc.)

---

## 🎯 PROMPT RÁPIDO PARA GENERAR VARIACIONES

Si quieres que Mistral te ayude a crear las variables, usa este prompt:

```
Soy dueño de un negocio de [DESCRIPCIÓN DE TU NEGOCIO].

Necesito crear un bot de Telegram con la siguiente arquitectura: [pega aquí el índice del MASTER_BOT_PROMPT_TEMPLATE.md]

Por favor, genera TODAS las variables {{VARIABLE}} que necesito reemplazar en el template, adaptadas específicamente para mi caso de uso. Dame un JSON con todos los valores.

Mi negocio:
- Tipo: [restaurante, alojamiento, servicios, etc.]
- Descripción: [describe tu negocio en 2-3 frases]
- Usuarios: [quiénes usarán el bot]
- Features principales: [lista 3-5 features clave]
```

**Mistral te devolverá un JSON completo con todas las variables listas para copiar/pegar.**

---

¡Con estos ejemplos ya tienes todo lo necesario para generar cualquier tipo de bot! 🚀
