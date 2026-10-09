 

const db = require('./models');

const TALLAS_HOMBRE = ['39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44'];
const TALLAS_MUJER = ['35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40'];
const TALLAS_NINO = ['28', '29', '30', '31', '32', '33', '34', '35'];

const COLORES = ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Marrón', 'Beige'];

const fs = require('fs');
const path = require('path');

function tallasPorGenero(genero) {
  if (genero === 'mujer') return TALLAS_MUJER;
  if (genero === 'nino') return TALLAS_NINO;
  return TALLAS_HOMBRE;
}

const CARPETA_IMAGENES = path.join(__dirname, 'public', 'img', 'productos');
function slugificar(texto) {
  return texto
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')  
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function buscarImagen(genero, marca, modelo) {
  const carpetaGenero = genero === 'mujer' ? 'mujer' : (genero === 'nino' ? 'ninos' : 'hombre');
  const candidatos = [
    `${slugificar(carpetaGenero + '-' + marca + '-' + modelo)}.jpg`,
    `${slugificar(carpetaGenero + '-' + modelo)}.jpg`,
  ];
  for (const nombreArchivo of candidatos) {
    if (fs.existsSync(path.join(CARPETA_IMAGENES, nombreArchivo))) return nombreArchivo;
  }
  return null;
}

const DESCRIPCION_POR_CATEGORIA = {
  'Urbano': 'inspiradas en el estilo de calle, ofrecen comodidad para el uso diario con un diseño versátil que combina con cualquier look',
  'Running': 'pensadas para el entrenamiento, con amortiguación diseñada para acompañarte en cada kilómetro',
  'Basketball': 'diseñadas para la cancha, con soporte y tracción pensados para el máximo rendimiento',
  'Skate': 'construidas para resistir el uso intenso sobre la tabla, con una suela vulcanizada de agarre superior',
  'Niños': 'pensadas para el día a día de los más pequeños, con materiales resistentes y fáciles de calzar',
};
function generarDescripcion(marca, modelo, categoria) {
  const frase = DESCRIPCION_POR_CATEGORIA[categoria] || DESCRIPCION_POR_CATEGORIA['Urbano'];
  return `Las ${marca} ${modelo} son ${frase}.`;
}

const CATALOGO = {
  'Nike': [
    ["Air Force 1 '07", 'Urbano', 349.90, true, 'hombre'],
    ['Air Max 270', 'Urbano', 399.90, false, 'mujer'],
    ['Revolution 6 Kids', 'Urbano', 149.90, false, 'nino'],
  ],
  'Adidas': [
    ['Superstar', 'Urbano', 299.90, true, 'hombre'],
    ['Campus 00s', 'Urbano', 379.90, false, 'mujer'],
    ['Duramo Kids', 'Urbano', 159.90, false, 'nino'],
  ],
  'New Balance': [
    ['574', 'Urbano', 289.90, true, 'hombre'],
    ['9060', 'Urbano', 549.90, false, 'mujer'],
    ['574 Kids', 'Urbano', 199.90, false, 'nino'],
  ],
  'Puma': [
    ['RS-X', 'Urbano', 349.90, true, 'hombre'],
    ['Cali Star', 'Urbano', 259.90, false, 'mujer'],
    ['Smash Kids', 'Urbano', 149.90, false, 'nino'],
  ],
  'Reebok': [
    ['Classic Leather', 'Urbano', 259.90, true, 'hombre'],
    ['Classic Nylon', 'Urbano', 249.90, false, 'mujer'],
    ['Classic Kids', 'Urbano', 169.90, false, 'nino'],
  ],
  'Jordan': [
    ['Air Jordan 4 Retro', 'Basketball', 899.90, true, 'hombre'],
    ['Air Jordan 1 Retro High OG', 'Basketball', 799.90, false, 'mujer'],
    ['Jordan 1 Kids', 'Basketball', 349.90, false, 'nino'],
  ],
  'Vans': [
    ['Old Skool', 'Urbano', 219.90, true, 'hombre'],
    ['Authentic', 'Urbano', 189.90, false, 'mujer'],
    ['Old Skool Kids', 'Urbano', 169.90, false, 'nino'],
  ],
  'Fila': [
    ['Original Fitness', 'Urbano', 209.90, true, 'hombre'],
    ['Disruptor II', 'Urbano', 239.90, false, 'mujer'],
    ['Disruptor Kids', 'Urbano', 169.90, false, 'nino'],
  ],
  'Lacoste': [
    ['Court-Master', 'Urbano', 339.90, true, 'hombre'],
    ['Carnaby Pro', 'Urbano', 379.90, false, 'mujer'],
    ['Kids Sideline', 'Urbano', 199.90, false, 'nino'],
  ],
};

function generarSku(marca, modelo, talla, color, indice) {
  const base = (marca + modelo).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  return `NS-${base}-${talla}-${color.slice(0, 3).toUpperCase()}-${indice}`;
}

async function seed() {
  try {
    console.log('Sembrando catálogo (9 marcas x 3 modelos: Hombre, Mujer, Niño)...\n');

    const almacenOnline = await db.Tienda.findOne({ where: { tipo: 'almacen_online' } });
    if (!almacenOnline) {
      console.error('No se encontró el Almacén Central. Arranca el servidor (npm start) al menos una vez antes de sembrar datos.');
      process.exit(1);
    }

    const nombresCategorias = new Set();
    for (const modelos of Object.values(CATALOGO)) {
      for (const [, categoria] of modelos) nombresCategorias.add(categoria);
    }
    const categoriasCreadas = {};
    for (const nombre of nombresCategorias) {
      const [cat] = await db.Categoria.findOrCreate({
        where: { slug: nombre.toLowerCase() },
        defaults: { nombre, descripcion: `Calzado ${nombre.toLowerCase()}`, slug: nombre.toLowerCase() },
      });
      categoriasCreadas[nombre] = cat;
    }
    console.log(`Categorías listas: ${[...nombresCategorias].join(', ')}\n`);

    let totalProductos = 0;
    let totalVariantes = 0;
    let indiceGlobal = 0;

    for (const [marca, modelos] of Object.entries(CATALOGO)) {
      let creadosPorMarca = 0;

      for (const [modelo, nombreCategoria, precioBase, enOferta, genero] of modelos) {
        indiceGlobal += 1;
        const nombreCompleto = `${marca} ${modelo}`;

        const [producto, creado] = await db.Producto.findOrCreate({
          where: { nombre: nombreCompleto },
          defaults: {
            nombre: nombreCompleto,
            descripcion: generarDescripcion(marca, modelo, nombreCategoria),
            precio: precioBase,
            precio_oferta: enOferta ? Math.round(precioBase * 0.8 * 100) / 100 : null,
            marca,
            genero,
            categoria_id: categoriasCreadas[nombreCategoria].id,
            activo: true,
            imagen_principal: buscarImagen(genero, marca, modelo),
          },
        });

        if (!creado) continue;  

        totalProductos += 1;
        creadosPorMarca += 1;

        const tallasDisponibles = tallasPorGenero(genero);

        const numColores = (indiceGlobal % 3 === 0) ? 3 : 2;
        const coloresProducto = [];
        for (let c = 0; c < numColores; c++) {
          const color = COLORES[(indiceGlobal + c * 2) % COLORES.length];
          if (!coloresProducto.includes(color)) coloresProducto.push(color);
        }

        let v = 0;
        for (let c = 0; c < coloresProducto.length; c++) {
          const color = coloresProducto[c];
          const longitud = 1 + ((indiceGlobal + c) % Math.min(4, tallasDisponibles.length));
          const inicioMax = Math.max(0, tallasDisponibles.length - longitud);
          const inicio = (indiceGlobal + c * 3) % (inicioMax + 1);
          const tallasDeEsteColor = tallasDisponibles.slice(inicio, inicio + longitud);

          for (const talla of tallasDeEsteColor) {
            v += 1;
            const variante = await db.VarianteProducto.create({
              producto_id: producto.id,
              talla,
              color,
              sku: generarSku(marca, modelo, talla, color, indiceGlobal * 10 + v),
            });
            const stock = 5 + ((indiceGlobal * 7 + v * 3) % 18);
            await db.InventarioTienda.create({
              tienda_id: almacenOnline.id, variante_id: variante.id, stock, stock_minimo: 5,
            });
            totalVariantes += 1;
          }
        }
      }
      console.log(`${marca}: ${creadosPorMarca} modelos nuevos (de ${modelos.length} definidos)`);
    }

    console.log(`\nListo: ${totalProductos} productos nuevos creados (${totalVariantes} variantes con stock).`);
    console.log('Entra a /admin/productos y súbele fotos a cada uno (hasta 3: principal + 2 de galería).');
  } catch (error) {
    console.error('Error sembrando el catálogo:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

seed();
