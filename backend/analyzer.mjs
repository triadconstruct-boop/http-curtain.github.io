const STOP = new Set("a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in into is it its may might more most must no nor not of on or our ours she should so than that the their theirs them then there these they this those to too under up us was we were what when where which who why will with would you your".split(/\s+/));
const CONTRA = ["false","misleading","no evidence","without evidence","not true","untrue","debunk","refut","hoax","fabricat","incorrect","inaccurate","unfounded","baseless","denied","did not","does not","never happened","contrary to"];
const SUPPORT = ["confirmed","verified","evidence shows","records show","data show","study found","investigation found","documented","announced","acknowledged"];
const FACT_CHECK = ["factcheck.org","snopes.com","politifact.com","fullfact.org","leadstories.com","checkyourfact.com","factcheck.afp.com"];
const WIRES = ["reuters.com","apnews.com","afp.com","bloomberg.com"];
const SOCIAL = ["x.com","twitter.com","facebook.com","tiktok.com","instagram.com","reddit.com","4chan.org"];

const decode = (v="") => v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const clean = (v="") => decode(v).replace(/<script\b[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<svg\b[\s\S]*?<\/svg>/gi," ")
  .replace(/<nav\b[\s\S]*?<\/nav>/gi," ").replace(/<footer\b[\s\S]*?<\/footer>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const domainOf = raw => { try{return new URL(raw).hostname.toLowerCase().replace(/^www\./,"")}catch{return""} };
const normUrl = raw => {
  try {
    const u=new URL(raw); u.hash=""; u.hostname=u.hostname.toLowerCase().replace(/^www\./,"");
    for(const k of [...u.searchParams.keys()]) if(/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    u.pathname=u.pathname.replace(/\/$/,"")||"/"; return u.toString();
  } catch { return raw||"" }
};
const dateOf = value => {
  if(!value)return null;
  const c=String(value).match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  const d=c?new Date(`${c[1]}-${c[2]}-${c[3]}T${c[4]||"00"}:${c[5]||"00"}:00Z`):new Date(value);
  return Number.isNaN(d.valueOf())?null:d.toISOString();
};
const tokens = (v="") => (v.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)||[])
  .map(x=>x.replace(/’/g,"'")).filter(x=>x.length>2&&!STOP.has(x));
const termsFor = claim => {
  const f=new Map(); for(const w of tokens(claim))f.set(w,(f.get(w)||0)+1);
  return [...f].sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length).slice(0,14).map(x=>x[0]);
};
const overlap = (text,terms) => {
  if(!terms.length)return 0; const hay=new Set(tokens(text));
  return terms.filter(x=>hay.has(x)).length/terms.length;
};
const hasAny = (text,list) => {const l=text.toLowerCase();return list.some(x=>l.includes(x))};
const sentences = (text="") => clean(text).split(/(?<=[.!?])\s+|\s*[|•]\s*/)
  .map(x=>x.trim()).filter(x=>x.length>=35&&x.length<=700).slice(0,500);
const clip = (text,max=340) => {const v=clean(text);return v.length<=max?v:v.slice(0,max-1).replace(/\s+\S*$/,"")+"…"};
const xml = (block,tag) => decode(block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,"i"))?.[1]||"").trim();

async function get(url,options={},timeout=14000,max=750000,fetcher=fetch){
  const target=new URL(url);
  if(!/^https?:$/.test(target.protocol)||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(target.hostname))throw new Error("URL rejected");
  const response=await fetcher(target,{...options,redirect:"follow",signal:AbortSignal.timeout(timeout),headers:{
    "User-Agent":"YY-CURTAIN/1.0 evidence-research (+https://yyrv.net/http-curtain.github.io/)",
    Accept:"application/json, application/rss+xml, application/xml, text/html;q=0.8, */*;q=0.2",...(options.headers||{})
  }});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(Number(response.headers.get("content-length")||0)>max)throw new Error("Response too large");
  if(!response.body?.getReader)return{text:(await response.text()).slice(0,max),url:response.url||target.toString()};
  const reader=response.body.getReader(),parts=[];let size=0;
  while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();break}parts.push(value)}
  const joined=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let offset=0;
  for(const part of parts){joined.set(part,offset);offset+=part.byteLength}
  return{text:new TextDecoder().decode(joined),url:response.url||target.toString()};
}

