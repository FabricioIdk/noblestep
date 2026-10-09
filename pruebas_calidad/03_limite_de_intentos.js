const fs=require('fs');
(async()=>{
  let jar=''; const g=async()=>{const r=await fetch('http://localhost:3000/auth/login',{headers:{cookie:jar}}); for(const s of r.headers.getSetCookie()) jar=s.split(';')[0]; return (await r.text()).match(/name="_csrf" value="([^"]+)"/)[1];};
  let bloqueo=null,res=[];
  for(let i=1;i<=14;i++){ const t=await g(); const r=await fetch('http://localhost:3000/auth/login',{method:'POST',headers:{cookie:jar,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:t,email:'cliente@correo.com',password:'mala'+i}),redirect:'manual'}); res.push(r.status); if(r.status===429&&!bloqueo) bloqueo=i; }
  console.log(res.join(','),'bloqueo en intento',bloqueo);
  fs.writeFileSync('./resultados_qa_rate.json',JSON.stringify({bloqueo,res}));
})();
