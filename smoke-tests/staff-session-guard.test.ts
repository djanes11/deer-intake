import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { isProtectedStaffPath, staffLoginUrl } from '../lib/staffRouteAccess.ts';

export async function run() {
  for (const path of ['/intake','/search','/scan','/butcher/intake','/reports/print-queue','/admin/settings','/staff/team']) {
    assert.equal(isProtectedStaffPath(path, true), true);
  }
  for (const path of ['/intake/overnight','/intake/view/token','/intake/10001','/i/token','/status','/staff/login','/staff/reset-password','/faq-public']) {
    assert.equal(isProtectedStaffPath(path), false);
  }
  assert.equal(isProtectedStaffPath('/', true), false);
  assert.equal(isProtectedStaffPath('/', false), true);
  assert.equal(staffLoginUrl('/intake','?tag=10001'), '/staff/login?next=%2Fintake%3Ftag%3D10001');
  const proxyCode = ts.transpileModule(fs.readFileSync('proxy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const publicMode of ['0', '1']) {
    let allowed = false;
    const deps: Record<string, any> = {
      'next/server': { NextResponse: { next: () => ({ next: true }), redirect: (url: URL) => ({ location: String(url), headers: new Headers() }) } },
      '@/lib/staffAuth': { requireStaffAccess: async () => ({ ok: allowed }) },
      '@/lib/staffRouteAccess': { isProtectedStaffPath, staffLoginUrl },
    };
    const module: any = { exports: {} };
    new Function('require','module','exports','process',proxyCode)((name: string) => deps[name], module, module.exports, { env: { PUBLIC_MODE: publicMode } });
    const denied = await module.exports.proxy(new Request('https://staff.example/scan'));
    assert.match(denied.location, /staff\/login\?next=%2Fscan/);
    assert.equal((await module.exports.proxy(new Request('https://staff.example/intake/overnight'))).next, true);
    allowed = true;
    // Staff mode also sets a legacy timestamp cookie on the response.
    deps['next/server'].NextResponse.next = () => ({ next: true, cookies: { set() {} } });
    assert.equal((await module.exports.proxy(new Request('https://staff.example/scan'))).next, true);
  }
  const js = ts.transpileModule(fs.readFileSync('app/components/StaffSessionRefresh.tsx','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const flush = async () => { for (let i=0;i<12;i++) await new Promise(resolve => setImmediate(resolve)); };
  for (const scenario of ['expired','valid','network','logout-email','logout-local']) {
    const state: any[] = [];
    const effects: Array<() => any> = [];
    const events: Record<string, () => void> = {};
    const calls: string[] = [];
    let authEvent: (event: string) => void = () => {};
    let status = scenario === 'expired' ? 401 : scenario === 'network' ? 503 : 200;
    let redirected = '';
    const win: any = {
      location: { pathname:'/scan', search:'', href:'https://staff.example/scan', origin:'https://staff.example', replace(url: string) { redirected=url; } },
      fetch: async (input: any, init: any = {}) => {
        calls.push(init.method || 'GET');
        if (init.method === 'DELETE') status=401;
        return new Response(JSON.stringify({authType: scenario==='logout-local'?'local':'supabase'}), {status: String(input).includes('/session')?status:403});
      },
      setInterval(fn: () => void) { events.poll=fn; return 1; }, clearInterval() {},
      addEventListener(name: string, fn: () => void) { events[name]=fn; }, removeEventListener() {},
    };
    const doc = {visibilityState:'visible',addEventListener(){},removeEventListener(){}};
    const deps: Record<string, any> = {
      react: {useState(initial: any) {const i=state.length;state.push(initial);return [initial,(v: any)=>{state[i]=v;}];},useEffect(fn:()=>any){effects.push(fn);}},
      'react/jsx-runtime': {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props}),Fragment:'fragment'},
      'next/navigation': {usePathname:()=>'/scan'},
      '@/lib/staffRouteAccess': {isProtectedStaffPath,staffLoginUrl},
      '@/lib/supabaseBrowser': {getSupabaseBrowser:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(fn:any){authEvent=fn;return {data:{subscription:{unsubscribe(){}}}};}}})},
      '@/lib/staffSessionRefresh': {subscribeStaffSessionRefresh:()=>({stop(){},settled:async()=>{}})},
    };
    const module: any = {exports:{}};
    new Function('require','module','exports','window','document',js)((name:string)=>{assert.ok(deps[name],name);return deps[name];},module,module.exports,win,doc);
    module.exports.default({children:'PRIVATE CONTENT'});
    assert.equal(state[0],null,'Staff content starts locked');
    const cleanup=effects[0](); await flush();
    if(scenario==='expired') assert.match(redirected,/staff\/login/);
    else if(scenario==='network') {assert.equal(state[2],true);assert.equal(state[1],true);assert.equal(redirected,'');}
    else {
      assert.equal(state[0],'/scan');assert.equal(state[2],false);
      await win.fetch('/api/v2/jobs');await flush();assert.equal(redirected,'','403 is not logout');
      if(scenario.startsWith('logout')) {
        authEvent('SIGNED_OUT');await flush();
        if(scenario==='logout-local') {assert.equal(calls.includes('DELETE'),false);assert.equal(redirected,'');}
        else {assert.equal(calls.includes('DELETE'),true);assert.match(redirected,/staff\/login/);}
      } else {status=401;events.focus();await flush();assert.equal(state[2],true);assert.match(redirected,/staff\/login/);}
    }
    cleanup();
  }
}
