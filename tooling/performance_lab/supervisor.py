"""Independent resource owner. Browser control cannot outlive this bounded lease."""
import functools,hashlib,http.server,json,os,queue,secrets,signal,subprocess,threading,time
from pathlib import Path
from .contract import MAX_BYTES,canonical,digest,errors

CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

def atomic(path,value):
    tmp=path.with_suffix('.pending');tmp.write_bytes(canonical(value));os.replace(tmp,path)

def processes(pids=None):
    rows={}
    if pids is not None and not pids:return {}
    command=['ps','-p',','.join(map(str,pids)),'-o','pid=,ppid=,pgid=,lstart=,command='] if pids is not None else ['ps','-axo','pid=,ppid=,pgid=,lstart=,command=']
    result=subprocess.run(command,capture_output=True,text=True,timeout=5)
    if result.returncode not in (0,1):raise RuntimeError('Cannot inspect process ownership')
    for line in result.stdout.splitlines():
        parts=line.split(None,8)
        if len(parts)==9:
            pid,ppid,pgid=map(int,parts[:3]);rows[pid]=dict(pid=pid,ppid=ppid,pgid=pgid,started=' '.join(parts[3:8]),command=parts[8])
    return rows

def owned_alive(owned):
    now=processes(list(owned))
    return [pid for pid,p in owned.items() if pid in now and now[pid]['started']==p['started']]


class CleanupFailure(RuntimeError):
    """No subsequent browser launch is safe until ownership is reconciled."""

def cleanup_owned(owned,resources,inspection_error=None,inspect=owned_alive,signal_group=os.killpg,signal_pid=os.kill,wait=time.sleep):
    issue=inspection_error
    terminationErrors=[]
    def termination_error(kind,pid,sig,error):
        terminationErrors.append(dict(kind=kind,pid=pid,signal=int(sig),error=str(error)))
    def inspect_remaining():
        nonlocal issue
        try:return inspect(owned),True
        except Exception as error:
            issue=str(error)
            return list(owned),False
    # A live direct child cannot have had its PID recycled. An exited root's
    # group is never signalled by stale group ID; inspect its descendants instead.
    def signal_live_roots(sig):
        nonlocal issue
        for process in resources:
            if process is not None and process.poll() is None:
                try:signal_group(process.pid,sig)
                except ProcessLookupError:pass
                except OSError as error:termination_error('group',process.pid,sig,error)
    signal_live_roots(signal.SIGTERM)
    alive,verified=inspect_remaining()
    if verified:
        for pid in alive:
            try:signal_pid(pid,signal.SIGTERM)
            except ProcessLookupError:pass
            except OSError as error:termination_error('pid',pid,signal.SIGTERM,error)
    for _ in range(30):
        for process in resources:
            if process:process.poll()
        alive,verified=inspect_remaining()
        if verified and not alive:break
        wait(.1)
    if alive:
        signal_live_roots(signal.SIGKILL)
        if verified:
            for pid in alive:
                try:signal_pid(pid,signal.SIGKILL)
                except ProcessLookupError:pass
                except OSError as error:termination_error('pid',pid,signal.SIGKILL,error)
    for _ in range(30):
        for process in resources:
            if process:process.poll()
        alive,verified=inspect_remaining()
        if verified and not alive:break
        wait(.1)
    # A helper may exit naturally after refusing a signal. Only an independently
    # verified empty owned set establishes cleanup; signal errors remain evidence.
    return dict(ok=verified and not alive and not issue,remaining=alive,checkedPids=list(owned),inspectionError=issue,terminationErrors=terminationErrors)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def setup(self):
        super().setup();self.connection.settimeout(5)
    def do_POST(self):
        cfg=self.server.lab
        if self.path!=f"/__lab/{cfg['token']}/{cfg['runId']}": self.send_error(404);return
        if self.headers.get('Origin')!=cfg['origin']: self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<=0 or size>MAX_BYTES: self.send_error(413);return
            raw=self.rfile.read(size);value=json.loads(raw)
            if errors(value,completed=False) or value['identity']['runId']!=cfg['runId']: self.send_error(422);return
            h=digest(value);target=cfg['directory']/'capture.json'
            with cfg['lock']:
                if target.exists() and digest(json.loads(target.read_text()))!=h:self.send_error(409);return
                atomic(target,value)
            body=canonical(dict(hash=h,saved=True))
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        except (ValueError,OSError): self.send_error(400)

