import { chromium, devices } from 'playwright';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = new URL(process.env.HTTPS_BASE_URL || 'https://aitechd.com/');
if (base.protocol !== 'https:') throw new Error('HTTPS_BASE_URL must use HTTPS');
const version = '20260911-https-v2';
const out = 'test-output/https';
await fs.mkdir(out, {recursive:true});
const failures = [];
const results = [];
const redirects = [];
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const check = (ok,message) => { if (!ok) failures.push(message); };
const insecure = url => /^(?:http|ws):/i.test(url);
const safePath = value => typeof value === 'string' && !value.startsWith('/') && !value.split('/').includes('..') && /\.html?$/i.test(value) && new URL(value,base).origin===base.origin;

// Verify the deployed build, not an older cached page with similar text.
let release;
for (let attempt=0; attempt<24; attempt++) {
  try {
    const response=await fetch(new URL(`https-release.json?audit=${process.env.GITHUB_SHA || version}-${attempt}`,base),{signal:AbortSignal.timeout(15000)});
    if(response.ok) {
      const data=await response.json();
      if(data.version===version && (!process.env.HTTPS_EXPECT_COMMIT || data.commit===process.env.HTTPS_EXPECT_COMMIT)) { release=data;break; }
    }
  } catch(error) { console.log(`Waiting for HTTPS release: ${error.message}`); }
  await sleep(5000);
}
if(!release || !Array.isArray(release.pages) || !release.pages.includes('index.html') || !release.pages.every(safePath)) throw new Error('A matching HTTPS release manifest was not published');
// An omitted source page must not silently disappear from the audit.
const tracked=execFileSync('git',['ls-files','-z','*.html','*.htm'],{encoding:'utf8'}).split('\0').filter(Boolean).filter(p=>!/(^|\/)(?:tests|node_modules|vendor|test-output|\.github|tools|scripts)\//.test(p));
for(const path of tracked) check(release.pages.includes(path),`Published manifest omits source HTML: ${path}`);
const paths=[...new Set(['',...release.pages])];
async function saveReport(complete=false) {
  const report={version,commit:release.commit,checkedAt:new Date().toISOString(),complete,browser:'full Chromium',base:base.href,htmlDocuments:release.pages.length,checks:results.length,redirects,failures,results};
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
}

// Check actual server redirects. JavaScript redirects do not pass this test.
const aliases=base.hostname==='aitechd.com'?['aitechd.com','www.aitechd.com']:[base.hostname];
for(const hostname of aliases) {
  for(const path of ['', 'yobi-quiz.html', 'game23.html']) {
    const target=new URL(path,base);target.hostname=hostname;target.protocol='http:';target.search='https-audit=redirect';
    try {
      const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(15000)});
      const location=response.headers.get('location');
      const next=location?new URL(location,target):null;
      const ok=[301,302,307,308].includes(response.status)&&next?.protocol==='https:'&&next?.pathname===target.pathname&&next?.search===target.search;
      redirects.push({from:target.href,status:response.status,to:next?.href,ok});
      check(ok,`Missing HTTPS server redirect: ${target.href} (${response.status}, ${location})`);
      await response.body?.cancel();
    }catch(error){failures.push(`Redirect check failed for ${target.href}: ${error.message}`);}
  }
}
// Validate the TLS certificate for www as well as the canonical hostname.
for(const hostname of aliases) {
  try {
    const url=new URL(base);url.hostname=hostname;
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    check(response.ok || [301,302,307,308].includes(response.status),`HTTPS alias returned ${response.status}: ${url}`);
    await response.body?.cancel();
  }catch(error){failures.push(`TLS validation failed for ${hostname}: ${error.message}`);}
}
await saveReport();

