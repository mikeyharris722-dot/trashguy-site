import 'server-only';
import {randomUUID} from 'node:crypto';
import {readX,saveX} from './x-giveaway-store';
import {siteDb} from './site-db';
import {postInfo,username,type XEntry} from './x-giveaway';

export type XCollection={id:string;postUrl:string;startedAt:string;status:'starting'|'running'|'succeeded'|'failed';runId?:string;entries?:XEntry[];raw?:number;limited?:boolean;partial?:boolean;stopRequested?:boolean;message?:string;costUsd?:number;retryable?:boolean};
type ReplyRow={resultType?:string;sourceTarget?:string;inReplyToId?:string;author?:{id?:string;username?:string}};
export function collectedEntries(rows:ReplyRow[],postId:string){
    if(!Array.isArray(rows))throw Error('Collector returned invalid reply data.');
    const entries:XEntry[]=[];
    for(const row of rows){
        if(row.resultType!=='replies'||String(row.sourceTarget)!==postId||String(row.inReplyToId)!==postId)throw Error('Collector returned replies for another post or nested replies. Nothing was loaded.');
        const accountId=row.author?.id;
        if(typeof accountId!=='string'||!/^\d{1,25}$/.test(accountId))throw Error('Collector did not provide exact author account IDs. Nothing was loaded.');
        entries.push({username:username(row.author?.username||''),accountId});
    }
    return entries;
}
export async function collectorConfig():Promise<{token:string;freePlanConfirmed:boolean}>{
    if(process.env.APIFY_API_TOKEN)return {token:process.env.APIFY_API_TOKEN,freePlanConfirmed:process.env.APIFY_FREE_PLAN_CONFIRMED==='1'};
    const {data,error}=await siteDb().rpc('x_collector_config');
    if(error||!data||typeof data.token!=='string'||!data.token.trim())throw Error('Automatic collection is awaiting the server API connection. CSV import still works.');
    return {token:data.token,freePlanConfirmed:data.freePlanConfirmed===true};
}
async function apify(path:string,body?:object){
    const {token}=await collectorConfig();
    let response:Response;
    try{response=await fetch('https://api.apify.com/v2/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),cache:'no-store'});}catch{throw Error('Collector connection timed out. Retry to check the saved job; no automatic duplicate run will be started.');}
    if(!response.ok)throw Error(response.status===401||response.status===403?'Collector API access is unavailable.':'Collector request failed ('+response.status+'). No paid fallback was used.');
    return response.json();
}
export async function freeBudget(){
    // This flag is set only after confirming the no-card Free account in Console.
    // A resource-scoped token cannot read billing or change account plans.
    if(!(await collectorConfig()).freePlanConfirmed)throw Error('Verify the Apify Free plan before enabling collection.');
    const month=new Date().toISOString().slice(0,7)+'-01T00:00:00.000Z';
    const runs=await apify('acts/bB9gzR3JDmTp5pnoz/runs?limit=100&desc=true&startedAfter='+encodeURIComponent(month));
    if(!Array.isArray(runs.data?.items)||typeof runs.data?.total!=='number')throw Error('Could not verify collector usage. Collection paused.');
    if(runs.data.total>=60)throw Error('The free collector limit of 60 runs this month has been reached.');
    let spent=0;
    for(const run of runs.data.items){if(typeof run.usageTotalUsd!=='number'||!Number.isFinite(run.usageTotalUsd))throw Error('Could not verify collector cost. Collection paused.');spent+=run.usageTotalUsd;}
    if(spent>=3)throw Error('The site collector budget is exhausted. Collection paused until next month.');
}
async function patchJob(id:string,change:Partial<XCollection>){for(let i=0;i<8;i++){const {state,version}=await readX();const job=state.collections?.find(j=>j.id===id);if(!job)throw Error('Collection not found.');Object.assign(job,change);if(await saveX(state,version))return job;}throw Error('Collection is busy. Check again.');}
export async function startCollection(url:string):Promise<XCollection>{
    const {postUrl}=postInfo(url);if(!postUrl)throw Error('Enter an X post URL.');
    const recentFor=(jobs:XCollection[])=>jobs.slice().reverse().find(j=>j.postUrl===postUrl&&!(j.status==='failed'&&j.retryable===true)&&Date.now()-Date.parse(j.startedAt)<(j.status==='succeeded'?300000:86400000));
    const existing=recentFor((await readX()).state.collections||[]);
    if(existing){if(existing.status==='starting'&&!existing.runId)throw Error('This post already has a pending start. Check Apify before trying another run.');return existing.status==='running'?pollCollection(existing.id):existing;}
    // Do not reserve a job if API access/budget cannot be verified.
    await freeBudget();
    const now=new Date();let job:XCollection|undefined;
    for(let i=0;i<8;i++){
        const {state,version}=await readX();const jobs=state.collections ||= [];
        const recent=recentFor(jobs);
        if(recent){if(recent.status==='starting'&&!recent.runId)throw Error('This post already has a pending start. Check Apify before trying another run.');return recent;}
        if(jobs.some(j=>['starting','running'].includes(j.status)&&Date.now()-Date.parse(j.startedAt)<240000))throw Error('Another collection is in progress. Please wait.');
        if(jobs.filter(j=>j.startedAt.slice(0,7)===now.toISOString().slice(0,7)).length>=60)throw Error('The free site limit of 60 collections this month has been reached.');
        job={id:randomUUID(),postUrl,startedAt:now.toISOString(),status:'starting'};jobs.push(job);
        if(await saveX(state,version))break;job=undefined;
    }
    if(!job)throw Error('Collection is busy. Try again.');
    // Reserve durably before making a billable call. Ambiguous failures are never retried automatically.
    try{
        const result=await apify('acts/xquik~x-engagement-scraper/runs?timeout=180&memory=256&maxTotalChargeUsd=0.05',{
            startUrls:[postUrl],engagementTypes:['replies'],maxItems:20,maxItemsPerTarget:20,scope:'direct',includeOriginalPost:false,
        });
        if(!/^[a-z0-9]+$/i.test(result.data?.id||''))throw Error('Collector returned no run ID.');
        return await patchJob(job.id,{runId:result.data.id,status:'running'});
    }catch{await patchJob(job.id,{status:'failed',message:'Could not confirm the collector start. Check Apify Runs before starting again. This request will not be repeated automatically.'});throw Error('Could not confirm the collector start. Check Apify Runs; this request will not be repeated automatically.');}
}
export async function pollCollection(id:string):Promise<XCollection>{
    const {state}=await readX();const job=state.collections?.find(j=>j.id===id);if(!job)throw Error('Collection not found.');
    if(job.status!=='running'||!job.runId)return job;
    let {data:run}=await apify('actor-runs/'+encodeURIComponent(job.runId));
    const expired=Date.now()-Date.parse(job.startedAt)>=180000;
    if(expired&&['READY','RUNNING','TIMING-OUT'].includes(run.status)&&!job.stopRequested){
        await patchJob(id,{stopRequested:true});
        job.stopRequested=true;
        // Explicitly stop at the deadline. The actor also has its own 180s timeout.
        // Never import a dataset while the actor can still append to it.
        try{const stopped=await apify('actor-runs/'+encodeURIComponent(job.runId)+'/abort',{});run=stopped.data;}catch{
            return {...job,message:'Three-minute limit reached. Waiting for the collector to stop before loading the replies already found.'};
        }
    }
    if(['READY','RUNNING','TIMING-OUT','ABORTING'].includes(run?.status))return {...job,message:expired?'Three-minute limit reached. Finalising the replies already collected…':'Collecting replies. X can respond slowly; after three minutes the replies found so far will be loaded.'};
    const partial=run?.status==='TIMED-OUT'||(run?.status==='ABORTED'&&(job.stopRequested===true||expired));
    if(!partial&&['FAILED','ABORTED'].includes(run?.status))return patchJob(id,{status:'failed',retryable:true,message:'The collector '+(run.status==='ABORTED'?'was cancelled':'failed')+'. No list was loaded. Click Save & fetch replies to try again.'});
    if(run?.status!=='SUCCEEDED'&&!partial)throw Error('Collector returned an unknown status. Check the same run again.');
    if(!/^[a-z0-9]+$/i.test(run.defaultDatasetId||''))throw Error('Collector returned no dataset.');
    const rows=await apify('datasets/'+run.defaultDatasetId+'/items?clean=true&limit=21');
    const entries=collectedEntries(rows,postInfo(job.postUrl).postUrl.split('/').pop()!);
    if(partial&&!entries.length)return patchJob(id,{status:'failed',retryable:true,partial:true,raw:0,message:'The three-minute limit was reached before any replies were collected. Try again or import a CSV.'});
    const limited=rows.length>=20;
    return patchJob(id,{status:'succeeded',entries,raw:rows.length,limited,partial,costUsd:typeof run.usageTotalUsd==='number'?run.usageTotalUsd:undefined,message:limited?'The 20-reply safety limit was reached. This list may be incomplete; import a full CSV before drawing.':partial?'Partial results — some replies may be missing. The collector reached the three-minute limit; review the collected accounts before spinning.':'Available direct replies retrieved. Hidden, deleted or unavailable replies may be missing.'});
}
