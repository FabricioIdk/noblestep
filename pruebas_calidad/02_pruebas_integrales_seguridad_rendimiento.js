const mysql=require('mysql2/promise'); const fs=require('fs');
const B='http://localhost:3000';
class C{ constructor(){this.jar={};this.hdr={};}
  async req(m,p,{form,multipart,headers={}}={}){ const h={...headers}; const ck=Object.entries(this.jar).map(([k,v])=>k+'='+v).join('; '); if(ck)h.cookie=ck;
    let body; if(form){h['content-type']='application/x-www-form-urlencoded'; body=new URLSearchParams(form).toString();} if(multipart){const fd=new FormData(); for(const[k,v]of Object.entries(multipart))fd.append(k,v); body=fd;}
    const r=await fetch(B+p,{method:m,headers:h,body,redirect:'manual'}); this.sc=r.headers.getSetCookie?.()||[]; for(const s of this.sc){const [kv]=s.split(';'); const i=kv.indexOf('='); this.jar[kv.slice(0,i)]=kv.slice(i+1);} this.hdr=Object.fromEntries(r.headers.entries());
    const text=await r.text(); return {status:r.status,loc:r.headers.get('location'),text,headers:this.hdr}; }
  async tok(p){ const r=await this.req('GET',p); const m=r.text.match(/name="_csrf" value="([^"]+)"/); return m?m[1]:null; }
  async login(email,pw){ const t=await this.tok('/auth/login'); return this.req('POST','/auth/login',{form:{_csrf:t,email,password:pw}}); }
}
(async()=>{
  const db=await mysql.createConnection({host:'127.0.0.1',user:'ns',password:'ns123',database:'noblestep'});
  const Q=async(s,p=[])=>(await db.query(s,p))[0];
  const R=[]; const rec=(id,hu,desc,esperado,obtenido,ok)=>{R.push({id,hu,desc,esperado,obtenido,ok}); console.log(id,ok?'OK ':'FALLA',obtenido);};
  const run=async(id,hu,desc,esperado,fn)=>{ try{ const r=await fn(); rec(id,hu,desc,esperado,r.obt,r.ok);}catch(e){rec(id,hu,desc,esperado,'Error: '+e.message.slice(0,120),false);} };
  const pw='Demo1234'; const ts=Date.now();
  const almacen=(await Q("SELECT id FROM tiendas WHERE tipo='almacen_online'"))[0].id; const ate=(await Q("SELECT id FROM tiendas WHERE tipo='fisica' ORDER BY id LIMIT 1"))[0].id;
  const cli=new C(), adm=new C(), anon=new C();
  await cli.login('cliente@correo.com',pw); await adm.login('admin@noblestep.pe',pw);
  const cliU=(await Q("SELECT id FROM usuarios WHERE email='cliente@correo.com'"))[0].id; const dirId=(await Q("SELECT id FROM direcciones WHERE usuario_id=?",[cliU]))[0].id;
  const V=await Q("SELECT v.id,v.producto_id,i.stock FROM variantes_producto v JOIN inventario_tienda i ON i.variante_id=v.id AND i.tienda_id=? WHERE i.stock>=8 ORDER BY v.id DESC LIMIT 6",[almacen]);
  const stock=async(t,v)=>(await Q("SELECT stock FROM inventario_tienda WHERE tienda_id=? AND variante_id=?",[t,v]))[0].stock;
  const addCart=async(v,c=1)=>{await Q("DELETE FROM detalle_carrito"); const t=await cli.tok('/carrito'); await cli.req('POST','/carrito/agregar',{form:{_csrf:t,variante_id:v.id,cantidad:c}});};
  const chk=async(x)=>{const t=await cli.tok('/checkout'); return cli.req('POST','/checkout',{form:{_csrf:t,...x}});};
  const pagar=async(id,x={})=>{const t=await cli.tok('/pedidos/'+id+'/pagar'); return cli.req('POST','/pedidos/'+id+'/pagar',{form:{_csrf:t,metodo_pago:'tarjeta',...x}});};
  // ---------- pruebas integrales
  await run('PI01','HU03, HU05, HU08, HU09, HU10, HU11','Compra completa con envío y cupón: detalle, carrito, checkout, pago y seguimiento','Pedido pagado con descuento, stock descontado y visible para cliente y administrador',async()=>{
    const v=V[0]; await cli.req('GET','/productos/'+v.producto_id); await addCart(v,1); const s0=await stock(almacen,v.id);
    const r=await chk({tipo_entrega:'envio_domicilio',direccion_id:dirId,cupon_codigo:'NOBLE10'}); const id=r.loc.split('/').pop(); await pagar(id,{metodo_pago:'plin'});
    const p=(await Q("SELECT estado,numero_pedido,cupon_id FROM pedidos WHERE id=?",[id]))[0]; const s1=await stock(almacen,v.id);
    const mis=(await cli.req('GET','/pedidos')).text.includes(p.numero_pedido); const ad=(await adm.req('GET','/admin/pedidos')).text.includes(p.numero_pedido); const nt=(await Q("SELECT COUNT(*) n FROM notificaciones WHERE usuario_id=? AND mensaje LIKE ?",[cliU,'%'+p.numero_pedido+'%']))[0].n;
    return {ok:p.estado==='pagado'&&!!p.cupon_id&&s0-s1===1&&mis&&ad&&nt>=2,obt:`Pedido ${p.estado} con cupón aplicado; stock ${s0}→${s1}; visible en Mis pedidos: ${mis?'sí':'no'}; visible en el panel: ${ad?'sí':'no'}; ${nt} notificaciones generadas`};});
  await run('PI02','HU05, HU08, HU16','Compra con recojo en la tienda de Ate y control de su inventario','El stock se descuenta en Ate y se refleja en el panel de inventario',async()=>{
    const v=(await Q("SELECT v.id,i.stock FROM variantes_producto v JOIN inventario_tienda i ON i.variante_id=v.id AND i.tienda_id=? WHERE i.stock>=3 LIMIT 1",[ate]))[0]; await addCart({id:v.id},1); const a0=await stock(ate,v.id);
    const r=await chk({tipo_entrega:'recojo_tienda',tienda_recojo_id:ate}); const id=r.loc.split('/').pop(); const a1=await stock(ate,v.id); const al=await stock(almacen,v.id);
    const inv=await adm.req('GET','/admin/inventario?tienda_id='+ate); const p=(await Q("SELECT tipo_entrega,tienda_id FROM pedidos WHERE id=?",[id]))[0];
    return {ok:p.tipo_entrega==='recojo_tienda'&&p.tienda_id===ate&&a0-a1===1&&inv.status===200,obt:`Pedido de recojo en Ate; stock de Ate ${a0}→${a1}; el panel de inventario de Ate responde ${inv.status}`};});
  await run('PI03','HU10, HU17, HU11, HU16','Pago aprobado, cancelación por el administrador y restitución del stock','El pedido queda cancelado, el cliente lo ve y el stock vuelve al almacén',async()=>{
    const v=V[1]; await addCart(v,2); const s0=await stock(almacen,v.id); const r=await chk({tipo_entrega:'envio_domicilio',direccion_id:dirId}); const id=r.loc.split('/').pop(); await pagar(id,{metodo_pago:'yape'}); const s1=await stock(almacen,v.id);
    const t=await adm.tok('/admin/pedidos/'+id); await adm.req('POST','/admin/pedidos/'+id+'/estado',{form:{_csrf:t,estado:'cancelado'}}); const s2=await stock(almacen,v.id);
    const e=(await Q("SELECT estado FROM pedidos WHERE id=?",[id]))[0].estado; const ve=/cancelado/i.test((await cli.req('GET','/pedidos/'+id)).text);
    return {ok:e==='cancelado'&&s1===s0-2&&s2===s0&&ve,obt:`Stock ${s0}→${s1} tras la compra y →${s2} tras cancelar; estado ${e}; el cliente ve el estado cancelado: ${ve?'sí':'no'}`};});
  await run('PI04','HU13, HU16, HU18','Orden de compra recibida y aviso de stock al cliente interesado','Al recibir la orden, el stock sube y se notifica la solicitud pendiente',async()=>{
    const v=V[2]; await Q("DELETE FROM solicitudes_stock WHERE variante_id=?",[v.id]); await Q("UPDATE inventario_tienda SET stock=0 WHERE tienda_id=? AND variante_id=?",[almacen,v.id]);
    const t=await anon.tok('/productos/'+v.producto_id); await anon.req('POST','/productos/'+v.producto_id+'/avisame',{form:{_csrf:t,variante_id:v.id,email:'interesado@correo.com',regresar_a:'/productos/'+v.producto_id}});
    const ta=await adm.tok('/admin/compras'); await adm.req('POST','/admin/compras',{form:{_csrf:ta,proveedor_id:(await Q("SELECT id FROM proveedores LIMIT 1"))[0].id,tienda_destino_id:almacen}}); const oc=(await Q("SELECT id FROM ordenes_compra ORDER BY id DESC LIMIT 1"))[0].id;
    const t3=await adm.tok('/admin/compras/'+oc); await adm.req('POST','/admin/compras/'+oc+'/detalle',{form:{_csrf:t3,variante_id:v.id,cantidad:12,costo_unitario:45}}); await adm.req('POST','/admin/compras/'+oc+'/recibir',{form:{_csrf:t3}}); await new Promise(r=>setTimeout(r,800));
    const s=await stock(almacen,v.id); const sol=(await Q("SELECT notificado FROM solicitudes_stock WHERE variante_id=?",[v.id]))[0];
    return {ok:s===12&&!!sol&&!!sol.notificado,obt:`Stock del almacén 0→${s}; solicitud de aviso marcada como notificada: ${sol&&sol.notificado?'sí':'no'}`};});
  await run('PI05','HU14, HU16, HU01, HU03','Alta de producto con variante y stock hasta verlo en el catálogo','El producto nuevo aparece en el catálogo con su talla disponible',async()=>{
    const cat=(await Q("SELECT id FROM categorias LIMIT 1"))[0].id; const t=await adm.tok('/admin/productos/nuevo'); const nom='Zapatilla QA '+ts;
    await adm.req('POST','/admin/productos',{multipart:{_csrf:t,nombre:nom,descripcion:'Prueba integral',precio:'259',marca:'QA',genero:'mujer',categoria_id:cat,activo:'on'}}); const p=(await Q("SELECT id FROM productos WHERE nombre=?",[nom]))[0];
    const t2=await adm.tok('/admin/productos/'+p.id+'/editar'); await adm.req('POST','/admin/productos/'+p.id+'/variantes',{form:{_csrf:t2,talla:'38',color:'Negro',stock:'6',sku:'QA-'+ts}}); const v=(await Q("SELECT id FROM variantes_producto WHERE producto_id=?",[p.id]))[0];
    const st=v?(await Q("SELECT COALESCE(SUM(stock),0) s FROM inventario_tienda WHERE variante_id=?",[v.id]))[0].s:0;
    const lista=(await anon.req('GET','/productos?q='+encodeURIComponent(nom))).text.includes('/productos/'+p.id); const det=(await anon.req('GET','/productos/'+p.id)).text.includes('data-variante="'+(v&&v.id)+'"');
    return {ok:!!v&&lista&&det,obt:`Producto y variante creados (stock inicial ${st}); aparece en el catálogo: ${lista?'sí':'no'}; el detalle muestra la talla 38: ${det?'sí':'no'}`};});
  await run('PI06','HU10, HU19','Pago aprobado y actualización del dashboard de reportes','Los ingresos del reporte aumentan con el nuevo pago',async()=>{
    const num=s=>Number((s.match(/INGRESOS TOTALES[\s\S]{0,300}?S\/\s*([0-9.,]+)/i)||[])[1]?.replace(/,/g,''));
    const a=await adm.req('GET','/admin/reportes'); const i0=(await Q("SELECT COALESCE(SUM(total),0) s FROM pedidos WHERE estado IN ('pagado','enviado','entregado')"))[0].s;
    const v=V[3]; await addCart(v,1); const r=await chk({tipo_entrega:'envio_domicilio',direccion_id:dirId}); const id=r.loc.split('/').pop(); await pagar(id,{metodo_pago:'transferencia'});
    const tot=(await Q("SELECT total FROM pedidos WHERE id=?",[id]))[0].total; const i1=(await Q("SELECT COALESCE(SUM(total),0) s FROM pedidos WHERE estado IN ('pagado','enviado','entregado')"))[0].s; const b=await adm.req('GET','/admin/reportes'); const ok=b.text.includes(Number(i1).toFixed(2));
    return {ok:ok&&Math.abs(i1-i0-tot)<0.02,obt:`Ingresos S/ ${Number(i0).toFixed(2)} → S/ ${Number(i1).toFixed(2)} (+S/ ${Number(tot).toFixed(2)}); el dashboard muestra el nuevo total: ${ok?'sí':'no'}`};});
  fs.writeFileSync('./resultados_qa_pi.json',JSON.stringify(R,null,1));
  // ---------- pruebas de seguridad
  const S=[]; const sec=async(id,desc,esperado,fn)=>{try{const r=await fn(); S.push({id,desc,esperado,obtenido:r.obt,ok:r.ok}); console.log(id,r.ok?'OK ':'FALLA',r.obt);}catch(e){S.push({id,desc,esperado,obtenido:'Error: '+e.message.slice(0,100),ok:false});console.log(id,'FALLA',e.message);}};
  await sec('PS01','Acceder al panel administrativo sin iniciar sesión','Redirige al inicio de sesión',async()=>{const r=await new C().req('GET','/admin'); return {ok:r.status===302&&/login/.test(r.loc),obt:`Estado ${r.status}, redirige a ${r.loc}`};});
  await sec('PS02','Acceder al panel administrativo con una cuenta de cliente','Acceso denegado (403)',async()=>{const r=await cli.req('GET','/admin/productos'); return {ok:r.status===403,obt:`Estado ${r.status}`};});
  await sec('PS03','Enviar un formulario sin token CSRF','El servidor rechaza la solicitud',async()=>{const r=await new C().req('POST','/auth/login',{form:{email:'cliente@correo.com',password:pw}}); return {ok:r.status===403||r.status===500&&/csrf/i.test(r.text),obt:`Estado ${r.status}; no se inició sesión: ${!/set-cookie/i.test(JSON.stringify(r.headers))||r.status>=400?'sí':'no'}`};});
  await sec('PS04','Almacenamiento de contraseñas','Todas las contraseñas están cifradas con bcrypt',async()=>{const n=(await Q("SELECT COUNT(*) n FROM usuarios WHERE password NOT LIKE '$2%'"))[0].n; const t=(await Q("SELECT COUNT(*) n FROM usuarios"))[0].n; return {ok:n===0,obt:`${t-n} de ${t} contraseñas cifradas`};});
  await sec('PS05','Inyección SQL en el buscador','No se alteran los resultados ni hay error del servidor',async()=>{const base=(await anon.req('GET','/productos')).text.match(/de (\d+) resultados/); const r=await anon.req('GET',"/productos?q="+encodeURIComponent("' OR '1'='1")); const sin=(r.text.match(/href="\/productos\/\d+"/g)||[]).length; return {ok:r.status===200&&sin===0,obt:`Estado ${r.status}; productos devueltos con la cadena maliciosa: ${sin}`};});
  await sec('PS06','Script malicioso (XSS) en el buscador','El texto se muestra escapado',async()=>{const x='<script>alert(1)</script>'; const r=await anon.req('GET','/productos?q='+encodeURIComponent(x)); return {ok:!r.text.includes(x),obt:`El script aparece sin escapar en la página: ${r.text.includes(x)?'sí':'no'}`};});
  await sec('PS07','Cabeceras de seguridad HTTP','Se envían las cabeceras de Helmet',async()=>{const r=await anon.req('GET','/'); const h=r.headers; const ok=!!h['content-security-policy']&&h['x-content-type-options']==='nosniff'&&!h['x-powered-by']; return {ok,obt:`Content-Security-Policy: ${h['content-security-policy']?'sí':'no'}; X-Content-Type-Options: ${h['x-content-type-options']||'no'}; X-Powered-By oculto: ${h['x-powered-by']?'no':'sí'}`};});
  await sec('PS08','Cookie de sesión','La cookie de sesión es HttpOnly',async()=>{const c=new C(); await c.login('cliente@correo.com',pw); const sc=c.sc.join(' | '); return {ok:/httponly/i.test(sc),obt:`Atributos de la cookie: ${/httponly/i.test(sc)?'HttpOnly':'sin HttpOnly'}${/samesite/i.test(sc)?', SameSite':''}`};});
  fs.writeFileSync('./resultados_qa_ps.json',JSON.stringify(S,null,1));
  // ---------- rendimiento
  const P=[]; const pages=[['Inicio','/',anon],['Catálogo','/productos',anon],['Detalle de producto','/productos/1',anon],['Carrito','/carrito',cli],['Panel administrativo','/admin',adm],['Reportes','/admin/reportes',adm]];
  for(const [n,u,c] of pages){const t=[]; for(let i=0;i<30;i++){const a=process.hrtime.bigint(); const r=await c.req('GET',u); t.push(Number(process.hrtime.bigint()-a)/1e6); if(r.status>=400)throw new Error(n+' '+r.status);} t.sort((a,b)=>a-b); P.push({pagina:n,ruta:u,prom:Math.round(t.reduce((a,b)=>a+b)/t.length),p95:Math.round(t[Math.floor(t.length*0.95)-1]),max:Math.round(t[t.length-1])}); console.log('PR',n,P[P.length-1].prom,'ms');}
  fs.writeFileSync('./resultados_qa_pr.json',JSON.stringify(P,null,1)); await db.end(); console.log('FIN');
})().catch(e=>{console.error('FATAL',e);process.exit(1)});
