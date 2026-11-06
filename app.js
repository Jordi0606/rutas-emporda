/* Rutas Empordà — app de una sola página, sin servidor. Datos en data.js (window.DATA). */
(() => {
  "use strict";
  const D = window.DATA;
  const RUTAS = D.rutas;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase();
  const TZ = "Europe/Madrid";
  const NOTE_MAX = 1000;
  const PALS = { type: "pals", label: "Pals", value: "Pals, Girona, España" };

  /* ---------- almacenamiento local (solo en este móvil) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("re_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("re_" + k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem("re_" + k); } catch {} },
  };
  let origin = store.get("origin", PALS);
  let calc = store.get("calc", null);      // {key, at, res:{n:{km,min}|{err}}}
  let notes = store.get("notes", {});
  let done = store.get("done", {});
  let zona = "", sortBy = store.get("sort", "n"), query = "";

  const originKey = (o) => o.type === "pals" ? "pals" : (typeof o.value === "string" ? "a:" + o.value : `g:${o.value.lat},${o.value.lng}`);
  const calcValid = () => calc && origin.type !== "pals" && calc.key === originKey(origin);

  /* ---------- formato ---------- */
  const fmtKm = (km) => km.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " km";
  const fmtMin = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h ${String(r).padStart(2, "0")} min` : `${r} min`; };
  const fmtWhen = (iso) => new Date(iso).toLocaleString("es-ES", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const valuesFor = (r) => {
    if (calcValid() && calc.res[r.n] && !calc.res[r.n].err) return { km: calc.res[r.n].km, min: calc.res[r.n].min, live: true };
    return { km: r.km, min: r.min, live: false };
  };

  /* ---------- hoy ---------- */
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function madridNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { y: +p.year, m: +p.month - 1, d: +p.day, wd };
  }
  function renderToday() {
    const t = madridNow();
    const dia = DIAS[t.wd], mes = MESES[t.m];
    const nth = Math.ceil(t.d / 7); // 1.º, 2.º, 3.º… sábado del mes
    const hoy = D.calendario.filter((c) => {
      const w = norm(c.cuando);
      if (c.evento === "EcoMercat") {
        if (t.wd !== 6) return false;
        if (w.includes("primer")) return nth === 1;
        if (w.includes("segundo") || w.includes("tercer")) return nth === 2 || nth === 3;
        return false;
      }
      return w.split(/[\s,\/]+/).includes(norm(dia));
    });
    const delMes = D.calendario.filter((c) => norm(c.cuando).includes(norm(mes)));
    const verano = t.m === 6 || t.m === 7;
    $("#today").innerHTML = `
      <h2>Hoy, ${dia} ${t.d} de ${mes}</h2>
      ${verano ? `<p class="warn">Julio y agosto están fuera del plan de excursiones.</p>` : ""}
      <p>${hoy.length ? "Mercados habituales hoy:" : "Hoy no hay mercados de la guía."}</p>
      ${hoy.length ? `<div class="chips">${hoy.map((c) => `<span class="chip">${esc(c.poblacion)}</span>`).join("")}</div>` : ""}
      ${delMes.length ? `<p>Este mes (${mes}): ${delMes.map((c) => `${esc(c.evento)} · ${esc(c.poblacion)}`).join("; ")}.</p>` : ""}
      <p class="hint">Fechas orientativas de la guía: confírmalas antes de ir.</p>`;
  }

  /* ---------- lista ---------- */
  function haystack(r) {
    return norm([r.nucleos.join(" "), r.enfoque, r.comarca,
      r.poblaciones.map((p) => p.nombre + " " + p.puntos.join(" ")).join(" "),
      r.lugares.map((l) => l.lugar + " " + l.tipo).join(" "),
      r.eventos.map((e) => e.evento).join(" "), notes[r.n] || ""].join(" "));
  }
  const HAY = Object.fromEntries(RUTAS.map((r) => [r.n, haystack(r)]));

  function renderHeader() {
    $("#originLabel").textContent = origin.label;
    $("#originMeta").textContent = origin.type === "pals" ? "datos del PDF"
      : calcValid() ? "recalculado " + fmtWhen(calc.at) : "sin recalcular";
  }

  function renderList() {
    renderHeader();
    let rs = RUTAS.filter((r) => (!zona || r.comarca === zona) && (!query || HAY[r.n].includes(query)));
    const v = (r) => valuesFor(r);
    if (sortBy === "km") rs.sort((a, b) => v(a).km - v(b).km);
    else if (sortBy === "min") rs.sort((a, b) => v(a).min - v(b).min);
    else if (sortBy === "pend") rs.sort((a, b) => (!!done[a.n] - !!done[b.n]) || a.n - b.n);
    else rs.sort((a, b) => a.n - b.n);
    const hechas = Object.keys(done).filter((k) => done[k]).length;
    $("#summary").textContent = `${rs.length} de ${RUTAS.length} rutas · ${hechas} hechas` +
      (origin.type !== "pals" && !calcValid() ? " · km y tiempos aún desde Pals" : "");
    $("#list").innerHTML = rs.map((r) => {
      const x = v(r);
      const hasNote = (notes[r.n] || "").trim().length > 0;
      return `<li><a class="item${done[r.n] ? " done" : ""}" href="#ruta-${r.n}" style="text-decoration:none;color:inherit">
        <span class="plate">R${String(r.n).padStart(2, "0")}</span>
        <span class="t"><span class="stops">${r.nucleos.map(esc).join(" · ")}</span>
          <span class="sub"><span class="tag ${r.comarca.startsWith("Alt") ? "alt" : "baix"}">${r.comarca.split(" ")[0]}</span>
          <span>${esc(r.enfoque)}</span>${done[r.n] ? "<span>✓ hecha</span>" : ""}${hasNote ? "<span>✎ nota</span>" : ""}</span></span>
        <span class="nums"><b>${fmtKm(x.km)}</b><span>${fmtMin(x.min)}</span></span></a></li>`;
    }).join("") || `<li class="summary">Ninguna ruta coincide con la búsqueda.</li>`;
  }

  /* ---------- enlaces de navegación ---------- */
  const placeStr = (n) => `${n}, Girona, España`;
  const originStr = () => typeof origin.value === "string" ? origin.value : `${origin.value.lat},${origin.value.lng}`;
  const waze = (q) => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  const wazeLL = (o) => `https://waze.com/ul?ll=${o.lat},${o.lng}&navigate=yes`;
  const gmaps = (r) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(originStr())}&destination=${encodeURIComponent(originStr())}&waypoints=${encodeURIComponent(r.nucleos.map(placeStr).join("|"))}`;

  /* ---------- ficha ---------- */
  let homeScroll = 0;
  function renderDetail(n) {
    const r = RUTAS.find((x) => x.n === n);
    if (!r) { location.hash = ""; return; }
    const x = valuesFor(r);
    const res = calcValid() ? calc.res[r.n] : null;
    const note = notes[r.n] || "";
    const prioTxt = { principal: "Principal", opcional: "Opcional", aparte: "Excursión aparte", cerrado: "Cerrado" };
    const back = origin.type === "gps" ? wazeLL(origin.value) : waze(originStr());
    const statLive = x.live
      ? `<div class="stat"><div class="k">Desde ${esc(origin.label)}</div><div class="v">${fmtKm(x.km)}</div><div class="s">${fmtMin(x.min)} · ida y vuelta</div></div>
         <div class="stat"><div class="k">Base del PDF (Pals)</div><div class="v">${fmtKm(r.km)}</div><div class="s">${fmtMin(r.min)}</div></div>`
      : `<div class="stat"><div class="k">Km ida y vuelta</div><div class="v">${fmtKm(r.km)}</div><div class="s">desde Pals (PDF)</div></div>
         <div class="stat"><div class="k">Conducción</div><div class="v">${fmtMin(r.min)}</div><div class="s">+ 60–90 min de comida</div></div>`;
    $("#detail").innerHTML = `
      <button class="back" type="button" data-back>‹ Todas las rutas</button>
      <div class="dhead">
        <span class="plate">R${String(r.n).padStart(2, "0")}</span>
        <h2>${r.nucleos.map(esc).join(" · ")}</h2>
        <div class="meta">${esc(r.comarca)} · ${esc(r.enfoque)} · Mejor época: ${esc(r.epoca)}</div>
      </div>
      <div class="stats">${statLive}</div>
      ${res && res.err ? `<p class="alert">No se pudo recalcular esta ruta: ${esc(res.err)}. Se muestran los datos del PDF.</p>` : ""}
      ${r.atencion ? `<p class="alert">${esc(r.atencion)}</p>` : ""}
      <div class="nav"><a class="lnk main" href="${gmaps(r)}" target="_blank" rel="noopener">Ruta completa en Google Maps</a></div>

      <section class="card"><h3>Paradas · Waze</h3>
        ${r.nucleos.map((s, i) => {
          const p = r.poblaciones.find((q) => q.nombre === s);
          return `<div class="stop"><div class="stop-h"><b>${i + 1}. ${esc(s)}</b>
            <a class="lnk" href="${waze(placeStr(s))}" target="_blank" rel="noopener">Waze</a></div>
            ${p ? `<p>${p.puntos.map(esc).join(" · ")}</p>` : ""}</div>`;
        }).join("")}
        <div class="stop"><div class="stop-h"><b>Vuelta a ${esc(origin.label)}</b>
          <a class="lnk" href="${back}" target="_blank" rel="noopener">Waze</a></div></div>
      </section>

      ${r.lugares.length ? `<section class="card"><h3>Castillos, monasterios, calas y arqueología</h3>
        ${r.lugares.map((l) => `<div class="place"><div class="h"><b>${esc(l.lugar)}</b>
          <span class="pill ${l.prio}">${prioTxt[l.prio]}</span></div>
          <p>${esc(l.tipo.split("·")[0].trim())} · ${esc(l.acceso)}</p></div>`).join("")}
      </section>` : ""}

      <section class="card"><h3>Mercados, ferias y fiestas</h3>
        <dl class="ev">${r.eventos.map((e) => `<dt>${esc(e.nombre)}</dt><dd>${esc(e.evento)}</dd>`).join("")}</dl>
      </section>

      <section class="card"><h3>Mi nota</h3>
        <label for="note" class="hint">Hasta ${NOTE_MAX} caracteres. Se guarda sola en este móvil.</label>
        <textarea id="note" maxlength="${NOTE_MAX}" placeholder="Dónde aparcar, dónde comimos, qué dejar para otra vez…">${esc(note)}</textarea>
        <div class="count"><span id="saved"></span><span id="cnt"></span></div>
        <button id="doneBtn" class="btn donebtn" type="button" aria-pressed="${!!done[r.n]}">${done[r.n] ? "✓ Hecha · desmarcar" : "Marcar como hecha"}</button>
      </section>`;
    const ta = $("#note"), cnt = $("#cnt"), saved = $("#saved");
    const upd = () => { const l = ta.value.length; cnt.textContent = `${l} / ${NOTE_MAX}`; cnt.className = l >= NOTE_MAX ? "over" : ""; };
    let tmr; upd();
    ta.addEventListener("input", () => {
      upd(); saved.textContent = "";
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        const v = ta.value.slice(0, NOTE_MAX);
        if (v.trim()) notes[r.n] = v; else delete notes[r.n];
        HAY[r.n] = haystack(r);
        saved.textContent = store.set("notes", notes) ? "Guardado" : "No se pudo guardar en este navegador";
      }, 500);
    });
    $("#doneBtn").addEventListener("click", () => {
      if (done[r.n]) delete done[r.n]; else done[r.n] = true;
      store.set("done", done); renderDetail(n);
    });
  }

  /* ---------- router por #hash ---------- */
  function route() {
    const m = location.hash.match(/^#ruta-(\d+)$/);
    if (m) {
      if (!$("#home").hidden) homeScroll = scrollY;
      $("#home").hidden = true; $("#detail").hidden = false;
      renderDetail(+m[1]); scrollTo(0, 0);
    } else {
      $("#detail").hidden = true; $("#home").hidden = false;
      renderList(); scrollTo(0, homeScroll);
    }
  }
  addEventListener("hashchange", route);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) { history.length > 1 && /^#ruta-/.test(location.hash) ? history.back() : (location.hash = ""); }
  });

  /* ---------- Google (Maps JavaScript API + librería routes) ---------- */
  let mapsP = null, mapsKey = null;
  function loadMaps(key) {
    if (mapsP && mapsKey === key) return mapsP;
    if (mapsP && mapsKey !== key) { location.reload(); return new Promise(() => {}); }
    mapsKey = key;
    mapsP = new Promise((resolve, reject) => {
      window.gm_authFailure = () => reject(new Error("Google ha rechazado la clave. Revisa que sea correcta, que tenga activadas Maps JavaScript API y Routes API, y que permita esta web."));
      window.__reMapsReady = () => resolve();
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=es&region=ES&callback=__reMapsReady`;
      s.async = true;
      s.onerror = () => reject(new Error("No se pudo cargar Google Maps. ¿Hay conexión a internet?"));
      document.head.appendChild(s);
    });
    mapsP.catch(() => { mapsP = null; mapsKey = null; });
    return mapsP;
  }

  async function computeOne(Route, r) {
    const o = origin.value;
    const req = {
      origin: o, destination: o,
      intermediates: r.nucleos.map((s) => ({ location: placeStr(s) })),
      travelMode: "DRIVING",
      routingPreference: "TRAFFIC_UNAWARE",
      fields: ["distanceMeters", "durationMillis"],
    };
    const { routes } = await Route.computeRoutes(req);
    const rt = routes && routes[0];
    if (!rt || rt.distanceMeters == null) throw new Error("Google no devolvió ninguna ruta");
    return { km: Math.round(rt.distanceMeters / 100) / 10, min: Math.round((rt.durationMillis || 0) / 60000) };
  }

  let busy = false;
  async function recalc() {
    const msg = $("#sheetMsg");
    msg.className = "msg"; msg.textContent = "";
    if (origin.type === "pals") { msg.textContent = "Desde Pals se usan los datos del PDF; no hace falta recalcular."; return; }
    const key = store.get("key", "");
    if (!key) { msg.className = "msg err"; msg.textContent = "Primero guarda tu clave de Google (abajo, en este menú)."; $("#key").focus(); return; }
    if (busy) return;
    busy = true; setBusy(true);
    const prog = $("#progress"), bar = $(".bar i", prog), lab = $("span", prog);
    prog.hidden = false; bar.style.width = "0"; lab.textContent = `0 / ${RUTAS.length}`;
    const res = {}; let k = 0, fails = 0, fatal = null;
    try {
      await loadMaps(key);
      const { Route } = await google.maps.importLibrary("routes");
      const queue = RUTAS.slice();
      const worker = async () => {
        while (queue.length && !fatal) {
          const r = queue.shift();
          try { res[r.n] = await computeOne(Route, r); }
          catch (e) {
            fails++; res[r.n] = { err: (e && e.message) || "error desconocido" };
            if (fails >= 3 && k < 3) fatal = e; // falla todo desde el principio: parar y no gastar más
          }
          k++; bar.style.width = (100 * k / RUTAS.length) + "%"; lab.textContent = `${k} / ${RUTAS.length}`;
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (fatal) throw fatal;
      calc = { key: originKey(origin), at: new Date().toISOString(), res };
      store.set("calc", calc);
      msg.className = fails ? "msg err" : "msg ok";
      msg.textContent = fails ? `Recalculadas ${RUTAS.length - fails} de ${RUTAS.length}. Las que fallaron muestran los datos del PDF.` : `Listo: ${RUTAS.length} rutas recalculadas desde ${origin.label}.`;
      toast("Rutas recalculadas");
    } catch (e) {
      msg.className = "msg err";
      msg.textContent = "No se pudo recalcular. " + ((e && e.message) || "");
    } finally {
      busy = false; setBusy(false); route();
    }
  }
  function setBusy(b) { ["#recalcBtn", "#gpsBtn", "#palsBtn"].forEach((s) => ($(s).disabled = b)); $("#addrForm button").disabled = b; }

  function setOrigin(o) {
    origin = o; store.set("origin", origin); route();
    if (o.type !== "pals" && !calcValid()) recalc();
    else { $("#sheetMsg").className = "msg ok"; $("#sheetMsg").textContent = o.type === "pals" ? "Origen: Pals. Datos del PDF." : "Ya estaba calculado para este origen."; }
  }

  /* ---------- menú ---------- */
  const sheet = $("#sheet");
  function openSheet() { sheet.hidden = false; renderKeyState(); $("#sheetMsg").textContent = ""; }
  function closeSheet() { if (!busy) sheet.hidden = true; }
  $("#menuBtn").addEventListener("click", openSheet);
  $("#originBtn").addEventListener("click", openSheet);
  sheet.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

  $("#gpsBtn").addEventListener("click", () => {
    const msg = $("#sheetMsg");
    if (!("geolocation" in navigator)) { msg.className = "msg err"; msg.textContent = "Este navegador no permite la ubicación."; return; }
    msg.className = "msg"; msg.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = +p.coords.latitude.toFixed(5), lng = +p.coords.longitude.toFixed(5);
      const hora = new Date().toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
      setOrigin({ type: "gps", label: `Mi ubicación (${hora})`, value: { lat, lng } });
    }, (err) => {
      msg.className = "msg err";
      msg.textContent = err.code === 1 ? "Has denegado el permiso de ubicación. Actívalo para esta web en los ajustes del navegador o escribe un lugar." : "No se pudo obtener la ubicación. Prueba de nuevo o escribe un lugar.";
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });
  $("#palsBtn").addEventListener("click", () => setOrigin(PALS));
  $("#addrForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#addr").value.trim();
    if (v.length < 2) { $("#sheetMsg").className = "msg err"; $("#sheetMsg").textContent = "Escribe un lugar (pueblo, dirección u hotel)."; return; }
    setOrigin({ type: "addr", label: v, value: /,/.test(v) ? v : `${v}, España` });
  });
  $("#recalcBtn").addEventListener("click", recalc);

  function renderKeyState() {
    const k = store.get("key", "");
    $("#keyState").textContent = k ? `Clave guardada (termina en …${k.slice(-4)}). Para cambiarla, pega otra y pulsa Guardar.` : "Sin clave: la app funciona con los datos del PDF, pero no puede recalcular.";
  }
  $("#keyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#key").value.trim();
    if (!/^[A-Za-z0-9_\-]{20,}$/.test(v)) { $("#keyState").textContent = "Eso no parece una clave de Google (suelen empezar por AIza)."; return; }
    const prev = store.get("key", "");
    store.set("key", v); $("#key").value = "";
    renderKeyState(); toast("Clave guardada");
    if (prev && prev !== v && mapsP) location.reload();
  });

  $("#copyNotes").addEventListener("click", async () => {
    const txt = RUTAS.filter((r) => (notes[r.n] || "").trim() || done[r.n])
      .map((r) => `R${String(r.n).padStart(2, "0")} ${r.nucleos.join(" · ")}${done[r.n] ? " [hecha]" : ""}\n${notes[r.n] || ""}`).join("\n\n");
    if (!txt) { toast("Aún no hay notas"); return; }
    try { await navigator.clipboard.writeText(txt); toast("Notas copiadas"); }
    catch {
      const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); toast("Notas copiadas"); } catch { toast("No se pudieron copiar"); }
      t.remove();
    }
  });

  /* ---------- filtros ---------- */
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
    zona = b.dataset.zona; renderList();
  }));
  $("#q").addEventListener("input", (e) => { query = norm(e.target.value.trim()); renderList(); });
  $("#sort").value = sortBy;
  $("#sort").addEventListener("change", (e) => { sortBy = e.target.value; store.set("sort", sortBy); renderList(); });

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => (el.hidden = true), 2200); }

  renderToday();
  route();
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
