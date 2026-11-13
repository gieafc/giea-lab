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
  const TURNOS_DEF = [
    { numero: 1, nombre: 'Turno mañana', inicio: '08:00', fin: '12:30' },
    { numero: 2, nombre: 'Turno tarde', inicio: '12:30', fin: '17:00' },
    { numero: 3, nombre: 'Turno noche', inicio: '17:00', fin: '21:30' }];

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
      if (e && e.code === '23P01' && !/Horario ocupado|Turno ocupado|ya tiene reservado/.test(m)) return 'Otra persona acaba de reservar ese horario. Elija otro bloque.';
      if (/observaciones/i.test(m) && /schema cache|does not exist/i.test(m)) return 'Falta instalar la sección de Observaciones: ejecute actualizacion_observaciones.sql en Supabase.';
      if (/check constraint "observaciones_texto/i.test(m)) return 'Escriba la observación (mínimo 5 caracteres).';
      if (/reuniones_sin_choque/i.test(m)) return 'Ya hay otra reunión programada en ese horario.';
      if (/reuniones_tema_check/i.test(m)) return 'Escriba el tema de la reunión.';
      if (/(avisos|reuniones|cancelar_reserva|resolver_solicitud)/i.test(m) && /schema cache|does not exist|Could not find/i.test(m)) return 'Falta instalar la actualización de reuniones y avisos: ejecute actualizacion_reuniones_avisos.sql en Supabase.';
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
      async cancelarReserva(id) { ok(await sb.rpc('cancelar_reserva', { p_id: id })); },
      async resolverSolicitud(id, aprobar, motivo) { ok(await sb.rpc('resolver_solicitud', { p_id: id, p_aprobar: aprobar, p_motivo: motivo || null })); },
      async solicitudesPendientes() {
        return ok(await sb.from('reservas_detalle').select('*').eq('estado', 'Pendiente').gt('fin', new Date().toISOString()).order('inicio'));
      },
      async avisos(limite = 150) { return ok(await sb.from('avisos').select('*').order('creado', { ascending: false }).limit(limite)); },
      async avisosNuevos(desde) {
        const r = await sb.from('avisos').select('id', { count: 'exact', head: true }).gt('creado', desde);
        return r.error ? 0 : (r.count || 0);
      },
      async marcarAvisosVistos() { ok(await sb.rpc('marcar_avisos_vistos')); },
      async reuniones(desde, hasta) {
        let q = sb.from('reuniones_detalle').select('*').order('inicio');
        if (desde) q = q.gte('fin', desde.toISOString());
        if (hasta) q = q.lt('inicio', hasta.toISOString());
        return ok(await q);
      },
      async crearReunion(g) {
        return ok(await sb.from('reuniones').insert({ inicio: g.inicio.toISOString(), fin: g.fin.toISOString(), tema: g.tema, lugar: g.lugar || null }).select().single());
      },
      async actualizarReunion(id, g) {
        const d = ok(await sb.from('reuniones').update({ inicio: g.inicio.toISOString(), fin: g.fin.toISOString(), tema: g.tema, lugar: g.lugar || null }).eq('id', id).select());
        if (!d.length) throw new Error('Solo quien organizó la reunión o un administrador puede modificarla.');
      },
      async cancelarReunion(id) {
        const d = ok(await sb.from('reuniones').delete().eq('id', id).select());
        if (!d.length) throw new Error('Solo quien organizó la reunión o un administrador puede cancelarla, y antes de que termine.');
      },
      async qrReunionToken(id) { return ok(await sb.rpc('qr_reunion_token', { p_id: id })); },
      async marcarReunion(id, token) { return ok(await sb.rpc('marcar_reunion', { p_id: id, p_token: token })); },
      async asistenciaReunion(ids) {
        if (!ids.length) return [];
        return ok(await sb.from('asistencia_reunion_detalle').select('*').in('reunion_id', ids).order('momento'));
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
      },
      async turnos() {
        const r = await sb.from('turnos').select('*').order('numero');
        return !r.error && r.data.length ? r.data.map(t => ({ ...t, inicio: U.hm(t.inicio), fin: U.hm(t.fin) })) : TURNOS_DEF;
      },
      async reglas() {
        const r = await sb.from('reglas_reserva').select('clave, valor');
        return r.error ? {} : Object.fromEntries(r.data.map(x => [x.clave, x.valor]));
      },
      async observaciones(desde, hasta) {
        let q = sb.from('observaciones_detalle').select('*').order('creado', { ascending: false }).limit(1000);
        if (desde) q = q.gte('creado', desde.toISOString());
        if (hasta) q = q.lt('creado', hasta.toISOString());
        return ok(await q);
      },
      async crearObservacion(o) {
        return ok(await sb.from('observaciones').insert({ equipo_id: o.equipo_id || null, texto: o.texto }).select().single());
      },
      async resolverObservacion(id, nota) {
        const d = ok(await sb.from('observaciones').update({ estado: 'Resuelta', nota_resolucion: nota || null }).eq('id', id).select());
        if (!d.length) throw new Error('Solo un administrador puede marcar observaciones como resueltas.');
      },
      async reabrirObservacion(id) {
        const d = ok(await sb.from('observaciones').update({ estado: 'Pendiente' }).eq('id', id).select());
        if (!d.length) throw new Error('Solo un administrador puede reabrir observaciones.');
      },
      async borrarObservacion(id) {
        const d = ok(await sb.from('observaciones').delete().eq('id', id).select());
        if (!d.length) throw new Error('Solo puede borrar sus propias observaciones pendientes.');
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
    const perfiles = D.usuarios.map(u => ({ id: uid(), activo: true, cambiar_pin: false, observaciones: null, avisos_vistos: new Date(Date.now() - 4 * 3600e3).toISOString(), ...u }));
    const pins = {}; perfiles.forEach(p => { pins[p.codigo] = p.pin; delete p.pin; });
    const equipos = D.equipos.map((e, i) => ({ id: i + 1, observaciones: null, ...e }));
    let reservas = [], asistencia = [], observaciones = [], avisos = [], reuniones = [], asisReu = [], yo = null;
    try { const s = sessionStorage.getItem('giea-demo-yo'); if (s) yo = perfiles.find(p => p.codigo === s) || null; } catch (e) {}

    const error = m => { throw new Error(m); };
    const esAdmin = () => yo && yo.rol === 'admin';
    const puedeAprobar = lab => yo && yo.activo && ['encargado', 'admin'].includes(yo.rol) && (yo.laboratorio === lab || yo.laboratorio === 'AMBOS');
    const otroLab = (e, p) => !!e.laboratorio && p.laboratorio !== 'AMBOS' && p.laboratorio !== e.laboratorio;
    const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    function descHorario(ini, fin) {
      const f = U.fechaLima(new Date(ini)), d = new Date(f + 'T12:00:00Z');
      const t = TURNOS_DEF.find(x => x.inicio === U.horaLima(ini) && x.fin === U.horaLima(fin));
      const h = U.horaLima(ini) + '–' + U.horaLima(fin);
      return `${DIAS[d.getUTCDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}, ` + (t ? `${t.nombre.toLowerCase()} (${h})` : h);
    }
    const avisar = (tipo, mensaje, laboratorio = null, cuando = new Date()) =>
      avisos.push({ id: ++seq, tipo, mensaje, actor_id: yo ? yo.id : null, laboratorio, creado: new Date(cuando).toISOString() });
    const detalleReu = g => { const p = perfiles.find(x => x.id === g.organizador_id);
      return { ...g, organizador_nombre: p.nombre, organizador_codigo: p.codigo, asistentes: asisReu.filter(a => a.reunion_id === g.id).length }; };
    const detalleObs = o => {
      const e = equipos.find(x => x.id === o.equipo_id), p = perfiles.find(x => x.id === o.usuario_id), r = perfiles.find(x => x.id === o.resuelta_por);
      return { ...o, equipo_codigo: e ? e.codigo : null, equipo_nombre: e ? e.nombre : null, equipo_laboratorio: e ? e.laboratorio : null,
               usuario_codigo: p.codigo, usuario_nombre: p.nombre, supervisor: p.supervisor, resuelta_por_nombre: r ? r.nombre : null };
    };
    const detalle = r => {
      const e = equipos.find(x => x.id === r.equipo_id), p = perfiles.find(x => x.id === r.usuario_id);
      const a = perfiles.find(x => x.id === r.aprobada_por), o = perfiles.find(x => x.id === r.aprobada_origen_por);
      return { ...r, equipo_codigo: e.codigo, equipo_nombre: e.nombre, equipo_laboratorio: e.laboratorio,
               usuario_codigo: p.codigo, usuario_nombre: p.nombre, supervisor: p.supervisor, usuario_laboratorio: p.laboratorio,
               aprobada_por_nombre: a ? a.nombre : null, aprobada_origen_por_nombre: o ? o.nombre : null };
    };

    const turnos = TURNOS_DEF.map(t => ({ ...t }));
    const RG = { max_turnos_equipo_semana: 3, dom_max_turnos_equipo_dia: 2, dom_max_equipos_turno: 3, sem_max_turnos_equipo_dia: 1, sem_max_equipos_turno: 2 };
    function validar(r, id, cambia) {
      const e = equipos.find(x => x.id === r.equipo_id), p = perfiles.find(x => x.id === r.usuario_id);
      if (!e) error('El equipo seleccionado no existe.');
      if (!p || !p.activo || p.rol === 'kiosco') error('Su usuario no está habilitado para reservar.');
      if (cambia && e.estado !== 'Disponible') error(`El equipo "${e.nombre}" no se puede reservar: está en ${e.estado.toLowerCase()}.`);
      const ini = new Date(r.inicio), fin = new Date(r.fin);
      if (fin <= ini) error('La hora de fin debe ser posterior a la de inicio.');
      if (!cambia) return;
      const f = U.fechaLima(ini);
      const t = turnos.find(x => x.inicio === U.horaLima(ini) && x.fin === U.horaLima(fin) && U.fechaLima(fin) === f);
      if (!t) error('Las reservas son por turno completo: ' + turnos.map(x => x.inicio + '–' + x.fin).join(', ') + '.');
      if (t.inicio < U.hm(e.hora_inicio) || t.fin > U.hm(e.hora_fin)) error(`El equipo "${e.nombre}" solo se puede reservar de ${U.hm(e.hora_inicio)} a ${U.hm(e.hora_fin)}.`);
      if (!esAdmin()) {
        const hoy = U.fechaLima(), dow = new Date(hoy + 'T12:00:00Z').getUTCDay(), dom = U.sumarDias(hoy, -dow), sab = U.sumarDias(dom, 6), esDom = dow === 0;
        const dm = x => x.split('-').reverse().slice(0, 2).join('/');
        if (f < dom || f > sab) error(`Solo se puede reservar dentro de la semana actual: del domingo ${dm(dom)} al sábado ${dm(sab)}.`);
        if (fin <= new Date()) error('Ese turno ya terminó.');
        const mias = reservas.filter(x => x.usuario_id === p.id && x.id !== id);
        const deEq = mias.filter(x => x.equipo_id === e.id && U.fechaLima(new Date(x.inicio)) >= dom && U.fechaLima(new Date(x.inicio)) <= sab);
        if (deEq.length >= RG.max_turnos_equipo_semana) error(`Ya tiene ${deEq.length} turno(s) de "${e.nombre}" esta semana. El máximo es ${RG.max_turnos_equipo_semana} por equipo.`);
        const limDia = esDom ? RG.dom_max_turnos_equipo_dia : RG.sem_max_turnos_equipo_dia;
        const nDia = deEq.filter(x => U.fechaLima(new Date(x.inicio)) === f).length;
        if (nDia >= limDia) error(`Ya tiene ${nDia} turno(s) de "${e.nombre}" el ${dm(f)}. ` + (esDom ? `El máximo es ${limDia} por día.` : `De lunes a sábado solo se puede reservar ${limDia} turno por equipo al día (los domingos, más).`));
        const limT = esDom ? RG.dom_max_equipos_turno : RG.sem_max_equipos_turno;
        const nT = new Set(mias.filter(x => x.equipo_id !== e.id && new Date(x.inicio) < fin && new Date(x.fin) > ini).map(x => x.equipo_id)).size;
        if (nT >= limT) error(`Ya tiene ${nT} equipo(s) reservados en ese turno. ` + (esDom ? `El máximo es ${limT} equipos por turno.` : `De lunes a sábado el máximo es ${limT} equipos por turno (los domingos, más).`));
      }
      const c = reservas.find(x => x.id !== id && x.equipo_id === r.equipo_id && new Date(x.inicio) < fin && new Date(x.fin) > ini);
      if (c && c.usuario_id === p.id) error(`Usted ya tiene reservado "${e.nombre}" en ese turno.`);
      if (c) { const q = perfiles.find(x => x.id === c.usuario_id);
        error(`Turno ocupado: ${q.nombre}${q.supervisor ? ' (' + q.supervisor + ')' : ''} ${c.estado === 'Pendiente' ? 'ya solicitó' : 'ya reservó'} "${e.nombre}" de ${U.horaLima(c.inicio)} a ${U.horaLima(c.fin)}.`); }
    }

    // Reservas de ejemplo para hoy y los próximos días
    (function sembrar() {
      const usuarios = perfiles.filter(p => p.rol !== 'kiosco');
      const usos = ['Voltametría cíclica de muestras', 'Impedancia (EIS) de recubrimientos', 'Curvas de carga-descarga',
        'Espectros de absorción', 'Caracterización de electrodos', 'Medición de corrosión', 'Calibración del equipo'];
      let k = 0;
      const hoy = U.fechaLima(), dom = U.sumarDias(hoy, -new Date(hoy + 'T12:00:00Z').getUTCDay());
      const usadas = {};
      for (let d = -7; d <= 6; d++) {
        const f = U.sumarDias(dom, d);
        equipos.forEach((e, i) => {
          turnos.forEach((t, j) => {
            if ((i * 3 + j + d * 2 + 14) % 5 > 1) return;
            const us = usuarios.filter(u => u.rol === 'usuario' && (!e.laboratorio || u.laboratorio === 'AMBOS' || u.laboratorio === e.laboratorio));
            const u = us[(k++) % us.length]; if (!u) return;
            const clave = u.id + ':' + e.id + ':' + (d < 0 ? 'a' : 'b');
            if (usadas[clave]) return; usadas[clave] = 1;
            const ini = U.enLima(f, t.inicio);
            reservas.push({ id: ++seq, equipo_id: e.id, usuario_id: u.id, inicio: ini.toISOString(), estado: 'Confirmada',
              fin: U.enLima(f, t.fin).toISOString(), uso: usos[k % usos.length], creado: new Date().toISOString() });
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
      // Una solicitud entre laboratorios, avisos y reuniones de ejemplo
      const deLab2 = usuarios.filter(u => u.laboratorio === 'LAB2' && u.rol === 'usuario');
      const eqL1 = equipos.find(e => e.laboratorio === 'LAB1');
      const pide = deLab2[1] || deLab2[0];
      if (pide && eqL1) {
        for (let d = 1; d <= 6; d++) {
          const f = U.sumarDias(hoy, d); if (f > U.sumarDias(dom, 6)) break;
          const t = turnos[2], ini = U.enLima(f, t.inicio), fin = U.enLima(f, t.fin);
          if (reservas.some(x => x.equipo_id === eqL1.id && new Date(x.inicio) < fin && new Date(x.fin) > ini)) continue;
          reservas.push({ id: ++seq, equipo_id: eqL1.id, usuario_id: pide.id, inicio: ini.toISOString(), fin: fin.toISOString(), estado: 'Pendiente',
            uso: 'Comparar con las medidas del Lab 2', creado: new Date().toISOString() });
          avisos.push({ id: ++seq, tipo: 'solicitud', laboratorio: 'LAB1', actor_id: pide.id, creado: new Date(Date.now() - 2 * 3600e3).toISOString(),
            mensaje: `${pide.nombre} (LAB2) solicita "${eqL1.nombre}" del LAB1 para el ${descHorario(ini, fin)}. Uso: Comparar con las medidas del Lab 2` });
          break;
        }
      }
      const org = usuarios.find(u => u.rol === 'usuario') || usuarios[0];
      const ahora = Date.now(), redondeo = 15 * 60e3;
      const r1 = { id: ++seq, organizador_id: org.id, inicio: new Date(Math.floor((ahora - 20 * 60e3) / redondeo) * redondeo).toISOString(), tema: 'Avance de tesis y revisión de resultados', lugar: 'Laboratorio 2', creado: new Date(ahora - 86400e3).toISOString() };
      r1.fin = new Date(new Date(r1.inicio).getTime() + 90 * 60e3).toISOString();
      const fR2 = U.sumarDias(hoy, 3);
      const r2 = { id: ++seq, organizador_id: (usuarios[3] || org).id, inicio: U.enLima(fR2, '16:00').toISOString(), fin: U.enLima(fR2, '17:30').toISOString(), tema: 'Seminario: técnicas de impedancia', lugar: 'Sala de reuniones', creado: new Date(ahora - 5 * 3600e3).toISOString() };
      const fR0 = U.sumarDias(hoy, -6);
      const r0 = { id: ++seq, organizador_id: org.id, inicio: U.enLima(fR0, '15:00').toISOString(), fin: U.enLima(fR0, '16:00').toISOString(), tema: 'Planificación del mes', lugar: 'Laboratorio 1', creado: new Date(ahora - 9 * 86400e3).toISOString() };
      reuniones.push(r0, r1, r2);
      usuarios.slice(0, 6).forEach((u, i) => asisReu.push({ reunion_id: r0.id, usuario_id: u.id, momento: new Date(new Date(r0.inicio).getTime() + i * 60e3).toISOString() }));
      usuarios.slice(1, 3).forEach((u, i) => asisReu.push({ reunion_id: r1.id, usuario_id: u.id, momento: new Date(new Date(r1.inicio).getTime() + i * 90e3).toISOString() }));
      const pn = id => perfiles.find(x => x.id === id).nombre;
      avisos.push({ id: ++seq, tipo: 'reunion', mensaje: `${pn(r2.organizador_id)} programó una reunión de grupo: "${r2.tema}", el ${descHorario(r2.inicio, r2.fin)} en ${r2.lugar}.`, creado: r2.creado },
        { id: ++seq, tipo: 'reunion', mensaje: `${pn(r1.organizador_id)} programó una reunión de grupo: "${r1.tema}", el ${descHorario(r1.inicio, r1.fin)} en ${r1.lugar}.`, creado: r1.creado });
      const rc = reservas.find(x => x.usuario_id !== org.id && new Date(x.inicio) > new Date());
      if (rc) { const e = equipos.find(x => x.id === rc.equipo_id), u = perfiles.find(x => x.id === rc.usuario_id);
        avisos.push({ id: ++seq, tipo: 'cancelacion', laboratorio: e.laboratorio, creado: new Date(ahora - 3 * 3600e3).toISOString(),
          mensaje: `${u.nombre} canceló su reserva de "${e.nombre}" del ${descHorario(rc.inicio, rc.fin)}. Ese turno quedó libre.` });
        reservas = reservas.filter(x => x.id !== rc.id); }

      // Observaciones de ejemplo
      const u1 = usuarios[1] || usuarios[0], u2 = usuarios[2] || usuarios[0], adm = perfiles.find(p => p.rol === 'admin');
      const hace = h => new Date(Date.now() - h * 3600e3).toISOString();
      observaciones.push(
        { id: ++seq, equipo_id: equipos[0].id, usuario_id: u1.id, texto: 'La lectura de corriente se satura por encima de 10 mA; revisar cable del electrodo de trabajo.', estado: 'Pendiente', creado: hace(5) },
        { id: ++seq, equipo_id: null, usuario_id: u2.id, texto: 'Encontré los electrodos de referencia fuera de su solución de almacenamiento.', estado: 'Pendiente', creado: hace(28) },
        { id: ++seq, equipo_id: equipos[4] ? equipos[4].id : equipos[0].id, usuario_id: u2.id, texto: 'El software no reconoce el equipo al encenderlo.', estado: 'Resuelta', creado: hace(96),
          resuelta_por: adm ? adm.id : null, resuelta_en: hace(70), nota_resolucion: 'Se reinstaló el driver USB.' });
    })();

    function validarReunion(n, cambiaHora = true) {
      if (n.tema.length < 3) error('Escriba el tema de la reunión.');
      if (!cambiaHora) return;
      if (new Date(n.fin) <= new Date(n.inicio)) error('La hora de fin debe ser posterior a la de inicio.');
      if (new Date(n.inicio) < new Date()) error('No se puede programar una reunión en un horario que ya pasó.');
      if (new Date(n.fin) - new Date(n.inicio) > 6 * 3600e3) error('Una reunión puede durar como máximo 6 horas.');
      const c = reuniones.find(g => g.id !== n.id && new Date(g.inicio) < new Date(n.fin) && new Date(g.fin) > new Date(n.inicio));
      if (c) error(`Ya hay una reunión ese horario: "${c.tema}" (${U.horaLima(c.inicio)} a ${U.horaLima(c.fin)}).`);
    }

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
        if (!yo || !['usuario', 'encargado', 'admin'].includes(yo.rol)) error('No tiene permiso para esta acción.');
        if (!r.uso || r.uso.trim().length < 5) error('Describa el uso del equipo (mínimo 5 caracteres).');
        const n = { equipo_id: r.equipo_id, usuario_id: yo.id, inicio: r.inicio.toISOString(), fin: r.fin.toISOString(), uso: r.uso.trim() };
        validar(n, null, true);
        const e = equipos.find(x => x.id === n.equipo_id);
        n.estado = otroLab(e, yo) ? 'Pendiente' : 'Confirmada';
        if (n.estado === 'Pendiente' && ['encargado', 'admin'].includes(yo.rol)) { n.aprobada_origen_por = yo.id; n.aprobada_origen_en = n.creado = new Date().toISOString(); }
        n.id = ++seq; n.creado = new Date().toISOString(); reservas.push(n);
        if (n.estado === 'Pendiente') avisar('solicitud', `${yo.nombre} (${yo.laboratorio}) solicita "${e.nombre}" del ${e.laboratorio} para el ${descHorario(n.inicio, n.fin)}. Uso: ${n.uso}`, e.laboratorio);
        return espera(n);
      },
      async actualizarReserva(id, r) {
        const x = reservas.find(z => z.id === id); if (!x) error('La reserva no existe.');
        if (x.usuario_id !== yo.id && !esAdmin()) error('No tiene permiso para esta acción.');
        const n = { ...x, ...(r.inicio && { inicio: r.inicio.toISOString() }), ...(r.fin && { fin: r.fin.toISOString() }),
          ...(r.uso !== undefined && { uso: r.uso.trim() }), ...(r.equipo_id && { equipo_id: r.equipo_id }) };
        if (n.uso.length < 5) error('Describa el uso del equipo (mínimo 5 caracteres).');
        const cambia = n.inicio !== x.inicio || n.fin !== x.fin || n.equipo_id !== x.equipo_id;
        if (cambia && !esAdmin() && x.estado === 'Confirmada' && new Date(x.inicio) - Date.now() < 24 * 3600e3)
          error('Solo se puede cambiar el turno hasta 24 horas antes del inicio de la reserva.');
        validar(n, id, cambia);
        if (cambia) {
          const e = equipos.find(z => z.id === n.equipo_id), e0 = equipos.find(z => z.id === x.equipo_id), p = perfiles.find(z => z.id === x.usuario_id);
          n.estado = otroLab(e, p) ? 'Pendiente' : 'Confirmada'; n.aprobada_por = null; n.aprobada_en = null;
          n.aprobada_origen_por = n.estado === 'Pendiente' && ['encargado', 'admin'].includes(p.rol) ? p.id : null;
          if (n.estado === 'Pendiente') avisar('solicitud', `${p.nombre} (${p.laboratorio}) solicita "${e.nombre}" del ${e.laboratorio} para el ${descHorario(n.inicio, n.fin)}. Uso: ${n.uso}`, e.laboratorio);
          else avisar('cambio', `${p.nombre} cambió su reserva de "${e0.nombre}" del ${descHorario(x.inicio, x.fin)}. Ese turno quedó libre.`, e0.laboratorio);
        }
        Object.assign(x, n); return espera(x);
      },
      async cancelarReserva(id) {
        const x = reservas.find(z => z.id === id);
        if (!x) error('La reserva ya no existe.');
        if (x.usuario_id !== yo.id && !esAdmin()) error('Solo puede cancelar sus propias reservas.');
        const limite = new Date(new Date(x.inicio).getTime() - 24 * 3600e3);
        if (!esAdmin() && x.estado === 'Confirmada' && Date.now() > limite)
          error(`Ya no se puede cancelar: el plazo vence 24 horas antes del inicio (${U.fechaLima(limite).slice(8, 10)}/${U.fechaLima(limite).slice(5, 7)} ${U.horaLima(limite)}).`);
        const e = equipos.find(z => z.id === x.equipo_id), p = perfiles.find(z => z.id === x.usuario_id);
        reservas = reservas.filter(z => z.id !== id);
        if (new Date(x.fin) > new Date()) avisar('cancelacion', x.usuario_id === yo.id
          ? `${p.nombre} ${x.estado === 'Pendiente' ? 'retiró su solicitud' : 'canceló su reserva'} de "${e.nombre}" del ${descHorario(x.inicio, x.fin)}. Ese turno quedó libre.`
          : `${yo.nombre} canceló la reserva de ${p.nombre} de "${e.nombre}" del ${descHorario(x.inicio, x.fin)}. Ese turno quedó libre.`, e.laboratorio);
        return espera(true);
      },
      async resolverSolicitud(id, aprobar, motivo) {
        const x = reservas.find(z => z.id === id);
        if (!x || x.estado !== 'Pendiente') error('La solicitud ya fue resuelta o retirada.');
        const e = equipos.find(z => z.id === x.equipo_id), p = perfiles.find(z => z.id === x.usuario_id);
        if (!puedeAprobar(e.laboratorio) && !puedeAprobar(p.laboratorio)) error(`Solo un encargado o administrador de ${e.laboratorio} o de ${p.laboratorio} puede resolver esta solicitud.`);
        if (!aprobar) {
          reservas = reservas.filter(z => z.id !== id);
          avisar('rechazada', `${yo.nombre} rechazó la solicitud de ${p.nombre}: "${e.nombre}" el ${descHorario(x.inicio, x.fin)}.${motivo ? ' Motivo: ' + motivo : ''}`, e.laboratorio);
          return espera(true);
        }
        const ladoEq = !x.aprobada_por && puedeAprobar(e.laboratorio), ladoOr = !x.aprobada_origen_por && puedeAprobar(p.laboratorio);
        if (!ladoEq && !ladoOr) error(`Su laboratorio ya aprobó esta solicitud. Falta la aprobación del ${!x.aprobada_por ? e.laboratorio : p.laboratorio}.`);
        const t = new Date().toISOString();
        if (ladoEq) { x.aprobada_por = yo.id; x.aprobada_en = t; }
        if (ladoOr) { x.aprobada_origen_por = yo.id; x.aprobada_origen_en = t; }
        if (x.aprobada_por && x.aprobada_origen_por) {
          x.estado = 'Confirmada';
          avisar('aprobada', `${yo.nombre} aprobó la solicitud de ${p.nombre}: "${e.nombre}" el ${descHorario(x.inicio, x.fin)}. Con la aprobación de ambos laboratorios, la reserva queda confirmada.`, e.laboratorio);
        } else {
          avisar('aprobada', `${yo.nombre} aprobó, por el ${ladoEq ? e.laboratorio : p.laboratorio}, la solicitud de ${p.nombre}: "${e.nombre}" el ${descHorario(x.inicio, x.fin)}. Falta la aprobación del ${!x.aprobada_por ? e.laboratorio : p.laboratorio}.`, e.laboratorio);
        }
        return espera(true);
      },
      async solicitudesPendientes() {
        return espera(reservas.filter(x => x.estado === 'Pendiente' && new Date(x.fin) > new Date()).sort((a, b) => a.inicio.localeCompare(b.inicio)).map(detalle));
      },
      async avisos(limite = 150) {
        if (!yo || yo.rol === 'kiosco') return [];
        return espera(avisos.slice().sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, limite));
      },
      async avisosNuevos(desde) { return avisos.filter(a => a.creado > desde).length; },
      async marcarAvisosVistos() { if (yo) yo.avisos_vistos = new Date().toISOString(); },
      async reuniones(desde, hasta) {
        return espera(reuniones.filter(g => (!desde || new Date(g.fin) >= desde) && (!hasta || new Date(g.inicio) < hasta))
          .sort((a, b) => a.inicio.localeCompare(b.inicio)).map(detalleReu));
      },
      async crearReunion(g) {
        if (!yo || !['usuario', 'encargado', 'admin'].includes(yo.rol)) error('Su usuario no puede programar reuniones.');
        const n = { id: ++seq, organizador_id: yo.id, inicio: g.inicio.toISOString(), fin: g.fin.toISOString(), tema: (g.tema || '').trim(), lugar: (g.lugar || '').trim() || null, creado: new Date().toISOString() };
        validarReunion(n);
        reuniones.push(n);
        avisar('reunion', `${yo.nombre} programó una reunión de grupo: "${n.tema}", el ${descHorario(n.inicio, n.fin)}${n.lugar ? ' en ' + n.lugar : ''}.`);
        return espera(n);
      },
      async actualizarReunion(id, g) {
        const x = reuniones.find(z => z.id === id);
        if (!x || (x.organizador_id !== yo.id && !esAdmin())) error('Solo quien organizó la reunión o un administrador puede modificarla.');
        const n = { ...x, inicio: g.inicio.toISOString(), fin: g.fin.toISOString(), tema: (g.tema || '').trim(), lugar: (g.lugar || '').trim() || null };
        const cambiaHora = n.inicio !== x.inicio || n.fin !== x.fin;
        validarReunion(n, cambiaHora);
        if (cambiaHora || n.lugar !== x.lugar) avisar('reunion', `${yo.nombre} cambió la reunión "${n.tema}": ahora es el ${descHorario(n.inicio, n.fin)}${n.lugar ? ' en ' + n.lugar : ''}.`);
        Object.assign(x, n); return espera(x);
      },
      async cancelarReunion(id) {
        const x = reuniones.find(z => z.id === id);
        if (!x || !(esAdmin() || (x.organizador_id === yo.id && new Date(x.fin) > new Date())))
          error('Solo quien organizó la reunión o un administrador puede cancelarla, y antes de que termine.');
        reuniones = reuniones.filter(z => z.id !== id); asisReu = asisReu.filter(a => a.reunion_id !== id);
        if (new Date(x.fin) > new Date()) avisar('reunion_cancelada', `${yo.nombre} canceló la reunión "${x.tema}" del ${descHorario(x.inicio, x.fin)}.`);
        return espera(true);
      },
      async qrReunionToken(id) {
        const g = reuniones.find(z => z.id === id); if (!g) error('La reunión no existe.');
        if (g.organizador_id !== yo.id && !esAdmin()) error('Solo quien organizó la reunión o un administrador puede mostrar su QR.');
        const act = new Date(new Date(g.inicio).getTime() - 15 * 60e3);
        if (new Date() < act) error(`El QR se activa 15 minutos antes del inicio (a las ${U.horaLima(act)}).`);
        if (new Date() > new Date(g.fin)) error('La reunión ya terminó.');
        const v = ventana();
        return { token: token('R' + id, v), renueva: new Date((v + 1) * 60000).toISOString(), ahora: new Date().toISOString() };
      },
      async marcarReunion(id, tok) {
        if (!yo || yo.rol === 'kiosco') error('Su usuario no está habilitado.');
        const g = reuniones.find(z => z.id === id); if (!g) error('La reunión no existe.');
        const t = Date.now();
        if (t < new Date(g.inicio) - 15 * 60e3 || t > new Date(g.fin).getTime() + 5 * 60e3)
          error(`La asistencia de esta reunión solo se registra durante su horario (${U.horaLima(g.inicio)} a ${U.horaLima(g.fin)}).`);
        const v = ventana();
        if (![0, 1, 2, 3, 4, 5].some(i => token('R' + id, v - i) === String(tok).toUpperCase()))
          error('El código QR caducó. Escanee nuevamente el código que se muestra en la reunión.');
        const ya = asisReu.find(a => a.reunion_id === id && a.usuario_id === yo.id);
        if (ya) return { tema: g.tema, momento: ya.momento, nombre: yo.nombre, repetido: true };
        const a = { reunion_id: id, usuario_id: yo.id, momento: new Date().toISOString() }; asisReu.push(a);
        return espera({ tema: g.tema, momento: a.momento, nombre: yo.nombre, repetido: false });
      },
      async asistenciaReunion(ids) {
        return espera(asisReu.filter(a => ids.includes(a.reunion_id)).sort((a, b) => a.momento.localeCompare(b.momento)).map(a => {
          const p = perfiles.find(x => x.id === a.usuario_id);
          return { ...a, codigo: p.codigo, nombre: p.nombre, supervisor: p.supervisor, laboratorio: p.laboratorio };
        }));
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
      },
      async turnos() { return espera(turnos.map(t => ({ ...t }))); },
      async reglas() { return espera({ ...RG }); },
      async observaciones(desde, hasta) {
        return espera(observaciones.filter(o => (!desde || new Date(o.creado) >= desde) && (!hasta || new Date(o.creado) < hasta))
          .sort((a, b) => b.creado.localeCompare(a.creado)).map(detalleObs));
      },
      async crearObservacion(o) {
        if (!yo || !['usuario', 'admin'].includes(yo.rol)) error('No tiene permiso para esta acción.');
        if (!o.texto || o.texto.trim().length < 5) error('Escriba la observación (mínimo 5 caracteres).');
        const n = { id: ++seq, equipo_id: o.equipo_id || null, usuario_id: yo.id, texto: o.texto.trim(), estado: 'Pendiente', creado: new Date().toISOString() };
        observaciones.push(n); return espera(n);
      },
      async resolverObservacion(id, nota) {
        if (!esAdmin()) error('Solo un administrador puede marcar observaciones como resueltas.');
        const o = observaciones.find(x => x.id === id);
        Object.assign(o, { estado: 'Resuelta', resuelta_por: yo.id, resuelta_en: new Date().toISOString(), nota_resolucion: nota || null });
      },
      async reabrirObservacion(id) {
        if (!esAdmin()) error('Solo un administrador puede reabrir observaciones.');
        Object.assign(observaciones.find(x => x.id === id), { estado: 'Pendiente', resuelta_por: null, resuelta_en: null, nota_resolucion: null });
      },
      async borrarObservacion(id) {
        const o = observaciones.find(x => x.id === id);
        if (!o || !(esAdmin() || (o.usuario_id === yo.id && o.estado === 'Pendiente'))) error('Solo puede borrar sus propias observaciones pendientes.');
        observaciones = observaciones.filter(x => x.id !== id);
      }
    };
  }

  const tieneSupabase = CFG.SUPABASE_URL && CFG.SUPABASE_CLAVE_PUBLICA && window.supabase;
  window.API = tieneSupabase ? crearSupabase() : crearDemo();
})();
