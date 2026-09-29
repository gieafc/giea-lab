/* =========================================================
   GIEA · Asistencia y reserva de equipos — interfaz
   ========================================================= */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG;
  const API = window.API;
  const $app = document.getElementById('app');

  /* ---------------- Estado ---------------- */
  const S = { yo: null, labs: [], equipos: [], perfiles: [], cal: null, timers: [] };

  /* ---------------- Utilidades ---------------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ = CFG.ZONA_HORARIA;
  const fmt = (d, o) => new Intl.DateTimeFormat('es-PE', { timeZone: TZ, ...o }).format(new Date(d));
  const hora = d => fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);
  const fechaLarga = d => may(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }));
  const fechaCorta = d => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const primerNombre = n => String(n || '').trim().split(/\s+/)[0];
  const iniciales = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const nombreLab = c => c === 'AMBOS' ? 'Ambos laboratorios' : !c ? 'Compartido' : (S.labs.find(l => l.codigo === c) || {}).nombre || c;
  const PRIORIDAD = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const limpiarTimers = () => { S.timers.forEach(t => clearInterval(t)); S.timers = []; };

  const I = {
    panel: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    reservar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
    mis: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    asistencia: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h3v3H7zM14 8h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/>',
    admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    llave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M18 5l2 2"/>',
    cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
    izq: '<path d="m15 18-6-6 6-6"/>', der: '<path d="m9 18 6-6-6-6"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    entrar: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    pantalla: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    observ: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4M12 14h.01"/>'
  };
  const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  function aviso(msg, tipo = '') {
    const d = document.createElement('div');
    d.className = 'aviso ' + tipo; d.textContent = msg;
    document.getElementById('avisos').appendChild(d);
    setTimeout(() => d.remove(), tipo === 'error' ? 7000 : 3800);
  }

  function modal({ titulo, cuerpo, acciones = [], ancho = false, alAbrir }) {
    const f = document.createElement('div');
    f.className = 'fondo-modal';
    f.innerHTML = `<div class="modal ${ancho ? 'ancho' : ''}" role="dialog" aria-modal="true" aria-labelledby="mt">
      <header><h2 id="mt">${esc(titulo)}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></header>
      <div class="contenido">${cuerpo}</div>
      ${acciones.length ? `<footer>${acciones.map((a, i) => `<button class="btn ${a.clase || ''}" data-acc="${i}" ${a.tipo === 'submit' ? 'type="submit"' : 'type="button"'}>${a.texto}</button>`).join('')}</footer>` : ''}
    </div>`;
    const cerrar = () => { f.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = e => { if (e.key === 'Escape') cerrar(); };
    f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', teclas);
    acciones.forEach((a, i) => f.querySelector(`[data-acc="${i}"]`).addEventListener('click', async ev => {
      const b = ev.currentTarget;
      if (!a.accion) return cerrar();
      b.disabled = true;
      try { const r = await a.accion(f, cerrar); if (r !== false) cerrar(); }
      catch (e) { const err = f.querySelector('.error-modal'); if (err) { err.textContent = e.message; err.classList.remove('oculto'); } else aviso(e.message, 'error'); }
      finally { b.disabled = false; }
    }));
    document.body.appendChild(f);
    const primero = f.querySelector('input:not([readonly]), textarea, select');
    (primero || f.querySelector('.cerrar')).focus();
    if (alAbrir) alAbrir(f, cerrar);
    return { el: f, cerrar };
  }
  const confirmar = (titulo, texto, boton = 'Confirmar', clase = '') => new Promise(res => {
    modal({ titulo, cuerpo: `<p>${texto}</p>`, acciones: [
      { texto: 'Volver', clase: 'sec', accion: () => res(false) },
      { texto: boton, clase, accion: () => res(true) }] });
  });

  /* ---------------- Rutas ---------------- */
  function ruta() {
    const h = location.hash.replace(/^#\/?/, '') || 'panel';
    const [camino, qs] = h.split('?');
    return { camino, partes: camino.split('/'), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  const ir = h => { if (location.hash === h) render(); else location.hash = h; };
  window.addEventListener('hashchange', () => render());

  async function cargarCatalogos() {
    [S.labs, S.equipos, S.perfiles, S.turnos, S.reglas] = await Promise.all([API.laboratorios(), API.equipos(), API.perfiles(), API.turnos(), API.reglas()]);
  }

  async function render() {
    limpiarTimers();
    if (S.cal) { S.cal.destroy(); S.cal = null; }
    const r = ruta();

    if (!S.yo) {
      if (r.camino === 'marcar') { try { sessionStorage.setItem('giea-pendiente', location.hash); } catch (e) {} }
      return vistaAcceso(r.camino === 'marcar');
    }
    if (S.yo.cambiar_pin && !API.demo) return vistaPin(true);

    if (S.yo.rol === 'kiosco') {
      const lab = S.yo.laboratorio === 'AMBOS' ? (r.q.lab || S.labs[0]?.codigo) : S.yo.laboratorio;
      if (r.camino !== 'qr' || r.q.lab !== lab) { location.replace('#/qr?lab=' + lab); return; }
      return vistaQR(lab);
    }
    try { const p = sessionStorage.getItem('giea-pendiente'); if (p) { sessionStorage.removeItem('giea-pendiente'); if (p !== location.hash) { location.replace(p); return; } } } catch (e) {}

    const v = r.partes[0];
    if (v === 'qr') return S.yo.rol === 'admin' ? vistaQR(r.q.lab || S.labs[0].codigo) : ir('#/asistencia');
    const vistas = {
      panel: vistaPanel, reservar: vistaReservar, 'mis-reservas': vistaMisReservas,
      asistencia: vistaAsistencia, marcar: vistaMarcar, observaciones: vistaObservaciones, pin: () => vistaPin(false), admin: vistaAdmin
    };
    if (v === 'admin' && S.yo.rol !== 'admin') return ir('#/panel');
    (vistas[v] || vistaPanel)(r);
  }

  /* ---------------- Estructura ---------------- */
  function shell(activa, titulo, ruta_, contenido) {
    const esAdmin = S.yo.rol === 'admin';
    const nav = [
      ['panel', 'Panel', 'panel'], ['reservar', 'Reservar', 'reservar'],
      ['mis-reservas', 'Mis reservas', 'mis', 'Reservas'], ['asistencia', 'Asistencia', 'asistencia'],
      ['observaciones', 'Observaciones', 'observ', 'Observ.']
    ];
    if (esAdmin) nav.push(['admin', 'Administración', 'admin', 'Admin']);
    const link = ([h, t, i]) => `<a href="#/${h}" ${activa === h ? 'aria-current="page"' : ''}>${ic(i)}<span>${t}</span></a>`;
    const linkCorto = ([h, t, i, c]) => link([h, c || t, i]);
    $app.innerHTML = `
    <div class="shell">
      <aside class="lateral">
        <div class="marca"><img src="assets/logo-giea.png" alt="GIEA"></div>
        <nav class="nav" aria-label="Principal">
          ${nav.map(link).join('')}
          <div class="sep"></div>
          <a href="#/pin" ${activa === 'pin' ? 'aria-current="page"' : ''}>${ic('llave')}<span>Cambiar PIN</span></a>
          <a href="#" data-salir>${ic('salir')}<span>Salir</span></a>
        </nav>
        <div class="yo">
          <div><div class="nombre">${esc(S.yo.nombre)}</div>
          <div class="sub">${esc(S.yo.codigo)} · ${esc(nombreLab(S.yo.laboratorio))}</div>
          ${S.yo.supervisor ? `<div class="sub">Supervisor: ${esc(S.yo.supervisor)}</div>` : ''}</div>
          <img class="uni" src="assets/logo-uni.png" alt="Universidad Nacional de Ingeniería">
        </div>
      </aside>
      <main class="principal">
        <div class="movil-marca"><img src="assets/logo-giea.png" alt="GIEA">
          <div class="fila"><a class="btn sec chico" href="#/pin" aria-label="Cambiar PIN">${ic('llave')}</a><button class="btn sec chico" data-salir aria-label="Salir">${ic('salir')}</button></div></div>
        ${API.demo ? `<div class="banda-demo"><b>Modo demostración.</b> Los datos son de ejemplo y se borran al recargar. Para usar la versión real, complete <code>js/config.js</code>.</div>` : ''}
        <div class="cabecera"><div>${ruta_ ? `<div class="ruta">${ruta_}</div>` : ''}<h1>${titulo}</h1></div><div class="acciones-cab fila"></div></div>
        <div id="vista">${contenido || ''}</div>
      </main>
      <nav class="barra-movil" aria-label="Principal">${nav.map(linkCorto).join('')}</nav>
    </div>`;
    $$('[data-salir]').forEach(b => b.addEventListener('click', async e => { e.preventDefault(); await API.salir(); S.yo = null; location.hash = '#/panel'; render(); }));
    return $('#vista');
  }

  /* ================= ACCESO ================= */
  function vistaAcceso(desdeQR) {
    $app.innerHTML = `
    <div class="acceso">
      <section class="acceso-marca">
        <div>
          <div class="logos"><img class="giea" src="assets/logo-giea.png" alt="GIEA"><img class="uni" src="assets/logo-uni.png" alt="Universidad Nacional de Ingeniería"></div>
          <h1>${esc(CFG.TITULO_APP)}</h1>
          <p>Reserve los equipos del laboratorio por bloques de horas y marque su entrada y salida con el código QR de la pantalla.</p>
        </div>
        <svg class="curva" viewBox="0 0 800 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C120 68 220 72 300 70 S360 66 380 72 C395 78 400 150 410 150 C420 150 425 80 440 72 C470 60 520 66 560 60 C600 54 610 20 640 18 C680 16 700 30 740 28 L800 26" fill="none" stroke="#E0524A" stroke-width="2" opacity=".45"/>
        </svg>
        <div class="pie">${esc(CFG.NOMBRE_GRUPO)} · ${esc(CFG.INSTITUCION)}</div>
      </section>
      <section class="acceso-form">
        <form novalidate>
          <div><h2>Ingresar</h2>
          <p class="tenue">${desdeQR ? 'Ingrese para registrar su asistencia.' : 'Use su código de usuario y su PIN.'}</p></div>
          <label class="campo"><span>Código de usuario</span>
            <input type="text" name="codigo" autocomplete="username" autocapitalize="characters" spellcheck="false" required placeholder="Ej.: GE101"></label>
          <label class="campo"><span>PIN</span>
            <input class="pin" type="password" name="pin" inputmode="numeric" autocomplete="current-password" required placeholder="••••"></label>
          <div class="error oculto" role="alert"></div>
          <button class="btn bloque" type="submit">${ic('entrar')} Ingresar</button>
          <p class="tenue" style="font-size:.9rem">¿Olvidó su PIN? Pida al administrador que lo restablezca.</p>
          ${API.demo ? `<div class="nota-demo"><b>Modo demostración.</b> Pruebe con
            <button type="button" data-demo="DEMO-ADMIN:1234">administrador</button>,
            <button type="button" data-demo="DEMO2:2222">usuario de Laboratorio 2</button> o
            <button type="button" data-demo="QR-LAB1:9991">pantalla QR</button>.</div>` : ''}
        </form>
      </section>
    </div>`;
    const f = $('form'), err = $('.error', f);
    $$('[data-demo]', f).forEach(b => b.addEventListener('click', () => {
      const [c, p] = b.dataset.demo.split(':'); f.codigo.value = c; f.pin.value = p; f.requestSubmit();
    }));
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.classList.add('oculto');
      const codigo = f.codigo.value.trim(), pin = f.pin.value.trim();
      if (!codigo || !pin) { err.textContent = 'Escriba su código y su PIN.'; err.classList.remove('oculto'); return; }
      const b = $('button[type=submit]', f); b.disabled = true; b.lastChild.textContent = ' Ingresando…';
      try {
        S.yo = await API.login(codigo, pin);
        await cargarCatalogos();
        render();
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove('oculto');
        b.disabled = false; b.lastChild.textContent = ' Ingresar';
      }
    });
    f.codigo.focus();
  }

  /* ================= CAMBIAR PIN ================= */
  function vistaPin(obligatorio) {
    const html = `
      <div class="tarjeta" style="max-width:460px">
        <form class="lista" novalidate>
          <p>${obligatorio ? 'Por seguridad, reemplace el PIN inicial por uno que solo usted conozca.' : 'Elija un PIN nuevo de 4 a 8 dígitos.'}</p>
          <label class="campo"><span>PIN nuevo</span><input class="pin" type="password" name="p1" inputmode="numeric" autocomplete="new-password" maxlength="8"></label>
          <label class="campo"><span>Repita el PIN nuevo</span><input class="pin" type="password" name="p2" inputmode="numeric" autocomplete="new-password" maxlength="8"></label>
          <div class="error oculto" role="alert"></div>
          <button class="btn" type="submit">Guardar PIN</button>
        </form>
      </div>`;
    if (obligatorio) {
      $app.innerHTML = `<div class="acceso-form" style="min-height:100vh"><div style="width:min(460px,100%)" class="lista">
        <img src="assets/logo-giea.png" alt="GIEA" width="150"><h1>Hola, ${esc(primerNombre(S.yo.nombre))}</h1>${html}</div></div>`;
    } else shell('pin', 'Cambiar PIN', '', html);
    const f = $('form'), err = $('.error', f);
    f.p1.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.classList.add('oculto');
      const a = f.p1.value.trim(), b = f.p2.value.trim();
      const mal = m => { err.textContent = m; err.classList.remove('oculto'); };
      if (!/^\d{4,8}$/.test(a)) return mal('El PIN debe tener entre 4 y 8 dígitos (solo números).');
      if (/^(\d)\1+$/.test(a) || '0123456789'.includes(a) || '9876543210'.includes(a)) return mal('Elija un PIN menos predecible (no repetido ni consecutivo).');
      if (a !== b) return mal('Los dos PIN no coinciden.');
      try { await API.cambiarPin(a); S.yo.cambiar_pin = false; aviso('PIN actualizado', 'ok'); ir('#/panel'); }
      catch (ex) { mal(ex.message); }
    });
  }

  /* ================= PANEL ================= */
  function puedeUsar(e) {
    if (S.yo.rol === 'admin' || !e.laboratorio || S.yo.laboratorio === 'AMBOS') return true;
    return e.laboratorio === S.yo.laboratorio;
  }

  async function vistaPanel(r) {
    const hoy = U.fechaLima();
    const fecha = r.q.fecha || hoy;
    const filtro = r.q.lab || (S.yo.laboratorio !== 'AMBOS' && S.yo.rol !== 'admin' ? S.yo.laboratorio : 'todos');
    const saludo = (() => { const h = +hora(new Date()).slice(0, 2); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; })();
    const v = shell('panel', `${saludo}, ${esc(primerNombre(S.yo.nombre))}`, fechaLarga(new Date()), `
      <div class="columna">
          <section class="tarjeta" id="t-hoy">
            <header>
              <div><h2>Equipos · ${fecha === hoy ? 'hoy' : fechaLarga(U.enLima(fecha, '12:00')).toLowerCase()}</h2>
              <div class="sub">Toque un espacio libre para reservar, o una barra para ver el detalle.</div></div>
              <div class="fila">
                <div class="segmentos" role="group" aria-label="Laboratorio">
                  ${[['todos', 'Todos'], ...S.labs.map(l => [l.codigo, window.innerWidth < 760 ? l.codigo : l.nombre])].map(([c, n]) => `<button type="button" data-lab="${c}" aria-pressed="${filtro === c}">${esc(n)}</button>`).join('')}
                </div>
                <div class="fila" style="gap:4px">
                  <button class="btn sec icono" data-dia="-1" aria-label="Día anterior">${ic('izq')}</button>
                  <button class="btn sec chico" data-dia="0">Hoy</button>
                  <button class="btn sec icono" data-dia="1" aria-label="Día siguiente">${ic('der')}</button>
                </div>
              </div>
            </header>
            <div class="linea-tiempo"><div class="vacio">Cargando…</div></div>
            <div class="leyenda" style="margin-top:12px"><span><i style="background:var(--coral)"></i>Sus reservas</span><span><i style="background:var(--azul)"></i>Reservas de otras personas</span><span><i style="background:repeating-linear-gradient(135deg,#F4F6FA 0 4px,#E1E6EE 4px 8px)"></i>No disponible</span></div>
          </section>
          <div class="tres">
          <section class="tarjeta" id="t-asis"><header><h2>Su asistencia</h2><a class="btn sec chico" href="#/asistencia">Ver historial</a></header><div class="vacio">Cargando…</div></section>
          <section class="tarjeta" id="t-prox"><header><h2>Sus próximas reservas</h2><a class="btn chico" href="#/reservar">${ic('mas')} Reservar</a></header><div class="lista"><div class="vacio">Cargando…</div></div></section>
          <section class="tarjeta" id="t-pres"><header><h2>En el laboratorio ahora</h2></header><div class="lista"><div class="vacio">Cargando…</div></div></section>
          </div>
          <section class="tarjeta" id="t-uso">
            <header><div><h2>Horas reservadas por equipo</h2><div class="sub">Últimos 30 días</div></div></header>
            <div class="barras"><div class="vacio">Cargando…</div></div>
          </section>
      </div>`);

    const nav = (f, l) => ir(`#/panel?fecha=${f}&lab=${l}`);
    $$('[data-lab]', v).forEach(b => b.addEventListener('click', () => nav(fecha, b.dataset.lab)));
    $$('[data-dia]', v).forEach(b => b.addEventListener('click', () => nav(+b.dataset.dia === 0 ? hoy : U.sumarDias(fecha, +b.dataset.dia), filtro)));

    const inicioDia = U.enLima(fecha, '00:00'), finDia = U.enLima(U.sumarDias(fecha, 1), '00:00');
    const hace30 = U.enLima(U.sumarDias(hoy, -30), '00:00'), en60 = U.enLima(U.sumarDias(hoy, 60), '00:00');

    try {
      const [delDia, rango, presentes, asis, obs] = await Promise.all([
        API.reservas(inicioDia, finDia),
        API.reservas(hace30, en60),
        API.presentes().catch(() => []),
        API.reporteAsistencia(U.sumarDias(hoy, -6), hoy).catch(() => []),
        API.observaciones().catch(() => [])
      ]);
      S.obsPend = obs.filter(o => o.estado === 'Pendiente');
      pintarLineaTiempo($('#t-hoy .linea-tiempo'), fecha, filtro, delDia);
      pintarUso($('#t-uso .barras'), rango.filter(x => new Date(x.inicio) < new Date() && new Date(x.fin) > hace30));
      pintarProximas($('#t-prox .lista'), rango.filter(x => x.usuario_id === S.yo.id && new Date(x.fin) > new Date()).slice(0, 5));
      pintarPresentes($('#t-pres .lista'), presentes);
      pintarAsistencia($('#t-asis'), asis.filter(a => a.codigo === S.yo.codigo), hoy);
    } catch (e) { aviso(e.message, 'error'); }
  }

  function pintarLineaTiempo(caja, fecha, filtro, reservas) {
    const eqs = S.equipos.filter(e => filtro === 'todos' || e.laboratorio === filtro || !e.laboratorio)
      .sort((a, b) => a.prioridad - b.prioridad || (a.laboratorio || 'ZZ').localeCompare(b.laboratorio || 'ZZ') || a.nombre.localeCompare(b.nombre));
    if (!eqs.length) { caja.innerHTML = '<div class="vacio">No hay equipos registrados para este filtro.</div>'; return; }
    const ini = Math.floor(Math.min(...eqs.map(e => U.min(e.hora_inicio))) / 60) * 60;
    const fin = Math.ceil(Math.max(...eqs.map(e => U.min(e.hora_fin))) / 60) * 60;
    const span = fin - ini, pct = m => ((m - ini) / span * 100).toFixed(3) + '%';
    const horas = []; for (let m = ini; m <= fin; m += 60) horas.push(m);
    const esHoy = fecha === U.fechaLima();
    const ahora = U.min(hora(new Date()));
    caja.innerHTML = `<div class="lt">
      <div class="lt-eje"><div></div><div class="horas">${horas.map(m => `<span style="left:${pct(m)}">${String(m / 60).padStart(2, '0')}:00</span>`).join('')}</div></div>
      ${eqs.map(e => {
        const rs = reservas.filter(x => x.equipo_id === e.id);
        const bloqueada = e.estado !== 'Disponible' || !puedeUsar(e);
        const motivo = e.estado !== 'Disponible' ? e.estado : 'Solo ' + nombreLab(e.laboratorio);
        return `<div class="lt-fila">
          <div class="lt-equipo"><span class="punto p${e.prioridad}" title="Prioridad ${PRIORIDAD[e.prioridad]}"></span>
            <div class="txt"><div class="n" title="${esc(e.nombre)}">${esc(e.nombre)}</div><div class="c">${esc(e.codigo)} · ${esc(e.laboratorio ? e.laboratorio : 'Compartido')}${(() => { const n = (S.obsPend || []).filter(o => o.equipo_id === e.id).length; return n ? ` · <a class="obs-aviso" href="#/observaciones?equipo=${e.id}" title="${n} observación(es) pendiente(s)">${ic('alerta')}${n}</a>` : ''; })()}</div></div></div>
          <div class="lt-pista ${e.estado !== 'Disponible' ? 'bloqueada' : ''}" data-eq="${e.id}" data-estado="${esc(e.estado !== 'Disponible' ? e.estado : '')}" ${bloqueada ? 'data-bloq="' + esc(motivo) + '"' : ''}>
            ${horas.slice(1, -1).map(m => `<span class="reja" style="left:${pct(m)}"></span>`).join('')}
            ${S.turnos.slice(1).map(t => `<span class="reja turno" style="left:${pct(U.min(t.inicio))}"></span>`).join('')}
            <span class="reja" style="left:${pct(U.min(e.hora_inicio))};border-left:0;width:0"></span>
            ${rs.map(x => {
              const a = Math.max(U.min(U.horaLima(x.inicio)), ini), b = Math.min(U.min(U.horaLima(x.fin)) || 1440, fin);
              const mia = x.usuario_id === S.yo.id;
              return `<button type="button" class="lt-barra ${mia ? 'mia' : ''}" data-res="${x.id}" style="left:${pct(a)};width:calc(${((b - a) / span * 100).toFixed(3)}% - 2px)"
                title="${esc(x.usuario_nombre)} · ${hora(x.inicio)}–${hora(x.fin)}&#10;${esc(x.uso)}">
                <span>${esc(mia ? 'Usted' : primerNombre(x.usuario_nombre))}</span>${b - a >= 150 ? `<span class="h">${hora(x.inicio)}–${hora(x.fin)}</span>` : ''}</button>`;
            }).join('')}
          </div></div>`;
      }).join('')}
      ${esHoy && ahora >= ini && ahora <= fin ? `<div class="lt-ahora" style="left:calc(var(--col-nombre) + (100% - var(--col-nombre)) * ${((ahora - ini) / span).toFixed(4)})" title="Ahora"></div>` : ''}
    </div>`;
    caja.querySelectorAll('.lt-barra').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation(); detalleReserva(reservas.find(x => x.id == b.dataset.res), () => render());
    }));
    caja.querySelectorAll('.lt-pista').forEach(p => p.addEventListener('click', ev => {
      if (p.dataset.bloq) { aviso(`No puede reservar este equipo: ${p.dataset.bloq}.`); return; }
      const r = p.getBoundingClientRect();
      const m = ini + (ev.clientX - r.left) / r.width * span;
      const t = turnoEnMinuto(m);
      const e = S.equipos.find(x => x.id == p.dataset.eq);
      const sm = semanaActual();
      if (S.yo.rol !== 'admin' && (fecha < sm.hoy || fecha > sm.sab)) { aviso(`Solo se puede reservar en la semana actual (hasta el ${diaNombre(sm.sab).toLowerCase()}).`); return; }
      nuevaReserva(e, fecha, t && t.numero, () => render());
    }));
  }

  function pintarUso(caja, reservas) {
    const horas = {};
    reservas.forEach(x => { horas[x.equipo_id] = (horas[x.equipo_id] || 0) + (new Date(x.fin) - new Date(x.inicio)) / 36e5; });
    const filas = S.equipos.map(e => ({ e, h: horas[e.id] || 0, n: reservas.filter(x => x.equipo_id === e.id).length }))
      .sort((a, b) => b.h - a.h);
    const max = Math.max(1, ...filas.map(f => f.h));
    if (!filas.some(f => f.h)) { caja.innerHTML = '<div class="vacio">Aún no hay reservas en los últimos 30 días.</div>'; return; }
    caja.innerHTML = filas.map(f => `<div class="barra-fila" title="${esc(f.e.nombre)}: ${f.h.toFixed(1)} h en ${f.n} reserva${f.n === 1 ? '' : 's'}">
      <span class="n">${esc(f.e.nombre)}</span>
      <span class="pista"><span class="valor" style="display:block;width:${(f.h / max * 100).toFixed(1)}%"></span></span>
      <span class="v">${f.h.toFixed(f.h < 10 ? 1 : 0)} h</span></div>`).join('');
  }

  function bloqueFecha(d) {
    return `<div class="fecha-bloque"><b>${fmt(d, { day: 'numeric' })}</b><span>${fmt(d, { month: 'short' }).replace('.', '')}</span></div>`;
  }
  function pintarProximas(caja, rs) {
    if (!rs.length) { caja.innerHTML = '<div class="vacio">No tiene reservas próximas.</div>'; return; }
    caja.innerHTML = rs.map(x => `<button type="button" class="item" data-res="${x.id}" style="border:0;text-align:left;cursor:pointer;width:100%">
      ${bloqueFecha(x.inicio)}<div class="cuerpo"><div class="t">${esc(x.equipo_nombre)}</div>
      <div class="s num">${hora(x.inicio)}–${hora(x.fin)} · <span style="text-transform:capitalize">${fmt(x.inicio, { weekday: 'long' })}</span></div></div></button>`).join('');
    $$('[data-res]', caja).forEach(b => b.addEventListener('click', () => detalleReserva(rs.find(x => x.id == b.dataset.res), () => render())));
  }
  function pintarPresentes(caja, ps) {
    if (!ps.length) { caja.innerHTML = '<div class="vacio">Nadie ha marcado entrada todavía.</div>'; return; }
    caja.innerHTML = S.labs.map(l => {
      const g = ps.filter(p => p.laboratorio === l.codigo);
      if (!g.length) return '';
      return `<h3 class="tenue" style="font-family:var(--f-texto);font-weight:600">${esc(l.nombre)} · ${g.length}</h3>` + g.map(p => `<div class="item" style="background:transparent;padding:4px 0">
        <span class="avatar ${l.codigo === 'LAB2' ? 'lab2' : ''}">${esc(iniciales(p.nombre))}</span>
        <div class="cuerpo"><div class="t">${esc(p.nombre)}</div><div class="s">Desde las ${hora(p.desde)}${p.supervisor ? ' · ' + esc(p.supervisor) : ''}</div></div></div>`).join('');
    }).join('');
  }
  function pintarAsistencia(tarjeta, filas, hoy) {
    const deHoy = filas.filter(f => f.fecha === hoy);
    const ent = deHoy.map(f => f.entrada).filter(Boolean).sort()[0];
    const sal = deHoy.map(f => f.salida).filter(Boolean).sort().pop();
    const dentro = ent && (!sal || sal < ent || deHoy.some(f => f.marcas % 2 === 1));
    const dias = []; for (let i = 6; i >= 0; i--) dias.push(U.sumarDias(hoy, -i));
    const cont = document.createElement('div');
    cont.innerHTML = `<div class="estado-hoy">
        <span class="icono ${ent ? '' : 'gris'}">${ic(ent ? 'ok' : 'reloj')}</span>
        <div><div class="t" style="font-weight:700">${ent ? (dentro ? `Entrada a las ${hora(ent)}` : `Hoy: ${hora(ent)} a ${hora(sal)}`) : 'Aún no marca hoy'}</div>
        <div class="s tenue" style="font-size:.9rem">${ent ? (dentro ? 'Recuerde marcar su salida con el QR.' : 'Jornada registrada.') : 'Escanee el QR del laboratorio al llegar.'}</div></div></div>
      <div class="semana" aria-label="Asistencia de los últimos 7 días">${dias.map(d => `<div><b class="${filas.some(f => f.fecha === d) ? 'si' : ''} ${d === hoy ? 'hoy' : ''}" title="${fechaCorta(U.enLima(d, '12:00'))}: ${filas.some(f => f.fecha === d) ? 'asistió' : 'sin marca'}"></b>${fmt(U.enLima(d, '12:00'), { weekday: 'short' }).replace('.', '')}</div>`).join('')}</div>`;
    tarjeta.querySelector('.vacio').replaceWith(cont);
  }

  /* ================= TURNOS Y CUPOS ================= */
  const REGLAS_DEF = { max_turnos_equipo_semana: 3, dom_max_turnos_equipo_dia: 2, dom_max_equipos_turno: 3, sem_max_turnos_equipo_dia: 1, sem_max_equipos_turno: 2 };
  function semanaActual() {
    const hoy = U.fechaLima(), dow = new Date(hoy + 'T12:00:00Z').getUTCDay(), dom = U.sumarDias(hoy, -dow);
    return { hoy, dow, dom, sab: U.sumarDias(dom, 6), esDomingo: dow === 0, dias: [0, 1, 2, 3, 4, 5, 6].map(i => U.sumarDias(dom, i)) };
  }
  const R = k => (S.reglas && S.reglas[k] != null ? S.reglas[k] : REGLAS_DEF[k]);
  const turnoDe = (ini, fin) => S.turnos.find(t => U.hm(t.inicio) === U.horaLima(ini) && U.hm(t.fin) === U.horaLima(fin));
  const turnoEnMinuto = m => S.turnos.find(t => m >= U.min(t.inicio) && m < U.min(t.fin));
  const nombreTurno = t => `${t.nombre} (${U.hm(t.inicio)}–${U.hm(t.fin)})`;
  const diaNombre = f => may(fmt(U.enLima(f, '12:00'), { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', ''));

  // Revisión en el navegador (la base de datos vuelve a validar todo)
  function revisarCupos(mias, eq, fecha, t, excluirId) {
    if (S.yo.rol === 'admin') return null;
    const s = semanaActual(), dom = s.esDomingo;
    const otras = mias.filter(x => x.id !== excluirId);
    const deEq = otras.filter(x => x.equipo_id === eq.id && U.fechaLima(new Date(x.inicio)) >= s.dom && U.fechaLima(new Date(x.inicio)) <= s.sab);
    const limSem = R('max_turnos_equipo_semana');
    if (deEq.length >= limSem) return `Ya tiene ${deEq.length} turno(s) de "${eq.nombre}" esta semana. El máximo es ${limSem} por equipo.`;
    const limDia = R(dom ? 'dom_max_turnos_equipo_dia' : 'sem_max_turnos_equipo_dia');
    const nDia = deEq.filter(x => U.fechaLima(new Date(x.inicio)) === fecha).length;
    if (nDia >= limDia) return dom ? `Ya tiene ${nDia} turno(s) de "${eq.nombre}" ese día. El máximo es ${limDia} por día.`
      : `De lunes a sábado solo se puede reservar ${limDia} turno por equipo al día, y ya tiene "${eq.nombre}" ese día.`;
    const ini = U.enLima(fecha, U.hm(t.inicio)), fin = U.enLima(fecha, U.hm(t.fin));
    const enTurno = new Set(otras.filter(x => x.equipo_id !== eq.id && new Date(x.inicio) < fin && new Date(x.fin) > ini).map(x => x.equipo_id)).size;
    const limTurno = R(dom ? 'dom_max_equipos_turno' : 'sem_max_equipos_turno');
    if (enTurno >= limTurno) return `Ya tiene ${enTurno} equipo(s) en ese turno. ${dom ? `El máximo es ${limTurno}.` : `De lunes a sábado el máximo es ${limTurno} (los domingos, más).`}`;
    return null;
  }

  function textoReglas() {
    const s = semanaActual();
    if (S.yo.rol === 'admin') return `<b>Administrador:</b> sin límite de cupos. Las reservas siguen siendo por turno completo.`;
    return s.esDomingo
      ? `<b>Hoy es domingo, día de planificación.</b> Puede reservar hasta ${R('max_turnos_equipo_semana')} turnos de un mismo equipo en la semana, máximo ${R('dom_max_turnos_equipo_dia')} por día, y hasta ${R('dom_max_equipos_turno')} equipos en un mismo turno.`
      : `<b>De lunes a sábado</b> puede agregar 1 turno por equipo al día (máximo ${R('max_turnos_equipo_semana')} por equipo en la semana) y hasta ${R('sem_max_equipos_turno')} equipos en un mismo turno. <span class="tenue">El domingo, día de planificación, los cupos son mayores.</span>`;
  }

  /* ================= RESERVAS: detalle / crear / editar ================= */
  async function nuevaReserva(e, fecha, turnoNum, alGuardar, existente) {
    const s = semanaActual(), admin = S.yo.rol === 'admin';
    const disponibles = S.equipos.filter(x => x.estado === 'Disponible' && puedeUsar(x));
    let semana = [];
    try { semana = await API.reservas(U.enLima(admin ? U.sumarDias(s.dom, -7) : s.dom, '00:00'), U.enLima(U.sumarDias(s.dom, admin ? 35 : 7), '00:00')); } catch (ex) { aviso(ex.message, 'error'); }
    const mias = semana.filter(x => x.usuario_id === S.yo.id);
    const diasOk = s.dias.filter(d => d >= s.hoy);
    if (!admin && (!fecha || !diasOk.includes(fecha))) fecha = diasOk[0];
    modal({
      titulo: existente ? 'Editar reserva' : 'Nueva reserva',
      cuerpo: `
        <div class="reglas-caja">${textoReglas()}</div>
        <label class="campo"><span>Equipo</span>
          <select name="equipo">${disponibles.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nombre)} (${esc(x.codigo)})</option>`).join('')}</select></label>
        <div class="rejilla-2">
          <label class="campo"><span>Día</span>
            ${admin ? `<input type="date" name="fecha" value="${fecha || s.hoy}">`
              : `<select name="fecha">${diasOk.map(d => `<option value="${d}" ${d === fecha ? 'selected' : ''}>${diaNombre(d)}</option>`).join('')}</select>`}</label>
          <label class="campo"><span>Turno</span><select name="turno"></select></label>
        </div>
        <label class="campo"><span>Uso del equipo</span>
          <textarea name="uso" maxlength="500" placeholder="Ej.: Voltametría cíclica de muestras para la tesis">${esc(existente ? existente.uso : '')}</textarea>
          <small class="info-eq"></small></label>
        <div class="error error-modal oculto" role="alert"></div>`,
      acciones: [
        { texto: 'Cancelar', clase: 'sec' },
        { texto: existente ? 'Guardar cambios' : 'Reservar', accion: async (f) => {
          const eq = S.equipos.find(x => x.id == f.querySelector('[name=equipo]').value);
          const fe = f.querySelector('[name=fecha]').value;
          const t = S.turnos.find(x => x.numero == f.querySelector('[name=turno]').value);
          const uso = f.querySelector('[name=uso]').value.trim();
          if (!fe || !t) throw new Error('Elija el día y el turno.');
          if (uso.length < 5) throw new Error('Describa en pocas palabras para qué usará el equipo.');
          const cambia = !existente || existente.equipo_id !== eq.id || U.fechaLima(new Date(existente.inicio)) !== fe || !turnoDe(existente.inicio, existente.fin) || turnoDe(existente.inicio, existente.fin).numero !== t.numero;
          if (cambia) { const m = revisarCupos(mias, eq, fe, t, existente && existente.id); if (m) throw new Error(m); }
          const datos = { equipo_id: eq.id, inicio: U.enLima(fe, U.hm(t.inicio)), fin: U.enLima(fe, U.hm(t.fin)), uso };
          if (existente) await API.actualizarReserva(existente.id, datos); else await API.crearReserva(datos);
          aviso(existente ? 'Reserva actualizada' : `Reserva registrada: ${eq.nombre}, ${diaNombre(fe).toLowerCase()}, ${U.hm(t.inicio)}–${U.hm(t.fin)}`, 'ok');
          alGuardar && alGuardar();
        } }
      ],
      alAbrir: (f) => {
        const sEq = f.querySelector('[name=equipo]'), sF = f.querySelector('[name=fecha]'), sT = f.querySelector('[name=turno]'), info = f.querySelector('.info-eq');
        const llenar = (quiero) => {
          const eq = S.equipos.find(x => x.id == sEq.value), fe = sF.value;
          const ops = S.turnos.filter(t => U.min(t.inicio) >= U.min(eq.hora_inicio) && U.min(t.fin) <= U.min(eq.hora_fin)).map(t => {
            const ini = U.enLima(fe, U.hm(t.inicio)), fin = U.enLima(fe, U.hm(t.fin));
            const ocup = semana.find(x => x.equipo_id === eq.id && (!existente || x.id !== existente.id) && new Date(x.inicio) < fin && new Date(x.fin) > ini);
            const paso = !admin && fin <= new Date();
            const motivo = ocup ? ` — ocupado por ${ocup.usuario_id === S.yo.id ? 'usted' : primerNombre(ocup.usuario_nombre)}` : paso ? ' — ya terminó' : '';
            return { t, libre: !ocup && !paso, txt: nombreTurno(t) + motivo };
          });
          const prefer = quiero || sT.value;
          sT.innerHTML = ops.map(o => `<option value="${o.t.numero}" ${o.libre ? '' : 'disabled'}>${esc(o.txt)}</option>`).join('');
          const elegido = ops.find(o => o.libre && String(o.t.numero) === String(prefer)) || ops.find(o => o.libre);
          if (elegido) sT.value = elegido.t.numero; else sT.selectedIndex = -1;
          const n = mias.filter(x => x.equipo_id === eq.id && (!existente || x.id !== existente.id) && U.fechaLima(new Date(x.inicio)) >= s.dom && U.fechaLima(new Date(x.inicio)) <= s.sab).length;
          info.textContent = admin ? `Horario del equipo: ${U.hm(eq.hora_inicio)} a ${U.hm(eq.hora_fin)}.`
            : `Esta semana usted tiene ${n} de ${R('max_turnos_equipo_semana')} turnos posibles de este equipo.${elegido ? '' : ' No quedan turnos libres ese día.'}`;
        };
        llenar(turnoNum || (existente && turnoDe(existente.inicio, existente.fin) || {}).numero);
        sEq.addEventListener('change', () => llenar());
        sF.addEventListener('change', () => llenar());
        if (!existente) f.querySelector('[name=uso]').focus();
      }
    });
  }

  function detalleReserva(x, alCambiar) {
    if (!x) return;
    const mia = x.usuario_id === S.yo.id, admin = S.yo.rol === 'admin';
    const futura = new Date(x.fin) > new Date();
    const acciones = [];
    if ((mia || admin) && (futura || admin)) acciones.push({ texto: 'Cancelar reserva', clase: 'peligro izq', accion: async () => {
      if (!await confirmar('Cancelar reserva', `¿Cancelar la reserva de <b>${esc(x.equipo_nombre)}</b> del ${fechaCorta(x.inicio)}, ${hora(x.inicio)}–${hora(x.fin)}?${!mia ? `<br><br>Pertenece a ${esc(x.usuario_nombre)}.` : ''}`, 'Sí, cancelar', 'peligro')) return false;
      await API.cancelarReserva(x.id); aviso('Reserva cancelada', 'ok'); alCambiar && alCambiar();
    } });
    if ((mia || admin) && futura) acciones.push({ texto: `${ic('editar')} Editar`, clase: 'sec', accion: () => {
      const e = S.equipos.find(q => q.id === x.equipo_id);
      const t = turnoDe(x.inicio, x.fin);
      setTimeout(() => nuevaReserva(e, U.fechaLima(new Date(x.inicio)), t && t.numero, alCambiar, x), 0);
    } });
    acciones.push({ texto: 'Cerrar' });
    const t = turnoDe(x.inicio, x.fin);
    modal({
      titulo: x.equipo_nombre,
      cuerpo: `<div class="resumen-reserva">
          <div class="t">${fechaLarga(x.inicio)}</div>
          <div class="num" style="font-size:1.35rem;font-weight:700;color:var(--navy)">${hora(x.inicio)} – ${hora(x.fin)}</div>
          ${t ? `<div class="tenue">${esc(t.nombre)}</div>` : ''}
        </div>
        <div><div class="tenue" style="font-size:.9rem">Reservado por</div><div style="font-weight:700">${esc(x.usuario_nombre)}${x.supervisor ? ` <span class="tenue" style="font-weight:500">(${esc(x.supervisor)})</span>` : ''}</div></div>
        <div><div class="tenue" style="font-size:.9rem">Uso</div><div style="overflow-wrap:anywhere">${esc(x.uso)}</div></div>`,
      acciones
    });
  }

  /* ================= RESERVAR (calendario por turnos) ================= */
  function vistaReservar(r) {
    const usables = S.equipos.filter(puedeUsar);
    const sel = usables.find(e => e.id == r.q.equipo) || usables.find(e => e.estado === 'Disponible') || usables[0];
    const grupos = [1, 2, 3].map(p => [p, usables.filter(e => e.prioridad === p)]).filter(g => g[1].length);
    const titulos = { 1: 'Prioridad alta · más usados', 2: 'Prioridad media', 3: 'Prioridad baja' };
    const s = semanaActual(), admin = S.yo.rol === 'admin';
    const v = shell('reservar', 'Reservar equipo', `Semana del ${diaNombre(s.dom).toLowerCase()} al ${diaNombre(s.sab).toLowerCase()}`, `
      <div class="reservar">
        <aside class="tarjeta selector-equipos" aria-label="Equipos">
          <input type="search" placeholder="Buscar equipo…" aria-label="Buscar equipo" style="margin-bottom:12px">
          ${grupos.map(([p, es]) => `<div class="grupo-eq"><h3>${titulos[p]}</h3>${es.map(e => `
            <button type="button" class="eq-op" data-eq="${e.id}" aria-pressed="${sel && e.id === sel.id}" ${e.estado !== 'Disponible' ? 'disabled' : ''} data-busca="${esc((e.nombre + ' ' + e.codigo).toLowerCase())}">
              <span class="punto p${e.prioridad}"></span><span><span class="n">${esc(e.nombre)}</span><br><span class="c">${esc(e.codigo)} · ${esc(e.laboratorio || 'Compartido')}${e.estado !== 'Disponible' ? ' · ' + esc(e.estado) : ''}</span></span>
            </button>`).join('')}</div>`).join('')}
          ${!usables.length ? '<div class="vacio">No hay equipos disponibles para su laboratorio.</div>' : ''}
        </aside>
        <section class="tarjeta">
          <label class="selector-movil campo"><span>Equipo</span>
            <select>${grupos.map(([p, es]) => `<optgroup label="${titulos[p]}">${es.map(e => `<option value="${e.id}" ${sel && e.id === sel.id ? 'selected' : ''} ${e.estado !== 'Disponible' ? 'disabled' : ''}>${esc(e.nombre)}${e.estado !== 'Disponible' ? ' (' + esc(e.estado) + ')' : ''}</option>`).join('')}</optgroup>`).join('')}</select></label>
          ${sel ? `<header class="cal-cabecera" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <div><h2>${esc(sel.nombre)}</h2>
            <div class="datos">${esc(sel.codigo)} · ${esc(nombreLab(sel.laboratorio))} · <span id="mi-cupo"></span></div></div>
            <button class="btn" data-nueva>${ic('mas')} Nueva reserva</button></header>
            <div class="reglas-caja">${textoReglas()}</div>
            <div id="obs-equipo"></div>
            <p class="tenue" style="font-size:.9rem;margin-bottom:10px">Toque un turno libre del calendario para reservarlo. Sus reservas aparecen en coral.</p>
            <div id="calendario"></div>` : '<div class="vacio">Seleccione un equipo.</div>'}
        </section>
      </div>`);
    const elegir = id => ir('#/reservar?equipo=' + id);
    $$('.eq-op', v).forEach(b => b.addEventListener('click', () => elegir(b.dataset.eq)));
    $('.selector-movil select', v).addEventListener('change', e => elegir(e.target.value));
    $('input[type=search]', v).addEventListener('input', e => {
      const t = e.target.value.trim().toLowerCase();
      $$('.eq-op', v).forEach(b => b.classList.toggle('oculto', !!t && !b.dataset.busca.includes(t)));
    });
    if (!sel) return;
    API.observaciones().then(obs => {
      const pend = obs.filter(o => o.equipo_id === sel.id && o.estado === 'Pendiente');
      const caja = $('#obs-equipo', v); if (!caja) return;
      caja.innerHTML = pend.length ? `<div class="obs-caja"><div class="fila" style="justify-content:space-between"><b>${ic('alerta')} ${pend.length === 1 ? 'Hay 1 observación pendiente' : `Hay ${pend.length} observaciones pendientes`} sobre este equipo</b>
          <a href="#/observaciones?equipo=${sel.id}">Ver todas</a></div>
          ${pend.slice(0, 2).map(o => `<p>«${esc(o.texto)}» <span class="tenue">— ${esc(primerNombre(o.usuario_nombre))}, ${fechaCorta(o.creado)}</span></p>`).join('')}</div>`
        : `<p class="tenue" style="font-size:.9rem;margin-bottom:8px">¿Notó algún problema con este equipo? <a href="#/observaciones?equipo=${sel.id}">Registrar una observación</a></p>`;
    }).catch(() => {});
    const disp = sel.estado === 'Disponible';
    const refrescar = () => S.cal && S.cal.refetchEvents();
    $('[data-nueva]', v).disabled = !disp;
    $('[data-nueva]', v).addEventListener('click', () => {
      let f = U.fechaLima(S.cal.getDate()); if (f < s.hoy) f = s.hoy;
      nuevaReserva(sel, f, null, refrescar);
    });

    const movil = window.innerWidth < 760;
    const turnos = S.turnos.filter(t => U.min(t.inicio) >= U.min(sel.hora_inicio) && U.min(t.fin) <= U.min(sel.hora_fin));
    if (!turnos.length) { $('#calendario', v).innerHTML = '<div class="vacio">El horario de este equipo no coincide con ningún turno.</div>'; return; }
    const durMin = U.min(turnos[0].fin) - U.min(turnos[0].inicio);
    const dur = `${String(Math.floor(durMin / 60)).padStart(2, '0')}:${String(durMin % 60).padStart(2, '0')}:00`;
    const hoyD = new Date(s.hoy + 'T12:00:00');
    S.cal = new FullCalendar.Calendar($('#calendario'), {
      locale: 'es', timeZone: 'local', firstDay: 0,
      initialView: movil ? 'timeGridDay' : 'timeGridWeek',
      initialDate: admin && r.q.fecha ? r.q.fecha : (movil ? s.hoy : s.dom),
      validRange: admin ? undefined : { start: s.dom, end: U.sumarDias(s.dom, 7) },
      headerToolbar: movil ? { left: 'prev,next', center: 'title', right: 'today' } : { left: admin ? 'prev,next today' : '', center: 'title', right: 'timeGridWeek,timeGridDay' },
      buttonText: { today: 'Hoy', week: 'Semana', day: 'Día' },
      titleFormat: movil ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
      allDaySlot: false, nowIndicator: true, height: 'auto', expandRows: true,
      slotMinTime: U.hm(turnos[0].inicio) + ':00', slotMaxTime: U.hm(turnos[turnos.length - 1].fin) + ':00',
      slotDuration: dur, snapDuration: dur, slotLabelInterval: dur,
      slotLabelContent: a => {
        const t = turnoEnMinuto(a.date.getHours() * 60 + a.date.getMinutes());
        return { html: t ? `<div class="turno-label"><b>${esc(t.nombre.replace('Turno ', ''))}</b><span>${U.hm(t.inicio)}</span><span>${U.hm(t.fin)}</span></div>` : '' };
      },
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      dayHeaderFormat: movil ? { weekday: 'long', day: 'numeric' } : { weekday: 'short', day: 'numeric' },
      selectable: disp, selectMirror: false, selectOverlap: false, unselectAuto: true,
      longPressDelay: 200, selectLongPressDelay: 200,
      editable: false, eventOverlap: false,
      selectAllow: i => (i.end - i.start) === durMin * 60000 && (admin || i.end > new Date()),
      select: i => {
        S.cal.unselect();
        const t = turnoEnMinuto(i.start.getHours() * 60 + i.start.getMinutes());
        nuevaReserva(sel, U.fechaLima(i.start), t && t.numero, refrescar);
      },
      events: async (info, ok, mal) => {
        try {
          const rs = await API.reservas(info.start, info.end);
          const deEq = rs.filter(x => x.equipo_id === sel.id);
          const mias = rs.filter(x => x.usuario_id === S.yo.id && x.equipo_id === sel.id && U.fechaLima(new Date(x.inicio)) >= s.dom && U.fechaLima(new Date(x.inicio)) <= s.sab).length;
          const cupo = $('#mi-cupo', v);
          if (cupo) cupo.textContent = admin ? `de ${U.hm(sel.hora_inicio)} a ${U.hm(sel.hora_fin)}` : `usted tiene ${mias} de ${R('max_turnos_equipo_semana')} turnos esta semana`;
          ok(deEq.map(x => {
            const mia = x.usuario_id === S.yo.id;
            return { id: String(x.id), start: x.inicio, end: x.fin, title: (mia ? 'Usted' : x.usuario_nombre) + (x.supervisor ? ` (${x.supervisor})` : ''),
              classNames: [mia ? 'ev-mia' : 'ev-otro'], extendedProps: { r: x } };
          }));
        } catch (e) { aviso(e.message, 'error'); mal(e); }
      },
      eventContent: a => {
        const x = a.event.extendedProps.r;
        return { html: `<div class="ev-c"><div class="num" style="font-size:.78rem;opacity:.9">${a.timeText}</div><div style="font-weight:700">${esc(a.event.title)}</div><div style="font-size:.8rem;opacity:.9">${esc(x.uso)}</div></div>` };
      },
      eventClick: a => detalleReserva(a.event.extendedProps.r, refrescar),
      dayCellClassNames: a => (a.date < hoyD && U.fechaLima(a.date) < s.hoy ? ['dia-pasado'] : [])
    });
    S.cal.render();
  }

  /* ================= MIS RESERVAS ================= */
  async function vistaMisReservas() {
    const v = shell('mis-reservas', 'Mis reservas', '', `
      <div class="panel-rejilla" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <section class="tarjeta"><header><h2>Próximas</h2><a class="btn chico" href="#/reservar">${ic('mas')} Reservar</a></header><div class="lista" id="prox"><div class="vacio">Cargando…</div></div></section>
        <section class="tarjeta"><header><h2>Últimos 30 días</h2></header><div class="lista" id="pas"><div class="vacio">Cargando…</div></div></section>
      </div>`);
    const hoy = U.fechaLima();
    try {
      const rs = (await API.reservas(U.enLima(U.sumarDias(hoy, -30), '00:00'), U.enLima(U.sumarDias(hoy, 120), '00:00'))).filter(x => x.usuario_id === S.yo.id);
      const ahora = new Date();
      const item = x => `<button type="button" class="item" data-res="${x.id}" style="border:0;text-align:left;cursor:pointer;width:100%">${bloqueFecha(x.inicio)}
        <div class="cuerpo"><div class="t">${esc(x.equipo_nombre)}</div><div class="s num"><span style="text-transform:capitalize">${fmt(x.inicio, { weekday: 'long' })}</span> · ${hora(x.inicio)}–${hora(x.fin)} · ${esc(x.equipo_laboratorio || 'Compartido')}</div>
        <div class="uso">${esc(x.uso)}</div></div></button>`;
      const prox = rs.filter(x => new Date(x.fin) > ahora), pas = rs.filter(x => new Date(x.fin) <= ahora).reverse();
      $('#prox', v).innerHTML = prox.length ? prox.map(item).join('') : '<div class="vacio">No tiene reservas próximas. <a href="#/reservar">Reservar un equipo</a>.</div>';
      $('#pas', v).innerHTML = pas.length ? pas.map(item).join('') : '<div class="vacio">Sin reservas en los últimos 30 días.</div>';
      $$('[data-res]', v).forEach(b => b.addEventListener('click', () => detalleReserva(rs.find(x => x.id == b.dataset.res), () => render())));
    } catch (e) { aviso(e.message, 'error'); }
  }

  /* ================= ASISTENCIA ================= */
  async function vistaAsistencia() {
    const hoy = U.fechaLima();
    const admin = S.yo.rol === 'admin';
    const v = shell('asistencia', 'Asistencia', '', `
      <div class="panel-rejilla">
        <section class="tarjeta">
          <header><div><h2>Mi historial</h2><div class="sub">Últimos 30 días</div></div></header>
          <div class="tabla-caja" id="hist"><div class="vacio">Cargando…</div></div>
        </section>
        <div class="columna">
          <section class="tarjeta">
            <h2 style="margin-bottom:10px">Cómo marcar</h2>
            <ol style="margin:0;padding-left:1.2rem;display:grid;gap:8px;color:var(--tinta-2)">
              <li>Abra la cámara de su celular y apunte al código QR de la pantalla del laboratorio.</li>
              <li>Toque el enlace que aparece. Si es la primera vez, ingrese con su código y PIN.</li>
              <li>La primera marca del día es la <b>entrada</b>; la siguiente, la <b>salida</b>.</li>
            </ol>
            <p class="tenue" style="font-size:.9rem;margin-top:10px">El código cambia cada minuto, así que solo funciona escaneándolo en el laboratorio.</p>
          </section>
          ${admin ? `<section class="tarjeta"><h2 style="margin-bottom:10px">Pantallas QR</h2>
            <p class="tenue" style="font-size:.92rem;margin-bottom:12px">Ábralas en la tablet o PC fija de cada laboratorio. Lo recomendable es ingresar ahí con la cuenta de pantalla (QR-LAB1, QR-LAB2), que no puede reservar ni ver datos.</p>
            <div class="fila">${S.labs.map(l => `<a class="btn sec" href="#/qr?lab=${l.codigo}">${ic('pantalla')} ${esc(l.nombre)}</a>`).join('')}</div>
            <p style="margin-top:12px"><a href="#/admin/asistencia">Ver el reporte de todos →</a></p></section>` : ''}
        </div>
      </div>`);
    try {
      const filas = await API.reporteAsistencia(U.sumarDias(hoy, -30), hoy);
      const mias = filas.filter(f => f.codigo === S.yo.codigo);
      $('#hist', v).innerHTML = mias.length ? tablaAsistencia(mias, false) : '<div class="vacio">Aún no tiene marcas de asistencia.</div>';
    } catch (e) { aviso(e.message, 'error'); }
  }

  function tablaAsistencia(filas, conNombre) {
    return `<table class="tabla"><thead><tr><th>Fecha</th>${conNombre ? '<th>Nombre</th><th>Supervisor</th>' : ''}<th>Lab.</th><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td style="text-transform:capitalize;white-space:nowrap">${fechaCorta(U.enLima(f.fecha, '12:00'))}</td>
        ${conNombre ? `<td>${esc(f.nombre)} <span class="tenue">${esc(f.codigo)}</span></td><td>${esc(f.supervisor || '')}</td>` : ''}
        <td>${esc(f.laboratorio)}</td><td class="num">${f.entrada ? hora(f.entrada) : '—'}</td>
        <td class="num">${f.salida && (!f.entrada || f.salida > f.entrada) ? hora(f.salida) : (f.fecha === U.fechaLima() ? '<span class="chip verde">En el lab</span>' : '<span class="chip ambar">Sin salida</span>')}</td>
        <td class="num">${f.horas != null && f.horas > 0 ? Number(f.horas).toFixed(1) : '—'}</td></tr>`).join('')}</tbody></table>`;
  }

  async function vistaMarcar(r) {
    const lab = (r.q.lab || '').toUpperCase(), tok = r.q.t || '';
    const v = shell('asistencia', 'Registro de asistencia', '', `<div class="marca-resultado"><div class="vacio">Registrando…</div></div>`);
    const caja = $('.marca-resultado', v);
    try {
      if (!lab || !tok) throw new Error('El enlace está incompleto. Escanee el código QR de la pantalla del laboratorio.');
      const res = await API.marcarAsistencia(lab, tok);
      const sal = res.tipo === 'salida';
      caja.innerHTML = `<span class="sello ${sal ? 'salida' : ''}">${ic(sal ? 'salir' : 'ok')}</span>
        <h2 style="font-size:1.5rem">${res.repetido ? `Su ${res.tipo} ya estaba registrada` : sal ? 'Salida registrada' : 'Entrada registrada'}</h2>
        <div class="hora">${hora(res.momento)}</div>
        <p class="tenue">${esc(res.nombre)} · ${esc(nombreLab(res.laboratorio))}</p>
        <p class="tenue" style="font-size:.92rem">${sal ? '¡Hasta pronto!' : 'Al retirarse, vuelva a escanear el QR para marcar su salida.'}</p>
        <a class="btn" href="#/panel">Ir al panel</a>`;
      history.replaceState(null, '', '#/marcar-hecho');
    } catch (e) {
      caja.innerHTML = `<span class="sello mal">${ic('alerta')}</span><h2 style="font-size:1.4rem">No se pudo registrar</h2>
        <p>${esc(e.message)}</p><a class="btn sec" href="#/asistencia">Ver mi asistencia</a>`;
    }
  }

  /* ================= PANTALLA QR (kiosco) ================= */
  async function vistaQR(lab) {
    const l = S.labs.find(x => x.codigo === lab) || { codigo: lab, nombre: lab };
    const esKiosco = S.yo.rol === 'kiosco';
    $app.innerHTML = `<div class="kiosco">
      <div class="lado-qr"><div class="qr-caja"><div id="qr" aria-label="Código QR de asistencia"></div><div class="progreso"><i style="width:100%"></i></div>
        <div class="tenue" id="qr-estado" style="font-size:.9rem">Generando código…</div></div></div>
      <div class="lado-info">
        <div class="logos"><img class="giea" src="assets/logo-giea.png" alt="GIEA"><img class="uni" src="assets/logo-uni.png" alt="Universidad Nacional de Ingeniería"></div>
        <div><div class="lab">${esc(l.nombre)}</div><div class="tenue" id="k-fecha" style="font-size:1.1rem"></div></div>
        <div class="reloj" id="k-reloj"></div>
        <p class="indic">Escanee el código con su celular para marcar su <b>entrada</b> o <b>salida</b>.</p>
        <div class="presentes"><h2 style="margin-bottom:8px">En el laboratorio ahora</h2><div class="lista" id="k-pres"></div></div>
        <div class="herr">
          <button class="btn sec chico" id="k-full">${ic('pantalla')} Pantalla completa</button>
          ${esKiosco ? `<button class="btn sec chico" id="k-salir">${ic('salir')} Cerrar sesión</button>` : `<a class="btn sec chico" href="#/asistencia">Volver</a>`}
          ${!esKiosco && S.labs.length > 1 ? S.labs.filter(x => x.codigo !== lab).map(x => `<a class="btn sec chico" href="#/qr?lab=${x.codigo}">${esc(x.nombre)}</a>`).join('') : ''}
        </div>
      </div></div>`;
    const base = location.href.split('#')[0];
    let renueva = 0, tokenActual = '';
    const reloj = () => { $('#k-reloj').textContent = hora(new Date()); $('#k-fecha').textContent = fechaLarga(new Date());
      const rest = Math.max(0, renueva - Date.now()); const p = $('.progreso i'); if (p) p.style.width = (rest / 600).toFixed(1) + '%'; };
    async function refrescar() {
      try {
        const t = await API.qrToken(lab);
        renueva = new Date(t.renueva).getTime();
        if (t.token !== tokenActual) {
          tokenActual = t.token;
          const url = `${base}#/marcar?lab=${encodeURIComponent(lab)}&t=${encodeURIComponent(t.token)}`;
          const q = qrcode(0, 'M'); q.addData(url); q.make();
          $('#qr').innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
          $('#qr svg').setAttribute('role', 'img');
        }
        $('#qr-estado').textContent = 'El código cambia cada minuto';
      } catch (e) { $('#qr-estado').textContent = e.message; }
      try {
        const ps = (await API.presentes()).filter(p => p.laboratorio === lab);
        $('#k-pres').innerHTML = ps.length ? ps.map(p => `<div class="item" style="background:var(--fondo);padding:8px 10px"><span class="avatar">${esc(iniciales(p.nombre))}</span><div class="cuerpo"><div class="t">${esc(p.nombre)}</div><div class="s">Desde las ${hora(p.desde)}</div></div></div>`).join('')
          : '<div class="tenue">Nadie ha marcado entrada todavía.</div>';
      } catch (e) {}
    }
    await refrescar(); reloj();
    S.timers.push(setInterval(reloj, 1000));
    S.timers.push(setInterval(() => { if (Date.now() >= renueva - 1500) refrescar(); }, 5000));
    S.timers.push(setInterval(refrescar, 30000));
    // mantener la pantalla encendida
    try { if (navigator.wakeLock) { S.wake = await navigator.wakeLock.request('screen'); } } catch (e) {}
    $('#k-full').addEventListener('click', () => { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); });
    const s = $('#k-salir'); if (s) s.addEventListener('click', async () => { if (await confirmar('Cerrar sesión', 'La pantalla dejará de mostrar el código QR.', 'Cerrar sesión')) { await API.salir(); S.yo = null; location.hash = '#/panel'; render(); } });
  }

  /* ================= ADMINISTRACIÓN ================= */
  function vistaAdmin(r) {
    const tab = r.partes[1] || 'usuarios';
    const tabs = [['usuarios', 'Usuarios'], ['equipos', 'Equipos'], ['asistencia', 'Reporte de asistencia'], ['importar', 'Importar Excel'], ['laboratorios', 'Laboratorios']];
    const v = shell('admin', 'Administración', '', `<nav class="pestanas">${tabs.map(([k, t]) => `<a href="#/admin/${k}" ${k === tab ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav><div id="admin-cont"></div>`);
    const c = $('#admin-cont', v);
    ({ usuarios: adminUsuarios, equipos: adminEquipos, asistencia: adminAsistencia, importar: adminImportar, laboratorios: adminLabs }[tab] || adminUsuarios)(c, r);
  }

  const opcionesLab = (val, conAmbos) => [...S.labs.map(l => [l.codigo, l.nombre]), ...(conAmbos ? [['AMBOS', 'Ambos laboratorios']] : [['', 'Compartido (todos)']])]
    .map(([c, n]) => `<option value="${c}" ${String(val ?? '') === c ? 'selected' : ''}>${esc(n)}</option>`).join('');

  function mostrarPin(res, nombre) {
    modal({ titulo: res.accion === 'creado' ? 'Usuario creado' : 'PIN restablecido', cuerpo: `
      <p>Entregue este PIN a <b>${esc(nombre)}</b> (código <b>${esc(res.codigo)}</b>). Se le pedirá cambiarlo al ingresar.</p>
      <div class="pin-grande">${esc(res.pin)}</div>
      <p class="tenue" style="font-size:.9rem">Anótelo ahora: por seguridad no se vuelve a mostrar.</p>`, acciones: [{ texto: 'Listo' }] });
  }

  function adminUsuarios(c) {
    const pintar = () => {
      const t = ($('#bus-u', c)?.value || '').toLowerCase(), fl = $('#fil-u', c)?.value || '';
      const lista = S.perfiles.filter(p => (!t || (p.nombre + ' ' + p.codigo + ' ' + (p.supervisor || '')).toLowerCase().includes(t)) && (!fl || p.laboratorio === fl || (fl === 'inactivos' && !p.activo)));
      $('#tabla-u', c).innerHTML = `<table class="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Laboratorio</th><th>Supervisor</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map(p => `<tr class="${p.activo ? '' : 'inactivo'}"><td><b>${esc(p.codigo)}</b></td><td>${esc(p.nombre)}</td><td>${esc(p.laboratorio === 'AMBOS' ? 'Ambos' : p.laboratorio)}</td><td>${esc(p.supervisor || '—')}</td>
          <td>${p.rol === 'admin' ? '<span class="chip coral">Administrador</span>' : p.rol === 'kiosco' ? '<span class="chip gris">Pantalla QR</span>' : 'Usuario'}</td>
          <td>${p.activo ? (p.cambiar_pin && p.rol !== 'kiosco' ? '<span class="chip ambar">PIN inicial</span>' : '<span class="chip verde">Activo</span>') : '<span class="chip gris">Inactivo</span>'}</td>
          <td class="acciones"><button class="btn sec chico" data-ed="${esc(p.codigo)}">Editar</button> <button class="btn sec chico" data-pin="${esc(p.codigo)}">Nuevo PIN</button></td></tr>`).join('')}
        </tbody></table>${!lista.length ? '<div class="vacio">Ningún usuario coincide con la búsqueda.</div>' : ''}`;
      $$('[data-ed]', c).forEach(b => b.addEventListener('click', () => editarUsuario(S.perfiles.find(p => p.codigo === b.dataset.ed))));
      $$('[data-pin]', c).forEach(b => b.addEventListener('click', async () => {
        const p = S.perfiles.find(x => x.codigo === b.dataset.pin);
        if (!await confirmar('Restablecer PIN', `Se generará un PIN nuevo para <b>${esc(p.nombre)}</b>. El PIN actual dejará de funcionar.`, 'Generar PIN')) return;
        try { const pin = String(Math.floor(100000 + Math.random() * 900000));
          const res = await API.guardarUsuario({ ...p, pin }); await recargar(); mostrarPin({ ...res, accion: 'pin', pin }, p.nombre);
        } catch (e) { aviso(e.message, 'error'); }
      }));
    };
    const recargar = async () => { S.perfiles = await API.perfiles(); pintar(); };
    c.innerHTML = `<section class="tarjeta"><header><div class="fila crece">
        <input type="search" id="bus-u" placeholder="Buscar por nombre, código o supervisor" style="max-width:340px">
        <select id="fil-u" style="max-width:220px"><option value="">Todos</option>${S.labs.map(l => `<option value="${l.codigo}">${esc(l.nombre)}</option>`).join('')}<option value="AMBOS">Ambos laboratorios</option><option value="inactivos">Inactivos</option></select></div>
        <button class="btn" id="nuevo-u">${ic('mas')} Agregar usuario</button></header>
        <div class="tabla-caja" id="tabla-u"></div>
        <p class="tenue" style="font-size:.9rem;margin-top:12px">Para dar de baja a alguien, edítelo y márquelo como inactivo: no podrá ingresar, pero su historial se conserva.</p></section>`;
    $('#bus-u', c).addEventListener('input', pintar); $('#fil-u', c).addEventListener('change', pintar);
    $('#nuevo-u', c).addEventListener('click', () => editarUsuario(null));
    pintar();

    function editarUsuario(p) {
      const nuevo = !p; p = p || { codigo: '', nombre: '', laboratorio: S.labs[0]?.codigo, supervisor: '', rol: 'usuario', activo: true };
      modal({ titulo: nuevo ? 'Agregar usuario' : `Editar ${p.codigo}`, cuerpo: `
        <div class="rejilla-2">
          <label class="campo"><span>Código</span><input type="text" name="codigo" value="${esc(p.codigo)}" ${nuevo ? '' : 'readonly'} autocapitalize="characters" placeholder="Ej.: GE112"></label>
          <label class="campo"><span>Laboratorio</span><select name="lab">${opcionesLab(p.laboratorio, true)}</select></label>
        </div>
        <label class="campo"><span>Nombre completo</span><input type="text" name="nombre" value="${esc(p.nombre)}"></label>
        <label class="campo"><span>Supervisor</span><input type="text" name="sup" value="${esc(p.supervisor || '')}" placeholder="Ej.: A. La Rosa Toro"></label>
        <div class="rejilla-2">
          <label class="campo"><span>Rol</span><select name="rol">
            <option value="usuario" ${p.rol === 'usuario' ? 'selected' : ''}>Usuario</option>
            <option value="admin" ${p.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            <option value="kiosco" ${p.rol === 'kiosco' ? 'selected' : ''}>Pantalla QR</option></select></label>
          <label class="campo"><span>Estado</span><select name="activo"><option value="1" ${p.activo ? 'selected' : ''}>Activo</option><option value="0" ${!p.activo ? 'selected' : ''}>Inactivo</option></select></label>
        </div>
        ${nuevo ? `<label class="campo"><span>PIN inicial (opcional)</span><input type="text" name="pin" inputmode="numeric" maxlength="8" placeholder="Vacío = se genera uno"><small>Se le pedirá cambiarlo en su primer ingreso.</small></label>` : ''}
        <div class="error error-modal oculto" role="alert"></div>`,
        acciones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: nuevo ? 'Agregar usuario' : 'Guardar cambios', accion: async f => {
          const g = n => f.querySelector(`[name=${n}]`)?.value.trim() || '';
          if (!g('codigo') || !g('nombre')) throw new Error('Complete el código y el nombre.');
          if (nuevo && S.perfiles.some(x => x.codigo === g('codigo').toUpperCase())) throw new Error('Ya existe un usuario con ese código.');
          const res = await API.guardarUsuario({ codigo: g('codigo'), nombre: g('nombre'), laboratorio: g('lab'), supervisor: g('sup'), rol: g('rol'), activo: g('activo') === '1', pin: nuevo ? g('pin') : null, observaciones: p.observaciones });
          await recargar();
          if (res.pin) mostrarPin(res, g('nombre')); else aviso('Usuario actualizado', 'ok');
        } }] });
    }
  }

  function adminEquipos(c) {
    const pintar = () => {
      $('#tabla-e', c).innerHTML = `<table class="tabla"><thead><tr><th>Código</th><th>Equipo</th><th>Laboratorio</th><th>Prioridad</th><th>Horario</th><th>Estado</th><th></th></tr></thead><tbody>
        ${S.equipos.map(e => `<tr><td><b>${esc(e.codigo)}</b></td><td>${esc(e.nombre)}</td><td>${esc(e.laboratorio || 'Compartido')}</td>
          <td><span class="punto p${e.prioridad}"></span> ${PRIORIDAD[e.prioridad]}</td><td class="num">${U.hm(e.hora_inicio)}–${U.hm(e.hora_fin)}</td>          <td>${e.estado === 'Disponible' ? '<span class="chip verde">Disponible</span>' : e.estado === 'Mantenimiento' ? '<span class="chip ambar">Mantenimiento</span>' : '<span class="chip rojo">Fuera de servicio</span>'}</td>
          <td class="acciones"><button class="btn sec chico" data-ed="${esc(e.codigo)}">Editar</button></td></tr>`).join('')}</tbody></table>`;
      $$('[data-ed]', c).forEach(b => b.addEventListener('click', () => editar(S.equipos.find(e => e.codigo === b.dataset.ed))));
    };
    c.innerHTML = `<section class="tarjeta"><header><div class="sub">Los de prioridad alta aparecen primero al reservar. Un equipo en mantenimiento no se puede reservar.</div>
      <button class="btn" id="nuevo-e">${ic('mas')} Agregar equipo</button></header><div class="tabla-caja" id="tabla-e"></div></section>`;
    $('#nuevo-e', c).addEventListener('click', () => editar(null));
    pintar();
    function editar(e) {
      const nuevo = !e; e = e || { codigo: '', nombre: '', laboratorio: S.labs[0]?.codigo, prioridad: 2, hora_inicio: '08:00', hora_fin: '21:30', duracion_max_h: null, estado: 'Disponible', observaciones: '' };
      modal({ titulo: nuevo ? 'Agregar equipo' : `Editar ${e.codigo}`, cuerpo: `
        <div class="rejilla-2">
          <label class="campo"><span>Código</span><input type="text" name="codigo" value="${esc(e.codigo)}" ${nuevo ? '' : 'readonly'} placeholder="Ej.: EQ1-004"></label>
          <label class="campo"><span>Laboratorio</span><select name="lab">${opcionesLab(e.laboratorio || '', false)}</select></label>
        </div>
        <label class="campo"><span>Nombre del equipo</span><input type="text" name="nombre" value="${esc(e.nombre)}"></label>
        <div class="rejilla-3">
          <label class="campo"><span>Prioridad</span><select name="prio">${[1, 2, 3].map(p => `<option value="${p}" ${e.prioridad == p ? 'selected' : ''}>${PRIORIDAD[p]}</option>`).join('')}</select></label>
          <label class="campo"><span>Desde</span><input type="time" name="hi" value="${U.hm(e.hora_inicio)}" step="1800"></label>
          <label class="campo"><span>Hasta</span><input type="time" name="hf" value="${U.hm(e.hora_fin)}" step="1800"></label>
        </div>
        <div class="rejilla-2">
          <label class="campo"><span>Estado</span><select name="estado">${['Disponible', 'Mantenimiento', 'Fuera de servicio'].map(s => `<option ${e.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        </div>
        <label class="campo"><span>Observaciones</span><input type="text" name="obs" value="${esc(e.observaciones || '')}"></label>
        <div class="error error-modal oculto" role="alert"></div>`,
        acciones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: nuevo ? 'Agregar equipo' : 'Guardar cambios', accion: async f => {
          const g = n => f.querySelector(`[name=${n}]`).value.trim();
          if (!g('codigo') || !g('nombre')) throw new Error('Complete el código y el nombre.');
          if (nuevo && S.equipos.some(x => x.codigo === g('codigo').toUpperCase())) throw new Error('Ya existe un equipo con ese código.');
          if (!g('hi') || !g('hf') || g('hf') <= g('hi')) throw new Error('La hora de fin debe ser posterior a la de inicio.');
          await API.guardarEquipo({ codigo: g('codigo').toUpperCase(), nombre: g('nombre'), laboratorio: g('lab') || null, prioridad: +g('prio'),
            hora_inicio: g('hi'), hora_fin: g('hf'), duracion_max_h: e.duracion_max_h ?? null, estado: g('estado'), observaciones: g('obs') || null });
          S.equipos = await API.equipos(); pintar(); aviso(nuevo ? 'Equipo agregado' : 'Equipo actualizado', 'ok');
        } }] });
    }
  }

  function adminLabs(c) {
    c.innerHTML = `<section class="tarjeta" style="max-width:760px"><div class="tabla-caja"><table class="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Responsable</th><th></th></tr></thead><tbody>
      ${S.labs.map(l => `<tr><td><b>${esc(l.codigo)}</b></td><td>${esc(l.nombre)}</td><td>${esc(l.responsable || '—')}</td><td class="acciones"><button class="btn sec chico" data-ed="${esc(l.codigo)}">Editar</button></td></tr>`).join('')}
      </tbody></table></div><p class="tenue" style="font-size:.9rem;margin-top:12px">Para agregar un tercer laboratorio, créelo en Supabase (tabla <code>laboratorios</code> y <code>qr_secretos</code>); vea la guía.</p></section>`;
    $$('[data-ed]', c).forEach(b => b.addEventListener('click', () => {
      const l = S.labs.find(x => x.codigo === b.dataset.ed);
      modal({ titulo: `Editar ${l.codigo}`, cuerpo: `<label class="campo"><span>Nombre</span><input type="text" name="n" value="${esc(l.nombre)}"></label>
        <label class="campo"><span>Responsable</span><input type="text" name="r" value="${esc(l.responsable || '')}"></label><div class="error error-modal oculto"></div>`,
        acciones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: 'Guardar', accion: async f => {
          await API.guardarLaboratorio({ codigo: l.codigo, nombre: f.querySelector('[name=n]').value.trim(), responsable: f.querySelector('[name=r]').value.trim() || null, observaciones: l.observaciones || null });
          S.labs = await API.laboratorios(); adminLabs(c); aviso('Laboratorio actualizado', 'ok');
        } }] });
    }));
  }

  async function adminAsistencia(c) {
    const hoy = U.fechaLima();
    c.innerHTML = `<section class="tarjeta"><header><div class="fila">
        <label class="campo"><span>Desde</span><input type="date" id="a-d" value="${hoy.slice(0, 8)}01"></label>
        <label class="campo"><span>Hasta</span><input type="date" id="a-h" value="${hoy}"></label>
        <label class="campo"><span>Laboratorio</span><select id="a-l"><option value="">Todos</option>${S.labs.map(l => `<option value="${l.codigo}">${esc(l.nombre)}</option>`).join('')}</select></label>
      </div><button class="btn sec" id="a-x">${ic('descargar')} Descargar Excel</button></header>
      <div id="a-res" style="margin-bottom:18px"></div>
      <div class="tabla-caja" id="a-t"><div class="vacio">Cargando…</div></div>
      <p class="tenue" style="font-size:.9rem;margin-top:14px">El Excel incluye dos hojas: <b>Asistencia</b> y <b>Observaciones</b> del mismo periodo.</p></section>`;
    let filas = [];
    const cargar = async () => {
      try {
        filas = await API.reporteAsistencia($('#a-d', c).value, $('#a-h', c).value, $('#a-l', c).value || null);
        const porPersona = {};
        filas.forEach(f => { const k = f.codigo; porPersona[k] = porPersona[k] || { nombre: f.nombre, codigo: f.codigo, supervisor: f.supervisor, dias: new Set(), horas: 0 }; porPersona[k].dias.add(f.fecha); porPersona[k].horas += Number(f.horas) > 0 ? Number(f.horas) : 0; });
        const res = Object.values(porPersona).sort((a, b) => b.dias.size - a.dias.size || a.nombre.localeCompare(b.nombre));
        $('#a-res', c).innerHTML = res.length ? `<h2 style="margin-bottom:10px">Resumen por persona</h2><div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Supervisor</th><th>Días asistidos</th><th>Horas registradas</th></tr></thead><tbody>
          ${res.map(p => `<tr><td>${esc(p.nombre)} <span class="tenue">${esc(p.codigo)}</span></td><td>${esc(p.supervisor || '')}</td><td class="num">${p.dias.size}</td><td class="num">${p.horas.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
          <h2 style="margin:22px 0 10px">Detalle por día</h2>` : '';
        $('#a-t', c).innerHTML = filas.length ? tablaAsistencia(filas, true) : '<div class="vacio">No hay marcas de asistencia en este periodo.</div>';
      } catch (e) { aviso(e.message, 'error'); }
    };
    ['#a-d', '#a-h', '#a-l'].forEach(s => $(s, c).addEventListener('change', cargar));
    $('#a-x', c).addEventListener('click', async () => {
      await cargarXLSX();
      const d0 = $('#a-d', c).value, d1 = $('#a-h', c).value, lab = $('#a-l', c).value;
      let obs = [];
      try { obs = (await API.observaciones(U.enLima(d0, '00:00'), U.enLima(U.sumarDias(d1, 1), '00:00'))).filter(o => !lab || !o.equipo_laboratorio || o.equipo_laboratorio === lab); } catch (e) { aviso(e.message, 'error'); }
      if (!filas.length && !obs.length) return aviso('No hay asistencia ni observaciones en este periodo.');
      const datos = filas.map(f => ({ Fecha: f.fecha, 'Código': f.codigo, Nombre: f.nombre, Supervisor: f.supervisor || '', Laboratorio: f.laboratorio,
        Entrada: f.entrada ? hora(f.entrada) : '', Salida: f.salida && f.salida > (f.entrada || '') ? hora(f.salida) : '', Horas: f.horas > 0 ? Number(f.horas) : '' }));
      const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(datos);
      ws['!cols'] = [12, 10, 32, 20, 12, 9, 9, 8].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
      XLSX.utils.book_append_sheet(wb, hojaObservaciones(obs), 'Observaciones');
      XLSX.writeFile(wb, `reporte_${d0}_a_${d1}.xlsx`);
    });
    cargar();
  }

  function hojaObservaciones(obs) {
    const datos = obs.map(o => ({ Fecha: U.fechaLima(new Date(o.creado)), Hora: hora(o.creado), Equipo: o.equipo_nombre || 'General (sin equipo)',
      'Código equipo': o.equipo_codigo || '', Laboratorio: o.equipo_laboratorio || '', 'Observación': o.texto,
      'Registrado por': o.usuario_nombre, Supervisor: o.supervisor || '', Estado: o.estado,
      'Resuelta el': o.resuelta_en ? U.fechaLima(new Date(o.resuelta_en)) : '', 'Resuelta por': o.resuelta_por_nombre || '', 'Nota de resolución': o.nota_resolucion || '' }));
    const ws = XLSX.utils.json_to_sheet(datos.length ? datos : [{ Fecha: '', 'Observación': 'Sin observaciones en este periodo' }]);
    ws['!cols'] = [11, 7, 34, 13, 11, 60, 26, 18, 11, 11, 22, 36].map(w => ({ wch: w }));
    return ws;
  }

  /* ================= OBSERVACIONES ================= */
  async function vistaObservaciones(r) {
    const admin = S.yo.rol === 'admin';
    const estado = r.q.estado || 'Pendiente', filEq = r.q.equipo || '';
    const eqOrden = [...S.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    const v = shell('observaciones', 'Observaciones', '', `
      <div class="panel-rejilla">
        <section class="tarjeta">
          <header>
            <div class="fila">
              <div class="segmentos" role="group" aria-label="Estado">
                ${[['Pendiente', 'Pendientes'], ['Resuelta', 'Resueltas'], ['todas', 'Todas']].map(([k, t]) => `<button type="button" data-est="${k}" aria-pressed="${estado === k}">${t}</button>`).join('')}
              </div>
              <select id="o-fil" aria-label="Filtrar por equipo" style="max-width:260px;min-height:38px;padding:.35rem .6rem">
                <option value="">Todos los equipos</option><option value="general" ${filEq === 'general' ? 'selected' : ''}>General (sin equipo)</option>
                ${eqOrden.map(e => `<option value="${e.id}" ${String(e.id) === filEq ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
              </select>
            </div>
            ${admin ? `<button class="btn sec chico" id="o-x">${ic('descargar')} Descargar Excel</button>` : ''}
          </header>
          <div class="lista" id="o-lista"><div class="vacio">Cargando…</div></div>
        </section>
        <section class="tarjeta obs-form">
          <h2 style="margin-bottom:12px">Nueva observación</h2>
          <form class="lista" id="o-form" novalidate>
            <label class="campo"><span>Equipo</span>
              <select name="equipo">
                <option value="">General (sin equipo específico)</option>
                ${eqOrden.map(e => `<option value="${e.id}" ${String(e.id) === filEq ? 'selected' : ''}>${esc(e.nombre)} (${esc(e.codigo)})</option>`).join('')}
              </select></label>
            <label class="campo"><span>Observación</span>
              <textarea name="texto" maxlength="1000" rows="5" placeholder="Ej.: El potenciostato 1 falla al leer la corriente. / Encontré los electrodos del equipo mal colocados."></textarea></label>
            <div class="error oculto" role="alert"></div>
            <button class="btn" type="submit">${ic('observ')} Registrar observación</button>
            <p class="tenue" style="font-size:.88rem">La verán todos los integrantes, y el administrador podrá marcarla como resuelta.</p>
          </form>
        </section>
      </div>`);
    const nav = (e, q) => ir(`#/observaciones?estado=${e}${q ? '&equipo=' + q : ''}`);
    $$('[data-est]', v).forEach(b => b.addEventListener('click', () => nav(b.dataset.est, $('#o-fil', v).value)));
    $('#o-fil', v).addEventListener('change', e => nav(estado, e.target.value));

    let lista = [];
    async function cargar() {
      const caja = $('#o-lista', v);
      try {
        const todas = await API.observaciones();
        lista = todas.filter(o => (estado === 'todas' || o.estado === estado)
          && (!filEq || (filEq === 'general' ? !o.equipo_id : String(o.equipo_id) === filEq)));
        const pend = todas.filter(o => o.estado === 'Pendiente').length;
        const bt = $('[data-est="Pendiente"]', v); if (bt) bt.textContent = `Pendientes (${pend})`;
        if (!lista.length) { caja.innerHTML = `<div class="vacio">${estado === 'Pendiente' ? 'No hay observaciones pendientes.' : 'No hay observaciones con este filtro.'}</div>`; return; }
        caja.innerHTML = lista.map(o => {
          const mia = o.usuario_id === S.yo.id;
          return `<article class="obs-item ${o.estado === 'Resuelta' ? 'resuelta' : ''}">
            <div class="fila" style="justify-content:space-between;gap:8px">
              <div class="t">${o.equipo_nombre ? esc(o.equipo_nombre) : 'General'}${o.equipo_codigo ? ` <span class="tenue" style="font-weight:500">${esc(o.equipo_codigo)}</span>` : ''}</div>
              ${o.estado === 'Pendiente' ? '<span class="chip ambar">Pendiente</span>' : '<span class="chip verde">Resuelta</span>'}
            </div>
            <p class="texto">${esc(o.texto)}</p>
            <div class="s tenue">${esc(o.usuario_nombre)}${o.supervisor ? ' (' + esc(o.supervisor) + ')' : ''} · ${fechaCorta(o.creado)}, ${hora(o.creado)}</div>
            ${o.estado === 'Resuelta' ? `<div class="resolucion">${ic('ok')}<span>Resuelta${o.resuelta_por_nombre ? ' por ' + esc(o.resuelta_por_nombre) : ''}${o.resuelta_en ? ' el ' + fechaCorta(o.resuelta_en) : ''}${o.nota_resolucion ? ': ' + esc(o.nota_resolucion) : ''}</span></div>` : ''}
            <div class="fila acciones-obs">
              ${admin && o.estado === 'Pendiente' ? `<button class="btn chico" data-resolver="${o.id}">${ic('ok')} Marcar resuelta</button>` : ''}
              ${admin && o.estado === 'Resuelta' ? `<button class="btn sec chico" data-reabrir="${o.id}">Reabrir</button>` : ''}
              ${(admin || (mia && o.estado === 'Pendiente')) ? `<button class="btn peligro chico" data-borrar="${o.id}">Borrar</button>` : ''}
            </div>
          </article>`;
        }).join('');
        $$('[data-resolver]', caja).forEach(b => b.addEventListener('click', () => {
          const o = lista.find(x => x.id == b.dataset.resolver);
          modal({ titulo: 'Marcar como resuelta', cuerpo: `<p class="tenue">«${esc(o.texto)}»</p>
            <label class="campo"><span>¿Qué se hizo? (opcional)</span><input type="text" name="nota" maxlength="300" placeholder="Ej.: Se cambió el cable del electrodo de trabajo"></label>
            <div class="error error-modal oculto"></div>`,
            acciones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: 'Marcar resuelta', accion: async f => {
              await API.resolverObservacion(o.id, f.querySelector('[name=nota]').value.trim()); aviso('Observación marcada como resuelta', 'ok'); cargar();
            } }] });
        }));
        $$('[data-reabrir]', caja).forEach(b => b.addEventListener('click', async () => {
          try { await API.reabrirObservacion(+b.dataset.reabrir); aviso('Observación reabierta', 'ok'); cargar(); } catch (e) { aviso(e.message, 'error'); }
        }));
        $$('[data-borrar]', caja).forEach(b => b.addEventListener('click', async () => {
          if (!await confirmar('Borrar observación', '¿Borrar esta observación? No se puede deshacer.', 'Borrar', 'peligro')) return;
          try { await API.borrarObservacion(+b.dataset.borrar); aviso('Observación borrada', 'ok'); cargar(); } catch (e) { aviso(e.message, 'error'); }
        }));
      } catch (e) { caja.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
    }

    const f = $('#o-form', v), err = $('.error', f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.classList.add('oculto');
      const texto = f.texto.value.trim();
      if (texto.length < 5) { err.textContent = 'Describa la observación (mínimo 5 caracteres).'; err.classList.remove('oculto'); return; }
      const b = $('button[type=submit]', f); b.disabled = true;
      try {
        await API.crearObservacion({ equipo_id: f.equipo.value ? +f.equipo.value : null, texto });
        f.texto.value = ''; aviso('Observación registrada', 'ok');
        if (estado !== 'Pendiente' && estado !== 'todas') nav('Pendiente', filEq); else cargar();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('oculto'); }
      finally { b.disabled = false; }
    });

    const bx = $('#o-x', v);
    if (bx) bx.addEventListener('click', async () => {
      if (!lista.length) return aviso('No hay observaciones para descargar con este filtro.');
      await cargarXLSX();
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, hojaObservaciones(lista), 'Observaciones');
      XLSX.writeFile(wb, `observaciones_${U.fechaLima()}.xlsx`);
    });
    cargar();
  }

  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel.')); document.head.appendChild(s); });
  }

  function adminImportar(c) {
    c.innerHTML = `<section class="tarjeta" style="max-width:900px">
      <p style="margin-bottom:14px">Suba la misma plantilla de Excel (hojas <b>Usuarios</b> y <b>Equipos</b>) para agregar o actualizar varios registros a la vez. Antes de aplicar verá qué cambiará.</p>
      <ul class="tenue" style="margin:0 0 16px;padding-left:1.2rem;display:grid;gap:4px;font-size:.95rem">
        <li>Las filas con un código nuevo se <b>agregan</b>; las que ya existen se <b>actualizan</b>.</li>
        <li>Quien no aparezca en la planilla <b>no se borra</b>. Para dar de baja, ponga su Estado en <i>Inactivo</i>.</li>
        <li>El PIN de un usuario existente solo cambia si escribe uno nuevo en la columna PIN inicial.</li>
      </ul>
      <label class="zona-archivo" id="zona">${ic('subir')}<b>Elija el archivo Excel o arrástrelo aquí</b><span class="tenue">.xlsx</span>
        <input type="file" accept=".xlsx,.xls" class="sr" id="arch"></label>
      <p style="margin-top:12px"><a href="plantilla/Plantilla_Laboratorio.xlsx" download>${'Descargar plantilla vacía'}</a></p>
      <div id="vista-previa" style="margin-top:18px"></div></section>`;
    const zona = $('#zona', c), inp = $('#arch', c);
    inp.addEventListener('change', () => inp.files[0] && leer(inp.files[0]));
    ['dragover', 'dragenter'].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.remove('sobre'); }));
    zona.addEventListener('drop', e => e.dataTransfer.files[0] && leer(e.dataTransfer.files[0]));

    async function leer(archivo) {
      const vp = $('#vista-previa', c); vp.innerHTML = '<div class="vacio">Leyendo archivo…</div>';
      try {
        await cargarXLSX();
        const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
        const hoja = n => { const k = wb.SheetNames.find(s => s.toLowerCase() === n.toLowerCase()); return k ? XLSX.utils.sheet_to_json(wb.Sheets[k], { defval: '', raw: false }) : null; };
        const us = hoja('Usuarios'), eqs = hoja('Equipos');
        if (!us && !eqs) throw new Error('El archivo no tiene hojas llamadas "Usuarios" ni "Equipos". Use la plantilla.');
        const val = (row, ...ks) => { for (const k of ks) { const kk = Object.keys(row).find(x => x.trim().toLowerCase() === k.toLowerCase()); if (kk && String(row[kk]).trim() !== '') return String(row[kk]).trim(); } return ''; };
        const esEjemplo = row => /ejemplo/i.test(val(row, 'Observaciones'));
        const errores = [], cambiosU = [], cambiosE = [];
        const labsOk = new Set(S.labs.map(l => l.codigo));

        (us || []).forEach((row, i) => {
          if (esEjemplo(row)) return;
          const codigo = val(row, 'Código', 'Codigo').toUpperCase(); const nombre = val(row, 'Nombre completo', 'Nombre');
          if (!codigo && !nombre) return;
          const fila = i + 2;
          if (!codigo) return errores.push(`Usuarios, fila ${fila}: falta el código.`);
          if (!nombre) return errores.push(`Usuarios, fila ${fila}: falta el nombre de ${codigo}.`);
          let lab = val(row, 'Laboratorio').toUpperCase(); if (lab === 'AMBOS' || !lab) lab = 'AMBOS';
          if (lab !== 'AMBOS' && !labsOk.has(lab)) return errores.push(`Usuarios, fila ${fila}: laboratorio "${lab}" no existe.`);
          const pin = val(row, 'PIN inicial', 'PIN');
          if (pin && !/^\d{3,8}$/.test(pin)) return errores.push(`Usuarios, fila ${fila}: el PIN debe tener de 3 a 8 dígitos.`);
          const activo = !/inactivo/i.test(val(row, 'Estado'));
          const nuevo = { codigo, nombre, laboratorio: lab, supervisor: val(row, 'Supervisor') || null, pin: pin || null, activo, observaciones: val(row, 'Observaciones') || null };
          const ya = S.perfiles.find(p => p.codigo === codigo);
          if (!ya) cambiosU.push({ tipo: 'nuevo', d: { ...nuevo, rol: 'usuario' } });
          else {
            const dif = [];
            if (ya.nombre !== nombre) dif.push('nombre'); if (ya.laboratorio !== lab) dif.push('laboratorio');
            if ((ya.supervisor || null) !== nuevo.supervisor) dif.push('supervisor'); if (ya.activo !== activo) dif.push(activo ? 'reactivar' : 'desactivar');
            if (pin) dif.push('PIN');
            if (dif.length) cambiosU.push({ tipo: 'mod', dif, d: { ...nuevo, rol: ya.rol, observaciones: nuevo.observaciones ?? ya.observaciones } });
          }
        });
        let nAuto = S.equipos.filter(e => /^EQ-C\d+$/.test(e.codigo)).length;
        (eqs || []).forEach((row, i) => {
          if (esEjemplo(row)) return;
          const nombre = val(row, 'Nombre del equipo', 'Nombre'); let codigo = val(row, 'Código equipo', 'Codigo equipo', 'Código').toUpperCase();
          if (!nombre && !codigo) return;
          const fila = i + 2;
          if (!nombre) return errores.push(`Equipos, fila ${fila}: falta el nombre.`);
          if (!codigo) { const ex = S.equipos.find(e => e.nombre.toLowerCase() === nombre.toLowerCase()); codigo = ex ? ex.codigo : `EQ-C${String(++nAuto).padStart(2, '0')}`; }
          const lab = val(row, 'Laboratorio').toUpperCase() || null;
          if (lab && !labsOk.has(lab)) return errores.push(`Equipos, fila ${fila}: laboratorio "${lab}" no existe.`);
          const pr = { alta: 1, media: 2, baja: 3 }[val(row, 'Prioridad').toLowerCase()] || 2;
          const hh = s => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : null; };
          const hi = hh(val(row, 'Hora inicio')) || '08:00', hf = hh(val(row, 'Hora fin')) || '18:00';
          if (hf <= hi) return errores.push(`Equipos, fila ${fila}: la hora de fin debe ser mayor que la de inicio.`);
          const mx = parseFloat(val(row, 'Duración máxima (h)', 'Duracion maxima (h)', 'Duración máxima').replace(',', '.'));
          const est = ['Disponible', 'Mantenimiento', 'Fuera de servicio'].find(s => s.toLowerCase() === val(row, 'Estado').toLowerCase()) || 'Disponible';
          const nuevo = { codigo, nombre, laboratorio: lab, prioridad: pr, hora_inicio: hi, hora_fin: hf, duracion_max_h: isNaN(mx) ? null : mx, estado: est, observaciones: val(row, 'Observaciones') || null };
          const ya = S.equipos.find(e => e.codigo === codigo);
          if (!ya) cambiosE.push({ tipo: 'nuevo', d: nuevo });
          else {
            const dif = [];
            if (ya.nombre !== nombre) dif.push('nombre'); if ((ya.laboratorio || null) !== lab) dif.push('laboratorio'); if (ya.prioridad !== pr) dif.push('prioridad');
            if (U.hm(ya.hora_inicio) !== hi || U.hm(ya.hora_fin) !== hf) dif.push('horario');
            if (ya.estado !== est) dif.push('estado');
            if (dif.length) cambiosE.push({ tipo: 'mod', dif, d: nuevo });
          }
        });

        const n = (a, t) => a.filter(x => x.tipo === t).length;
        const total = cambiosU.length + cambiosE.length;
        vp.innerHTML = `
          ${errores.length ? `<div class="error" style="margin-bottom:14px"><b>Filas con problemas (no se importarán):</b><ul style="margin:6px 0 0;padding-left:1.2rem">${errores.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
          <h2 style="margin-bottom:8px">Vista previa</h2>
          <p style="margin-bottom:12px">Usuarios: <span class="cambio-nuevo">${n(cambiosU, 'nuevo')} nuevos</span>, <span class="cambio-mod">${n(cambiosU, 'mod')} con cambios</span> · Equipos: <span class="cambio-nuevo">${n(cambiosE, 'nuevo')} nuevos</span>, <span class="cambio-mod">${n(cambiosE, 'mod')} con cambios</span></p>
          ${total ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Tipo</th><th>Código</th><th>Nombre</th><th>Cambio</th></tr></thead><tbody>
            ${[...cambiosU.map(x => ({ ...x, q: 'Usuario' })), ...cambiosE.map(x => ({ ...x, q: 'Equipo' }))].map(x => `<tr><td>${x.q}</td><td><b>${esc(x.d.codigo)}</b></td><td>${esc(x.d.nombre)}</td>
              <td>${x.tipo === 'nuevo' ? '<span class="cambio-nuevo">Nuevo</span>' : `<span class="cambio-mod">${esc(x.dif.join(', '))}</span>`}</td></tr>`).join('')}</tbody></table></div>
            <div class="fila" style="margin-top:16px;justify-content:flex-end"><button class="btn" id="aplicar">Aplicar ${total} cambio${total === 1 ? '' : 's'}</button></div>`
          : '<div class="vacio">La planilla no trae cambios respecto a lo registrado.</div>'}`;
        const b = $('#aplicar', vp);
        if (b) b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = 'Aplicando…';
          const pins = [], fallas = [];
          for (const x of cambiosE) { try { await API.guardarEquipo(x.d); } catch (e) { fallas.push(`${x.d.codigo}: ${e.message}`); } }
          for (const x of cambiosU) {
            try { const r = await API.guardarUsuario(x.d); if (r.pin) pins.push({ 'Código': r.codigo, Nombre: x.d.nombre, 'PIN inicial': r.pin }); }
            catch (e) { fallas.push(`${x.d.codigo}: ${e.message}`); }
          }
          await cargarCatalogos();
          vp.innerHTML = `<h2 style="margin-bottom:8px">Importación terminada</h2><p>${total - fallas.length} de ${total} cambios aplicados.</p>
            ${fallas.length ? `<div class="error" style="margin-top:10px"><ul style="margin:0;padding-left:1.2rem">${fallas.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
            ${pins.length ? `<p style="margin-top:12px">Se asignaron PIN a ${pins.length} usuario(s). Descárguelos ahora para entregárselos; no se vuelven a mostrar.</p>
              <button class="btn" id="bajar-pins" style="margin-top:10px">${ic('descargar')} Descargar lista de PIN</button>` : ''}`;
          const bp = $('#bajar-pins', vp);
          if (bp) bp.addEventListener('click', () => { const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(pins), 'PIN'); XLSX.writeFile(wb2, `pin_nuevos_${U.fechaLima()}.xlsx`); });
        });
      } catch (e) { vp.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
      inp.value = '';
    }
  }

  /* ---------------- Inicio ---------------- */
  (async function iniciar() {
    try {
      S.yo = await API.sesion();
      if (S.yo) await cargarCatalogos();
    } catch (e) { S.yo = null; }
    render();
  })();
})();
