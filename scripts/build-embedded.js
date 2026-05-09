const fs=require('fs'),path=require('path');
const pd=path.join(__dirname,'..','public');
const wf=path.join(__dirname,'..','.wrangler','deploy','index.js');
const of=path.join(__dirname,'..','.wrangler','deploy','embedded.js');
const a={};
const m={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
function w(d,p){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory())w(path.join(d,e.name),p+e.name+'/');else{const x=path.extname(e.name);a['/'+p+e.name]={c:fs.readFileSync(path.join(d,e.name),'utf-8'),m:m[x]||'text/plain'};}}}
w(pd,'');
let c=fs.readFileSync(wf,'utf-8');
c=c.replace(/return c\.env\.ASSETS\.fetch\(c\.req\.raw\);/g,'var _u=new URL(c.req.url);var _p=_u.pathname==="/"?"/index.html":_u.pathname;var _a=SA[_p];if(_a)return new Response(_a.c,{headers:{"Content-Type":_a.m}});return new Response("Not Found",{status:404});');
fs.mkdirSync(path.dirname(of),{recursive:true});
fs.writeFileSync(of,'var SA='+JSON.stringify(a)+';\n'+c);
console.log('Built:',Object.keys(a).length,'assets,',Buffer.byteLength(fs.readFileSync(of)),'bytes');
