const http=require('http'),d=JSON.stringify({name:'k',password:'Sishun2gm11hkPocok',email:'p@p.l'});
const r=http.request({hostname:'localhost',port:4873,path:'/-/user/org.couchdb.user:k',method:'PUT',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},e=>{let b='';e.on('data',c=>b+=c);e.on('end',()=>console.log(b));});
r.write(d);r.end();
