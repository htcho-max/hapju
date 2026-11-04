import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/usr/bin/google-chrome'});
const pg = await b.newPage();
for (const S of [192,512]) {
  const data = await pg.evaluate((S)=>{const c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');const u=S/512;
    g.fillStyle='#14181f';g.fillRect(0,0,S,S);
    const cols=['#cf8a2c','#3a8db0','#4f9a5a'];
    cols.forEach((col,i)=>{const y=(150+i*90)*u;g.fillStyle=col;let s=7+i*3;
      for(let x=96;x<416;x+=8){s=(s*16807)%2147483647;const env=Math.sin(Math.PI*(x-96)/320);const h=(10+ (s/2147483647)*30)*env*u+3*u;g.fillRect(x*u,y-h,5*u,h*2)}});
    g.fillStyle='#f05252';g.beginPath();g.arc(256*u,400*u,30*u,0,7);g.fill();
    return c.toDataURL('image/png');},S);
  const fs = await import('fs'); fs.writeFileSync(`../icon-${S}.png`, Buffer.from(data.split(',')[1],'base64'));
}
await b.close();
