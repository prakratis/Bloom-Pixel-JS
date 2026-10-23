(() => {
  "use strict";
  const TOKEN_KEY = "bloom-auth-token";
  const SELECTED_TASK_KEY = "bloom-selected-task";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let token = localStorage.getItem(TOKEN_KEY) || "";
  let user = null, authMode = "register", currentSessionId = Number(localStorage.getItem("bloom-session-id")) || null;
  let selectedTask = localStorage.getItem(SELECTED_TASK_KEY) || "";
  let selectedGardenItem = null, lastFocus = null;
  const views = ["home","tasks","garden","worlds","progress","compete","friends","settings"];
  const icons = {tulip:"tulip",daisy:"daisy",lavender:"lavender"};
  const pixelPatterns = {
    tulip:{c:"#d56f9c",rows:["...##...","..####..","...##...","...##...","...##...","..#..#..","..#..#..","...##..."]},
    daisy:{c:"#e6b94d",rows:["..###...",".##.##..","##...##.","##..###.","##..###.",".##.##..","..###...","...#...."]},
    lavender:{c:"#9984cf",rows:["..##....",".####...","..##.#..",".####...","..##.#..",".####...","...#....","...#...."]},
    pot:{c:"#b96e55",rows:["........",".######.","..####..","..####..","..####..","...##...","...##...","........"]},
    mushroom:{c:"#cc6e79",rows:["..####..",".######.","########","..####..","...##...","...##...","...##...","........"]},
    stones:{c:"#9b9ba9",rows:["........",".###....","#####...","..####..",".######.","...###..","........","........"]},
    pond:{c:"#70b9d1",rows:["........","...##...",".######.","########",".######.","..####..","........","........"]},
    lights:{c:"#e9b94f",rows:["#..#..#.",".##.##..","..#..#..","...##...","..#..#..",".#..##..","#..#..#.","........"]},
    seed:{c:"#8cae73",rows:["........","...##...","..####..",".######.","..####..","...##...","...#....","........"]},
    sprout:{c:"#78a96d",rows:["........","..##....",".####...","..##....","...##...","..####..","...##...","...##..."]},
    coffee:{c:"#ad795d",rows:["..####..",".######.",".######.",".######.","..####.#.","...##....","..####...","........"]},
    tree:{c:"#6f9d78",rows:["...##...","..####..",".######.","########","..####..","...##...","...##...","..####.."]},
    moon:{c:"#b5a2df",rows:["...####.","..#####.",".####...",".###....",".###....",".####...","..#####.","...####."]},
    leaf:{c:"#78a96d",rows:["....##..","...####.","..######",".######.","..####..","...##...","...#....","........"]},
    flower:{c:"#d56f9c",rows:["...#....","..###...",".#####..","###.###.",".#####..","..###...","...#....","...#...."]},
    check:{c:"#6f9d78",rows:["........","......#.",".....##.","#...##..","##.##...",".###....","..#.....","........"]},
    heart:{c:"#d56f9c",rows:[".##.##..","########","########",".######.","..####..","...##...","........","........"]},
    star:{c:"#e9b94f",rows:["...#....","...#....","########",".######.","..####..",".##..##..","##....##.","........"]},
    home:{c:"#8cae73",rows:["...##...","..####..",".######.","########","##....##","##....##","##....##","########"]},
    task:{c:"#8cae73",rows:["########","#......#","#.##...#","#..##..#","#...##.#","#....###","#......#","########"]},
    cloud:{c:"#8dbbd0",rows:["........","...###..",".######.","########","########",".######.","........","........"]},
    chart:{c:"#8cae73",rows:["########","#......#","#..##..#","#..##..#","#.####.#","#.####.#","########","........"]},
    trophy:{c:"#d7ab4f",rows:["..####..",".######.","##....##","##....##",".######.","...##...","..####..","..####.."]},
    friends:{c:"#d56f9c",rows:[".##..##.",".##..##.","..####..","...##...",".######.","##.##.##","##....##","........"]},
    settings:{c:"#9b9ba9",rows:["..####..",".##..##.","##.####.#","##.####.#",".##..##.","..####..","...##...","........"]},
    menu:{c:"#7f8c88",rows:["########","........","########","........","########","........","........","........"]}
  };
  function pixelIcon(key, size=28) {
    const data=pixelPatterns[key]||pixelPatterns.flower;
    const cells=data.rows.map((row,y)=>[...row].map((v,x)=>v!=="."?`<rect x="${x}" y="${y}" width="1" height="1"/>`:"").join("")).join("");
    return `<svg class="pixel-icon" width="${size}" height="${size}" viewBox="0 0 8 8" role="img" aria-label="${key}" shape-rendering="crispEdges" style="--pixel-color:${data.c}"><rect width="8" height="8" fill="none"/>${cells}</svg>`;
  }
  const itemCatalog = {
    terracotta_pot:{name:"Terracotta pot",emoji:"pot"},pink_pot:{name:"Blush pot",emoji:"tulip"},
    mushroom:{name:"Tiny mushroom",emoji:"mushroom"},stepping_stones:{name:"Stepping stones",emoji:"stones"},
    pond:{name:"Little pond",emoji:"pond"},fairy_lights:{name:"Fairy lights",emoji:"lights"},
    daisy_seed:{name:"Moon daisy seed",emoji:"daisy"},lavender_seed:{name:"Lilac spire seed",emoji:"lavender"}
  };
  async function api(path, options={}) {
    const headers = {...(options.headers||{})};
    if (token) headers.Authorization = "Bearer " + token;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"]="application/json";
    let response;
    try { response = await fetch(path, {...options, headers}); }
    catch { throw new Error("Can't reach Bloom's server. Check your connection and try again."); }
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 401 && token) {
        token = ""; localStorage.removeItem(TOKEN_KEY); user = null; updateAuthUI();
        const av = $(".view.active"); if (av && av.id !== "home-view") renderView(av.id.replace("-view","")).catch(() => {});
      }
      throw new Error(payload.detail || "Something went wrong.");
    }
    return payload;
  }
  function toast(message) {
    const el=$("#toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toast._timer); toast._timer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function fmtMins(n) { n=Math.max(0,Number(n)||0); return n>=60?`${Math.floor(n/60)}h ${n%60}m`:`${n}m`; }
  const parseDate = s => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
  const avatarIcon = k => pixelIcon(pixelPatterns[k] ? k : "flower", 24);
  function setSidebar(open) {
    $("#sidebar").classList.toggle("open", open); $("#sidebarBackdrop").hidden = !open;
    $("#mobileMenu").setAttribute("aria-expanded", String(open));
  }
  function closeAuth() { $("#authModal").hidden = true; $("#authPassword").value = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function updateAuthUI() {
    if (user) document.body.dataset.world = user.active_world || "window_sill";
    else document.body.dataset.world = "window_sill";
    $("#authOpen").hidden=!!user; $("#signOut").hidden=!user;
    $("#profileName").textContent=user ? (user.display_name||user.username) : "Guest gardener";
    $("#profileLevel").textContent=user ? `Level ${user.level} · ${user.seeds} seeds` : "Local demo · sign in to sync";
    $("#mobileLevel").textContent=user?`Lv ${user.level}`:"Lv 1";
  }
  function showView(name) {
    if (!views.includes(name)) return;
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===`${name}-view`));
    $$(".nav-item[data-view]").forEach(b=>{const on=b.dataset.view===name;b.classList.toggle("active",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current");});
    setSidebar(false);
    const vroot=$(`#${name}-view`); if (name!=="home" && vroot && !vroot.innerHTML.trim()) vroot.innerHTML='<p class="loading">Growing…</p>';
    renderView(name).catch(e=>toast(e.message));
    window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  }
  function header(title, desc, action="") {
    return `<header class="feature-header"><div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${action}</header>`;
  }
  function card(title, content, tone="") {
    return `<section class="feature-card"><div class="feature-card-head ${tone}">${esc(title)}</div><div class="feature-card-body">${content}</div></section>`;
  }
  function requireUser() {
    if (!user) { openAuth(); throw new Error("Sign in or create an account to use saved Bloom features."); }
  }
  function openAuth(mode="register") {
    authMode=mode; lastFocus=document.activeElement; $("#authModal").hidden=false; updateAuthMode(); setTimeout(()=>$("#authUsername").focus(),0);
  }
  function updateAuthMode() {
    const register=authMode==="register";
    $("#authTitle").textContent=register?"create_your_garden":"welcome_back";
    $("#authIntro").textContent=register?"Create an account to keep your garden, sessions and rewards safe across devices.":"Sign in to continue growing your garden.";
    $("#authPassword").autocomplete=register?"new-password":"current-password";
    $("#emailLabel").hidden=!register; $("#authEmail").required=register;
    $("#authSubmit").textContent=register?"Create account":"Sign in";
    $("#authToggle").textContent=register?"Already have an account? Sign in":"New to Bloom? Create an account";
    $("#authError").textContent="";
  }
  async function refreshMe() {
    if (!token) { user=null; updateAuthUI(); return; }
    try { const p=await api("/api/auth/me"); user=p.user; updateAuthUI(); }
    catch { token=""; localStorage.removeItem(TOKEN_KEY); user=null; updateAuthUI(); }
  }
  async function authSubmit(e) {
    e.preventDefault(); $("#authError").textContent="";
    const btn=$("#authSubmit"); if(btn.disabled) return; btn.disabled=true;
    const username=$("#authUsername").value.trim(), password=$("#authPassword").value;
    const body=authMode==="register"?{username,email:$("#authEmail").value.trim(),password}:{username,password};
    try {
      const p=await api(authMode==="register"?"/api/auth/register":"/api/auth/login",{method:"POST",body:JSON.stringify(body)});
      token=p.token; localStorage.setItem(TOKEN_KEY,token); user=p.user; updateAuthUI(); closeAuth();
      toast(`Welcome to Bloom, ${user.display_name||user.username}!`); await renderHomeStats();
    } catch(err) { $("#authError").textContent=err.message; } finally { btn.disabled=false; }
  }
  function renderGuestMessage(title="Sign in to unlock this feature") {
    return `<div class="empty-state"><strong>${esc(title)}</strong><p>Create a free account to save your progress, collect rewards and join the Bloom community.</p><button class="btn primary" data-auth-open>Create account</button></div>`;
  }
  async function renderView(name) {
    if (name==="home") { await renderHomeStats(); return; }
    const root=$(`#${name}-view`);
    if (!user) {
      const titles={tasks:"Tasks & quests",garden:"My garden",worlds:"Focus worlds",progress:"Your progress",compete:"Compete",friends:"Friends",settings:"Settings"};
      root.innerHTML=header(titles[name]||"Bloom","Your little world is waiting.")+renderGuestMessage();
      return;
    }
    if (name==="tasks") return renderTasks();
    if (name==="garden") return renderGarden();
    if (name==="worlds") return renderWorlds();
    if (name==="progress") return renderProgress();
    if (name==="compete") return renderCompete();
    if (name==="friends") return renderFriends();
    if (name==="settings") return renderSettings();
  }
  async function renderHomeStats() {
    if (!user) return;
    try {
      const p=await api("/api/progress");
      $("#profileLevel").textContent=`Level ${user.level} · ${user.seeds} seeds`;
      $("#mobileLevel").textContent=`Lv ${user.level}`;
      const today=$("#sToday"); if(today) today.textContent=String(p.today_sessions);
      const streak=$("#sStreak"); if(streak) streak.textContent=String(p.streak);
      const time=$("#sTime"); if(time) time.textContent=fmtMins(p.total_minutes);
      const week=$("#week"); if(week) {
        week.innerHTML=p.weekly.map((d,i)=>{const n=Math.floor(d.minutes/25);return `<div class="day ${i===p.weekly.length-1?"today":""}"><div class="n">${n}</div><div class="stack">${[0,1,2,3].map(k=>`<span class="${n>=4?"full":k<n?"on":""}"></span>`).join("")}</div><div class="l">${new Date(d.date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"}).slice(0,2)}</div></div>`;}).join("");
      }
      const taskSelect=$("#activeTaskSelect");
      if(taskSelect) {
        const t=await api("/api/tasks"), open=t.tasks.filter(x=>x.status==="todo");
        if(selectedTask&&!open.some(x=>String(x.id)===selectedTask)){selectedTask="";localStorage.removeItem(SELECTED_TASK_KEY);}
        taskSelect.innerHTML='<option value="">Focus on anything</option>'+open.map(x=>`<option value="${x.id}" ${String(x.id)===selectedTask?"selected":""}>${esc(x.title)}</option>`).join("");
      }
    } catch(e) { /* local timer stays usable even if the server is offline */ }
  }
  async function renderTasks() {
    const root=$("#tasks-view");
    const [tasksPayload,questPayload]=await Promise.all([api("/api/tasks"),api("/api/quests")]);
    const tasks=tasksPayload.tasks.filter(t=>t.status!=="archived").sort((x,y)=>(x.status==="done")-(y.status==="done")), latest={};
    questPayload.quests.forEach(q=>{const c=latest[q.key]; if(!c||q.period_key>c.period_key) latest[q.key]=q;});
    const quests=questPayload.quests.filter(q=>latest[q.key]===q||(q.completed&&!q.claimed));
    root.innerHTML=header("Tasks & quests","Turn small, focused sessions into progress.")+
      `<div class="feature-grid">${card("Add a task",`<form id="taskForm" class="feature-form"><input name="title" maxlength="180" required placeholder="e.g. Finish physics numericals"><input name="estimate_minutes" type="number" min="5" max="480" value="25" aria-label="Estimated minutes"><button class="btn primary">Add task</button></form><p class="inline-note">Choose a task on Home before starting your focus timer.</p>`,"rose")}${card("Daily & weekly quests",`<div class="item-list">${quests.map(q=>`<div class="list-row"><div class="row-main"><strong>${esc(q.title)}</strong><small>${esc(q.description)} · ${q.progress}/${q.target}</small><div class="progress-track"><span style="width:${Math.min(100,q.progress/q.target*100)}%"></span></div></div><div class="row-actions">${q.completed?`<button class="btn small ${q.claimed?"":"primary"}" data-claim-quest="${q.id}" ${q.claimed?"disabled":""}>${q.claimed?"Claimed":"Claim"}</button>`:`<span class="pill">${q.cadence}</span>`}</div></div>`).join("")}</div>`,"sun")}</div>`+
      card("Your task list",tasks.length?`<div class="item-list">${tasks.map(t=>`<div class="list-row"><input type="checkbox" data-task-done="${t.id}" ${t.status==="done"?"checked":""} aria-label="Mark ${esc(t.title)} complete"><div class="row-main"><strong>${esc(t.title)}</strong><small>${t.estimate_minutes} min estimate · ${t.status==="done"?"Completed":"To do"}</small></div><div class="row-actions"><button class="btn small" data-task-focus="${t.id}">Focus</button><button class="btn small quiet" data-task-delete="${t.id}" aria-label="Delete task">×</button></div></div>`).join("")}</div>`:`<div class="empty-state">No tasks yet. Add one small thing you'd like to finish.</div>`);
    $("#taskForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),title=String(fd.get("title")||"").trim();if(!title){toast("Give your task a name first.");return;}try{await api("/api/tasks",{method:"POST",body:JSON.stringify({title,estimate_minutes:Number(fd.get("estimate_minutes")||25)})});toast("Task planted in your list.");await renderTasks();await renderHomeStats();}catch(err){toast(err.message);}});
    $$("[data-task-done]",root).forEach(el=>el.addEventListener("change",async()=>{try{const p=await api(`/api/tasks/${el.dataset.taskDone}`,{method:"PATCH",body:JSON.stringify({status:el.checked?"done":"todo"})});user=p.user;updateAuthUI();toast(el.checked?"Task completed! +XP and seeds":"Task reopened.");renderTasks();}catch(e){toast(e.message);}}));
    $$("[data-task-delete]",root).forEach(el=>el.addEventListener("click",async()=>{try{await api(`/api/tasks/${el.dataset.taskDelete}`,{method:"DELETE"});renderTasks();toast("Task removed.");}catch(e){toast(e.message);}}));
    $$("[data-task-focus]",root).forEach(el=>el.addEventListener("click",()=>{selectedTask=el.dataset.taskFocus;localStorage.setItem(SELECTED_TASK_KEY,selectedTask);showView("home");renderHomeStats();toast("Task selected. Start a focus session when ready.");}));
    $$("[data-claim-quest]",root).forEach(el=>el.addEventListener("click",async()=>{try{const p=await api(`/api/quests/${el.dataset.claimQuest}/claim`,{method:"POST"});user=p.user;updateAuthUI();toast("Quest rewards collected!");renderTasks();}catch(e){toast(e.message);}}));
  }
  async function renderGarden() {
    const root=$("#garden-view"),g=await api("/api/garden"),userItems=g.items,plants=g.plants;
    const placed=new Map(userItems.filter(i=>i.placed).map(i=>[`${i.x},${i.y}`,i]));
    const plantEmoji=plants.find(p=>p.is_active), owned=new Set(userItems.map(i=>i.key));
    const tiles=Array.from({length:48},(_,i)=>{const x=i%8,y=Math.floor(i/8),it=placed.get(`${x},${y}`);return `<button class="garden-tile ${it?"occupied":""} ${""}" data-tile-x="${x}" data-tile-y="${y}" title="Tile ${x+1}, ${y+1}" aria-label="Tile ${x+1}, ${y+1}${it?", "+esc(itemCatalog[it.key]?.name||it.key):""}">${it?pixelIcon(itemCatalog[it.key]?.emoji||"leaf",24):(x===3&&y===3&&plantEmoji?pixelIcon(icons[plantEmoji.species]||"sprout",24):"·")}</button>`}).join("");
    root.innerHTML=header("My garden","A little world, grown one focus session at a time.")+
      `<div class="feature-grid">${card("Garden plot",`<p>Choose an item from your inventory, then choose an empty tile. The layout is saved to your account.</p><div class="garden-board">${tiles}</div><p class="inline-note">Grid placement · 8 × 6 tiles · no overlapping decorations</p>`,"sage")}${card("Plants & collection",`<div class="item-list">${plants.map(p=>`<div class="list-row"><span style="font-size:28px">${pixelIcon(icons[p.species]||"sprout",28)}</span><div class="row-main"><strong>${esc(p.nickname)}</strong><small>Stage ${p.stage+1}/5 · ${p.growth_points} growth points</small><div class="progress-track"><span style="width:${Math.min(100,p.stage/4*100)}%"></span></div></div><button class="btn small" data-activate-plant="${p.id}" ${p.is_active?"disabled":""}>${p.is_active?"Active":"Select"}</button></div>`).join("")}</div><div class="feature-form"><select id="newPlantSpecies"><option value="tulip">Blush tulip · 20 seeds</option><option value="daisy">Moon daisy · 30 seeds</option><option value="lavender">Lilac spire · 40 seeds</option></select><button class="btn" id="buyPlant">Add plant</button></div>`,"rose")}</div>`+
      `<div class="gap"></div><div class="feature-grid">${card("Your inventory",userItems.length?`<div class="item-list">${userItems.map(i=>`<div class="list-row"><span style="font-size:26px">${pixelIcon(itemCatalog[i.key]?.emoji||"leaf",26)}</span><div class="row-main"><strong>${esc(itemCatalog[i.key]?.name||i.key)}</strong><small>${i.placed?`Placed at ${i.x+1}, ${i.y+1}`:"In inventory"}</small></div><button class="btn small" data-select-item="${i.id}">${selectedGardenItem===i.id?"Selected":i.placed?"Move":"Place"}</button></div>`).join("")}</div>`:`<div class="empty-state">Your inventory is empty. Pick up a little decoration from the shop.</div>`,"sun")}${card("Garden shop",`<div class="item-list">${g.catalog.map(it=>`<div class="list-row"><span style="font-size:25px">${pixelIcon(it.emoji,25)}</span><div class="row-main"><strong>${esc(it.name)}</strong><small>${it.cost===0?"Free":it.cost+" seeds"}</small></div>${owned.has(it.key)?'<span class="pill">Owned</span>':'<button class="btn small" data-buy-item="'+it.key+'"'+(user.seeds<it.cost?" disabled":"")+'>Buy</button>'}</div>`).join("")}</div>`,"rose")}</div>`;
    $$("[data-activate-plant]",root).forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/garden/plants/${b.dataset.activatePlant}/activate`,{method:"POST"});renderGarden();toast("Active plant updated.");}catch(e){toast(e.message);}}));
    $("#buyPlant").addEventListener("click",async()=>{try{const p=await api("/api/garden/plants",{method:"POST",body:JSON.stringify({species:$("#newPlantSpecies").value})});user=p.user;updateAuthUI();renderGarden();toast("A new plant joined your collection.");}catch(e){toast(e.message);}});
    $$("[data-buy-item]",root).forEach(b=>b.addEventListener("click",async()=>{try{const p=await api(`/api/garden/shop/${b.dataset.buyItem}/buy`,{method:"POST"});user=p.user;updateAuthUI();renderGarden();toast("Item added to your inventory.");}catch(e){toast(e.message);}}));
    $$("[data-select-item]",root).forEach(b=>b.addEventListener("click",()=>{selectedGardenItem=Number(b.dataset.selectItem);renderGarden();toast("Now choose an empty garden tile.");}));
    $$("[data-tile-x]",root).forEach(b=>b.addEventListener("click",async()=>{if(!selectedGardenItem){toast("Select an inventory item first.");return;}try{await api(`/api/garden/items/${selectedGardenItem}/place`,{method:"PATCH",body:JSON.stringify({x:Number(b.dataset.tileX),y:Number(b.dataset.tileY)})});selectedGardenItem=null;renderGarden();toast("Garden updated.");}catch(e){toast(e.message);}}));
  }
  async function renderWorlds() {
    const root=$("#worlds-view"),p=await api("/api/worlds");
    root.innerHTML=header("Focus worlds","Pick a scene that helps you settle in.")+`<div class="feature-grid two">${p.worlds.map(w=>`<article class="world-card ${w.unlocked?"":"locked"}"><div class="world-art">${pixelIcon(w.emoji,48)}</div><h3>${esc(w.name)}</h3><p>${esc(w.description)}</p><div class="row-actions">${w.active?'<span class="pill">Selected</span>':w.unlocked?`<button class="btn small primary" data-select-world="${w.key}">Use world</button>`:`<span class="pill">${w.cost} seeds</span><button class="btn small" data-unlock-world="${w.key}" ${user.seeds<w.cost?"disabled":""}>Unlock</button>`}</div></article>`).join("")}</div><p class="inline-note">Worlds currently update your selected scene preference; additional background art and ambience packs can be added without replacing the home design.</p>`;
    $$("[data-select-world]",root).forEach(b=>b.addEventListener("click",async()=>{try{const x=await api(`/api/worlds/${b.dataset.selectWorld}/select`,{method:"POST"});user=x.user;updateAuthUI();renderWorlds();toast("Focus world selected.");}catch(e){toast(e.message);}}));
    $$("[data-unlock-world]",root).forEach(b=>b.addEventListener("click",async()=>{try{const x=await api(`/api/worlds/${b.dataset.unlockWorld}/unlock`,{method:"POST"});user=x.user;updateAuthUI();renderWorlds();toast("World unlocked!");}catch(e){toast(e.message);}}));
  }
  async function renderProgress() {
    const root=$("#progress-view"),p=await api("/api/progress"),a=await api("/api/achievements");
    root.innerHTML=header("Your progress","Real focus, measured gently.")+
      `<div class="stat-grid"><div class="stat-tile"><small>Today</small><strong>${fmtMins(p.today_minutes)}</strong></div><div class="stat-tile"><small>Total focus</small><strong>${fmtMins(p.total_minutes)}</strong></div><div class="stat-tile"><small>Sessions</small><strong>${p.sessions}</strong></div><div class="stat-tile"><small>Day streak</small><strong>${p.streak}</strong></div></div><div class="gap"></div><div class="feature-grid">${card("Last seven days",`<div class="heatmap">${p.weekly.map(d=>`<div class="heat-cell ${d.minutes?"active":""}" data-level="${d.minutes>=75?3:d.minutes>=25?2:d.minutes>0?1:0}"><strong>${d.minutes}</strong><small>${new Date(d.date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"})}</small></div>`).join("")}</div><p class="inline-note">Minutes per day, calculated from completed focus sessions.</p>`,"sage")}${card("Achievements",`<div class="item-list">${a.achievements.map(x=>`<div class="list-row"><span style="font-size:27px">${pixelIcon(x.emoji,27)}</span><div class="row-main"><strong>${esc(x.name)}</strong><small>${esc(x.description)}</small></div><span class="pill">${x.unlocked?"Unlocked":"Locked"}</span></div>`).join("")}</div>`,"sun")}</div>`+
      `<div class="gap"></div>`+card("Recent focus sessions",p.recent_sessions.length?`<div class="item-list">${p.recent_sessions.map(s=>`<div class="list-row"><div class="row-main"><strong>${s.mode==="focus"?"Focus session":s.mode==="short"?"Short break":"Long break"}</strong><small>${s.ended_at?parseDate(s.ended_at).toLocaleString():"In progress"} · ${fmtMins(Math.floor(s.duration_seconds/60))}</small></div><span class="pill">${esc(s.status)}</span></div>`).join("")}</div>`:`<div class="empty-state">Your first completed session will show up here.</div>`);
  }
  async function renderCompete() {
    const root=$("#compete-view"),p=await api("/api/leaderboard");
    root.innerHTML=header("Compete","A little friendly rivalry. Focus first, compare second.")+
      `<div class="feature-card"><div class="feature-card-head sun">This week's focus leaderboard</div><div class="feature-card-body"><p>Scores use completed focus minutes from Monday onward. You can opt out in Settings.</p><div class="item-list">${p.entries.map(e=>`<div class="list-row ${e.is_me?"me":""}"><span class="pill">#${e.rank}</span><span class="friend-avatar">${avatarIcon(e.avatar)}</span><div class="row-main"><strong>${esc(e.display_name)} ${e.is_me?"(you)":""}</strong><small>@${esc(e.username)} · Level ${e.level}</small></div><strong>${fmtMins(e.minutes)}</strong></div>`).join("")||'<div class="empty-state">No scores yet. Be the first to grow!</div>'}</div></div></div>`;
  }
  async function renderFriends() {
    const root=$("#friends-view"),p=await api("/api/friends");
    root.innerHTML=header("Friends","Visit gardens, cheer each other on and keep growing.")+
      `<div class="feature-grid">${card("Find a gardener",`<form class="feature-form" id="friendForm"><input name="username" required minlength="3" maxlength="24" placeholder="Exact username"><button class="btn primary">Add friend</button></form><p class="inline-note">Requests are sent by username. No open direct messages in this version.</p>`,"rose")}${card("Your connections",p.friends.length?`<div class="item-list">${p.friends.map(f=>`<div class="list-row"><span class="friend-avatar">${avatarIcon(f.avatar)}</span><div class="row-main"><strong>${esc(f.display_name)}</strong><small>@${esc(f.username)} · Level ${f.level} · ${f.status}</small></div><div class="row-actions">${f.status==="pending"&&f.direction==="incoming"?`<button class="btn small primary" data-accept-friend="${f.id}">Accept</button>`:""}${f.status==="accepted"?`<button class="btn small" data-visit-friend="${esc(f.username)}">Visit garden</button>`:""}${f.status==="accepted"?`<button class="btn small quiet" data-block-friend="${f.id}" data-confirm>Block</button>`:""}<button class="btn small quiet" data-remove-friend="${f.id}" data-confirm>${f.status==="pending"?(f.direction==="incoming"?"Decline":"Cancel"):"Remove"}</button></div></div>`).join("")}</div>`:`<div class="empty-state">Your garden circle is empty. Add a friend by username to get started.</div>`,"sage")}</div><div id="friendGardenResult"></div>`;
    $("#friendForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{const r=await api("/api/friends/request",{method:"POST",body:JSON.stringify({username:fd.get("username")})});toast(r.status==="accepted"?"Friend request accepted.":"Friend request sent.");renderFriends();}catch(e){toast(e.message);}});
    $$("[data-accept-friend]",root).forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/friends/${b.dataset.acceptFriend}/accept`,{method:"POST"});toast("You're friends now!");renderFriends();}catch(e){toast(e.message);}}));
    $$("[data-remove-friend]",root).forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/friends/${b.dataset.removeFriend}`,{method:"DELETE"});renderFriends();toast("Connection removed.");}catch(e){toast(e.message);}}));
    $$("[data-block-friend]",root).forEach(b=>b.addEventListener("click",async()=>{try{await api(`/api/friends/${b.dataset.blockFriend}/block`,{method:"POST"});renderFriends();toast("Connection blocked.");}catch(e){toast(e.message);}}));
    $$("[data-visit-friend]",root).forEach(b=>b.addEventListener("click",async()=>{try{const g=await api(`/api/friends/${encodeURIComponent(b.dataset.visitFriend)}/garden`);$("#friendGardenResult").innerHTML=`<div class="gap"></div>${card(`${g.profile.display_name}'s garden`,g.plants.map(p=>`<div class="list-row"><span style="font-size:30px">${pixelIcon(icons[p.species]||"sprout",28)}</span><div class="row-main"><strong>${esc(p.nickname)}</strong><small>Stage ${p.stage+1}/5</small></div></div>`).join("")||"This garden is still growing.","sun")}`;}catch(e){toast(e.message);}}));
  }
  async function renderSettings() {
    const root=$("#settings-view");
    root.innerHTML=header("Settings","Your account, your garden, your boundaries.")+
      `<div class="feature-grid">${card("Profile & privacy",`<form id="settingsForm" class="item-list"><label>Display name<input class="field-input" name="display_name" maxlength="48" value="${esc(user.display_name||user.username)}"></label><label>Avatar<select class="field-input" name="avatar">${["flower","sprout","tulip","daisy","mushroom","moon","pot"].map(x=>`<option value="${x}" ${user.avatar===x?"selected":""}>${x[0].toUpperCase()+x.slice(1)}</option>`).join("")}</select></label><label><input type="checkbox" name="is_public" ${user.is_public?"checked":""}> My garden is visible to friends / public visitors</label><label><input type="checkbox" name="show_on_leaderboard" ${user.show_on_leaderboard?"checked":""}> Show me on the leaderboard</label><button class="btn primary">Save settings</button></form>`,"rose")}${card("Account",`<p>Signed in as <strong>@${esc(user.username)}</strong></p><p class="inline-note">Password hashes are stored server-side. Use a unique password and keep your account details private.</p><button class="btn" id="settingsSignOut">Sign out</button>`,"sun")}</div>`;
    $("#settingsForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{const p=await api("/api/profile",{method:"PATCH",body:JSON.stringify({display_name:fd.get("display_name"),avatar:fd.get("avatar"),is_public:fd.has("is_public"),show_on_leaderboard:fd.has("show_on_leaderboard")})});user=p.user;updateAuthUI();toast("Settings saved.");}catch(e){toast(e.message);}});
    $("#settingsSignOut").addEventListener("click",signOut);
  }
  async function signOut() {
    token="";user=null;currentSessionId=null;localStorage.removeItem(TOKEN_KEY);localStorage.removeItem("bloom-session-id");updateAuthUI();toast("Signed out. Your local timer still works.");showView("home");
  }
  async function ensureServerSession() {
    if(!user||currentSessionId) return;
    try {
      const p=await api("/api/sessions/start",{method:"POST",body:JSON.stringify({task_id:selectedTask?Number(selectedTask):null,mode:"focus"})});
      currentSessionId=p.session.id;localStorage.setItem("bloom-session-id",String(currentSessionId));
    } catch(e) { toast(e.message); }
  }
  async function pauseServerSession() {
    if(!user||!currentSessionId)return;
    try{await api(`/api/sessions/${currentSessionId}/pause`,{method:"POST"});}catch(e){toast(e.message);}
  }
  async function resumeServerSession() {
    if(!user||!currentSessionId)return;
    try{await api(`/api/sessions/${currentSessionId}/resume`,{method:"POST"});}catch(e){currentSessionId=null;localStorage.removeItem("bloom-session-id");await ensureServerSession();}
  }
  async function resetServerSession() {
    if(!user||!currentSessionId)return;
    try{await api(`/api/sessions/${currentSessionId}/cancel`,{method:"POST"});}catch{}
    currentSessionId=null;localStorage.removeItem("bloom-session-id");
  }
  async function completeServerSession() {
    if(!user) { toast("Session complete! Sign in to save rewards and analytics."); return; }
    if(!currentSessionId) await ensureServerSession();
    if(!currentSessionId)return;
    try {
      const p=await api(`/api/sessions/${currentSessionId}/complete`,{method:"POST"});
      currentSessionId=null;localStorage.removeItem("bloom-session-id");
      if(p.user){user=p.user;updateAuthUI();}
      if(p.reward&&p.reward.eligible)toast(`Lovely work! +${p.reward.xp} XP · +${p.reward.seeds} seeds · ${p.reward.minutes} focused minutes.`);
      else toast("Session saved. Rewards require at least one minute of server-recorded focus.");
      await renderHomeStats();
    } catch(e){toast(e.message);}
  }
  function bindEvents() {
    const themeBtn=$("#themeBtn"), order=["auto","light","dark"];
    const applyTheme=t=>{ if(t==="light"||t==="dark") document.documentElement.setAttribute("data-theme",t); else document.documentElement.removeAttribute("data-theme"); themeBtn.textContent="Theme: "+t; };
    let theme=order.includes(localStorage.getItem("bloom-theme"))?localStorage.getItem("bloom-theme"):"auto"; applyTheme(theme);
    themeBtn.addEventListener("click",()=>{ theme=order[(order.indexOf(theme)+1)%3]; try{localStorage.setItem("bloom-theme",theme);}catch{} applyTheme(theme); });
    document.addEventListener("click",e=>{
      const b=e.target.closest("[data-confirm]"); if(!b||b.dataset.armed) return;
      e.stopImmediatePropagation(); e.preventDefault();
      b.dataset.armed="1"; b.dataset.label=b.textContent; b.textContent="Sure?";
      setTimeout(()=>{ if(b.isConnected){ delete b.dataset.armed; b.textContent=b.dataset.label; } },3000);
    },true);
    $$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
    $("#mobileMenu").addEventListener("click",()=>setSidebar(!$("#sidebar").classList.contains("open")));
    $("#sidebarBackdrop").addEventListener("click",()=>setSidebar(false));
    $("#authOpen").addEventListener("click",()=>openAuth("register"));
    $("#authForm").addEventListener("submit",authSubmit);
    $("#authToggle").addEventListener("click",()=>{authMode=authMode==="register"?"login":"register";updateAuthMode();});
    $("#authGuest").addEventListener("click",()=>{closeAuth();toast("Local demo mode. Create an account to save social progress.");});
    $("#signOut").addEventListener("click",signOut);
    document.addEventListener("click",e=>{if(e.target.closest("[data-auth-open]"))openAuth("register");});
    $("#authModal").addEventListener("mousedown",e=>{if(e.target.id==="authModal")closeAuth();});
    document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$("#authModal").hidden)closeAuth();else setSidebar(false);});
    window.addEventListener("bloom:timer-start",()=>{ if(currentSessionId) resumeServerSession(); else ensureServerSession(); });
    window.addEventListener("bloom:timer-pause",pauseServerSession);
    window.addEventListener("bloom:timer-reset",resetServerSession);
    window.addEventListener("bloom:session-complete",completeServerSession);
    const body=$("#home-view .page");
    if(body){
      const select=document.createElement("div");select.className="active-task-row";
      select.innerHTML='<label for="activeTaskSelect">Focus task</label><select id="activeTaskSelect"><option value="">Focus on anything</option></select><button class="btn small" id="quickTasks">Tasks</button>';
      body.insertBefore(select,body.querySelector(".grid"));
      $("#quickTasks").addEventListener("click",()=>showView("tasks"));
      $("#activeTaskSelect").addEventListener("change",e=>{selectedTask=e.target.value;localStorage.setItem(SELECTED_TASK_KEY,selectedTask);});
    }
  }
  function renderStaticPixelIcons() {
    $$('[data-pixel]').forEach(el=>{el.innerHTML=pixelIcon(el.dataset.pixel,Number(el.dataset.pixelSize)||18);});
  }
  async function boot() {
    renderStaticPixelIcons();
    bindEvents();updateAuthUI();await refreshMe();
    if(user) {
      $("#authModal").hidden=true;
      await renderHomeStats();
    }
  }
  boot();
})();