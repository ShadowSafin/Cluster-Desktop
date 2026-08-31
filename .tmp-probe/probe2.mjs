import { execa } from 'execa';
const p = execa('node -e "console.log(1); console.error(2); console.log(3)"', {
  shell: true, buffer: false, reject: false, all: true,
});
console.log('has all:', Boolean(p.all), '| stdout:', Boolean(p.stdout), '| stderr:', Boolean(p.stderr));
let buf = '';
if (p.all) { for await (const c of p.all) buf += String(c); }
const r = await p;
console.log('exitCode:', r.exitCode, '| timedOut:', r.timedOut, '| isCanceled:', r.isCanceled);
console.log('captured:', JSON.stringify(buf));

// cancellation probe
const ac = new AbortController();
const p2 = execa('node -e "setTimeout(()=>{}, 5000)"', { shell: true, buffer: false, reject: false, all: true, cancelSignal: ac.signal });
setTimeout(() => ac.abort(), 300);
const r2 = await p2;
console.log('cancel -> exitCode:', r2.exitCode, 'isCanceled:', r2.isCanceled);

// timeout probe
const r3 = await execa('node -e "setTimeout(()=>{}, 5000)"', { shell: true, buffer: false, reject: false, all: true, timeout: 400 });
console.log('timeout -> exitCode:', r3.exitCode, 'timedOut:', r3.timedOut);
