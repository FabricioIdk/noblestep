# Noble Step

Tienda online de zapatillas de Noble Step S.A.C., con panel administrativo para gestionar catálogo, inventario multi-tienda, pedidos, envíos y reportes.

**Tecnologías:** Node.js · Express 5 · EJS · Sequelize · MySQL

## Requisitos

- Node.js 18 o superior
- MySQL 8 o MariaDB 10.4+ (por ejemplo, el que incluye XAMPP)

## Instalación

1. Instala las dependencias:
   ```
   npm install
   ```

2. Crea el archivo de configuración a partir del ejemplo y completa tus datos:
   ```
   copy .env.example .env
   ```

3. Crea una base de datos vacía llamada `noblestep` (o el nombre que pongas en `DB_NAME`).

4. Crea las tablas (solo la primera vez; `force: true` borra y vuelve a crear todo):
   ```
   node -e "require('./models').sequelize.sync({ force: true }).then(() => process.exit())"
   ```

5. Arranca el servidor una vez para que se cree el Almacén Central (la tienda que abastece las ventas online):
   ```
   npm start
   ```

6. Carga el catálogo inicial (opcional):
   ```
   node seed_catalogo_completo.js
   node seed_datos.js
   ```
   - `seed_catalogo_completo.js`: 9 marcas con modelos para hombre, mujer y niños, con tallas, colores, stock e imágenes.
   - `seed_datos.js`: categorías base, productos de la marca Noble Step y el cupón `BIENVENIDO10` (10 % de descuento).

7. Abre `http://localhost:3000`.

Para desarrollo, `npm run dev` reinicia el servidor automáticamente al guardar cambios.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a MySQL |
| `PORT` | Puerto del servidor (por defecto 3000) |
| `SESSION_SECRET` | Clave para firmar las sesiones. Usa una cadena larga y aleatoria |
| `NODE_ENV` | En el servidor publicado debe ser `production` (activa cookies seguras y fuerza HTTPS en los recursos) |
| `APP_URL` | Dirección pública del sitio, sin barra final (por ejemplo `https://noblestep.pe`). Mercado Pago la usa para devolver al cliente y enviar notificaciones |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Cuenta de correo para enviar los enlaces de recuperación de contraseña |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (de prueba o de producción) |
| `MP_WEBHOOK_SECRET` | Clave secreta de las notificaciones (webhooks) de Mercado Pago, para verificar que vienen de Mercado Pago |

**Correo con Gmail:** activa la verificación en 2 pasos de la cuenta, genera una contraseña de aplicación en `myaccount.google.com/apppasswords` y úsala en `SMTP_PASS` (no la contraseña normal de Gmail).

## Crear el primer administrador

El registro público siempre crea cuentas de cliente. Crea tu cuenta desde `/auth/registro` y luego cambia su rol en la base de datos:

```sql
UPDATE usuarios SET rol = 'administrador' WHERE email = 'tu-correo@dominio.com';
```

Vuelve a iniciar sesión para que el cambio se aplique.

## Funcionalidades

**Tienda**
- Catálogo con búsqueda, filtros (género, categoría, marca, precio, ofertas) y ordenamiento
- Detalle de producto con galería, colores, tallas, stock por tienda y aviso cuando vuelve a haber stock
- Carrito, checkout con envío a domicilio o recojo en tienda, cupones de descuento e IGV (18 %)
- Compra rápida ("Comprar ahora") desde el detalle del producto
- Pago con Mercado Pago: tarjetas de crédito y débito, Yape y saldo de Mercado Pago
- Mi cuenta, Mis pedidos con seguimiento del estado y del envío, favoritos y notificaciones
- Registro, inicio de sesión y recuperación de contraseña por correo
- Modo oscuro y diseño adaptable a celular

**Panel administrativo** (`/admin`)
- Productos, variantes (talla/color) e imágenes
- Categorías, cupones y proveedores
- Inventario por tienda: entradas, salidas, ajustes y alertas de stock mínimo
- Tiendas físicas y Almacén Central
- Órdenes de compra con recepción automática de stock
- Pedidos (cambio de estado con devolución de stock al cancelar), pagos y envíos
- Reportes y dashboard: ingresos, ticket promedio, productos y clientes top, ventas por tienda
- Configuración del sistema y auditoría de acciones administrativas

## Seguridad

- Contraseñas con bcrypt y política mínima (8 caracteres, letras y números)
- Sesiones guardadas en MySQL (`connect-session-sequelize`)
- Protección CSRF en todos los formularios
- Límite de intentos en login, registro, recuperación de contraseña y checkout
- Cabeceras de seguridad con Helmet y Content Security Policy con nonce
- Enlaces de recuperación de contraseña de un solo uso que vencen en 1 hora, sin revelar si un correo está registrado

## Estructura

```
noblestep/
├── app.js            Configuración de Express y arranque del servidor
├── config/           Conexión a MySQL
├── models/           Modelos Sequelize y sus relaciones
├── controllers/      Lógica de cada módulo
├── routes/           Definición de rutas
├── middlewares/      Autenticación, CSRF, subida de archivos y errores
├── services/         Correo, notificaciones, auditoría y avisos de stock
├── views/            Vistas EJS (tienda, cuenta y panel admin)
└── public/           CSS, JavaScript, fuentes e imágenes
```

## Pagos con Mercado Pago

Los pagos usan Checkout Pro: el cliente pasa a la página segura de Mercado Pago, paga y vuelve al pedido. La tienda nunca recibe ni guarda los datos de la tarjeta.

1. Crea una aplicación en `mercadopago.com.pe/developers` → Tus integraciones.
2. Copia el **Access Token de prueba** en `MP_ACCESS_TOKEN`.
3. En Cuentas de prueba, crea un vendedor y un comprador de Perú. Para pagar, inicia sesión en Mercado Pago con el comprador de prueba y usa las tarjetas de prueba (titular `APRO` = aprobado, `OTHE` = rechazado).

Cómo se confirma un pago:
- Al volver del checkout, el servidor consulta el pago en la API de Mercado Pago y solo marca el pedido como pagado si está aprobado y el monto y la moneda (PEN) coinciden con el pedido.
- Con un `APP_URL` en HTTPS, Mercado Pago también avisa por webhook a `/webhooks/mercadopago`, aunque el cliente cierre la ventana. Configura esa URL y el evento **Pagos** en tu aplicación, y copia la clave secreta en `MP_WEBHOOK_SECRET`.
- Cada pago se registra una sola vez (`referencia_transaccion` es única).

Si ya tenías la base de datos creada, aplica este cambio una vez:

```sql
ALTER TABLE pagos MODIFY metodo_pago ENUM('tarjeta','yape','plin','transferencia','mercadopago') NOT NULL;
ALTER TABLE pagos ADD UNIQUE INDEX pagos_referencia_transaccion_unica (referencia_transaccion);
```

## Antes de publicar

- Define `NODE_ENV=production` y un `SESSION_SECRET` propio.
- Configura las variables `SMTP_*`; sin ellas los clientes no reciben el enlace para recuperar su contraseña.
- Publica el sitio con HTTPS, pon esa dirección en `APP_URL` y cambia `MP_ACCESS_TOKEN` por el **Access Token de producción** para cobrar de verdad.
- Las imágenes de productos se guardan en `public/img/productos/`. Si el hosting borra el disco al reiniciar (Render, Railway, etc.), conviene moverlas a un servicio como Cloudinary.