function planFor(claim){
  const terms=termsFor(claim),core=terms.slice(0,9).join(" "),phrase=clean(claim).replace(/["()]/g," ").slice(0,180);
  return{terms,queries:[
    {id:"core",q:core||phrase},{id:"exact",q:phrase.length<150?`"${phrase}"`:core},
    {id:"refute",q:`${core} (false OR hoax OR debunked OR "no evidence" OR misleading)`},
    {id:"origin",q:`${core} ("first reported" OR "according to" OR leak OR study OR "press release")`}
  ]};
}
function source(raw){
  const url=normUrl(raw.url);
  return{id:"",title:clean(raw.title)||domainOf(url)||"Untitled source",url,canonicalUrl:normUrl(raw.canonicalUrl||url),
    domain:raw.domain||domainOf(url),publishedAt:dateOf(raw.publishedAt),author:clean(raw.author||""),
    publisher:clean(raw.publisher||""),provider:raw.provider,providerQuery:raw.providerQuery||"",
    language:raw.language||"",excerpt:clip(raw.excerpt||"",420),text:clean(raw.text||"").slice(0,80000),
    outbound:raw.outbound||[],retrievedAt:new Date().toISOString()};
}
async function gdelt(plan,fetcher){
  try{
    const q=plan.queries[0],params=new URLSearchParams({query:q.q,mode:"artlist",maxrecords:"250",format:"json",sort:"dateasc"});
    const {text}=await get(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`,{},18000,3000000,fetcher);
    const sources=(JSON.parse(text).articles||[]).map(a=>source({title:a.title,url:a.url,domain:a.domain,publishedAt:a.seendate,language:a.language,provider:"GDELT",providerQuery:"origin"}));
    return{name:"GDELT",sources,errors:[]};
  }catch(e){return{name:"GDELT",sources:[],errors:[e.message]}}
}
async function googleNews(plan,fetcher){
  const settled=await Promise.allSettled([plan.queries[0],plan.queries[2]].map(async q=>{
    const params=new URLSearchParams({q:q.q,hl:"en-US",gl:"US",ceid:"US:en"});
    const {text}=await get(`https://news.google.com/rss/search?${params}`,{},15000,1500000,fetcher);
    return[...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,100).map(m=>{
      const b=m[1],s=b.match(/<source(?:\s+url="([^"]+)")?>([\s\S]*?)<\/source>/i);
      return source({title:xml(b,"title").replace(/\s+-\s+[^-]+$/,""),url:xml(b,"link"),publishedAt:xml(b,"pubDate"),
        publisher:s?clean(s[2]):"",domain:s?.[1]?domainOf(s[1]):"",excerpt:xml(b,"description"),provider:"Google News",providerQuery:q.id});
    });
  }));
  return{name:"Google News",sources:settled.flatMap(x=>x.status==="fulfilled"?x.value:[]),errors:settled.filter(x=>x.status==="rejected").map(x=>x.reason?.message||"request failed")};
}
async function crossref(plan,fetcher){
  try{
    const params=new URLSearchParams({"query.bibliographic":plan.queries[0].q,rows:"30",select:"DOI,title,author,published,publisher,URL,type,abstract"});
    const{text}=await get(`https://api.crossref.org/works?${params}`,{},16000,1800000,fetcher);
    const list=JSON.parse(text).message?.items||[];
    return{name:"Crossref",errors:[],sources:list.map(i=>{
      const d=i.published?.["date-parts"]?.[0],date=d?`${d[0]}-${String(d[1]||1).padStart(2,"0")}-${String(d[2]||1).padStart(2,"0")}`:null;
      return source({title:i.title?.[0],url:i.URL||(i.DOI?`https://doi.org/${i.DOI}`:""),publishedAt:date,
        author:(i.author||[]).slice(0,4).map(x=>[x.given,x.family].filter(Boolean).join(" ")).join(", "),
        publisher:i.publisher,excerpt:i.abstract,provider:"Crossref",providerQuery:"scholarly",domain:"doi.org"});
    })};
  }catch(e){return{name:"Crossref",sources:[],errors:[e.message]}}
}
async function wikipedia(plan,fetcher){
  try{
    const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:plan.queries[0].q,gsrlimit:"12",prop:"extracts|info",exintro:"1",explaintext:"1",inprop:"url",format:"json",origin:"*"});
    const{text}=await get(`https://en.wikipedia.org/w/api.php?${params}`,{},15000,2000000,fetcher),json=JSON.parse(text);
    return{name:"Wikipedia",errors:[],sources:Object.values(json.query?.pages||{}).map(p=>source({title:p.title,url:p.fullurl,excerpt:p.extract,text:p.extract,provider:"Wikipedia",providerQuery:"reference",publisher:"Wikipedia"}))};
  }catch(e){return{name:"Wikipedia",sources:[],errors:[e.message]}}
}
function meta(html,keys){
  for(const key of keys){const e=key.replace(/[.*+?^$()|[\]\\{}]/g,"\\$&");
    const pats=[new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${e}["'][^>]+content=["']([^"']+)["'][^>]*>`,"i"),new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${e}["'][^>]*>`,"i")];
    for(const p of pats){const f=html.match(p)?.[1];if(f)return decode(f)}
  }return"";
}
function parsePage(html,url){
  const title=meta(html,["og:title","twitter:title"])||clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
  const author=meta(html,["author","article:author","byl"]),publisher=meta(html,["og:site_name","application-name"]);
  const publishedAt=meta(html,["article:published_time","datePublished","date","pubdate"])||html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1]||"";
  const canonical=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||url;
  let body=html.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ");
  body=body.match(/<article\b[\s\S]*?<\/article>/i)?.[0]||body;
  const outbound=[];for(const m of html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)){try{const u=normUrl(new URL(decode(m[1]),url).toString());if(/^https?:/i.test(u)&&!outbound.includes(u))outbound.push(u)}catch{}if(outbound.length>=120)break}
  return{title,author,publisher,publishedAt:dateOf(publishedAt),canonicalUrl:normUrl(canonical),text:clean(body).slice(0,80000),outbound};
}
function kindOf(s){
  const d=s.domain||domainOf(s.url),h=`${s.title} ${s.url}`.toLowerCase();
  if(FACT_CHECK.some(x=>d===x||d.endsWith("."+x))||/fact[ -]?check|factcheck|ap-fact-check|debunk|hoax/.test(h))return"FACT_CHECK";
  if(/\.gov$|\.gov\.|\.mil$|\.mil\.|court|legislat|parliament|congress/.test(d))return"PRIMARY_RECORD";
  if(s.provider==="Crossref"||d==="doi.org"||/journal|university|research|academy|science/.test(d))return"RESEARCH";
  if(/press[-_]?release|newsroom|prnewswire|businesswire|globenewswire/.test(h))return"PRESS_RELEASE";
  if(WIRES.some(x=>s.url.includes(x)))return"WIRE_REPORT";
  if(SOCIAL.some(x=>d.endsWith(x)))return"SOCIAL_POST";
  if(s.provider==="Wikipedia")return"REFERENCE";return"REPORTING";
}
const weightOf=k=>({PRIMARY_RECORD:1,RESEARCH:.9,FACT_CHECK:.82,WIRE_REPORT:.75,PRESS_RELEASE:.62,REPORTING:.55,REFERENCE:.42,SOCIAL_POST:.25})[k]||.4;
function bestExcerpt(s,terms){const a=sentences(`${s.title}. ${s.excerpt}. ${s.text}`);a.sort((x,y)=>overlap(y,terms)-overlap(x,terms));return clip(a[0]||s.excerpt||s.title,360)}
function classify(s,terms,claimNegated){
  const sample=`${s.title}. ${s.excerpt}. ${s.text.slice(0,30000)}`,relevant=sentences(sample).filter(x=>overlap(x,terms)>=Math.min(.5,3/Math.max(terms.length,1))),focus=relevant.slice(0,12).join(" ");
  const neg=hasAny(focus||sample.slice(0,2000),CONTRA)||relevant.some(line=>/\b(no|not|never|denies?|rejects?|cannot)\b|doesn't|don't|didn't|isn't|aren't|can't/i.test(line));
  const pos=hasAny(focus||sample.slice(0,2000),SUPPORT),attributed=/\b(according to|reportedly|sources? (?:said|say)|claims?|alleges?)\b/i.test(focus||sample.slice(0,2000));
  let relationship="CONTEXT",relationshipStrength="LOW";
  if(neg){relationship=claimNegated?"CONFIRMING":"CONTRADICTING";relationshipStrength=s.kind==="FACT_CHECK"||relevant.length>1?"HIGH":"MEDIUM"}
  else if(pos&&overlap(focus,terms)>=.25){relationship=claimNegated?"CONTRADICTING":"CONFIRMING";relationshipStrength=["PRIMARY_RECORD","RESEARCH"].includes(s.kind)?"HIGH":"MEDIUM"}
  else if(attributed||overlap(sample.slice(0,12000),terms)>=.25){relationship="REPEATS_CLAIM";relationshipStrength="MEDIUM"}
  return{...s,relationship,relationshipStrength,excerpt:bestExcerpt(s,terms)};
}
function shingles(text,n=5){const w=tokens(text).slice(0,1800),set=new Set();for(let i=0;i<=w.length-n;i+=2)set.add(w.slice(i,i+n).join(" "));return set}
function jaccard(a,b){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n)}
function genealogy(sources){
  const parent=sources.map((_,i)=>i),find=x=>parent[x]===x?x:(parent[x]=find(parent[x])),union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
  const titles=sources.map(x=>new Set(tokens(x.title))),bodies=sources.map(x=>shingles(`${x.title} ${x.text||x.excerpt}`)),edges=[],edgeKeys=new Set();
  const addEdge=(from,to,basis)=>{const key=from+"|"+to+"|"+basis;if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({from,to,basis})}};
  const urls=new Map(sources.map((x,i)=>[normUrl(x.canonicalUrl||x.url),i]));
  for(let i=0;i<sources.length;i++){
    for(const link of sources[i].outbound||[]){const t=urls.get(normUrl(link));if(t!==undefined&&t!==i){union(i,t);addEdge(sources[i].id,sources[t].id,"DIRECT_LINK")}}
    const prose=(sources[i].text||sources[i].excerpt||"").toLowerCase().slice(0,40000);
    for(let t=0;t<sources.length;t++){if(t===i)continue;const names=[sources[t].publisher,(sources[t].domain||"").split(".")[0]].map(x=>(x||"").toLowerCase().trim()).filter(x=>x.length>=5&&!/^(daily|media|news|press|times)$/.test(x));if(names.some(name=>prose.includes("according to "+name)||prose.includes("reported by "+name)||prose.includes("citing "+name))){union(i,t);addEdge(sources[i].id,sources[t].id,"NAMED_ATTRIBUTION")}}
    for(let j=i+1;j<sources.length;j++){
      if(normUrl(sources[i].canonicalUrl)===normUrl(sources[j].canonicalUrl)){union(i,j);addEdge(sources[j].id,sources[i].id,"SAME_CANONICAL");continue}
      const ts=jaccard(titles[i],titles[j]),bs=jaccard(bodies[i],bodies[j]);
      if(ts>=.72||bs>=.68){union(i,j);const old=(sources[i].publishedAt||"9999")<=(sources[j].publishedAt||"9999")?i:j,newer=old===i?j:i;addEdge(sources[newer].id,sources[old].id,bs>=.68?"NEAR_DUPLICATE_TEXT":"NEAR_DUPLICATE_TITLE")}
    }
  }
  const groups=new Map();sources.forEach((s,i)=>{const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(s)});
  const clusters=[...groups.values()].map(m=>{m.sort((a,b)=>(a.publishedAt||"9999").localeCompare(b.publishedAt||"9999"));return{root:m[0],members:m.map(x=>x.id),domains:[...new Set(m.map(x=>x.domain))],basis:m.length===1?"INDEPENDENT_RECOVERED_ITEM":"CITATION_OR_SIMILARITY_DEPENDENCY"}}).sort((a,b)=>(a.root.publishedAt||"9999").localeCompare(b.root.publishedAt||"9999"));
  clusters.forEach((cluster,index)=>{cluster.id=`ORIGIN-${String(index+1).padStart(2,"0")}`});
  const dated=sources.filter(x=>x.publishedAt).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
  return{clusters,edges,earliestRecovered:dated[0]||sources[0]||null};
}
function assumptions(claim){
  const l=claim.toLowerCase(),out=[],add=(name,reason,test)=>out.push({name,reason,test});
  if(/because|caus|led to|resulted in|due to|responsible for/.test(l))add("Causation","The claim treats an association or sequence as causal.","Look for timing, mechanism, controls, and plausible confounders.");
  if(/secret|cover.?up|coordinate|plot|agenda|they want|planned|intentional|deliberate/.test(l))add("Coordinated intent","The claim assigns shared knowledge or intent to multiple actors.","Find contemporaneous communications, instructions, payments, or independently authenticated records.");
  if(/\b(all|always|never|every|none|only|entire)\b/.test(l))add("Absolute scope","The claim uses a universal or exclusive term.","One verified exception can defeat the absolute wording.");
  if(/\b(leak|anonymous|insider|sources say|they say|reportedly|rumor)\b/.test(l))add("Unspecified provenance","The claim depends on unattributed or indirectly attributed information.","Identify the first publisher, original artifact, custody, and authentication method.");
  if(/\b(no coverage|silence|ignored|suppressed|censored|deleted)\b/.test(l))add("Absence as evidence","The claim may treat missing coverage or records as proof.","Test ordinary explanations and locate affirmative evidence independent of the absence.");
  if(/\b\d+(?:\.\d+)?%|\b\d{2,}\b/.test(l))add("Measurement","The claim contains a quantity whose denominator or method may be unstated.","Recover the dataset, denominator, collection period, exclusions, and uncertainty.");
  if(/\b(will|soon|next|future|imminent|by 20\d\d)\b/.test(l))add("Time horizon","The claim predicts an outcome without necessarily fixing a deadline.","Record a specific observable outcome and deadline before evaluating it.");
  add("Source independence","Repeated publication does not establish independent corroboration.","Trace citations and copied language back to distinct firsthand records.");
  add("Stable meaning","Key terms may change meaning across sources or retellings.","Define actors, event, place, time, and threshold in falsifiable terms.");return out;
}
function alternatives(claim){
  const l=claim.toLowerCase(),out=[
    {name:"Shared-source amplification",explanation:"Many pages may repeat one report, press release, post, or paper.",test:"Collapse near-duplicate wording and citations; count origin clusters rather than URLs."},
    {name:"Incomplete initial report",explanation:"An early accurate fragment may have acquired unsupported details during retelling.",test:"Compare the earliest recovered version with later versions line by line."},
    {name:"Selection or reporting bias",explanation:"Visible examples may be easier to publish, search, remember, or measure than missing cases.",test:"Define a denominator and search systematically for counterexamples."},
    {name:"Terminology mismatch",explanation:"Sources may use the same word for different events, people, standards, or periods.",test:"Normalize names, dates, locations, and definitions before merging records."}
  ];
  if(/because|caus|led to|resulted|due to|responsible/.test(l))out.push({name:"Confounding or reverse causation",explanation:"A third factor or reversed sequence may explain the association.",test:"Compare timelines, controls, mechanisms, and matched cases."});
  if(/secret|cover.?up|coordinate|plot|agenda|planned|deliberate/.test(l))out.push({name:"Aligned incentives without coordination",explanation:"Actors can behave similarly because they face similar incentives without sharing a plan.",test:"Find communication or resource links that distinguish coordination from parallel behavior."});
  if(/leak|anonymous|insider|rumor|post/.test(l))out.push({name:"Fabricated or misattributed origin",explanation:"The alleged original artifact or speaker may be false, altered, or incorrectly identified.",test:"Authenticate the artifact and establish custody before relying on downstream discussion."});return out;
}
function predictionTests(claim,g){
  const l=claim.toLowerCase(),out=[
    {test:"Independent-origin test",wouldSupport:"Two or more origin clusters lead to separate firsthand records that agree on material details.",wouldWeaken:"Most coverage collapses to one unattributed or circular source."},
    {test:"Specificity test",wouldSupport:"Recovered records agree on named actors, dates, locations, mechanism, and measurable outcome.",wouldWeaken:"The claim survives only while its terms remain vague or shift."},
    {test:"Counterevidence test",wouldSupport:"The claim explains verified contrary cases without ad hoc exceptions.",wouldWeaken:"A verified counterexample defeats a necessary or absolute part of the claim."}
  ];
  if(/secret|cover.?up|coordinate|plot|planned|deliberate/.test(l))out.push({test:"Coordination footprint",wouldSupport:"Authenticated communications, shared funding, tasking, or synchronized operational records appear.",wouldWeaken:"Similar behavior is explained by public information and independent incentives."});
  if(/because|caus|led to|resulted|responsible/.test(l))out.push({test:"Mechanism and timing",wouldSupport:"The proposed cause consistently precedes the effect and predicts new cases.",wouldWeaken:"The effect precedes the proposed cause or disappears under controls."});
  if(g.clusters.length===1)out.push({test:"Single-origin stress test",wouldSupport:"The recovered root contains authenticated primary evidence.",wouldWeaken:"The root contains only assertion and later sources add no independent evidence."});return out;
}
function incentive(sources,terms,mode){
  const marker=mode==="benefit"?/\b(benefit|profit|gain|advantage|revenue|funding|sales|votes|power|market share)\b/i:/\b(lose|loss|harm|cost|burden|damage|risk|disadvantage|penalty)\b/i,out=[];
  for(const s of sources)for(const line of sentences(s.text||s.excerpt))if(marker.test(line)&&overlap(line,terms)>=.15){out.push({passage:clip(line,280),sourceId:s.id});if(out.length>=5)return out}return out;
}
function recoveredPredictions(sources,terms){
  const future=["predict","forecast","will ","expected to","projected to","by 20"],failed=["failed","did not occur","did not happen","never materialized","proved wrong","missed"],out=[];
  for(const s of sources)for(const line of sentences(s.text||s.excerpt)){if(!hasAny(line,future)||overlap(line,terms)<.15)continue;const years=[...line.matchAll(/\b(20\d{2})\b/g)].map(x=>+x[1]);out.push({prediction:clip(line,300),sourceId:s.id,status:hasAny(line,failed)?"REPORTED_FAILED":years.some(y=>y<new Date().getUTCFullYear())?"PAST_DUE_REQUIRES_CHECK":"OPEN_OR_UNDATED"});if(out.length>=8)return out}return out;
}
function gaps(sources){
  const d=sources.filter(x=>x.publishedAt).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)),out=[];
  for(let i=1;i<d.length;i++){const days=Math.floor((new Date(d[i].publishedAt)-new Date(d[i-1].publishedAt))/86400000);if(days>=45)out.push({days,from:d[i-1].publishedAt,to:d[i].publishedAt,beforeSourceId:d[i-1].id,afterSourceId:d[i].id})}
  return out.sort((a,b)=>b.days-a.days).slice(0,8);
}
function missing(sources,g,terms){
  const out=[],k=new Set(sources.map(x=>x.kind)),r=new Set(sources.map(x=>x.relationship));
  if(!k.has("PRIMARY_RECORD"))out.push("No government, court, legislative, or comparable primary record was recovered.");
  if(!k.has("RESEARCH"))out.push("No directly relevant scholarly record was recovered.");
  if(!r.has("CONTRADICTING"))out.push("No explicit countercase was recovered; the refutation search remains incomplete.");
  if(!r.has("CONFIRMING"))out.push("No explicit evidentiary confirmation was recovered. Repetition was not counted.");
  if(g.clusters.length<2)out.push("Independent corroboration is missing: coverage collapses to one recovered origin cluster.");
  if(!g.earliestRecovered?.publishedAt)out.push("The earliest recovered item has no machine-readable publication date.");
  if(!g.earliestRecovered?.author)out.push("The earliest recovered item exposes no verified individual author in its metadata.");
  if(terms.length<3)out.push("The claim is too broad for a discriminating search. Add names, dates, places, or an observable event.");
  if(!out.length)out.push("Primary artifacts still require manual authentication; automated retrieval cannot establish custody or authenticity.");return out;
}
function dedupe(raw){
  const map=new Map();for(const s of raw){if(!s.url)continue;const key=normUrl(s.canonicalUrl||s.url),p=map.get(key);
    if(!p)map.set(key,s);else{p.title=p.title.length>=s.title.length?p.title:s.title;p.excerpt=p.excerpt.length>=s.excerpt.length?p.excerpt:s.excerpt;p.publishedAt||=s.publishedAt;p.author||=s.author;p.publisher||=s.publisher;p.provider=[...new Set(`${p.provider},${s.provider}`.split(","))].join(",")}}
  return[...map.values()];
}
async function enrich(raw,terms,fetcher){
  const ranked=[...raw].sort((a,b)=>overlap(`${b.title} ${b.excerpt}`,terms)-overlap(`${a.title} ${a.excerpt}`,terms)).slice(0,240),chosen=[],domains=new Map();
  for(const s of ranked){const n=domains.get(s.domain)||0;if(n>=3)continue;chosen.push(s);domains.set(s.domain,n+1);if(chosen.length>=36)break}
  await Promise.allSettled(chosen.map(async s=>{if(s.provider==="Wikipedia"||s.provider==="Crossref"||s.provider.includes("Google News")||!s.url)return;try{const f=await get(s.url,{headers:{Accept:"text/html,application/xhtml+xml"}},11000,900000,fetcher),p=parsePage(f.text,f.url);s.title=p.title||s.title;s.author=p.author||s.author;s.publisher=p.publisher||s.publisher;s.publishedAt=p.publishedAt||s.publishedAt;s.canonicalUrl=p.canonicalUrl||s.canonicalUrl;s.text=p.text||s.text;s.outbound=p.outbound;const d=domainOf(s.canonicalUrl||s.url);if(d&&d!=="news.google.com")s.domain=d}catch(e){s.fetchError=e.message}}));return ranked;
}
const pub=s=>({id:s.id,title:s.title,url:s.url,canonicalUrl:s.canonicalUrl,domain:s.domain,publishedAt:s.publishedAt,author:s.author,publisher:s.publisher,provider:s.provider,kind:s.kind,relationship:s.relationship,relationshipStrength:s.relationshipStrength,excerpt:s.excerpt,fetchError:s.fetchError||null});
function statusFor(sources,g){
  const c=sources.filter(x=>x.relationship==="CONFIRMING"),x=sources.filter(x=>x.relationship==="CONTRADICTING"),sc=c.filter(x=>["PRIMARY_RECORD","RESEARCH","FACT_CHECK"].includes(x.kind)),sx=x.filter(x=>["PRIMARY_RECORD","RESEARCH","FACT_CHECK"].includes(x.kind));let s="UNRESOLVED";
  if(sc.length&&sx.length)s="CONTESTED";else if(sx.length>=2&&!sc.length)s="CONTRADICTED_IN_RETRIEVED_RECORD";else if(sc.length>=2&&!sx.length)s="SUPPORTED_IN_RETRIEVED_RECORD";else if(c.length>x.length&&c.length>=2)s="PROVISIONALLY_SUPPORTED";else if(x.length>c.length&&x.length>=2)s="PROVISIONALLY_CONTRADICTED";
  if(g.clusters.length<=1&&sources.length>3)s+="_SINGLE_ORIGIN";return s;
}