def supervise(directory,root,run=None,probe=False,fault=None,deadline=180,browser_command=None,worker_command=None,smoke=False):
    directory=Path(directory).resolve();directory.mkdir(parents=True,exist_ok=True)
    if (directory/'ownership.json').exists(): raise RuntimeError('Run directory already used')
    before=processes();owned={};interrupt=False;browser=worker=None;server=None;chromeLog=workerLog=None
    manifest=dict(state='prepared',beforeBrowserPids=[pid for pid,p in before.items() if any(k in p['command'] for k in ['agent-browser','chrome-headless-shell'])],owned=[],cleanup=None)
    atomic(directory/'ownership.json',manifest)
    def interrupted(*_):
        nonlocal interrupt
        interrupt=True
    previous={s:signal.signal(s,interrupted) for s in (signal.SIGINT,signal.SIGTERM)}
    def record():
        now=processes();roots={p.pid for p in (browser,worker) if p}
        changed=True
        while changed:
            changed=False
            for pid,p in now.items():
                if pid not in before and pid not in owned and (pid in roots or p['ppid'] in owned or p['pgid'] in roots):owned[pid]=p;changed=True
        manifest['owned']=list(owned.values());atomic(directory/'ownership.json',manifest)
    try:
        serve=Path(root).resolve()
        if probe:
            serve=directory/'probe';serve.mkdir()
            (serve/'index.html').write_text('''<link rel="icon" href="data:,"><button id="mode-cruisin">Start GPU probe</button><canvas id="c"></canvas><script>document.querySelector('button').onclick=()=>{window.__probeClicked=true;let g=document.querySelector('canvas').getContext('webgl2');let e=g?.getExtension('WEBGL_debug_renderer_info');window.__probeGpuVerified=!!e;window.__probeGpu=g?(e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)):null;};</script>''')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(serve)))
        token=secrets.token_hex(24);runId=(run or {}).get('identity',{}).get('runId',directory.name)
        origin=f'http://127.0.0.1:{server.server_port}'
        server.lab=dict(token=token,runId=runId,origin=origin,directory=directory,lock=threading.Lock())
        threading.Thread(target=server.serve_forever,daemon=True).start()
        if run:run['exportUrl']=f'{origin}/__lab/{token}/{runId}'
        params='?mute=1' if probe else f"?mute=1&performanceLab=1&perf={run['conditions']['tier']}&physics=1&seed={run['conditions']['seed']}&x=-230.3&z=-691.8&heading=0&tod=0.3"
        if run and run['identity']['scenario']=='streaming-drive-v1':params=params.replace('heading=0','heading=2.3580')
        if smoke:params=params.replace('&performanceLab=1','')
        config=dict(url=origin+'/'+params,run=run,probe=probe,fault=fault,smoke=smoke)
        atomic(directory/'config.json',config)
        chromeLog=open(directory/'chrome.log','w')
        browser=subprocess.Popen(browser_command or [CHROME,f'--user-data-dir={directory}/profile','--remote-debugging-port=0','--disable-extensions','--no-first-run','--no-default-browser-check','--window-size=1280,800','about:blank'],stdout=chromeLog,stderr=chromeLog,start_new_session=True)
        record()
        workerLog=open(directory/'worker.log','w')
        worker=subprocess.Popen((worker_command or ['node',str(Path(__file__).with_name('worker.mjs'))])+[str(directory)],stdout=subprocess.PIPE,stderr=workerLog,text=True,start_new_session=True)
        record();q=queue.Queue()
        def read():
            for line in worker.stdout:q.put(line)
        threading.Thread(target=read,daemon=True).start();start=last=time.monotonic();lastRecord=0
        while worker.poll() is None:
            now=time.monotonic()
            if interrupt:raise RuntimeError('Supervisor interrupted')
            if browser.poll() is not None:raise RuntimeError('Owned Chrome exited during control')
            if now-start>deadline:raise RuntimeError('Overall run deadline')
            if now-last>15:raise RuntimeError('Control-worker heartbeat lease expired')
            while not q.empty():
                line=q.get();last=now
                if line.strip()!='heartbeat':print(line.strip(),flush=True)
            if now-lastRecord>1:record();lastRecord=now
            time.sleep(.1)
        record()
        if worker.returncode:
            detail=json.loads((directory/'worker-result.json').read_text()).get('error') if (directory/'worker-result.json').exists() else None
            raise RuntimeError(detail or f'Control worker exited {worker.returncode}')
        result=json.loads((directory/'worker-result.json').read_text())
        if not result['ok']:raise RuntimeError(result.get('error','Worker failure'))
        if not probe and not smoke:
            raw=json.loads((directory/'capture.json').read_text())
            if raw.get('state')!='exporting' or not raw.get('progress',{}).get('complete') or raw.get('errors'):raise RuntimeError('Page reported incomplete or invalid work')
        manifest['state']='collected'
    except BaseException as error:
        manifest.update(state='interrupted' if interrupt else 'failed',error=str(error))
    finally:
        inspectionError=None
        try:record()
        except Exception as error:inspectionError=str(error)
        manifest['cleanup']=cleanup_owned(owned,(worker,browser),inspectionError)
        if not manifest['cleanup']['ok']:manifest.update(state='failed',error='Owned process cleanup failed')
        if server:server.shutdown();server.server_close()
        if chromeLog:chromeLog.close()
        if workerLog:workerLog.close()
        atomic(directory/'ownership.json',manifest)
        if (directory/'capture.json').exists():
            capture=json.loads((directory/'capture.json').read_text());capture['exportHash']=digest(capture);capture['cleanup']=manifest['cleanup']
            if manifest['state']=='collected' and capture.get('state')=='exporting':capture['state']='completed'
            else:capture['state']='failed';capture.setdefault('errors',[]).append(manifest.get('error','Page failed'))
            if capture['state']=='completed':
                invalid=errors(capture)
                if invalid:
                    capture['state']='failed';capture['errors']+=invalid
                    manifest.update(state='failed',error='Invalid captured run: '+','.join(invalid))
                    atomic(directory/'ownership.json',manifest)
            atomic(directory/'run.json',capture)
        for s,h in previous.items():signal.signal(s,h)
    return manifest
