const bcrypt=require('bcryptjs'); const db=require('./models');
(async()=>{
  const h=bcrypt.hashSync('Demo1234',10);
  await db.Tienda.update({nombre:'Almacén Noble Step Pichanaki',direccion:'Av. Micaela Bastidas 490',distrito:'Pichanaki',ciudad:'Chanchamayo',telefono:'999 111 222'},{where:{tipo:'almacen_online'}});
  const [ate]=await db.Tienda.findOrCreate({where:{nombre:'Tienda Noble Step Ate'},defaults:{nombre:'Tienda Noble Step Ate',tipo:'fisica',direccion:'Av. Miguel Grau 2532',distrito:'Ate',ciudad:'Lima',telefono:'999 333 444',activo:true}});
  await db.Usuario.findOrCreate({where:{email:'admin@noblestep.pe'},defaults:{nombre:'Fabricio',apellido:'Jaramillo',email:'admin@noblestep.pe',password:h,telefono:'999111222',rol:'administrador'}});
  const [cli]=await db.Usuario.findOrCreate({where:{email:'cliente@correo.com'},defaults:{nombre:'Lucía',apellido:'Ramírez',email:'cliente@correo.com',password:h,telefono:'987654321',rol:'cliente'}});
  await db.Cupon.findOrCreate({where:{codigo:'NOBLE10'},defaults:{codigo:'NOBLE10',tipo_descuento:'porcentaje',valor:10,fecha_inicio:'2026-01-01',fecha_fin:'2026-12-31',activo:true}});
  // pedidos de ejemplo repartidos en los últimos días (para el dashboard y las listas del panel)
  const vars=await db.VarianteProducto.findAll({limit:60,include:[{model:db.Producto,as:'Producto'}]});
  const [dir]=await db.Direccion.findOrCreate({where:{usuario_id:cli.id,calle:'Av. Nicolás Ayllón 1234'},defaults:{usuario_id:cli.id,calle:'Av. Nicolás Ayllón 1234',distrito:'Ate',ciudad:'Lima',referencia:'Frente al grifo',predeterminada:true}});
  const estados=['pagado','pagado','enviado','entregado','pagado','entregado','pendiente','cancelado','pagado','entregado','enviado','pagado'];
  const almacen=await db.Tienda.findOne({where:{tipo:'almacen_online'}});
  for(let i=0;i<estados.length;i++){
    const items=[vars[(i*5)%vars.length],vars[(i*5+7)%vars.length]]; let sub=0; const det=[];
    for(const v of items){const pr=Number(v.Producto.precio_oferta||v.Producto.precio); const c=1+(i%2); sub+=pr*c; det.push({v,c,pr});}
    const igv=sub*0.18, total=sub+igv+(i%3===0?0:12.9);
    const f=new Date(Date.now()-(11-i)*86400000);
    const ped=await db.Pedido.create({usuario_id:cli.id,direccion_id:dir.id,tienda_id:almacen.id,tipo_entrega:'envio_domicilio',numero_pedido:'NS-'+(1760000000000+i*86400000),estado:estados[i],subtotal:sub.toFixed(2),igv:igv.toFixed(2),total:total.toFixed(2),fecha_pedido:f});
    for(const d of det) await db.DetallePedido.create({pedido_id:ped.id,variante_id:d.v.id,cantidad:d.c,precio_unitario:d.pr,subtotal:(d.pr*d.c).toFixed(2)});
    if(estados[i]!=='pendiente'&&estados[i]!=='cancelado') await db.Pago.create({pedido_id:ped.id,metodo_pago:['tarjeta','yape','plin','transferencia'][i%4],estado_pago:'aprobado',monto:total.toFixed(2),fecha_pago:f,referencia_transaccion:'SIM-'+i});
  }
  console.log('listo'); process.exit();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
