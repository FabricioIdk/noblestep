const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium'); const puppeteer=require('puppeteer-core'); const fs=require('fs');
(async()=>{
  const b=await puppeteer.launch({args:[...chromium.args,'--no-sandbox'],executablePath:await chromium.executablePath(),headless:'shell'});
  const out=[]; const rutas=['/','/productos','/productos/1','/auth/login','/auth/registro'];
  for(const [nom,w,h,mob] of [['Móvil (390 px)',390,844,true],['Tableta (768 px)',768,1024,false],['Computadora (1366 px)',1366,768,false]]){
    const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:mob,hasTouch:mob}); let ok=0, fails=[];
    for(const r of rutas){ await p.goto('http://localhost:3000'+r,{waitUntil:'networkidle0'}); const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:window.innerWidth,menu:!!document.querySelector('header,nav')})); if(o.sw<=o.iw+1&&o.menu) ok++; else fails.push(r+' ('+o.sw+'>'+o.iw+')'); }
    out.push({disp:nom,ok,total:rutas.length,fails}); console.log(nom,ok+'/'+rutas.length,fails.join(' '));
    await p.close();
  }
  fs.writeFileSync('./resultados_qa_resp.json',JSON.stringify(out)); await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
