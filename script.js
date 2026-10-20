
const $ = id => document.getElementById(id);

const F = ["Ground Floor", "First Floor", "Second Floor", "Third Floor"];

const STORES = [
  ["Zara", "Nike", "Adidas", "Apple Store", "Starbucks", "Pharmacy", "Bookstore", "Sephora", "Uniqlo"],
  ["Levis", "Puma", "Fabindia", "Samsung", "Food Court", "Croma", "Titan", "Lenskart", "Gift Shop"],
  ["Cinema", "Arcade", "Bowling", "Gaming Zone", "Escape Room", "Karaoke", "Electronics Hub", "Mobile Store", "Laptop Hub"],
  ["Furniture", "Jewellery", "Toy Store", "Salon", "Gym", "Bank", "Clinic", "Rooftop Cafe", "Kids Zone"]
];

const X = [170, 360, 650, 830];
const Y = [170, 300, 430];

const REM = [
  [[1, 0], [2, 1]],
  [[2, 0], [1, 1]],
  [[1, 0], [2, 0]],
  [[1, 1], [2, 1]]
];

/* ---------- GRAPH ---------- */

const nodes = {};
const adj = {};

function N(id, f, x, y, label, type, g) {
  nodes[id] = { id, f, x, y, label, type, g };
  adj[id] = [];
}

function E(a, b, kind = "walk", w = null, crowd = false) {
  if (w == null) {
    w = Math.round(
      Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) * 0.2
    );
  }

  adj[a].push({ to: b, w, kind, crowd });
  adj[b].push({ to: a, w, kind, crowd });
}

N("0:EN", 0, 95, 300, "Main Entrance", "entrance");

for (let f = 0; f < F.length; f++) {
  const J = (r, c) => `${f}:j${r}${c}`;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const sp =
        r === 1 && c === 1 ? ["Escalator", "escalator"] :
        r === 1 && c === 2 ? ["Lift", "lift"] :
        ["Junction " + String.fromCharCode(65 + r * 4 + c), "junction"];

      N(J(r, c), f, X[c], Y[r], sp[0], sp[1]);
    }
  }

  N(`${f}:ST`, f, 905, 300, "Stairs", "stairs");

  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 3; i++) {
      const id = `${f}:s${r}${i}`;
      const xm = (X[i] + X[i + 1]) / 2;
      const w = X[i + 1] - X[i] - 40;
      const y0 = r === 0 ? 70 : r === 2 ? 454 : (i === 1 ? 322 : 194);
      const h = r === 1 ? 84 : 76;

      N(id, f, xm, Y[r], STORES[f][r * 3 + i], "store", [
        xm - w / 2, y0, w, h
      ]);

      const crowded = r === (f % 2 === 0 ? 1 : 0) && i === 1;

      E(J(r, i), id, "walk", null, crowded);
      E(id, J(r, i + 1), "walk", null, crowded);
    }
  }

  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 2; r++) {
      if (!REM[f].some(([cc, rr]) => cc === c && rr === r)) {
        E(J(r, c), J(r + 1, c));
      }
    }
  }

  E(`${f}:ST`, J(1, 3));
}

E("0:EN", "0:j10");

for (let f = 0; f < F.length - 1; f++) {
  E(`${f}:ST`, `${f + 1}:ST`, "stairs", 25);
  E(`${f}:j11`, `${f + 1}:j11`, "escalator", 18);
  E(`${f}:j12`, `${f + 1}:j12`, "lift", 30);
}

/* ---------- MIN-HEAP ---------- */

class Heap {
  constructor() {
    this.a = [];
  }

  get size() {
    return this.a.length;
  }

