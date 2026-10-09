// Pruebas de calidad ejecutadas contra el sistema en funcionamiento (HTTP + base de datos)
const mysql=require('mysql2/promise'); const fs=require('fs');
const B='http://localhost:3000';
class C{ constructor(){this.jar={};}
  async req(m,p,{form,multipart,headers={}}={}){ const h={...headers}; const ck=Object.entries(this.jar).map(([k,v])=>k+'='+v).join('; '); if(ck)h.cookie=ck;
    let body; if(form){h['content-type']='application/x-www-form-urlencoded'; body=new URLSearchParams(form).toString();} if(multipart){const fd=new FormData(); for(const[k,v]of Object.entries(multipart))fd.append(k,v); body=fd;}
    const r=await fetch(B+p,{method:m,headers:h,body,redirect:'manual'}); for(const s of (r.headers.getSetCookie?.()||[])){const [kv]=s.split(';'); const i=kv.indexOf('='); this.jar[kv.slice(0,i)]=kv.slice(i+1);} 
    const text=await r.text(); return {status:r.status,loc:r.headers.get('location'),text}; }
  async tok(p){ const r=await this.req('GET',p); const m=r.text.match(/name="_csrf" value="([^"]+)"/); return m?m[1]:null; }
  async post(p,data,page){ const t=await this.tok(page||p.split('/').slice(0,-1).join('/')||'/'); return this.req('POST',p,{form:{_csrf:t,...data}}); }
  async login(email,pw){ const t=await this.tok('/auth/login'); return this.req('POST','/auth/login',{form:{_csrf:t,email,password:pw}}); }
}
(async()=>{
  const db=await mysql.createConnection({host:'127.0.0.1',user:'ns',password:'ns123',database:'noblestep'});
  const Q=async(s,p=[])=>(await db.query(s,p))[0];
  const R=[]; const rec=(id,hu,desc,esperado,obtenido,ok,prob='N/A',acc='N/A')=>{R.push({id,hu,desc,esperado,obtenido,ok,prob,acc}); console.log(id,ok?'OK ':'FALLA',obtenido);};
  const run=async(id,hu,desc,esperado,fn)=>{ try{ const r=await fn(); rec(id,hu,desc,esperado,r.obt,r.ok,r.prob,r.acc);}catch(e){rec(id,hu,desc,esperado,'Error en la prueba: '+e.message.slice(0,120),false,e.message.slice(0,120),'Revisar el flujo');} };
  const pw='Demo1234'; const ts=Date.now();
  const almacen=(await Q("SELECT id FROM tiendas WHERE tipo='almacen_online'"))[0].id; const ate=(await Q("SELECT id FROM tiendas WHERE tipo='fisica' LIMIT 1"))[0].id;
  const cli=new C(), adm=new C(), anon=new C(), otro=new C();
  const ids=t=>[...new Set([...t.matchAll(/href="\/productos\/(\d+)"/g)].map(m=>m[1]))];
  // ---------- PU01 catálogo
  await run('PU01','HU01','Filtrar el catálogo por género y precio','Solo se listan productos que cumplen los filtros',async()=>{
    const a=await anon.req('GET','/productos?genero=hombre&precio_min=300'); const got=ids(a.text).length;
    const exp=Math.min(12,(await Q("SELECT COUNT(*) n FROM productos WHERE activo=1 AND genero='hombre' AND precio>=300"))[0].n);
    const b=await anon.req('GET','/productos?oferta=1'); const off=ids(b.text).length; const expo=Math.min(12,(await Q("SELECT COUNT(*) n FROM productos WHERE activo=1 AND precio_oferta IS NOT NULL"))[0].n);
    return {ok:got===exp&&off===expo&&a.status===200,obt:`Filtro género y precio: ${got} de ${exp} esperados; ofertas: ${off} de ${expo}`};});
  await run('PU02','HU02','Buscar un producto por nombre parcial','Se listan los productos cuyo nombre coincide',async()=>{
    const a=await anon.req('GET','/productos?q=nike'); const got=ids(a.text).length; const exp=Math.min(12,(await Q("SELECT COUNT(*) n FROM productos WHERE activo=1 AND nombre LIKE '%nike%'"))[0].n);
    const z=await anon.req('GET','/productos?q=zzzzqq'); const none=ids(z.text).length===0;
    return {ok:got===exp&&none&&got>0,obt:`Búsqueda "nike": ${got} resultados (esperado ${exp}); búsqueda sin coincidencias: ${none?'sin resultados':'con resultados'}`};});
  await run('PU03','HU03','Consultar el detalle de un producto con sus tallas','Se muestran las tallas y las agotadas se marcan',async()=>{
    const pid=(await Q("SELECT producto_id id FROM variantes_producto GROUP BY producto_id HAVING COUNT(*)>=3 LIMIT 1"))[0].id;
    const a=await anon.req('GET','/productos/'+pid); const nv=(a.text.match(/data-variante="/g)||[]).length; const exp=(await Q("SELECT COUNT(*) n FROM variantes_producto WHERE producto_id=?",[pid]))[0].n;
    return {ok:a.status===200&&nv===exp,obt:`Detalle del producto ${pid}: ${nv} tallas mostradas de ${exp} registradas`};});
  // ---------- login cliente
  const lg=await cli.login('cliente@correo.com',pw); const cliU=(await Q("SELECT id FROM usuarios WHERE email='cliente@correo.com'"))[0].id;
  await adm.login('admin@noblestep.pe',pw);
  await run('PU04','HU04','Agregar y quitar un favorito','El favorito se crea y luego se elimina',async()=>{
    const pid=(await Q("SELECT id FROM productos WHERE activo=1 ORDER BY id DESC LIMIT 1"))[0].id; await Q("DELETE FROM favoritos WHERE usuario_id=? AND producto_id=?",[cliU,pid]);
    const t=await cli.tok('/productos/'+pid); await cli.req('POST','/favoritos/'+pid+'/toggle',{form:{_csrf:t,regresar_a:'/productos/'+pid}}); const n1=(await Q("SELECT COUNT(*) n FROM favoritos WHERE usuario_id=? AND producto_id=?",[cliU,pid]))[0].n;
    await cli.req('POST','/favoritos/'+pid+'/toggle',{form:{_csrf:t,regresar_a:'/productos/'+pid}}); const n2=(await Q("SELECT COUNT(*) n FROM favoritos WHERE usuario_id=? AND producto_id=?",[cliU,pid]))[0].n;
    return {ok:n1===1&&n2===0,obt:`Tras marcar: ${n1} registro; tras desmarcar: ${n2}`};});
  // variante con stock en almacén
  const V=(await Q("SELECT v.id,i.stock FROM variantes_producto v JOIN inventario_tienda i ON i.variante_id=v.id AND i.tienda_id=? WHERE i.stock>=6 ORDER BY v.id LIMIT 4",[almacen]));
  await run('PU05','HU05','Agregar al carrito, exceder el stock y quitar','Se agrega, se rechaza lo que excede el stock y se elimina',async()=>{
    await Q("DELETE FROM detalle_carrito"); const v=V[0]; const t=await cli.tok('/carrito');
    await cli.req('POST','/carrito/agregar',{form:{_csrf:t,variante_id:v.id,cantidad:1}}); let it=(await Q("SELECT id,cantidad FROM detalle_carrito WHERE variante_id=?",[v.id]))[0];
    const t2=await cli.tok('/carrito'); await cli.req('POST','/carrito/item/'+it.id,{form:{_csrf:t2,cantidad:v.stock+50}}); let it2=(await Q("SELECT cantidad FROM detalle_carrito WHERE id=?",[it.id]))[0];
    await cli.req('POST','/carrito/item/'+it.id+'/eliminar',{form:{_csrf:t2}}); const left=(await Q("SELECT COUNT(*) n FROM detalle_carrito WHERE id=?",[it.id]))[0].n;
    return {ok:!!it&&it2.cantidad<=v.stock&&left===0,obt:`Agregado (cantidad ${it?it.cantidad:0}); al pedir ${v.stock+50} unidades quedó en ${it2.cantidad} (stock ${v.stock}); luego eliminado: ${left===0?'sí':'no'}`,prob:it2.cantidad<=v.stock?'N/A':'El carrito aceptó una cantidad mayor al stock',acc:it2.cantidad<=v.stock?'N/A':'Validar la cantidad contra el stock al actualizar'};});
  // ---------- PU06 registro / login
  const mail='prueba'+ts+'@correo.com';
  await run('PU06','HU06','Registrar, rechazar duplicado e iniciar sesión','Cuenta creada con contraseña cifrada; duplicado y clave errónea rechazados',async()=>{
    const n=new C(); const t=await n.tok('/auth/registro'); const r1=await n.req('POST','/auth/registro',{form:{_csrf:t,nombre:'Prueba',apellido:'QA',email:mail,telefono:'999888777',password:'Clave1234'}});
    const u=(await Q("SELECT password FROM usuarios WHERE email=?",[mail]))[0]; const hashed=u&&u.password.startsWith('$2');
    const n2=new C(); const t2=await n2.tok('/auth/registro'); const r2=await n2.req('POST','/auth/registro',{form:{_csrf:t2,nombre:'Prueba',apellido:'QA',email:mail,telefono:'999888777',password:'Clave1234'}}); const dup=/ya existe/i.test(r2.text);
    const n3=new C(); const r3=await n3.login(mail,'Incorrecta99'); const bad=/credenciales incorrectas/i.test(r3.text);
    return {ok:!!u&&hashed&&dup&&bad,obt:`Cuenta creada: ${u?'sí':'no'}; contraseña cifrada (bcrypt): ${hashed?'sí':'no'}; correo duplicado rechazado: ${dup?'sí':'no'}; clave incorrecta rechazada: ${bad?'sí':'no'}`};});
  // ---------- PU07 recuperar contraseña
  await run('PU07','HU07','Recuperar la contraseña con un enlace temporal','El enlace permite definir una nueva contraseña y caduca',async()=>{
    const n=new C(); const t=await n.tok('/auth/olvide-password'); const r=await n.req('POST','/auth/olvide-password',{form:{_csrf:t,email:mail}});
    const m=r.text.match(/restablecer-password\/([A-Za-z0-9]+)/); const tk=m?m[1]:null; const row=(await Q("SELECT reset_token,reset_token_expira FROM usuarios WHERE email=?",[mail]))[0];
    let okReset=false; if(tk){const t2=await n.tok('/auth/restablecer-password/'+tk); const r2=await n.req('POST','/auth/restablecer-password/'+tk,{form:{_csrf:t2,password:'Nueva12345'}}); const l=await new C().login(mail,'Nueva12345'); okReset=r2.status===302&&l.status===302;}
    await Q("UPDATE usuarios SET reset_token='vencido123',reset_token_expira='2020-01-01' WHERE email=?",[mail]); const ex=await new C().req('GET','/auth/restablecer-password/vencido123'); const caduca=!/name="password"/.test(ex.text);
    return {ok:!!tk&&!!row.reset_token_expira&&okReset&&caduca,obt:`Enlace generado: ${tk?'sí':'no'}; nueva contraseña funciona: ${okReset?'sí':'no'}; enlace vencido rechazado: ${caduca?'sí':'no'}`};});
  // ---------- PU08 / PU09 / PU10 checkout, cupón, pago
  const dirId=(await Q("SELECT id FROM direcciones WHERE usuario_id=? LIMIT 1",[cliU]))[0].id;
  const addCart=async(v,c=1)=>{const t=await cli.tok('/carrito'); await cli.req('POST','/carrito/agregar',{form:{_csrf:t,variante_id:v.id,cantidad:c}});};
  const stock=async(tid,v)=>(await Q("SELECT stock FROM inventario_tienda WHERE tienda_id=? AND variante_id=?",[tid,v])).map(r=>r.stock)[0];
  const checkout=async(extra)=>{const t=await cli.tok('/checkout'); const r=await cli.req('POST','/checkout',{form:{_csrf:t,...extra}}); return r;};
  let pedA=null,pedB=null;
  await run('PU08','HU08','Confirmar pedidos con envío y con recojo en tienda','Pedido registrado, IGV 18 %, stock descontado en la ubicación de origen',async()=>{
    await Q("DELETE FROM detalle_carrito"); const v=V[1]; await addCart(v,2); const s0=await stock(almacen,v.id);
    const r=await checkout({tipo_entrega:'envio_domicilio',direccion_id:dirId}); pedA=r.loc?r.loc.split('/').pop():null; const p=(await Q("SELECT * FROM pedidos WHERE id=?",[pedA]))[0];
    const s1=await stock(almacen,v.id); const igvOk=p&&Math.abs(Number(p.igv)-Number(p.subtotal)*0.18)<0.02; const env=(await Q("SELECT COUNT(*) n FROM envios WHERE pedido_id=?",[pedA]))[0].n;
    await Q("DELETE FROM detalle_carrito"); const w=V[2]; await addCart(w,1); const a0=await stock(ate,w.id); const r2=await checkout({tipo_entrega:'recojo_tienda',tienda_recojo_id:ate}); pedB=r2.loc?r2.loc.split('/').pop():null; const p2=(await Q("SELECT * FROM pedidos WHERE id=?",[pedB]))[0]; const a1=await stock(ate,w.id); const env2=(await Q("SELECT COUNT(*) n FROM envios WHERE pedido_id=?",[pedB]))[0].n;
    const ok=!!p&&igvOk&&s0-s1===2&&env===1&&!!p2&&p2.tienda_id===ate&&a0-a1===1&&env2===0&&p2.tipo_entrega==='recojo_tienda';
    return {ok,obt:`Envío: pedido ${p?'creado':'no creado'}, IGV correcto: ${igvOk?'sí':'no'}, stock del almacén ${s0}→${s1}. Recojo: tienda de Ate, stock ${a0}→${a1}, sin envío registrado: ${env2===0?'sí':'no'}`};});
  await run('PU08b','HU08','Confirmar con stock insuficiente','Se rechaza y no se crea el pedido',async()=>{
    await Q("DELETE FROM detalle_carrito"); const v=V[3]; await addCart(v,3); const orig=await stock(almacen,v.id); await Q("UPDATE inventario_tienda SET stock=1 WHERE tienda_id=? AND variante_id=?",[almacen,v.id]);
    const n0=(await Q("SELECT COUNT(*) n FROM pedidos"))[0].n; const r=await checkout({tipo_entrega:'envio_domicilio',direccion_id:dirId}); const n1=(await Q("SELECT COUNT(*) n FROM pedidos"))[0].n; const msg=/stock suficiente|no tiene/i.test(r.text);
    await Q("UPDATE inventario_tienda SET stock=? WHERE tienda_id=? AND variante_id=?",[orig,almacen,v.id]); await Q("DELETE FROM detalle_carrito");
    return {ok:n1===n0&&msg,obt:`Pedidos antes/después: ${n0}/${n1}; mensaje de stock insuficiente: ${msg?'sí':'no'}`};});
  await run('PU09','HU09','Aplicar un cupón válido, uno inexistente y uno vencido','Solo el cupón vigente descuenta; los demás no se aplican',async()=>{
    const bruto=id=>Q("SELECT p.cupon_id,p.subtotal,(SELECT SUM(subtotal) FROM detalle_pedido WHERE pedido_id=p.id) b FROM pedidos p WHERE p.id=?",[id]).then(r=>r[0]);
    await Q("DELETE FROM detalle_carrito"); await addCart(V[0],1); const r1=await checkout({tipo_entrega:'envio_domicilio',direccion_id:dirId,cupon_codigo:'NOEXISTE'}); const p1=await bruto(r1.loc&&r1.loc.split('/').pop());
    await Q("INSERT INTO cupones (codigo,tipo_descuento,valor,fecha_inicio,fecha_fin,activo,created_at,updated_at) VALUES ('VENCIDO"+ts+"','porcentaje',50,'2025-01-01','2025-12-31',1,NOW(),NOW())");
    await Q("DELETE FROM detalle_carrito"); await addCart(V[0],1); const r2=await checkout({tipo_entrega:'envio_domicilio',direccion_id:dirId,cupon_codigo:'VENCIDO'+ts}); const p2=await bruto(r2.loc&&r2.loc.split('/').pop());
    await Q("DELETE FROM detalle_carrito"); await addCart(V[0],1); const r3=await checkout({tipo_entrega:'envio_domicilio',direccion_id:dirId,cupon_codigo:'NOBLE10'}); const p3=await bruto(r3.loc&&r3.loc.split('/').pop());
    const sinDesc=p=>p&&!p.cupon_id&&Math.abs(Number(p.subtotal)-Number(p.b))<0.02; const conDesc=p3&&p3.cupon_id&&Math.abs(Number(p3.subtotal)-Number(p3.b)*0.9)<0.02;
    const avisa=/cup[oó]n/i.test(r1.text)&&r1.status===200;
    return {ok:sinDesc(p1)&&sinDesc(p2)&&conDesc,obt:`Cupón inexistente: pedido sin descuento (${sinDesc(p1)?'sí':'no'}); cupón vencido: sin descuento (${sinDesc(p2)?'sí':'no'}); NOBLE10: 10 % de descuento (${conDesc?'sí':'no'}); mensaje al cliente por cupón inválido: ${avisa?'sí':'no'}`,prob:avisa?'N/A':'El cupón inválido o vencido se ignora sin avisar al cliente',acc:avisa?'N/A':'Pendiente: mostrar un mensaje cuando el código del cupón no sea válido'};});
  await run('PU10','HU10','Pagar con respuesta aprobada y rechazada','Aprobado: pedido pagado; rechazado: pedido pendiente',async()=>{
    const t=await cli.tok('/pedidos/'+pedA+'/pagar'); await cli.req('POST','/pedidos/'+pedA+'/pagar',{form:{_csrf:t,metodo_pago:'yape'}}); const pa=(await Q("SELECT estado FROM pedidos WHERE id=?",[pedA]))[0].estado; const pg=(await Q("SELECT estado_pago FROM pagos WHERE pedido_id=? ORDER BY id DESC LIMIT 1",[pedA]))[0];
    const t2=await cli.tok('/pedidos/'+pedB+'/pagar'); await cli.req('POST','/pedidos/'+pedB+'/pagar',{form:{_csrf:t2,metodo_pago:'tarjeta',forzar_rechazo:'on'}}); const pb=(await Q("SELECT estado FROM pedidos WHERE id=?",[pedB]))[0].estado; const pg2=(await Q("SELECT estado_pago FROM pagos WHERE pedido_id=? ORDER BY id DESC LIMIT 1",[pedB]))[0];
    return {ok:pa==='pagado'&&pg.estado_pago==='aprobado'&&pb==='pendiente'&&pg2.estado_pago==='rechazado',obt:`Aprobado: pedido ${pa}, pago ${pg&&pg.estado_pago}. Rechazado: pedido ${pb}, pago ${pg2&&pg2.estado_pago}`};});
  await run('PU11','HU11','Consultar mis pedidos y proteger los de otro usuario','El cliente ve sus pedidos; otro usuario no puede verlos',async()=>{
    const l=await cli.req('GET','/pedidos'); const num=(await Q("SELECT numero_pedido n FROM pedidos WHERE id=?",[pedA]))[0].n; const ve=l.text.includes(num);
    await otro.login(mail,'Nueva12345'); const r=await otro.req('GET','/pedidos/'+pedA); const bloqueado=r.status===404||r.status===302||r.status===403||!r.text.includes(num);
    return {ok:ve&&bloqueado,obt:`El cliente ve su pedido: ${ve?'sí':'no'}; otro usuario recibe estado ${r.status} y no ve el pedido: ${bloqueado?'sí':'no'}`};});
  await run('PU12','HU12','Generar y marcar notificaciones','Se generan avisos de pedido y pago y se marcan como leídos',async()=>{
    const n=(await Q("SELECT id,tipo FROM notificaciones WHERE usuario_id=? ORDER BY id DESC",[cliU])); const tipos=[...new Set(n.map(x=>x.tipo))];
    const t=await cli.tok('/notificaciones'); await cli.req('POST','/notificaciones/'+n[0].id+'/leer',{form:{_csrf:t}}); const col=Object.keys((await Q("SELECT * FROM notificaciones WHERE id=?",[n[0].id]))[0]).find(k=>/leid/.test(k)); const row=(await Q("SELECT * FROM notificaciones WHERE id=?",[n[0].id]))[0];
    return {ok:n.length>0&&tipos.length>=2&&!!row[col],obt:`${n.length} notificaciones de tipos: ${tipos.join(', ')}; marcada como leída: ${row[col]?'sí':'no'}`};});
  await run('PU13','HU13','Solicitar aviso de stock y recibirlo al reponer','Se registra la solicitud y se marca como notificada al reponer stock',async()=>{
    const v=(await Q("SELECT v.id,v.producto_id FROM variantes_producto v ORDER BY v.id DESC LIMIT 1"))[0]; await Q("UPDATE inventario_tienda SET stock=0 WHERE variante_id=?",[v.id]); await Q("DELETE FROM solicitudes_stock WHERE variante_id=?",[v.id]);
    const t=await anon.tok('/productos/'+v.producto_id); await anon.req('POST','/productos/'+v.producto_id+'/avisame',{form:{_csrf:t,variante_id:v.id,email:'aviso@correo.com',regresar_a:'/productos/'+v.producto_id}}); const s1=(await Q("SELECT notificado FROM solicitudes_stock WHERE variante_id=?",[v.id]))[0];
    const ta=await adm.tok('/admin/inventario'); await adm.req('POST','/admin/inventario/movimiento',{form:{_csrf:ta,tienda_id:almacen,variante_id:v.id,tipo:'entrada',cantidad:5,motivo:'Prueba de aviso'}}); await new Promise(r=>setTimeout(r,800)); const s2=(await Q("SELECT notificado FROM solicitudes_stock WHERE variante_id=?",[v.id]))[0];
    return {ok:!!s1&&!s1.notificado&&!!s2&&!!s2.notificado,obt:`Solicitud registrada: ${s1?'sí':'no'}; marcada como notificada tras la entrada de stock: ${s2&&s2.notificado?'sí':'no'}`};});
  // ---------- administración
  const cat=await Q("SELECT id FROM categorias LIMIT 1");
  let prodNew=null;
  await run('PU14','HU14','Registrar un producto, validar obligatorios y desactivarlo','Producto creado; sin datos obligatorios se rechaza; inactivo no se muestra',async()=>{
    const t=await adm.tok('/admin/productos/nuevo'); const nom='Producto QA '+ts; const r=await adm.req('POST','/admin/productos',{multipart:{_csrf:t,nombre:nom,descripcion:'Prueba',precio:'199',marca:'QA',genero:'unisex',categoria_id:cat[0].id,activo:'on'}});
    const p=(await Q("SELECT id,activo FROM productos WHERE nombre=?",[nom]))[0]; prodNew=p&&p.id;
    const r2=await adm.req('POST','/admin/productos',{multipart:{_csrf:t,nombre:'Sin precio '+ts,descripcion:'x',marca:'QA',genero:'unisex',categoria_id:cat[0].id}}); const sin=(await Q("SELECT COUNT(*) n FROM productos WHERE nombre=?",['Sin precio '+ts]))[0].n;
    const t3=await adm.tok('/admin/productos/'+prodNew+'/editar'); await adm.req('POST','/admin/productos/'+prodNew,{multipart:{_csrf:t3,nombre:nom,descripcion:'Prueba',precio:'199',marca:'QA',genero:'unisex',categoria_id:cat[0].id}}); const act=(await Q("SELECT activo FROM productos WHERE id=?",[prodNew]))[0].activo; const vis=ids((await anon.req('GET','/productos?q='+encodeURIComponent(nom))).text).includes(String(prodNew));
    return {ok:!!p&&sin===0&&!act&&!vis,obt:`Producto creado: ${p?'sí':'no'}; sin precio rechazado: ${sin===0?'sí':'no'}; desactivado y oculto del catálogo: ${!act&&!vis?'sí':'no'}`};});
  await run('PU15','HU15','Crear y eliminar una categoría','La categoría se crea y se elimina',async()=>{
    const t=await adm.tok('/admin/categorias'); const nom='Categoría QA '+ts; await adm.req('POST','/admin/categorias',{form:{_csrf:t,nombre:nom,descripcion:'Prueba'}}); const c=(await Q("SELECT id,slug FROM categorias WHERE nombre=?",[nom]))[0];
    await adm.req('POST','/admin/categorias/'+c.id+'/eliminar',{form:{_csrf:t}}); const n=(await Q("SELECT COUNT(*) n FROM categorias WHERE id=?",[c.id]))[0].n;
    return {ok:!!c&&!!c.slug&&n===0,obt:`Categoría creada con identificador "${c&&c.slug}"; eliminada: ${n===0?'sí':'no'}`};});
  await run('PU16','HU16','Registrar entrada, salida excesiva y ajuste de stock','Entrada suma, salida mayor al stock se rechaza, ajuste fija el valor',async()=>{
    const v=V[0]; const t=await adm.tok('/admin/inventario'); const s0=await stock(almacen,v.id);
    await adm.req('POST','/admin/inventario/movimiento',{form:{_csrf:t,tienda_id:almacen,variante_id:v.id,tipo:'entrada',cantidad:10,motivo:'Prueba'}}); const s1=await stock(almacen,v.id);
    await adm.req('POST','/admin/inventario/movimiento',{form:{_csrf:t,tienda_id:almacen,variante_id:v.id,tipo:'salida',cantidad:999999,motivo:'Prueba'}}); const s2=await stock(almacen,v.id);
    await adm.req('POST','/admin/inventario/movimiento',{form:{_csrf:t,tienda_id:almacen,variante_id:v.id,tipo:'ajuste',cantidad:s0,motivo:'Prueba'}}); const s3=await stock(almacen,v.id); const mv=(await Q("SELECT COUNT(*) n FROM movimientos_inventario WHERE variante_id=?",[v.id]))[0].n;
    return {ok:s1===s0+10&&s2===s1&&s3===s0&&mv>=2,obt:`Stock inicial ${s0}; tras entrada de 10: ${s1}; tras salida excesiva: ${s2}; tras ajuste: ${s3}; movimientos registrados: ${mv}`};});
  await run('PU17','HU17','Cambiar el estado, cancelar un pedido y registrar el envío','El estado cambia; al cancelar el stock se restituye; el envío se registra',async()=>{
    const det=(await Q("SELECT variante_id,cantidad FROM detalle_pedido WHERE pedido_id=?",[pedA]))[0]; const tid=(await Q("SELECT tienda_id FROM pedidos WHERE id=?",[pedA]))[0].tienda_id; const t=await adm.tok('/admin/pedidos/'+pedA);
    await adm.req('POST','/admin/pedidos/'+pedA+'/envio',{form:{_csrf:t,costo_envio:'12.90',zona:'Lima',empresa_transporte:'Olva Courier',numero_seguimiento:'OLV12345',estado:'en_camino'}}); const env=(await Q("SELECT empresa_transporte,numero_seguimiento FROM envios WHERE pedido_id=?",[pedA]))[0];
    const s0=await stock(tid,det.variante_id); await adm.req('POST','/admin/pedidos/'+pedA+'/estado',{form:{_csrf:t,estado:'cancelado'}}); const est=(await Q("SELECT estado FROM pedidos WHERE id=?",[pedA]))[0].estado; const s1=await stock(tid,det.variante_id);
    return {ok:!!env&&env.numero_seguimiento==='OLV12345'&&est==='cancelado'&&s1===s0+det.cantidad,obt:`Envío registrado (${env&&env.empresa_transporte}); pedido ${est}; stock ${s0}→${s1} (se restituyeron ${s1-s0} de ${det.cantidad})`};});
  await run('PU18','HU18','Registrar proveedor y recibir una orden de compra','El stock de la ubicación aumenta al recibir la orden',async()=>{
    const t=await adm.tok('/admin/proveedores'); await adm.req('POST','/admin/proveedores',{form:{_csrf:t,nombre:'Proveedor QA '+ts,ruc:'20'+String(ts).slice(-9),contacto:'Ana',telefono:'999000111',email:'prov@qa.com',direccion:'Lima'}}); const pr=(await Q("SELECT id FROM proveedores WHERE nombre=?",['Proveedor QA '+ts]))[0];
    const t2=await adm.tok('/admin/compras'); await adm.req('POST','/admin/compras',{form:{_csrf:t2,proveedor_id:pr.id,tienda_destino_id:almacen}}); const oc=(await Q("SELECT id FROM ordenes_compra ORDER BY id DESC LIMIT 1"))[0]; const v=V[2];
    const t3=await adm.tok('/admin/compras/'+oc.id); await adm.req('POST','/admin/compras/'+oc.id+'/detalle',{form:{_csrf:t3,variante_id:v.id,cantidad:7,costo_unitario:50}}); const s0=await stock(almacen,v.id);
    await adm.req('POST','/admin/compras/'+oc.id+'/recibir',{form:{_csrf:t3}}); const s1=await stock(almacen,v.id); const est=(await Q("SELECT estado FROM ordenes_compra WHERE id=?",[oc.id]))[0].estado;
    return {ok:!!pr&&s1===s0+7,obt:`Proveedor creado; orden ${est}; stock ${s0}→${s1} (+7)`};});
  await run('PU19','HU19','Consultar el dashboard de reportes','Los ingresos del reporte coinciden con la base de datos',async()=>{
    const r=await adm.req('GET','/admin/reportes'); const tot=(await Q("SELECT COALESCE(SUM(total),0) s FROM pedidos WHERE estado IN ('pagado','enviado','entregado')"))[0].s; const f=Number(tot).toFixed(2); const ok=r.text.includes(f);
    return {ok:r.status===200&&ok,obt:`Ingresos en la base de datos: S/ ${f}; el reporte muestra ese valor: ${ok?'sí':'no'}`};});
  await run('PU20','HU20','Crear tienda, cupón y configuración, y consultar la auditoría','Los registros se crean y la auditoría registra las acciones',async()=>{
    const t=await adm.tok('/admin/tiendas'); await adm.req('POST','/admin/tiendas',{form:{_csrf:t,nombre:'Tienda QA '+ts,direccion:'Av. Prueba 123',distrito:'Ate',ciudad:'Lima',telefono:'999'}}); const ti=(await Q("SELECT id FROM tiendas WHERE nombre=?",['Tienda QA '+ts]))[0];
    const t2=await adm.tok('/admin/cupones'); await adm.req('POST','/admin/cupones',{form:{_csrf:t2,codigo:'QA'+ts,tipo_descuento:'monto_fijo',valor:'20',fecha_inicio:'2026-01-01',fecha_fin:'2026-12-31'}}); const cu=(await Q("SELECT id FROM cupones WHERE codigo=?",['QA'+ts]))[0];
    const t3=await adm.tok('/admin/configuracion'); await adm.req('POST','/admin/configuracion',{form:{_csrf:t3,clave:'qa_'+ts,valor:'1'}}); const cf=(await Q("SELECT id FROM configuracion_sistema WHERE clave=?",['qa_'+ts]))[0];
    const aud=(await Q("SELECT COUNT(*) n FROM auditoria"))[0].n;
    return {ok:!!ti&&!!cu&&!!cf&&aud>0,obt:`Tienda creada: ${ti?'sí':'no'}; cupón creado: ${cu?'sí':'no'}; configuración creada: ${cf?'sí':'no'}; registros de auditoría: ${aud}`};});
  fs.writeFileSync('./resultados_qa_pu.json',JSON.stringify(R,null,1)); await db.end();
  console.log('RESUMEN',R.filter(r=>r.ok).length+'/'+R.length);
})().catch(e=>{console.error('FATAL',e);process.exit(1)});
