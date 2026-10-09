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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Cuenta de correo para enviar los enlaces de recuperación de contraseña |

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
- Pago con tarjeta, Yape o Plin
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

## Antes de publicar

- Define `NODE_ENV=production` y un `SESSION_SECRET` propio.
- Configura las variables `SMTP_*`; sin ellas los clientes no reciben el enlace para recuperar su contraseña.
- El cobro todavía no está conectado a una pasarela de pagos: los pedidos se marcan como pagados al confirmar y los datos de la tarjeta no se envían ni se guardan. La integración (Culqi, Niubiz, Mercado Pago, etc.) se hace en la función `procesarPago` de `controllers/pagoController.js`.
- Las imágenes de productos se guardan en `public/img/productos/`. Si el hosting borra el disco al reiniciar (Render, Railway, etc.), conviene moverlas a un servicio como Cloudinary.