  push(x) {
    const a = this.a;
    a.push(x);

    let i = a.length - 1;

    while (i > 0) {
      const p = (i - 1) >> 1;

      if (a[p][0] <= a[i][0]) break;

      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();

    if (a.length) {
      a[0] = last;
      let i = 0;

      for (;;) {
        let m = i;
        const l = 2 * i + 1;
        const r = l + 1;

        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;

        if (m === i) break;

        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }

    return top;
  }
}

/* ---------- SHARED HELPERS ---------- */

function ecost(e, op) {
  if (op.acc && (e.kind === "stairs" || e.kind === "escalator")) {
    return null;
  }

  return e.w * (op.crowd && e.crowd ? 3 : 1);
}

function getPath(prev, s, t, V) {
  if (s === t) return [s];

  const path = [];
  let current = t;
  let guard = 0;

  while (current != null && guard++ <= V) {
    path.unshift(current);

    if (current === s) return path;

    current = prev[current];
  }

  return [];
}

// Deterministic tie-breaking rules:
// Dijkstra prefers the lexicographically smaller predecessor.
// Bellman-Ford prefers the lexicographically larger predecessor.
// These rules apply ONLY when candidate costs are exactly equal.

function preferDijkstraPredecessor(candidate, existing) {
  return existing == null || candidate < existing;
}

function preferBellmanPredecessor(candidate, existing) {
  return existing == null || candidate > existing;
}

/* ---------- DIJKSTRA ---------- */

function dijkstra(s, t, op) {
  const dist = {};
  const prev = {};
  const done = new Set();
  const steps = [];
  let relax = 0;

  for (const k in nodes) {
    dist[k] = Infinity;
  }

  dist[s] = 0;

  const h = new Heap();
  h.push([0, s]);

  while (h.size) {
    const [d, u] = h.pop();

    if (done.has(u)) continue;

    done.add(u);

    const step = { u, d, rel: 0 };
    steps.push(step);

    if (u === t) break;

    for (const e of adj[u]) {
      const c = ecost(e, op);

      if (c === null) continue;

      relax++;

      const candidate = d + c;
      const isBetter = candidate < dist[e.to];

      const isEqualButPreferred =
        candidate === dist[e.to] &&
        !done.has(e.to) &&
        preferDijkstraPredecessor(u, prev[e.to]);

      if (isBetter || isEqualButPreferred) {
        dist[e.to] = candidate;
        prev[e.to] = u;
        h.push([candidate, e.to]);
        step.rel++;
      }
    }
  }

  return {
    path: dist[t] < Infinity ? getPath(prev, s, t, Object.keys(nodes).length) : [],
    cost: dist[t],
    steps,
    relax,
    prev,
    dist
  };
}

/* ---------- BELLMAN-FORD ---------- */

function bellman(s, t, op) {
  const dist = {};
  const prev = {};
  const steps = [];

  let checks = 0;
  let passes = 0;
  let successful = 0;

  for (const k in nodes) {
    dist[k] = Infinity;
  }

  dist[s] = 0;

  const V = Object.keys(nodes).length;

  for (let i = 0; i < V - 1; i++) {
    passes++;

    let changed = false;
    let improved = 0;

    for (const u in adj) {
      if (dist[u] === Infinity) continue;

      for (const e of adj[u]) {
        const c = ecost(e, op);

        if (c === null) continue;

        checks++;

        const candidate = dist[u] + c;
        const isBetter = candidate < dist[e.to];

        const isEqualButPreferred =
          candidate === dist[e.to] &&
          e.to !== s &&
          preferBellmanPredecessor(u, prev[e.to]);

        if (isBetter || isEqualButPreferred) {
          if (isBetter) {
            dist[e.to] = candidate;
            changed = true;
            successful++;
          }

          prev[e.to] = u;
          improved++;
        }
      }
    }

    steps.push({
      u: s,
      d: 0,
      rel: improved,
      pass: passes,
      checks
    });

    if (!changed) break;
  }

  return {
    path: dist[t] < Infinity ? getPath(prev, s, t, V) : [],
    cost: dist[t],
    checks,
    passes,
    relax: checks,
    successful,
    steps,
    dist,
    prev
  };
}

/* ---------- ALGORITHM SELECTION ---------- */

let cur = 0;
let run = 0;
let algorithm = "dijkstra";

let st = {
  explored: new Set(),
  path: [],
  cur: null,
  marker: "0:EN"
};

const o = () => ({
  acc: $("acc").checked,
  crowd: $("crowd").checked
});

function currentAlgorithm() {
  return algorithm;
}

function activeResult(s, t, op) {
  return currentAlgorithm() === "dijkstra"
    ? dijkstra(s, t, op)
    : bellman(s, t, op);
}

function highlightAlgorithm() {
  document.querySelectorAll(".complexity-card").forEach(card => {
    card.classList.remove("selected-algorithm", "primary");
  });

  $(algorithm === "dijkstra" ? "dijkstraCard" : "bellmanCard")
    .classList.add("selected-algorithm", "primary");

  $("nvLabel").textContent =
    algorithm === "dijkstra" ? "NODES VISITED" : "PASSES";

  $("traceHeading").textContent =
    algorithm === "dijkstra"
      ? "Dijkstra trace (priority queue pops)"
      : "Bellman–Ford trace (edge-scan passes)";
}

/* ---------- ALGORITHM COMPARISON ---------- */

function describePath(path) {
  if (!path.length) return "No route found";

  return path.map(id => nodes[id].label).join(" → ");
}

function formatCost(cost) {
  return Number.isFinite(cost) ? `${cost} m` : "No route";
}

function compare(s, t, selectedResult) {
  const op = o();

  const d = dijkstra(s, t, op);
  const bf = bellman(s, t, op);

  const V = Object.keys(nodes).length;
  const Ed = Object.values(adj).reduce((sum, list) => sum + list.length, 0) / 2;

  const row = (a, b, c, d) =>
    `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td></tr>`;

  $("cmp").innerHTML = `
    <div>Graph: V = ${V} nodes, E = ${Ed} edges</div>

    <table>
      <tr>
        <th>Algorithm</th>
        <th>Cost found</th>
        <th>Work counted</th>
        <th>Time complexity</th>
      </tr>
      ${row("Dijkstra", formatCost(d.cost), d.relax, "O((V + E) log V)")}
      ${row("Bellman–Ford", formatCost(bf.cost),
        `${bf.checks} checks (${bf.passes} passes)`, "O(V × E)")}
    </table>

    <h3>Dijkstra route</h3>
    <p>${describePath(d.path)}</p>
    <p><strong>Total cost:</strong> ${formatCost(d.cost)}</p>

    <h3>Bellman–Ford route</h3>
    <p>${describePath(bf.path)}</p>
    <p><strong>Total cost:</strong> ${formatCost(bf.cost)}</p>
  `;

  const sameCost = d.cost === bf.cost;
  const differentPaths =
    d.path.length > 0 &&
    bf.path.length > 0 &&
    d.path.join("|") !== bf.path.join("|");

  let explanation;

  if (!sameCost) {
    explanation =
      "The computed costs differ. Check the route calculations and selected options.";
  } else if (differentPaths) {
    explanation =
      "Both algorithms found the same minimum cost using different routes. " +
      "Equal-cost alternatives were resolved using their different tie-breaking rules.";
  } else {
    explanation =
      "Both algorithms found the same minimum cost and route for this selection. " +
      "Try another start/destination pair or change corridor costs to explore other routes.";
  }

  $("bfResult").innerHTML = `
    <strong>Algorithm comparison result</strong>
    <p>${explanation}</p>
    <p><strong>Dijkstra:</strong> ${formatCost(d.cost)}</p>
    <p><strong>Bellman–Ford:</strong> ${formatCost(bf.cost)}</p>
  `;

  highlightAlgorithm();
}

/* ---------- MAP RENDERING ---------- */

function render() {
  const f = cur;
  const S = $("ss").value;
  const D = $("sd").value;
  const opt = o();

  const here = Object.values(nodes).filter(n => n.f === f);

  let h = `
    <rect class="wall" x="60" y="50" width="880" height="500" rx="16"/>
    <text class="ft" x="500" y="34">${F[f].toUpperCase()}</text>
  `;

  let cor = "";
  let cw = "";
  let weightLabels = "";

  here.forEach(a => {
    adj[a.id].forEach(e => {
      const b = nodes[e.to];

      if (b.f !== f || a.id >= b.id) return;

      const l = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;

      cor += `<line class="cor" ${l}/>`;

      if (opt.crowd && e.crowd) {
        cw += `<line class="cw" ${l}/>`;
      }

      const penalty = opt.crowd && e.crowd;
      const shownWeight = ecost(e, opt);

      let mx = (a.x + b.x) / 2;
      let my = (a.y + b.y) / 2;

      const dx = b.x - a.x;
      const dy = b.y - a.y;

      if (Math.abs(dy) < 1) {
        my += Math.round(mx / 65) % 2 === 0 ? -10 : 10;
      } else if (Math.abs(dx) < 1) {
        mx += Math.round(my / 65) % 2 === 0 ? -10 : 10;
      } else {
        const len = Math.hypot(dx, dy) || 1;
        mx += (-dy / len) * 8;
        my += (dx / len) * 8;
      }

      const labelClass = penalty ? "edge-label penalty" : "edge-label";
      const bgClass = penalty ? "edge-label-bg penalty" : "edge-label-bg";

      weightLabels += `
        <rect class="${bgClass}" x="${mx - 15}" y="${my - 7}"
          width="30" height="14" rx="5"/>
        <text class="${labelClass}" x="${mx}" y="${my + 0.5}">
          ${shownWeight}m
        </text>
      `;
    });
  });

  h += cor + cw + weightLabels;

  here.filter(n => n.type === "store").forEach(n => {
    const [x, y, w, hh] = n.g;

    h += `
      <rect class="store${n.id === S ? " s" : ""}${n.id === D ? " d" : ""}"
        x="${x}" y="${y}" width="${w}" height="${hh}" rx="8"/>
      <text class="sl" x="${x + w / 2}" y="${y + hh / 2 + 5}">
        ${n.label}
      </text>
    `;
  });

  const p = st.path;

  for (let i = 0; i < p.length - 1; i++) {
    const a = nodes[p[i]];
    const b = nodes[p[i + 1]];

    if (a.f === f && b.f === f) {
      h += `<line class="route" x1="${a.x}" y1="${a.y}"
        x2="${b.x}" y2="${b.y}"/>`;
    } else if (a.f !== b.f) {
      if (a.f === f) {
        h += `<text class="badge" x="${a.x}" y="${a.y - 22}">
          ${b.f > a.f ? "&#9650; up" : "&#9660; down"}
        </text>`;
      }

      if (b.f === f) {
        h += `<text class="badge" x="${b.x}" y="${b.y - 22}">arrive</text>`;
      }
    }
  }

  here.forEach(n => {
    const c =
      (st.explored.has(n.id) ? " ex" : "") +
      (st.cur === n.id ? " cu" : "");

    if (["stairs", "escalator", "lift"].includes(n.type)) {
      h += `
        <rect class="cn${c}" x="${n.x - 30}" y="${n.y - 11}"
          width="60" height="22" rx="6"/>
        <text class="ct" x="${n.x}" y="${n.y + 4}">${n.label}</text>
      `;
    } else {
      h += `<circle class="nd${c}" cx="${n.x}" cy="${n.y}"
        r="${n.type === "store" ? 5 : 8}"/>`;

      if (n.type === "junction") {
        h += `<text class="nl" x="${n.x + 13}" y="${n.y - 9}">
          ${n.label.slice(-1)}
        </text>`;
      }

      if (n.type === "entrance") {
        h += `<text class="nl" x="${n.x - 35}" y="${n.y - 16}"
          style="text-anchor:start">${n.label}</text>`;
      }
    }
  });

  $("layer").innerHTML = h;

  F.forEach((_, i) => {
    const count = [...st.explored].filter(id => nodes[id].f === i).length;
    const badge = $("bd" + i);

    badge.textContent = count;
    badge.style.display = count ? "inline" : "none";
  });

  moveMarker();
}


function moveMarker() {
  const n = nodes[st.marker];
  const m = $("me");

  if (!n || !m) return;

  m.setAttribute("cx", n.x);
  m.setAttribute("cy", n.y);
  m.style.display = n.f === cur ? "block" : "none";
  m.style.transform = "none";
}


function setFloor(f) {
  cur = f;

  document.querySelectorAll("#tabs button").forEach((b, i) => {
    b.classList.toggle("on", i === f);
  });

  render();
}

/* ---------- UI HELPERS ---------- */

function fill(sel, entrance) {
  sel.innerHTML = F.map((name, f) => {
    const opts = Object.values(nodes)
      .filter(n =>
        n.f === f &&
        (n.type === "store" || (entrance && n.type === "entrance"))
      )
      .map(n => `<option value="${n.id}">${n.label}</option>`)
      .join("");

    return `<optgroup label="${name}">${opts}</optgroup>`;
  }).join("");
}

function resetView() {
  run++;

  st = {
    explored: new Set(),
    path: [],
    cur: null,
    marker: $("ss").value
  };

  ["dist", "time", "nv", "rx"].forEach(id => {
    $(id).textContent = "-";
  });

  $("dir").innerHTML = "";
  $("log").innerHTML = "";
  $("cmp").textContent = "Run a route to compare.";
  $("msg").textContent =
    "Choose a start and destination, then press Find Shortest Route.";

  setFloor(nodes[st.marker].f);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const fmt = seconds =>
  seconds < 60
    ? Math.round(seconds) + " s"
    : Math.floor(seconds / 60) + " min " +
      Math.round(seconds % 60) + " s";

function directions(path) {
  return path.slice(1).map((id, i) => {
    const a = nodes[path[i]];
    const b = nodes[id];
    const e = adj[a.id].find(x => x.to === id);

    if (a.f !== b.f) {
      return `Take the ${b.type} ${b.f > a.f ? "up" : "down"} to the ${F[b.f]}`;
    }

    return i === path.length - 2
      ? `Arrive at ${b.label} (${e.w} m)`
      : `Walk to ${b.label} (${e.w} m)`;
  });
}

/* ---------- MAIN SIMULATION ---------- */

async function go() {
  const s = $("ss").value;
  const t = $("sd").value;

  resetView();
  highlightAlgorithm();

  const tok = run;

  if (s === t) {
    $("msg").textContent = "Start and destination are the same place.";
    return;
  }

  const r = activeResult(s, t, o());
  const sp = +$("speed").value;

  $("msg").textContent =
    algorithm === "dijkstra"
      ? "Dijkstra is exploring nearest locations with a priority queue..."
      : "Bellman–Ford is repeatedly scanning graph edges...";

  for (let i = 0; i < r.steps.length; i++) {
    if (tok !== run) return;

    const x = r.steps[i];

    st.explored.add(x.u);
    st.cur = x.u;

    if (nodes[x.u].f !== cur) {
      setFloor(nodes[x.u].f);
    } else {
      render();
    }

    $("nv").textContent = i + 1;

    const li = document.createElement("li");

    li.textContent = algorithm === "dijkstra"
      ? `#${i + 1} pop ${nodes[x.u].label} [${nodes[x.u].f ? "F" + nodes[x.u].f : "G"}] d=${x.d} relaxed ${x.rel}`
      : `Pass ${x.pass}: scanned ${x.checks} edges so far; ${x.rel} distance updates in this pass`;

    $("log").appendChild(li);
    $("log").scrollTop = 1e9;

    if (sp) await sleep(sp);
  }

  st.cur = null;

  if (!r.path.length) {
    $("msg").textContent = "No route found with the selected options.";
    render();
    return;
  }

  st.path = r.path;

  let physicalDistance = 0;

  for (let i = 0; i < r.path.length - 1; i++) {
    physicalDistance += adj[r.path[i]].find(
      e => e.to === r.path[i + 1]
    ).w;
  }

  $("dist").textContent = physicalDistance + " m";
  $("time").textContent = fmt(physicalDistance / 1.3);
  $("rx").textContent = algorithm === "dijkstra" ? r.relax : r.checks;

  $("msg").innerHTML =
    `<b>${algorithm === "dijkstra" ? "Dijkstra" : "Bellman–Ford"}</b> route found: ` +
    `<b>${nodes[s].label}</b> to <b>${nodes[t].label}</b>` +
    (o().crowd ? ` (weighted cost ${r.cost})` : "") + ".";

  $("dir").innerHTML = directions(r.path)
    .map(d => `<li>${d}</li>`)
    .join("");

  compare(s, t, r);
  render();

  for (const id of r.path) {
    if (tok !== run) return;

    if (nodes[id].f !== cur) setFloor(nodes[id].f);

    st.marker = id;
    moveMarker();

    await sleep(450);
  }
}

/* ---------- INSTANT RESULT ---------- */

async function goInstant() {
  const s = $("ss").value;
  const t = $("sd").value;

  resetView();
  highlightAlgorithm();

  const tok = run;

  if (s === t) {
    $("msg").textContent = "Start and destination are the same place.";
    return;
  }

  const r = activeResult(s, t, o());

  $("msg").textContent =
    algorithm === "dijkstra"
      ? "Dijkstra route calculated. Walking the route..."
      : "Bellman–Ford route calculated. Walking the route...";

  r.steps.forEach(x => st.explored.add(x.u));
  st.cur = null;

  if (!r.path.length) {
    $("msg").textContent = "No route found with the selected options.";
    $("nv").textContent = r.steps.length;
    $("rx").textContent = algorithm === "dijkstra" ? r.relax : r.checks;
    render();
    return;
  }

  st.path = r.path;

  let physicalDistance = 0;

  for (let i = 0; i < r.path.length - 1; i++) {
    physicalDistance += adj[r.path[i]].find(
      e => e.to === r.path[i + 1]
    ).w;
  }

  $("dist").textContent = physicalDistance + " m";
  $("time").textContent = fmt(physicalDistance / 1.3);
  $("nv").textContent = r.steps.length;
  $("rx").textContent = algorithm === "dijkstra" ? r.relax : r.checks;

  $("msg").innerHTML =
    `<b>${algorithm === "dijkstra" ? "Dijkstra" : "Bellman–Ford"}</b> route found: ` +
    `<b>${nodes[s].label}</b> to <b>${nodes[t].label}</b>` +
    (o().crowd ? ` (weighted cost ${r.cost})` : "") + ".";

  $("dir").innerHTML = directions(r.path)
    .map(d => `<li>${d}</li>`)
    .join("");

  compare(s, t, r);

  st.marker = s;
  setFloor(nodes[s].f);
  render();

  for (const id of r.path) {
    if (tok !== run) return;

    if (nodes[id].f !== cur) setFloor(nodes[id].f);

    st.marker = id;
    moveMarker();

    await sleep(450);
  }
}

/* ---------- RANDOMIZE EDGE COSTS ---------- */

function randomizeCosts() {
  resetView();

  const seen = new Set();

  for (const u in adj) {
    for (const e of adj[u]) {
      const key = [u, e.to].sort().join("|");

      if (seen.has(key)) continue;
      seen.add(key);

      const newWeight = Math.floor(Math.random() * 26) + 10;

      e.w = newWeight;

      const reverse = adj[e.to].find(x => x.to === u);

      if (reverse) reverse.w = newWeight;
    }
  }

  render();

  $("msg").textContent =
    "All connection weights changed. Choose a route to calculate a new shortest path.";

  $("bfResult").innerHTML = `
    <strong>Algorithm comparison</strong>
    <p>Weights changed. Run a route to compare both algorithms.</p>
  `;
}

/* ---------- INITIALIZATION ---------- */

$("tabs").innerHTML =
  F.map((n, i) =>
    `<button data-f="${i}">${n}<span class="bd" id="bd${i}"></span></button>`
  ).join("") +
  `<div class="algorithm-switch" role="group" aria-label="Choose shortest-path algorithm">
    <span>Algorithm</span>
    <button type="button" id="chooseDijkstra" class="active">Dijkstra</button>
    <button type="button" id="chooseBellman">Bellman–Ford</button>
  </div>`;

document.querySelectorAll("#tabs button[data-f]").forEach(b => {
  b.onclick = () => setFloor(+b.dataset.f);
});

function setAlgorithm(next) {
  algorithm = next;

  $("chooseDijkstra").classList.toggle("active", next === "dijkstra");
  $("chooseBellman").classList.toggle("active", next === "bellman");

  resetView();
  highlightAlgorithm();

  $("msg").textContent =
    `${next === "dijkstra" ? "Dijkstra" : "Bellman–Ford"} selected. ` +
    "Choose a route to compare both algorithms.";
}

$("chooseDijkstra").onclick = () => setAlgorithm("dijkstra");
$("chooseBellman").onclick = () => setAlgorithm("bellman");

fill($("ss"), true);
fill($("sd"), false);

$("ss").value = "0:EN";
$("sd").value = "2:s20";

["ss", "sd", "acc", "crowd"].forEach(id => {
  $(id).onchange = resetView;
});

$("swap").onclick = () => {
  const a = $("ss").value;
  const b = $("sd").value;

  if (!$("sd").querySelector(`[value="${a}"]`)) return;

  $("ss").value = b;
  $("sd").value = a;

  resetView();
};

$("find").onclick = go;
$("instant").onclick = goInstant;
$("randomCosts").onclick = randomizeCosts;

resetView();

{
  const V = Object.keys(nodes).length;
  const Ed = Object.values(adj).reduce((sum, list) => sum + list.length, 0) / 2;

  $("cv").textContent = V;
  $("ce").textContent = Ed;

  $("cd").textContent = Math.round((V + Ed) * Math.log2(V));
  $("cb").textContent = V * Ed;
}
