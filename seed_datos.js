 

const db = require('./models');

async function seed() {
  try {
    console.log('Cargando datos iniciales...\n');

    const categorias = {};
    for (const nombre of ['Urbano', 'Deportivo', 'Formal']) {
      const [cat] = await db.Categoria.findOrCreate({
        where: { slug: nombre.toLowerCase() },
        defaults: { nombre, descripcion: `Calzado ${nombre.toLowerCase()}`, slug: nombre.toLowerCase() },
      });
      categorias[nombre] = cat;
      console.log(`Categoria: ${nombre}`);
    }

    const productosData = [
      { nombre: 'Noble Runner', categoria: 'Urbano', precio: 189.90, precio_oferta: 149.90, marca: 'Noble Step',
        descripcion: 'Zapatilla urbana comoda para uso diario, con suela de goma antideslizante.',
        variantes: [['39', 'Negro', 8], ['40', 'Negro', 12], ['41', 'Blanco', 6], ['42', 'Blanco', 4]] },
      { nombre: 'Noble Classic', categoria: 'Urbano', precio: 249.90, precio_oferta: null, marca: 'Noble Step',
        descripcion: 'Modelo clasico de cuero, ideal para looks casuales.',
        variantes: [['38', 'Marron', 5], ['39', 'Marron', 7], ['40', 'Negro', 10]] },
      { nombre: 'Noble Sport Pro', categoria: 'Deportivo', precio: 219.90, precio_oferta: null, marca: 'Noble Step',
        descripcion: 'Zapatilla deportiva con amortiguacion reforzada para entrenamiento.',
        variantes: [['40', 'Azul', 9], ['41', 'Azul', 11], ['42', 'Gris', 6]] },
      { nombre: 'Noble Trail', categoria: 'Deportivo', precio: 259.90, precio_oferta: 199.90, marca: 'Noble Step',
        descripcion: 'Zapatilla todo terreno, suela con mayor agarre para trekking urbano.',
        variantes: [['39', 'Verde', 4], ['40', 'Verde', 5], ['41', 'Negro', 8]] },
      { nombre: 'Noble Oxford', categoria: 'Formal', precio: 299.90, precio_oferta: null, marca: 'Noble Step',
        descripcion: 'Zapato formal de cuero genuino, ideal para oficina o eventos.',
        variantes: [['40', 'Negro', 3], ['41', 'Negro', 5], ['42', 'Marron', 4]] },
    ];

    const almacenOnline = await db.Tienda.findOne({ where: { tipo: 'almacen_online' } });
    if (!almacenOnline) {
      console.error('No se encontro el Almacen Central. Arranca el servidor (npm start) al menos una vez antes de sembrar datos.');
      process.exit(1);
    }

    for (const p of productosData) {
      const [producto, creado] = await db.Producto.findOrCreate({
        where: { nombre: p.nombre },
        defaults: {
          nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, precio_oferta: p.precio_oferta,
          marca: p.marca, categoria_id: categorias[p.categoria].id, activo: true,
        },
      });

      if (creado) {
        console.log(`Producto: ${p.nombre}${p.precio_oferta ? ' (en oferta)' : ''}`);
        for (const [talla, color, stock] of p.variantes) {
          const sku = `NS-${p.nombre.replace(/\s+/g, '').toUpperCase().slice(0, 6)}-${talla}-${color.slice(0, 3).toUpperCase()}`;
          const variante = await db.VarianteProducto.create({
            producto_id: producto.id, talla, color, sku,
          });
          await db.InventarioTienda.create({
            tienda_id: almacenOnline.id, variante_id: variante.id, stock, stock_minimo: 5,
          });
        }
      } else {
        console.log(`Producto ya existia, se omite: ${p.nombre}`);
      }
    }

    await db.Cupon.findOrCreate({
      where: { codigo: 'BIENVENIDO10' },
      defaults: {
        codigo: 'BIENVENIDO10', tipo_descuento: 'porcentaje', valor: 10,
        fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
      },
    });
    console.log('Cupon: BIENVENIDO10 (10%)');

    console.log('\nListo. Entra a /admin/productos para subirle una foto a cada uno.');
  } catch (error) {
    console.error('Error sembrando datos:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

seed();