export async function analyzeClaim(claim,{fetcher=fetch}={}){
  const started=Date.now(),plan=planFor(claim),providers=await Promise.all([gdelt(plan,fetcher),googleNews(plan,fetcher),crossref(plan,fetcher),wikipedia(plan,fetcher)]);
  let sources=await enrich(dedupe(providers.flatMap(x=>x.sources)),plan.terms,fetcher);
  const threshold=Math.min(.5,Math.max(.18,2/Math.max(plan.terms.length,1)));
  sources=sources.filter(s=>overlap(`${s.title} ${s.excerpt} ${s.text.slice(0,10000)}`,plan.terms)>=threshold);
  sources.forEach((s,i)=>{s.id=`SRC-${String(i+1).padStart(3,"0")}`;s.kind=kindOf(s);s.weight=weightOf(s.kind)});
  const neg=/\b(not|never|no|false)\b|doesn't|didn't/i.test(claim);sources=sources.map(s=>classify(s,plan.terms,neg));
  const claimBearing=sources.filter(x=>x.relationship!=="CONTEXT"),g=genealogy(claimBearing.length?claimBearing:sources),confirming=sources.filter(x=>x.relationship==="CONFIRMING"),contradicting=sources.filter(x=>x.relationship==="CONTRADICTING"),repeats=sources.filter(x=>x.relationship==="REPEATS_CLAIM"),domains=new Set(sources.map(x=>x.domain).filter(Boolean)),first=g.earliestRecovered;
  const weight=sources.reduce((n,x)=>n+(x.relationship==="CONTEXT"?.25:x.weight),0),coverage=Math.min(100,Math.round(weight*5+domains.size*2)),independence=claimBearing.length?Math.round(100*g.clusters.length/claimBearing.length):0,contradiction=confirming.length+contradicting.length?Math.round(100*contradicting.length/(confirming.length+contradicting.length)):0,citations=g.edges.filter(x=>x.basis==="DIRECT_LINK"||x.basis==="NAMED_ATTRIBUTION").length;
  return{schemaVersion:1,engine:{name:"CURTAIN deterministic evidence engine",version:"1.0.0",generativeAI:false},claim,generatedAt:new Date().toISOString(),elapsedMs:Date.now()-started,
    assessment:{status:statusFor(sources,g),method:"Rule-based retrieval, provenance, similarity, stance-marker and source-type analysis."},
    scores:{coverage,independence,contradiction,sources:sources.length,domains:domains.size,originClusters:g.clusters.length},
    interpretation:{headline:sources.length?`${sources.length} relevant records across ${domains.size} domains collapse into ${g.clusters.length} recoverable origin cluster${g.clusters.length===1?"":"s"}.`:"No relevant public records were recovered from the available indexes.",observations:[
      `${confirming.length} records contain confirming language; ${contradicting.length} contain contradictory language; ${repeats.length} repeat the claim without establishing it.`,
      first?`The earliest machine-dated item recovered is ${first.domain||first.publisher||"an unidentified publisher"} from ${first.publishedAt?.slice(0,10)||"an unknown date"}.`:"No dated origin candidate was recovered.",
      `${citations} citation or named-attribution dependencies and ${g.edges.length-citations} canonical or text-similarity dependencies were detected.`,
      "Relationship labels describe wording in retrieved sources. They are not a truth verdict or manual authentication."
    ]},
    evidence:{confirming:confirming.slice(0,20).map(pub),contradicting:contradicting.slice(0,20).map(pub),repetitions:repeats.slice(0,20).map(pub),
      knownFacts:[...sources].filter(x=>["PRIMARY_RECORD","RESEARCH","FACT_CHECK"].includes(x.kind)).sort((a,b)=>b.weight-a.weight).slice(0,10).map(x=>({finding:x.excerpt,sourceId:x.id,kind:x.kind})),
      knownHoaxes:sources.filter(x=>x.relationship==="CONTRADICTING"&&(x.kind==="FACT_CHECK"||(x.kind==="REFERENCE"&&/hoax|conspiracy theory|misinformation|false claim|urban legend/i.test(x.title+" "+x.excerpt)))).slice(0,12).map(pub),missingEvidence:missing(sources,g,plan.terms)},
    redTeam:{unsupportedAssumptions:assumptions(claim),competingExplanations:alternatives(claim)},
    genealogy:{firstClaimant:first?{author:first.author||null,publisher:first.publisher||first.domain,qualification:"Earliest recovered machine-dated source; not proof of first-ever authorship.",sourceId:first.id}:null,earliestRecovered:first?pub(first):null,
      clusters:g.clusters.map(c=>({...c,root:pub(c.root)})),dependencies:g.edges,propagation:sources.filter(x=>x.publishedAt).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)).map(x=>({sourceId:x.id,date:x.publishedAt,domain:x.domain,relationship:x.relationship})),coverageGaps:gaps(sources)},
    incentives:{whoBenefits:incentive(sources,plan.terms,"benefit"),whoLoses:incentive(sources,plan.terms,"loss"),qualification:"Only explicit benefit or loss language is shown; CURTAIN does not infer motive from benefit alone."},
    predictions:{tests:predictionTests(claim,g),recoveredPredictions:recoveredPredictions(sources,plan.terms)},sourceIndex:sources.map(pub),
    retrieval:{queryTerms:plan.terms,providers:providers.map(x=>({name:x.name,recovered:x.sources.length,errors:x.errors})),limitations:[
      "Search covers indexed public material returned by the configured providers, not the entire internet.",
      "Private, deleted, paywalled, blocked, image-only, and unindexed sources may be absent.",
      "Near-duplicate clustering indicates likely dependence; it does not prove coordination or common authorship.",
      "Automated source typing and stance detection require human review before consequential use."
    ]}};
}
export const internals={termsFor,overlap,kindOf,genealogy,assumptions,alternatives,parsePage,dateOf};
