'use client';
import { useEffect, useState } from 'react';
import { getJob, progress, saveJob, searchJobs } from '@/lib/api';

type Row = { label: string; ok?: boolean; msg?: string; route?: string };

export default function HealthPage(){
  const [rows, setRows] = useState<Row[]>([]);
  const [env, setEnv] = useState<{ NEXT_PUBLIC_GAS_BASE?: string; GAS_BASE?: string }>({});

  useEffect(() => {
    setEnv({
      NEXT_PUBLIC_GAS_BASE: process.env.NEXT_PUBLIC_GAS_BASE,
      GAS_BASE: process.env.GAS_BASE as any
    });

    (async () => {
      const out: Row[] = [];
      // Search ping
      try {
        const r = await searchJobs('1');
        out.push({ label:'GET /search', ok: !!r.ok, msg: r.ok?'ok':'fail' });
      } catch (e:any){ out.push({ label:'GET /search', ok:false, msg:e?.message }); }

      // Get
      try {
        const r = await getJob('1');
        out.push({ label:'GET /get?tag=1', ok: !!r.ok, msg: r.ok? (r.exists?'exists':'not found') : (r.error||'fail') });
      } catch (e:any){ out.push({ label:'GET /get', ok:false, msg:e?.message }); }

      // Save (safe dummy)
      try {
        const r = await saveJob({ tag:'HEALTH-CHECK', status:'Dropped Off', dropoff:'2025-01-01', customer:'Health', phone:'0000000', email:'x@x', address:'-', city:'-', state:'-', zip:'-' , county:'-', sex:'Doe', processType:'Standard Processing' });
        out.push({ label:'POST /save', ok: !!r.ok, msg: r.ok?'ok':(r.error||'fail') });
      } catch (e:any){ out.push({ label:'POST /save', ok:false, msg:e?.message }); }

      // Progress (harmless if tag missing)
      try {
        const r = await progress('HEALTH-CHECK');
        out.push({ label:'POST /progress', ok: !!r.ok, msg: r.ok?(r.nextStatus||'ok'):(r.error||'fail') });
      } catch (e:any){ out.push({ label:'POST /progress', ok:false, msg:e?.message }); }

      setRows(out);
    })();
  }, []);

  return (
    <main className="page-wrap">
      <h2>Admin Health</h2>
      <div className="card" style={{margin:'8px 0'}}>
        <div className="muted" style={{marginBottom:8}}>Env</div>
        <div><strong>NEXT_PUBLIC_GAS_BASE:</strong> {env.NEXT_PUBLIC_GAS_BASE || <em>(unset)</em>}</div>
        <div><strong>GAS_BASE:</strong> {env.GAS_BASE || <em>(unset)</em>}</div>
      </div>

      <table className="tbl" style={{marginTop:12}}>
        <thead><tr><th>Check</th><th>Status</th></tr></thead>
        <tbody>
        {rows.map((r,i)=>(
          <tr key={i}>
            <td>{r.label}</td>
            <td style={{color:r.ok?'#065f46':'#b91c1c', fontWeight:700}}>
              {r.ok ? 'OK' : 'FAIL'} {r.msg? `— ${r.msg}`:''}
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </main>
  );
}