// Use full Chromium/new headless, NOT headless-shell: it exposes the browser's
// visible Security state (the state behind Chrome's site-information warning).
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--enable-unsafe-swiftshader']});
const profiles=[{name:'desktop',options:{viewport:{width:1365,height:900}}},{name:'android',options:{...devices['Pixel 7']}}];
try {
  for(const profile of profiles) {
    for(const path of paths) {
      const target=new URL(path,base);target.searchParams.set('https-audit',release.commit || version);
      const context=await browser.newContext({...profile.options,ignoreHTTPSErrors:false});
      const page=await context.newPage();
      const cdp=await context.newCDPSession(page);
      let security=null;
      const row={profile:profile.name,path:path||'/',url:target.href,insecure:[],securityIssues:[],pageErrors:[],failedRequests:[],badResponses:[]};
      cdp.on('Security.visibleSecurityStateChanged',e=>{
        const state=e.visibleSecurityState;
        security={securityState:state.securityState,issueIds:state.securityStateIssueIds,certificate:state.certificateSecurityState?{protocol:state.certificateSecurityState.protocol,subjectName:state.certificateSecurityState.subjectName,issuer:state.certificateSecurityState.issuer,validTo:state.certificateSecurityState.validTo,certificateNetworkError:state.certificateSecurityState.certificateNetworkError}:null};
      });
      cdp.on('Audits.issueAdded',e=>{if(['MixedContentIssue','ContentSecurityPolicyIssue'].includes(e.issue.code))row.securityIssues.push(e.issue);});
      page.on('request',request=>{if(insecure(request.url()))row.insecure.push(request.url());});
      page.on('websocket',socket=>{if(insecure(socket.url()))row.insecure.push(socket.url());});
      page.on('console',msg=>{if(/mixed content|violates.*content security policy|refused to.*(?:insecure|content security policy)/i.test(msg.text()))row.securityIssues.push({message:msg.text()});});
      page.on('pageerror',error=>row.pageErrors.push(error.message));
      page.on('requestfailed',request=>row.failedRequests.push({url:request.url(),reason:request.failure()?.errorText}));
      page.on('response',response=>{if(response.status()>=400)row.badResponses.push({url:response.url(),status:response.status()});});
      await cdp.send('Security.enable');await cdp.send('Audits.enable');
      const start=failures.length;
      try {
        const response=await page.goto(target.href,{waitUntil:'load',timeout:45000});
        row.status=response?.status();row.tls=await response?.securityDetails();
        check(Boolean(response?.ok()),`${profile.name} ${path}: document status ${row.status}`);
        await page.waitForTimeout(path==='game23.html'?7000:2000);
        // Exercise the reported learning page, not just its initial HTML shell.
        if(path==='yobi-quiz.html') {
          const practice=page.getByRole('button',{name:/今日の20問を始める/});
          if(await practice.count()) { await practice.click();await page.waitForTimeout(1500);row.learningStarted=true; }
        }
        row.state=await page.evaluate(()=>({url:location.href,secure:isSecureContext,version:document.querySelector('meta[name="site-security-version"]')?.content,csp:[...document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map(e=>e.content),insecure:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/^(http|ws):/i.test(u))}));
        row.security=security;
        check(row.state.url.startsWith('https://')&&row.state.secure,`${profile.name} ${path}: insecure context`);
        check(row.state.version===version&&row.state.csp.some(p=>/(?:^|;)\s*upgrade-insecure-requests(?:\s*;|\s*$)/i.test(p)),`${profile.name} ${path}: HTTPS policy missing`);
        check(security?.securityState==='secure',`${profile.name} ${path}: browser security state is ${security?.securityState || 'NOT OBSERVED'}`);
        check(!row.insecure.length&&!row.state.insecure.length&&!row.securityIssues.length,`${profile.name} ${path}: mixed content or CSP issue`);
        check(!row.pageErrors.length,`${profile.name} ${path}: unhandled JavaScript: ${row.pageErrors.join(' | ')}`);
        const transportFailures=row.failedRequests.filter(r=>/ERR_(CERT|SSL|TLS)|MIXED_CONTENT|BLOCKED_BY_CSP/i.test(r.reason || ''));
        check(!transportFailures.length,`${profile.name} ${path}: TLS/security request failure`);
        const brokenOwn=row.badResponses.filter(r=>new URL(r.url).origin===base.origin);
        check(!brokenOwn.length,`${profile.name} ${path}: missing same-origin resources: ${JSON.stringify(brokenOwn)}`);
        if(['','yobi-quiz.html','game23.html'].includes(path))await page.screenshot({path:`${out}/${profile.name}-${path||'index'}.png`,fullPage:false});
      }catch(error){failures.push(`${profile.name} ${path}: ${error.message}`);row.error=error.message;}
      row.ok=failures.length===start;
      results.push(row);
      await saveReport();
      console.log(`HTTPS ${row.ok?'PASS':'FAIL'} ${profile.name} ${path||'/'} security=${security?.securityState || 'unobserved'} mixed=${row.insecure.length+row.securityIssues.length} errors=${row.pageErrors.length}`);
      await context.close();
    }
  }
}finally{await browser.close();}
await saveReport(true);
console.log(JSON.stringify({httpsAudit:failures.length?'FAILED':'PASSED',htmlDocuments:release.pages.length,checks:results.length,redirects:redirects.length,failures},null,2));
if(failures.length)process.exitCode=1;
