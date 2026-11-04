// 혼자 합주실 0.2.0 시험: 가짜 마이크 + 헤드리스 Chrome
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
const ROOT = process.env.ROOT || '/home/claude/hapju-repo';
const srv = spawn('python3', ['-m', 'http.server', '8766'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/home/claude/hapju/tools/fake.wav', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, permissions: ['microphone'] });
await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/lamejs/**', r => r.fulfill({ contentType: 'application/javascript', body: readFileSync('/home/claude/hapju/tools/node_modules/lamejs/lame.min.js', 'utf8') }));
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push('CONSOLE ' + m.text()) });
let nf = 0; const ok = (c, m) => { if (!c) nf++; console.log((c ? 'ok   ' : 'FAIL ') + m) };
const ev = s => pg.evaluate(s); const wait = ms => pg.waitForTimeout(ms);
await pg.goto('http://localhost:8766/'); await wait(1500);
ok(await ev('P.tracks.length') === 3 && await ev('VERSION') === '0.2.0', '예시 곡 · 버전 ' + await ev('VERSION'));
// 옛 형식 옮기기
ok(await ev(`JSON.stringify(migrate({tracks:[{takes:[1,2],active:1},{takes:[]}]}).tracks.map(t=>[t.cuts,t.pick,'active' in t]))`) === '[[[],[1],false],[[],[0],false]]', '0.1 프로젝트 옮기기');
// 늘이기 단위 시험: 440Hz 1초 → 50% = 2초, 음높이 유지
const st = await ev(`(async()=>{const sr=48000,x=new Float32Array(sr);for(let i=0;i<sr;i++)x[i]=0.5*Math.sin(2*Math.PI*440*i/sr);const y=await stretch(x,0.5);let z=0;for(let i=sr/2;i<sr*1.5;i++)if(y[i-1]<0&&y[i]>=0)z++;let mx=0;for(let i=sr/2;i<sr*1.5;i++)mx=Math.max(mx,Math.abs(y[i]));return{len:y.length/sr,f:z,mx:+mx.toFixed(2)}})()`);
ok(Math.abs(st.len - 2) < 0.01 && Math.abs(st.f - 440) < 6 && st.mx > 0.4 && st.mx < 0.6, '느리게(WSOLA) ' + JSON.stringify(st));
// 구간 반복 재생
await pg.click('#bLoop'); const L = await ev('JSON.stringify(P.loop)');
ok(await ev('P.loop.on&&Math.abs(P.loop.b-5)<1e-6&&P.loop.a===0'), '반복 구간 켜기 ' + L);
await ev('P.metro=false'); await pg.click('#bPlay'); await wait(6200); const lt = await ev('curTime()');
ok(lt > 0.3 && lt < 2.5, '반복해서 처음으로 돌아옴 ' + lt.toFixed(2)); ok(await ev('playing'), '반복 중 계속 재생');
await pg.click('#bPlay'); await pg.click('#bLoop'); ok(await ev('!P.loop.on&&!playing'), '반복 끄기');
// 느리게 재생
await pg.selectOption('#selRate', '0.7'); await pg.click('#bPlay'); await wait(2500);
const t1 = await ev('curTime()'); await wait(1000); const t2 = await ev('curTime()');
ok(Math.abs((t2 - t1) - 0.7) < 0.08, '70% 빠르기 진행 ' + (t2 - t1).toFixed(3) + ' / 늘인 소리 ' + await ev('stCache.size'));
await pg.click('#bPlay'); await pg.selectOption('#selRate', '1');
// 반복 녹음 → 회마다 테이크
await ev('P.countIn=false;S.lat=80;P.loop={on:true,a:0,b:2.5};renderTop();setPos(0)');
await pg.click('#bRec'); await wait(300); await pg.click('[data-inst=clarinet]'); await wait(7900); await pg.click('#bRec'); await wait(800);
const lr = await ev(`(()=>{const t=P.tracks[3];return{n:t.takes.length,spans:t.takes.map(c=>[+(c.off+c.ts).toFixed(3),+(c.te-c.ts).toFixed(3)]),pick:t.pick}})()`);
ok(lr.n === 3 && lr.spans.every(s => Math.abs(s[0]) < 0.002 && Math.abs(s[1] - 2.5) < 0.01), '반복 녹음 3회 → 테이크 3개 ' + JSON.stringify(lr));
ok(lr.pick[0] === 2, '마지막 테이크가 쓰임');
await ev('P.loop.on=false;renderTop()');
// 나누기 · 테이크 고르기 · 비우기 · 합치기
await ev('setPos(1.2)'); await pg.click('#cbSplit');
let cp = await ev('JSON.stringify([P.tracks[3].cuts,P.tracks[3].pick,selS])');
ok(cp === '[[1.2],[2,2],1]', '나누기 ' + cp);
await pg.click('#cbPrev'); cp = await ev('JSON.stringify(P.tracks[3].pick)'); ok(cp === '[2,1]', '뒤 구간만 테이크 2 ' + cp);
await pg.screenshot({ path: 's2_comp.png' });
await pg.click('#cbNext'); await pg.click('#cbNext'); cp = await ev('JSON.stringify(P.tracks[3].pick)+$("#cbTake").textContent'); ok(cp === '[2,-1]비움', '구간 비우기 ' + cp);
ok(await ev('projEnd()') > 20, '끝 계산(예시 곡 기준) ' + (await ev('projEnd()')).toFixed(2));
const mix = await ev(`(async()=>{const rv=P.tracks[3].rev;P.tracks[3].rev=0;P.tracks.forEach((t,i)=>t.solo=i===3);const r=await renderMix();P.tracks.forEach(t=>t.solo=false);P.tracks[3].rev=rv;const d=r.getChannelData(0),sr=r.sampleRate;const rms=(a,b)=>{let s=0;for(let i=a*sr;i<b*sr;i++)s+=d[i]*d[i];return Math.sqrt(s/((b-a)*sr))};return[rms(0.2,1.1),rms(1.4,2.3)].map(v=>+v.toFixed(4))})()`);
ok(mix[0] > 0.02 && mix[1] < 0.002, '비운 구간은 조용 ' + JSON.stringify(mix));
await pg.click('#cbPrev'); await pg.click('#cbJoin'); cp = await ev('JSON.stringify([P.tracks[3].cuts,P.tracks[3].pick])'); ok(cp === '[[],[2]]', '합치기 ' + cp);
// 나눔 끌기
await ev('setPos(1.0)'); await pg.click('#cbSplit');
const box = await pg.evaluate(() => { const r = document.querySelector('#cLanes').getBoundingClientRect(); return { left: r.left, top: r.top } });
const cx = await ev('(P.tracks[3].cuts[0]-view.x0)*view.pps'), cy = await ev('3*laneH()+12');
await pg.mouse.move(box.left + cx, box.top + cy); await pg.mouse.down(); await pg.mouse.move(box.left + cx + 23, box.top + cy, { steps: 5 }); await pg.mouse.up();
const nc = await ev('P.tracks[3].cuts[0]'); ok(Math.abs(nc - (1 + 23 / await ev('view.pps'))) < 0.02, '나눔 끌어 옮기기 1.0→' + nc.toFixed(2));
// 소리 정리
await pg.click('#cbClean'); await wait(200); const before = await ev('takeOf(P.tracks[3]).buf');
await pg.click('[data-nr="24"]'); await wait(800); const after = await ev('takeOf(P.tracks[3]).buf');
ok(before !== after && await ev(`BUF.has('${after}')`), '잡음 줄이기 → 새 소리');
const dn = await ev(`(()=>{const sr=48000,x=new Float32Array(sr*2);for(let i=0;i<x.length;i++)x[i]=(Math.random()-.5)*0.01+(i>sr/2&&i<sr*1.5?0.4*Math.sin(2*Math.PI*330*i/sr):0);const y=denoise(x,sr,24);const r=(a,b,d)=>{let s=0;for(let i=a;i<b;i++)s+=d[i]*d[i];return Math.sqrt(s/(b-a))};return{q:+(20*Math.log10(r(sr*1.8,sr*1.98,y)/r(sr*1.8,sr*1.98,x))).toFixed(1),p:+(20*Math.log10(r(sr*0.8,sr*1.2,y)/r(sr*0.8,sr*1.2,x))).toFixed(2)}})()`);
ok(dn.q < -15 && Math.abs(dn.p) < 0.5, '쉬는 구간 잡음 ' + dn.q + 'dB, 연주 ' + dn.p + 'dB');
await pg.click('#bUndo'); ok(await ev('takeOf(P.tracks[3]).buf') === before, '되돌리기로 원래 소리');
await ev('autoLevelAll()'); const gs = await ev('P.tracks.map(t=>takeOf(t)&&takeOf(t).gain)'); ok(gs.every(g => g == null || (isFinite(g) && g >= -24 && g <= 18)), '음량 자동 맞춤 ' + JSON.stringify(gs));
// 내보내기 MP3
await ev('selClip=false;renderClipbar()'); await pg.click('#bExp'); await pg.waitForSelector('#exAct a[download]', { timeout: 30000 });
const ex = await ev('$("#exAct a[download]").getAttribute("download")+" "+$("#exAct p").textContent'); ok(/\.mp3 /.test(ex), 'MP3 내보내기 ' + ex);
await pg.screenshot({ path: 's2_export.png' });
await pg.click('[data-fmt=wav]'); ok(/\.wav$/.test(await ev('$("#exAct a[download]").getAttribute("download")')), 'WAV 고르기'); await ev('closeSheet()');
// 백업 → 가져오기
const bk = await ev(`(async()=>{const f=await exportBackup();window.__bk=f;return{name:f.name,mb:+(f.size/1048576).toFixed(2)}})()`);
ok(/\.hapju$/.test(bk.name) && bk.mb > 1, '백업 파일 ' + JSON.stringify(bk));
const orig = await ev(`JSON.stringify({n:P.tracks.length,t:P.tracks.map(t=>[t.takes.length,t.cuts,t.pick]),len:P.tracks.map(t=>t.takes.map(c=>BUF.get(c.buf).data.length))})`);
const oid = await ev('P.id'); await ev('importBackup(window.__bk)'); await wait(1500);
const imp = await ev(`JSON.stringify({n:P.tracks.length,t:P.tracks.map(t=>[t.takes.length,t.cuts,t.pick]),len:P.tracks.map(t=>t.takes.map(c=>BUF.get(c.buf).data.length))})`);
ok(imp === orig && await ev('P.id') !== oid && /가져옴/.test(await ev('P.name')), '가져오기 같음 · 이름 ' + await ev('P.name'));
const er = await ev(`(()=>{const a=[...BUF.values()][0];return a.data.length})()`); ok(er > 0, '가져온 소리 있음');
// 다시 열기
await ev('saveProject()'); await wait(400); await pg.reload(); await wait(1500);
ok(await ev('P.name').then(n => /가져옴/.test(n)) && await ev('P.tracks[3].cuts.length') === 1, '다시 열기 유지');
await pg.screenshot({ path: 's2_phone.png' });
// 태블릿 다크
const c2 = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' }); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('PAGEERR2 ' + e.message));
await p2.goto('http://localhost:8766/'); await p2.waitForTimeout(1200); await p2.evaluate(`P.loop={on:true,a:5,b:10};selT=P.tracks[3]?P.tracks[3].id:P.tracks[0].id;selClip=true;renderAll()`); await p2.waitForTimeout(300); await p2.screenshot({ path: 's2_tab.png' });
const ov = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth); ok(!ov, '가로 넘침 없음');
console.log(errs.length ? errs.join('\n') : '오류 0'); console.log(nf ? nf + '개 실패' : '모두 통과');
await b.close(); srv.kill();
