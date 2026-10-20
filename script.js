const $ = id => document.getElementById(id);
const F = ["Ground Floor", "First Floor", "Second Floor", "Third Floor"];
const STORES = [
  ["Zara","Nike","Adidas","Apple Store","Starbucks","Pharmacy","Bookstore","Sephora","Uniqlo"],
  ["Levis","Puma","Fabindia","Samsung","Food Court","Croma","Titan","Lenskart","Gift Shop"],
  ["Cinema","Arcade","Bowling","Gaming Zone","Escape Room","Karaoke","Electronics Hub","Mobile Store","Laptop Hub"],
  ["Furniture","Jewellery","Toy Store","Salon","Gym","Bank","Clinic","Rooftop Cafe","Kids Zone"]];
const X = [170,360,650,830], Y = [170,300,430];   // junction grid (uneven spacing = uneven distances)
// vertical corridors removed per floor [column,row] so every floor has a different maze of routes
const REM = [[[1,0],[2,1]], [[2,0],[1,1]], [[1,0],[2,0]], [[1,1],[2,1]]];

/* ---------- GRAPH ---------- */
const nodes = {}, adj = {};
function N(id,f,x,y,label,type,g){ nodes[id]={id,f,x,y,label,type,g}; adj[id]=[]; }
function E(a,b,kind="walk",w=null,crowd=false){
  if(w==null) w=Math.round(Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)*0.2);
  adj[a].push({to:b,w,kind,crowd}); adj[b].push({to:a,w,kind,crowd});
}
N("0:EN",0,95,300,"Main Entrance","entrance");
for(let f=0;f<F.length;f++){
  const J=(r,c)=>`${f}:j${r}${c}`;
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){
    const sp = r==1&&c==1 ? ["Escalator","escalator"] : r==1&&c==2 ? ["Lift","lift"]
             : ["Junction "+String.fromCharCode(65+r*4+c),"junction"];
    N(J(r,c),f,X[c],Y[r],sp[0],sp[1]);
  }
  N(f+":ST",f,905,300,"Stairs","stairs");
  // horizontal corridors: a shop door sits in the middle of each segment
  for(let r=0;r<3;r++)for(let i=0;i<3;i++){
    const id=`${f}:s${r}${i}`, xm=(X[i]+X[i+1])/2, w=X[i+1]-X[i]-40;
    const y0 = r==0?70 : r==2?454 : (i==1?322:194), h = r==1?84:76;
    N(id,f,xm,Y[r],STORES[f][r*3+i],"store",[xm-w/2,y0,w,h]);
    const crowded = r===(f%2===0?1:0) && i===1;
    E(J(r,i),id,"walk",null,crowded); E(id,J(r,i+1),"walk",null,crowded);
  }
  // vertical corridors (some removed)
  for(let c=0;c<4;c++)for(let r=0;r<2;r++)
    if(!REM[f].some(([cc,rr])=>cc===c&&rr===r)) E(J(r,c),J(r+1,c));
  E(f+":ST",J(1,3));
}
E("0:EN","0:j10");
for(let f=0;f<F.length-1;f++){          // between floors
  E(f+":ST",(f+1)+":ST","stairs",25);
  E(f+":j11",(f+1)+":j11","escalator",18);
  E(f+":j12",(f+1)+":j12","lift",30);
}

