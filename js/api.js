/* =========================================================
   Capa de datos. Dos implementaciones con la misma interfaz:
   - Supabase (producción)
   - Demo (en memoria, si config.js no tiene datos de Supabase)
   ========================================================= */
(function () {
  const CFG = window.APP_CONFIG;
  const TZ_OFFSET = '-05:00'; // Lima, sin horario de verano

  /* ---------- Utilidades de fecha (hora de Lima) ---------- */
  const U = {
    // 'YYYY-MM-DD' de un Date en hora de Lima
    fechaLima(d = new Date()) {
      return new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
    },
    // Date a partir de fecha 'YYYY-MM-DD' y hora 'HH:MM' en Lima
    enLima(fecha, hora) { return new Date(`${fecha}T${hora.length === 5 ? hora + ':00' : hora}${TZ_OFFSET}`); },
    horaLima(d) { return new Date(new Date(d).getTime() - 5 * 3600e3).toISOString().slice(11, 16); },
    sumarDias(fecha, n) { const d = new Date(fecha + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    hm(t) { return (t || '').slice(0, 5); },
    min(t) { const [h, m] = U.hm(t).split(':').map(Number); return h * 60 + m; }
  };
  window.U = U;

  /* =========================================================
     SUPABASE
     ========================================================= */
  function crearSupabase() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CLAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'giea-sesion' }
    });
    const correo = c => String(c).trim().toLowerCase() + '@' + CFG.DOMINIO_INTERNO;
    const clave = p => CFG.PREFIJO_CLAVE + String(p).trim();

    function traducir(e) {
      const m = (e && (e.message || e.error_description)) || String(e);
      if (/Invalid login credentials/i.test(m)) return 'Código o PIN incorrecto.';
      if (/banned/i.test(m)) return 'Su usuario está desactivado. Consulte con el administrador.';
      if (/should be different/i.test(m)) return 'El nuevo PIN debe ser distinto del actual.';
      if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.';
      if (e && e.code === '23P01' && !/Horario ocupado/.test(m)) return 'Otra persona acaba de reservar ese horario. Elija otro bloque.';
      if (/row-level security|permission denied/i.test(m)) return 'No tiene permiso para esta acción.';
      if (/JWT expired|not authenticated/i.test(m)) return 'Su sesión expiró. Vuelva a ingresar.';
      return m;
    }
    const ok = ({ data, error }) => { if (error) throw new Error(traducir(error)); return data; };

    async function perfil(uid) {
      return ok(await sb.from('perfiles').select('*').eq('id', uid).maybeSingle());
    }

    return {
      demo: false,
      async sesion() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const p = await perfil(data.session.user.id).catch(() => null);
        if (!p || !p.activo) { await sb.auth.signOut(); return null; }
        return p;
      },
      async login(codigo, pin) {
        const r = await sb.auth.signInWithPassword({ email: correo(codigo), password: clave(pin) });
        if (r.error) throw new Error(traducir(r.error));
        const p = await perfil(r.data.user.id);
        if (!p || !p.activo) { await sb.auth.signOut(); throw new Error('Su usuario está desactivado. Consulte con el administrador.'); }
        return p;
      },
      async salir() { await sb.auth.signOut(); },
      async cambiarPin(pin) {
        const r = await sb.auth.updateUser({ password: clave(pin) });
        if (r.error) throw new Error(traducir(r.error));
        ok(await sb.rpc('pin_cambiado'));
      },
      async laboratorios() { return ok(await sb.from('laboratorios').select('*').order('codigo')); },
      async equipos() { return ok(await sb.from('equipos').select('*').order('prioridad').order('nombre')); },
      async perfiles() { return ok(await sb.from('perfiles').select('*').order('nombre')); },
      async reservas(desde, hasta) {
        return ok(await sb.from('reservas_detalle').select('*')
          .lt('inicio', hasta.toISOString()).gt('fin', desde.toISOString()).order('inicio'));
      },
      async crearReserva(r) {
        return ok(await sb.from('reservas').insert({ equipo_id: r.equipo_id, inicio: r.inicio.toISOString(), fin: r.fin.toISOString(), uso: r.uso }).select().single());
      },
      async actualizarReserva(id, r) {
        const patch = {};
        if (r.inicio) patch.inicio = r.inicio.toISOString();
        if (r.fin) patch.fin = r.fin.toISOString();
        if (r.uso !== undefined) patch.uso = r.uso;
        if (r.equipo_id) patch.equipo_id = r.equipo_id;
        return ok(await sb.from('reservas').update(patch).eq('id', id).select().single());
      },
      async cancelarReserva(id) {
        const d = ok(await sb.from('reservas').delete().eq('id', id).select());
        if (!d.length) throw new Error('No se pudo cancelar: la reserva ya pasó o no le pertenece.');
      },
      async presentes() { return ok(await sb.rpc('presentes_ahora')); },
      async marcarAsistencia(lab, token) { return ok(await sb.rpc('marcar_asistencia', { p_lab: lab, p_token: token })); },
      async qrToken(lab) { return ok(await sb.rpc('qr_token_actual', { p_lab: lab })); },
      async reporteAsistencia(desde, hasta, lab) {
        return ok(await sb.rpc('reporte_asistencia', { p_desde: desde, p_hasta: hasta, p_lab: lab || null }));
      },
      async guardarUsuario(u) {
        return ok(await sb.rpc('admin_guardar_usuario', {
          p_codigo: u.codigo, p_nombre: u.nombre, p_laboratorio: u.laboratorio, p_supervisor: u.supervisor || null,
          p_pin: u.pin || null, p_rol: u.rol || 'usuario', p_activo: u.activo !== false, p_observaciones: u.observaciones || null
        }));
      },
      async guardarEquipo(e) {
        const fila = { ...e }; delete fila.id;
        return ok(await sb.from('equipos').upsert(fila, { onConflict: 'codigo' }).select().single());
      },
      async guardarLaboratorio(l) {
        return ok(await sb.from('laboratorios').upsert(l, { onConflict: 'codigo' }).select().single());
      }
    };
  }

  /* =========================================================
     DEMO (en memoria)
     ========================================================= */
  function crearDemo() {
    const D = window.DEMO_DATOS;
    let seq = 1000;
    const uid = () => 'u' + (++seq);
    const labs = D.laboratorios.map(l => ({ ...l }));
    const perfiles = D.usuarios.map(u => ({ id: uid(), activo: true, cambiar_pin: false, observaciones: null, ...u }));
    const pins = {}; perfiles.forEach(p => { pins[p.codigo] = p.pin; delete p.pin; });
    const equipos = D.equipos.map((e, i) => ({ id: i + 1, observaciones: null, ...e }));
    let reservas = [], asistencia = [], yo = null;
    try { const s = sessionStorage.getItem('giea-demo-yo'); if (s) yo = perfiles.find(p => p.codigo === s) || null; } catch (e) {}

    const error = m => { throw new Error(m); };
    const esAdmin = () => yo && yo.rol === 'admin';
    const detalle = r => {
      const e = equipos.find(x => x.id === r.equipo_id), p = perfiles.find(x => x.id === r.usuario_id);
      return { ...r, equipo_codigo: e.codigo, equipo_nombre: e.nombre, equipo_laboratorio: e.laboratorio,
               usuario_codigo: p.codigo, usuario_nombre: p.nombre, supervisor: p.supervisor };
    };

    function validar(r, id) {
      const e = equipos.find(x => x.id === r.equipo_id), p = perfiles.find(x => x.id === r.usuario_id);
      if (!e) error('El equipo seleccionado no existe.');
      if (!p || !p.activo || p.rol === 'kiosco') error('Su usuario no está habilitado para reservar.');
      if (e.estado !== 'Disponible') error(`El equipo "${e.nombre}" no se puede reservar: está en ${e.estado.toLowerCase()}.`);
      if (e.laboratorio && p.laboratorio !== 'AMBOS' && p.laboratorio !== e.laboratorio && !esAdmin())
        error(`El equipo "${e.nombre}" pertenece a ${e.laboratorio} y usted está registrado en ${p.laboratorio}.`);
      const ini = new Date(r.inicio), fin = new Date(r.fin);
      if (fin <= ini) error('La hora de fin debe ser posterior a la de inicio.');
      if (U.fechaLima(ini) !== U.fechaLima(new Date(fin - 1000))) error('La reserva debe empezar y terminar el mismo día.');
      const hi = U.horaLima(ini), hf = U.horaLima(fin);
      if (hi < U.hm(e.hora_inicio) || hf > U.hm(e.hora_fin) || hf === '00:00')
        error(`El equipo "${e.nombre}" solo se puede reservar de ${U.hm(e.hora_inicio)} a ${U.hm(e.hora_fin)}.`);
      if (e.duracion_max_h && (fin - ini) > e.duracion_max_h * 3600e3)
        error(`La reserva excede la duración máxima de ${e.duracion_max_h} h para "${e.nombre}".`);
      if (r._nuevoInicio && ini < Date.now() - 600e3 && !esAdmin()) error('No se puede reservar en un horario que ya pasó.');
      const c = reservas.find(x => x.id !== id && x.equipo_id === r.equipo_id && new Date(x.inicio) < fin && new Date(x.fin) > ini);
      if (c) { const q = perfiles.find(x => x.id === c.usuario_id);
        error(`Horario ocupado: ${q.nombre}${q.supervisor ? ' (' + q.supervisor + ')' : ''} tiene "${e.nombre}" reservado de ${U.horaLima(c.inicio)} a ${U.horaLima(c.fin)}.`); }
    }

    // Reservas de ejemplo para hoy y los próximos días
    (function sembrar() {
      const usuarios = perfiles.filter(p => p.rol !== 'kiosco');
      const usos = ['Voltametría cíclica de muestras', 'Impedancia (EIS) de recubrimientos', 'Curvas de carga-descarga',
        'Espectros de absorción', 'Caracterización de electrodos', 'Medición de corrosión', 'Calibración del equipo'];
      let k = 0;
      for (let d = -1; d <= 5; d++) {
        const f = U.sumarDias(U.fechaLima(), d);
        equipos.forEach((e, i) => {
          if ((i + d + 7) % 3 === 2) return;
          const bloques = [[8 + (i % 3), 2 + (i % 2)], [13 + (i % 2), 2], [17, 1 + (i % 3)]];
          bloques.forEach(([h, dur], j) => {
            if ((i + j + d) % 4 === 3) return;
            const us = usuarios.filter(u => !e.laboratorio || u.laboratorio === 'AMBOS' || u.laboratorio === e.laboratorio);
            const u = us[(k++) % us.length]; if (!u) return;
            const ini = U.enLima(f, String(h).padStart(2, '0') + ':' + (j === 1 ? '30' : '00'));
            reservas.push({ id: ++seq, equipo_id: e.id, usuario_id: u.id, inicio: ini.toISOString(),
              fin: new Date(ini.getTime() + dur * 3600e3).toISOString(), uso: usos[k % usos.length], creado: new Date().toISOString() });
          });
        });
      }
      // Asistencia de ejemplo (últimos 10 días)
      for (let d = -10; d <= 0; d++) {
        const f = U.sumarDias(U.fechaLima(), d);
        usuarios.forEach((u, i) => {
          if ((i + d) % 4 === 0) return;
          const lab = u.laboratorio === 'AMBOS' ? 'LAB1' : u.laboratorio;
          const ent = U.enLima(f, `0${8 + (i % 2)}:${String(5 + i * 3 % 50).padStart(2, '0')}`);
          if (ent > new Date()) return;
          asistencia.push({ id: ++seq, usuario_id: u.id, laboratorio: lab, tipo: 'entrada', momento: ent.toISOString() });
          const sal = new Date(ent.getTime() + (6 + i % 4) * 3600e3);
          if (sal < new Date()) asistencia.push({ id: ++seq, usuario_id: u.id, laboratorio: lab, tipo: 'salida', momento: sal.toISOString() });
        });
      }
    })();

    function token(lab, v) { let h = 2166136261; const s = 'demo:' + lab + ':' + v; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ('0000000000' + (h >>> 0).toString(16).toUpperCase()).slice(-10); }
    const ventana = () => Math.floor(Date.now() / 60000);
    const espera = (v) => new Promise(r => setTimeout(() => r(v), 120));

    return {
      demo: true,
      async sesion() { return yo; },
      async login(codigo, pin) {
        const p = perfiles.find(x => x.codigo === String(codigo).trim().toUpperCase());
        if (!p || pins[p.codigo] !== String(pin).trim()) error('Código o PIN incorrecto.');
        if (!p.activo) error('Su usuario está desactivado. Consulte con el administrador.');
        yo = p; try { sessionStorage.setItem('giea-demo-yo', p.codigo); } catch (e) {}
        return espera(p);
      },
      async salir() { yo = null; try { sessionStorage.removeItem('giea-demo-yo'); } catch (e) {} },
      async cambiarPin(pin) { if (pins[yo.codigo] === pin) error('El nuevo PIN debe ser distinto del actual.'); pins[yo.codigo] = pin; yo.cambiar_pin = false; },
      async laboratorios() { return espera(labs.map(l => ({ ...l }))); },
      async equipos() { return espera(equipos.map(e => ({ ...e })).sort((a, b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre))); },
      async perfiles() { return espera(perfiles.map(p => ({ ...p })).sort((a, b) => a.nombre.localeCompare(b.nombre))); },
      async reservas(desde, hasta) {
        return espera(reservas.filter(r => new Date(r.inicio) < hasta && new Date(r.fin) > desde)
          .sort((a, b) => a.inicio.localeCompare(b.inicio)).map(detalle));
      },
      async crearReserva(r) {
        if (!yo || !['usuario', 'admin'].includes(yo.rol)) error('No tiene permiso para esta acción.');
        if (!r.uso || r.uso.trim().length < 5) error('Describa el uso del equipo (mínimo 5 caracteres).');
        const n = { equipo_id: r.equipo_id, usuario_id: yo.id, inicio: r.inicio.toISOString(), fin: r.fin.toISOString(), uso: r.uso.trim() };
        validar({ ...n, _nuevoInicio: true }, null);
        n.id = ++seq; n.creado = new Date().toISOString(); reservas.push(n); return espera(n);
      },
      async actualizarReserva(id, r) {
        const x = reservas.find(z => z.id === id); if (!x) error('La reserva no existe.');
        if (x.usuario_id !== yo.id && !esAdmin()) error('No tiene permiso para esta acción.');
        const n = { ...x, ...(r.inicio && { inicio: r.inicio.toISOString() }), ...(r.fin && { fin: r.fin.toISOString() }),
          ...(r.uso !== undefined && { uso: r.uso.trim() }), ...(r.equipo_id && { equipo_id: r.equipo_id }) };
        if (n.uso.length < 5) error('Describa el uso del equipo (mínimo 5 caracteres).');
        validar({ ...n, _nuevoInicio: n.inicio !== x.inicio }, id);
        Object.assign(x, n); return espera(x);
      },
      async cancelarReserva(id) {
        const x = reservas.find(z => z.id === id);
        if (!x || !(esAdmin() || (x.usuario_id === yo.id && new Date(x.fin) > new Date())))
          error('No se pudo cancelar: la reserva ya pasó o no le pertenece.');
        reservas = reservas.filter(z => z.id !== id);
      },
      async presentes() {
        const hoy = U.fechaLima(), ult = {};
        asistencia.filter(a => U.fechaLima(new Date(a.momento)) === hoy).sort((a, b) => a.momento.localeCompare(b.momento))
          .forEach(a => { ult[a.usuario_id + a.laboratorio] = a; });
        return espera(Object.values(ult).filter(a => a.tipo === 'entrada').map(a => {
          const p = perfiles.find(x => x.id === a.usuario_id);
          return { laboratorio: a.laboratorio, codigo: p.codigo, nombre: p.nombre, supervisor: p.supervisor, desde: a.momento };
        }));
      },
      async qrToken(lab) {
        if (!yo || !['admin', 'kiosco'].includes(yo.rol)) error('Solo la pantalla de asistencia o un administrador pueden mostrar el QR.');
        if (yo.rol === 'kiosco' && yo.laboratorio !== 'AMBOS' && yo.laboratorio !== lab) error(`Esta pantalla está configurada para ${yo.laboratorio}.`);
        const v = ventana();
        return { token: token(lab, v), renueva: new Date((v + 1) * 60000).toISOString(), ahora: new Date().toISOString() };
      },
      async marcarAsistencia(lab, tok) {
        if (!yo || yo.rol === 'kiosco') error('Su usuario no está habilitado.');
        if (!labs.some(l => l.codigo === lab)) error('Laboratorio desconocido.');
        if (yo.laboratorio !== 'AMBOS' && yo.laboratorio !== lab && yo.rol !== 'admin') error(`Usted está registrado en ${yo.laboratorio}, no en ${lab}.`);
        const v = ventana();
        if (![0, 1, 2, 3, 4, 5].some(i => token(lab, v - i) === String(tok).toUpperCase()))
          error('El código QR caducó. Escanee nuevamente el código que aparece en la pantalla del laboratorio.');
        const hoy = U.fechaLima();
        const ult = asistencia.filter(a => a.usuario_id === yo.id && a.laboratorio === lab && U.fechaLima(new Date(a.momento)) === hoy)
          .sort((a, b) => b.momento.localeCompare(a.momento))[0];
        if (ult && Date.now() - new Date(ult.momento) < 120e3) return { tipo: ult.tipo, momento: ult.momento, laboratorio: lab, nombre: yo.nombre, repetido: true };
        const tipo = ult && ult.tipo === 'entrada' ? 'salida' : 'entrada';
        const a = { id: ++seq, usuario_id: yo.id, laboratorio: lab, tipo, momento: new Date().toISOString() };
        asistencia.push(a); return espera({ tipo, momento: a.momento, laboratorio: lab, nombre: yo.nombre, repetido: false });
      },
      async reporteAsistencia(desde, hasta, lab) {
        const g = {};
        asistencia.forEach(a => {
          const f = U.fechaLima(new Date(a.momento));
          if (f < desde || f > hasta || (lab && a.laboratorio !== lab)) return;
          if (!esAdmin() && a.usuario_id !== yo.id) return;
          const k = f + a.usuario_id + a.laboratorio, p = perfiles.find(x => x.id === a.usuario_id);
          g[k] = g[k] || { fecha: f, codigo: p.codigo, nombre: p.nombre, supervisor: p.supervisor, laboratorio: a.laboratorio, entrada: null, salida: null, marcas: 0 };
          const r = g[k]; r.marcas++;
          if (a.tipo === 'entrada' && (!r.entrada || a.momento < r.entrada)) r.entrada = a.momento;
          if (a.tipo === 'salida' && (!r.salida || a.momento > r.salida)) r.salida = a.momento;
        });
        return espera(Object.values(g).map(r => ({ ...r, horas: r.entrada && r.salida ? Math.round((new Date(r.salida) - new Date(r.entrada)) / 36e3) / 100 : null }))
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre)));
      },
      async guardarUsuario(u) {
        if (!esAdmin()) error('Solo un administrador puede modificar usuarios.');
        const codigo = String(u.codigo).trim().toUpperCase();
        if (!codigo || /\s/.test(codigo)) error(`Código inválido: "${u.codigo}".`);
        if (u.pin && !/^[0-9]{3,8}$/.test(u.pin)) error(`El PIN de ${codigo} debe tener entre 3 y 8 dígitos.`);
        let p = perfiles.find(x => x.codigo === codigo), accion = 'actualizado', pin = u.pin || null;
        if (p && p.id === yo.id && (u.rol !== 'admin' || u.activo === false)) error('No puede quitarse a sí mismo el rol de administrador ni desactivarse.');
        if (!p) { accion = 'creado'; pin = pin || String(Math.floor(Math.random() * 1e6)).padStart(6, '0'); p = { id: uid(), codigo }; perfiles.push(p); }
        Object.assign(p, { nombre: u.nombre.trim(), laboratorio: (u.laboratorio || 'AMBOS').toUpperCase(), supervisor: u.supervisor || null,
          rol: u.rol || 'usuario', activo: u.activo !== false, observaciones: u.observaciones || null, cambiar_pin: pin ? u.rol !== 'kiosco' : p.cambiar_pin });
        if (pin) pins[codigo] = pin;
        return espera({ codigo, accion, pin });
      },
      async guardarEquipo(e) {
        if (!esAdmin()) error('No tiene permiso para esta acción.');
        let x = equipos.find(z => z.codigo === e.codigo);
        if (!x) { x = { id: equipos.length + 1 }; equipos.push(x); }
        Object.assign(x, { ...e, id: x.id }); return espera({ ...x });
      },
      async guardarLaboratorio(l) {
        if (!esAdmin()) error('No tiene permiso para esta acción.');
        let x = labs.find(z => z.codigo === l.codigo); if (!x) { x = {}; labs.push(x); } Object.assign(x, l); return espera({ ...x });
      }
    };
  }

  const tieneSupabase = CFG.SUPABASE_URL && CFG.SUPABASE_CLAVE_PUBLICA && window.supabase;
  window.API = tieneSupabase ? crearSupabase() : crearDemo();
})();