/* ---------- MIN-HEAP (PRIORITY QUEUE) ---------- */
class Heap{
  constructor(){this.a=[];}
  get size(){return this.a.length;}
  push(x){const a=this.a;a.push(x);let i=a.length-1;
    while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
  pop(){const a=this.a,top=a[0],last=a.pop();
    if(a.length){a[0]=last;let i=0;
      for(;;){let m=i,l=2*i+1,r=l+1;
        if(l<a.length&&a[l][0]<a[m][0])m=l;
        if(r<a.length&&a[r][0]<a[m][0])m=r;
        if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}
    return top;}
}

/* ---------- DIJKSTRA ---------- */
function ecost(e,op){                     // cost of an edge under chosen options (null = blocked)
  if(op.acc&&(e.kind==="stairs"||e.kind==="escalator"))return null;
  return e.w*(op.crowd&&e.crowd?3:1);
}
function dijkstra(s,t,op){
  const dist={},prev={},done=new Set(),steps=[];let relax=0;
  for(const k in nodes)dist[k]=Infinity;
  dist[s]=0;
  const h=new Heap();h.push([0,s]);
  while(h.size){
    const [d,u]=h.pop();
    if(done.has(u))continue;              // stale heap entry
    done.add(u);
    const step={u,d,rel:0};steps.push(step);
    if(u===t)break;
    for(const e of adj[u]){
      const c=ecost(e,op);if(c===null)continue;
      relax++;
      if(d+c<dist[e.to]){dist[e.to]=d+c;prev[e.to]=u;h.push([d+c,e.to]);step.rel++;}
    }
  }
  const path=[];
  if(dist[t]<Infinity)for(let c=t;c;c=prev[c])path.unshift(c);
  return{path,cost:dist[t],steps,relax};
}

/* ---------- BELLMAN-FORD (for comparison) ---------- */
function bellman(s,t,op){
  const dist={},prev={},steps=[];let checks=0,passes=0,successful=0;
  for(const k in nodes)dist[k]=Infinity;
  dist[s]=0;
  const V=Object.keys(nodes).length;
  for(let i=0;i<V-1;i++){
    passes++;let changed=false,improved=0;
    for(const u in adj)for(const e of adj[u]){
      const c=ecost(e,op);if(c===null)continue;
      checks++;
      if(dist[u]!==Infinity&&dist[u]+c<dist[e.to]){
        dist[e.to]=dist[u]+c;prev[e.to]=u;changed=true;improved++;successful++;
      }
    }
    // A compact pass trace makes Bellman–Ford's repeated scans visible in the log.
    steps.push({u: s, d: 0, rel: improved, pass: passes, checks});
    if(!changed)break;
  }
  const path=[];
  if(dist[t]<Infinity){
    let c=t,guard=0;while(c&&guard++<=V){path.unshift(c);if(c===s)break;c=prev[c];}
    if(path[0]!==s)path.length=0;
  }
  return{path,cost:dist[t],checks,passes,relax:checks,successful,steps,dist};
}
function currentAlgorithm(){return algorithm;}
function highlightAlgorithm(){
  document.querySelectorAll('.complexity-card').forEach(card=>card.classList.remove('selected-algorithm','primary'));
  $(algorithm==='dijkstra'?'dijkstraCard':'bellmanCard').classList.add('selected-algorithm','primary');
  $('nvLabel').textContent=algorithm==='dijkstra'?'NODES VISITED':'PASSES';
  $('traceHeading').textContent=algorithm==='dijkstra'?'Dijkstra trace (priority queue pops)':'Bellman–Ford trace (edge-scan passes)';
}
function activeResult(s,t,op){return currentAlgorithm()==='dijkstra'?dijkstra(s,t,op):bellman(s,t,op);}
function compare(s,t,r){
  const op=o(),selected=currentAlgorithm(),other=selected==='dijkstra'?'bellman':'dijkstra';
  const alt=other==='dijkstra'?dijkstra(s,t,op):bellman(s,t,op);
  const V=Object.keys(nodes).length,Ed=Object.values(adj).reduce((a,l)=>a+l.length,0)/2;
  const row=(a,b,c,d)=>`<tr><td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td></tr>`;
  const d=dijkstra(s,t,op),bf=bellman(s,t,op);
  $('cmp').innerHTML=`<div>Graph: V = ${V} nodes, E = ${Ed} edges</div>
    <table><tr><th>Algorithm</th><th>Cost found</th><th>Work counted</th><th>Complexity</th></tr>`+
    row('Dijkstra',d.cost,d.relax,'O((V+E) log V)')+
    row('Bellman–Ford',bf.cost,`${bf.checks} checks (${bf.passes} passes)`,'O(V × E)')+`</table>
    <div>Both algorithms should find the same minimum cost on this graph. Their work counts differ because Dijkstra uses a priority queue, while Bellman–Ford repeatedly scans edges.</div>`;
  const same=d.cost===bf.cost;
  const altWork=other==='dijkstra'?`${alt.relax} edge relaxations`:`${alt.checks} edge checks across ${alt.passes} passes`;
  $('bfResult').innerHTML=`<strong>Alternate algorithm result — ${other==='dijkstra'?'Dijkstra':'Bellman–Ford'}</strong>
    <p><span class="bf-status">${other==='dijkstra'?'Dijkstra':'Bellman–Ford'} minimum cost: ${alt.cost}</span>.
    The selected ${selected==='dijkstra'?'Dijkstra':'Bellman–Ford'} result is ${r.cost}; the alternate algorithm reports ${alt.cost} (${altWork}).
    ${same?'Both agree on the shortest-path cost, as expected for the same graph with non-negative edge weights.':'The costs differ; check the route calculation because both algorithms should agree for this graph.'}</p>`;
  highlightAlgorithm();
}
/* ---------- STATE & RENDER ---------- */
let cur=0,run=0,algorithm='dijkstra';
let st={explored:new Set(),path:[],cur:null,marker:"0:EN"};
const o=()=>({acc:$("acc").checked,crowd:$("crowd").checked});

function render(){
  const f=cur,S=$("ss").value,D=$("sd").value,opt=o();
  const here=Object.values(nodes).filter(n=>n.f===f);
  let h=`<rect class="wall" x="60" y="50" width="880" height="500" rx="16"/><text class="ft" x="500" y="34">${F[f].toUpperCase()}</text>`;
  let cor="",cw="",weightLabels="";
  here.forEach(a=>adj[a.id].forEach(e=>{const b=nodes[e.to];
    if(b.f===f&&a.id<b.id){
      const l=`x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
      cor+=`<line class="cor" ${l}/>`;
      if(opt.crowd&&e.crowd)cw+=`<line class="cw" ${l}/>`;
      const penalty=opt.crowd&&e.crowd;
      const shownWeight=ecost(e,opt);
      let mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      // Keep labels close to their edge and gently stagger neighbouring short segments.
      const dx=b.x-a.x, dy=b.y-a.y;
      if(Math.abs(dy)<1){
        my += (Math.round(mx/65)%2===0 ? -10 : 10);
      } else if(Math.abs(dx)<1){
        mx += (Math.round(my/65)%2===0 ? -10 : 10);
      } else {
        const len=Math.hypot(dx,dy)||1;
        mx+=(-dy/len)*8; my+=(dx/len)*8;
      }
      const labelClass=penalty?"edge-label penalty":"edge-label";
      const bgClass=penalty?"edge-label-bg penalty":"edge-label-bg";
      weightLabels+=`<rect class="${bgClass}" x="${mx-15}" y="${my-7}" width="30" height="14" rx="5"/>`+
        `<text class="${labelClass}" x="${mx}" y="${my+.5}">${shownWeight}m</text>`;
    }}));
  h+=cor+cw+weightLabels;
  here.filter(n=>n.type==="store").forEach(n=>{const [x,y,w,hh]=n.g;
    h+=`<rect class="store${n.id===S?" s":""}${n.id===D?" d":""}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="8"/>`+
       `<text class="sl" x="${x+w/2}" y="${y+hh/2+5}">${n.label}</text>`;});
  const p=st.path;
  for(let i=0;i<p.length-1;i++){const a=nodes[p[i]],b=nodes[p[i+1]];
    if(a.f===f&&b.f===f)h+=`<line class="route" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    else if(a.f!==b.f){
      if(a.f===f)h+=`<text class="badge" x="${a.x}" y="${a.y-22}">${b.f>a.f?"&#9650; up":"&#9660; down"}</text>`;
      if(b.f===f)h+=`<text class="badge" x="${b.x}" y="${b.y-22}">arrive</text>`;}}
  here.forEach(n=>{const c=(st.explored.has(n.id)?" ex":"")+(st.cur===n.id?" cu":"");
    if(["stairs","escalator","lift"].includes(n.type)){
      h+=`<rect class="cn${c}" x="${n.x-30}" y="${n.y-11}" width="60" height="22" rx="6"/><text class="ct" x="${n.x}" y="${n.y+4}">${n.label}</text>`;
    } else{
      h+=`<circle class="nd${c}" cx="${n.x}" cy="${n.y}" r="${n.type==="store"?5:8}"/>`;
      if(n.type==="junction")h+=`<text class="nl" x="${n.x+13}" y="${n.y-9}">${n.label.slice(-1)}</text>`;
      if(n.type==="entrance")h+=`<text class="nl" x="${n.x-35}" y="${n.y-16}" style="text-anchor:start">${n.label}</text>`;}});
  $("layer").innerHTML=h;
  F.forEach((_,i)=>{const c=[...st.explored].filter(id=>nodes[id].f===i).length;
    const b=$("bd"+i);b.textContent=c;b.style.display=c?"inline":"none";});
  moveMarker();
}
function moveMarker(){
  const n=nodes[st.marker],m=$("me");
  m.style.display=n.f===cur?"block":"none";
  m.style.transform=`translate(${n.x}px,${n.y}px)`;
}
function setFloor(f){
  cur=f;
  document.querySelectorAll("#tabs button").forEach((b,i)=>b.classList.toggle("on",i===f));
  render();
}

/* ---------- UI HELPERS ---------- */
function fill(sel,entrance){
  sel.innerHTML=F.map((name,f)=>{
    const opts=Object.values(nodes).filter(n=>n.f===f&&(n.type==="store"||(entrance&&n.type==="entrance")))
      .map(n=>`<option value="${n.id}">${n.label}</option>`).join("");
    return `<optgroup label="${name}">${opts}</optgroup>`;}).join("");
}
function resetView(){
  run++;
  st={explored:new Set(),path:[],cur:null,marker:$("ss").value};
  ["dist","time","nv","rx"].forEach(i=>$(i).textContent="-");
  $("dir").innerHTML="";$("log").innerHTML="";$("cmp").textContent="Run a route to compare.";
  $("msg").textContent="Choose a start and destination, then press Find Shortest Route.";
  setFloor(nodes[st.marker].f);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=s=>s<60?Math.round(s)+" s":Math.floor(s/60)+" min "+Math.round(s%60)+" s";
function directions(p){
  return p.slice(1).map((id,i)=>{
    const a=nodes[p[i]],b=nodes[id],e=adj[a.id].find(x=>x.to===id);
    if(a.f!==b.f)return `Take the ${b.type} ${b.f>a.f?"up":"down"} to the ${F[b.f]}`;
    return i===p.length-2?`Arrive at ${b.label} (${e.w} m)`:`Walk to ${b.label} (${e.w} m)`;});
}

/* ---------- MAIN SIMULATION ---------- */
async function go(){
  const s=$("ss").value,t=$("sd").value;
  resetView();
  highlightAlgorithm();
  const tok=run;
  if(s===t){$("msg").textContent="Start and destination are the same place.";return;}
  const r=activeResult(s,t,o()),sp=+$("speed").value;
  $("msg").textContent=(algorithm==='dijkstra'?"Dijkstra is exploring nearest locations with a priority queue...":"Bellman–Ford is repeatedly scanning graph edges...");
  for(let i=0;i<r.steps.length;i++){          // 1) animate exploration
    if(tok!==run)return;
    const x=r.steps[i];
    st.explored.add(x.u);st.cur=x.u;
    if(nodes[x.u].f!==cur)setFloor(nodes[x.u].f);else render();
    $("nv").textContent=i+1;
    const li=document.createElement("li");
    li.textContent=algorithm==='dijkstra'?`#${i+1} pop ${nodes[x.u].label} [${nodes[x.u].f?"F"+nodes[x.u].f:"G"}]  d=${x.d}  relaxed ${x.rel}`:`Pass ${x.pass}: scanned ${x.checks} edges so far; ${x.rel} distance updates in this pass`;
    $("log").appendChild(li);$("log").scrollTop=1e9;
    if(sp)await sleep(sp);
  }
  st.cur=null;
  if(!r.path.length){$("msg").textContent="No route found with the selected options.";render();return;}
  st.path=r.path;                              // 2) show results
  let phys=0;
  for(let i=0;i<r.path.length-1;i++)phys+=adj[r.path[i]].find(e=>e.to===r.path[i+1]).w;
  $("dist").textContent=phys+" m";
  $("time").textContent=fmt(phys/1.3);
  $("rx").textContent=algorithm==='dijkstra'?r.relax:r.checks;
  $("msg").innerHTML=`<b>${algorithm==='dijkstra'?"Dijkstra":"Bellman–Ford"}</b> route found: <b>${nodes[s].label}</b> to <b>${nodes[t].label}</b>`+
    (o().crowd?` (weighted cost ${r.cost})`:"")+".";
  $("dir").innerHTML=directions(r.path).map(d=>`<li>${d}</li>`).join("");
  compare(s,t,r);
  render();
  for(const id of r.path){                     // 3) walk the route
    if(tok!==run)return;
    if(nodes[id].f!==cur)setFloor(nodes[id].f);
    st.marker=id;moveMarker();
    await sleep(450);
  }
}


/* ---------- INSTANT RESULT (same algorithm, no animation delay) ---------- */
async function goInstant(){
  const s=$("ss").value,t=$("sd").value;
  resetView();
  highlightAlgorithm();
  const tok=run;
  if(s===t){$("msg").textContent="Start and destination are the same place.";return;}
  const r=activeResult(s,t,o());
  $("msg").textContent=(algorithm==='dijkstra'?"Dijkstra route calculated. Walking the route...":"Bellman–Ford route calculated. Walking the route...");
  // Skip exploration animation, but retain the explored set and final route.
  r.steps.forEach(x=>st.explored.add(x.u));
  st.cur=null;
  if(!r.path.length){
    $("msg").textContent="No route found with the selected options.";
    $("nv").textContent=r.steps.length;
    $("rx").textContent=algorithm==='dijkstra'?r.relax:r.checks;
    render();
    return;
  }
  st.path=r.path;
  let phys=0;
  for(let i=0;i<r.path.length-1;i++)phys+=adj[r.path[i]].find(e=>e.to===r.path[i+1]).w;
  $("dist").textContent=phys+" m";
  $("time").textContent=fmt(phys/1.3);
  $("nv").textContent=r.steps.length;
  $("rx").textContent=algorithm==='dijkstra'?r.relax:r.checks;
  $("msg").innerHTML=`<b>${algorithm==='dijkstra'?"Dijkstra":"Bellman–Ford"}</b> route found: <b>${nodes[s].label}</b> to <b>${nodes[t].label}</b>`+
    (o().crowd?` (weighted cost ${r.cost})`:"")+".";
  $("dir").innerHTML=directions(r.path).map(d=>`<li>${d}</li>`).join("");
  compare(s,t,r);
  // Start at the selected location and animate along each route node.
  st.marker=s;
  setFloor(nodes[s].f);
  render();
  for(const id of r.path){
    if(tok!==run)return;
    if(nodes[id].f!==cur)setFloor(nodes[id].f);
    st.marker=id;
    moveMarker();
    await sleep(450);
  }
}


/* ---------- RANDOMIZE EDGE COSTS ---------- */
function randomizeCosts(){
  resetView();
  const seen=new Set();
  for(const u in adj){
    for(const e of adj[u]){
      const key=[u,e.to].sort().join("|");
      if(seen.has(key))continue;
      seen.add(key);
      const newWeight=Math.floor(Math.random()*26)+10; // 10–35 m
      e.w=newWeight;
      const reverse=adj[e.to].find(x=>x.to===u);
      if(reverse)reverse.w=newWeight;
    }
  }
  render();
  $("msg").textContent="All connection weights changed. Choose a route to calculate a new shortest path.";
  $("bfResult").innerHTML="<strong>Alternate algorithm result</strong><p>Weights changed. Run a route to compare the selected algorithm with the alternate algorithm.</p>";
}

/* ---------- INIT ---------- */
$("tabs").innerHTML=F.map((n,i)=>`<button data-f="${i}">${n}<span class="bd" id="bd${i}"></span></button>`).join("")+`<div class="algorithm-switch" role="group" aria-label="Choose shortest-path algorithm"><span>Algorithm</span><button type="button" id="chooseDijkstra" class="active">Dijkstra</button><button type="button" id="chooseBellman">Bellman–Ford</button></div>`;
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>setFloor(+b.dataset.f));
function setAlgorithm(next){algorithm=next;$("chooseDijkstra").classList.toggle("active",next==="dijkstra");$("chooseBellman").classList.toggle("active",next==="bellman");resetView();highlightAlgorithm();$("msg").textContent=`${next==="dijkstra"?"Dijkstra":"Bellman–Ford"} selected. Choose a route to compare both algorithms.`;}
$("chooseDijkstra").onclick=()=>setAlgorithm("dijkstra");
$("chooseBellman").onclick=()=>setAlgorithm("bellman");
fill($("ss"),true);fill($("sd"),false);
$("ss").value="0:EN";$("sd").value="2:s20";     // Main Entrance -> Electronics Hub
["ss","sd","acc","crowd"].forEach(i=>$(i).onchange=resetView);
$("swap").onclick=()=>{const a=$("ss").value,b=$("sd").value;
  if(!$("sd").querySelector(`[value="${a}"]`))return;
  $("ss").value=b;$("sd").value=a;resetView();};
$("find").onclick=go;
$("instant").onclick=goInstant;
$("randomCosts").onclick=randomizeCosts;
resetView();
{const V=Object.keys(nodes).length,Ed=Object.values(adj).reduce((a,l)=>a+l.length,0)/2;
 $("cv").textContent=V;$("ce").textContent=Ed;
 $("cd").textContent=Math.round((V+Ed)*Math.log2(V));$("cb").textContent=V*Ed;}
