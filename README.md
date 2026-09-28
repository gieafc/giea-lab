# GIEA · Asistencia y reserva de equipos

Aplicación web para reservar los equipos del laboratorio por bloques de horas y registrar la asistencia diaria con un código QR. Funciona sin costo con **GitHub Pages** (la página) y **Supabase** (la base de datos).

## Qué contiene el paquete

| Carpeta / archivo | Para qué sirve | ¿Se sube a GitHub? |
|---|---|---|
| `sitio-web/` | La aplicación completa | **Sí**, todo su contenido |
| `supabase/instalacion.sql` | Crea la base de datos con sus usuarios y equipos | **No**: contiene los PIN iniciales |
| `PIN_iniciales_CONFIDENCIAL.xlsx` | PIN inicial de cada persona y de las pantallas QR | **No** |

Puede probar la aplicación antes de instalar nada: abra `sitio-web/index.html` en el navegador. Sin datos de Supabase funciona en **modo demostración** con usuarios ficticios.

---

## Instalación (unos 20 minutos)

### 1. Crear la base de datos en Supabase

1. Entre a <https://supabase.com>, cree una cuenta gratuita y luego **New project**.
   - Nombre: por ejemplo `giea-laboratorio`.
   - Región: **South America (São Paulo)**, la más cercana a Lima.
   - Anote la contraseña de la base de datos (no la usará la app, pero la puede necesitar Supabase).
2. Cuando el proyecto esté listo, abra **SQL Editor → New query**.
3. Abra `supabase/instalacion.sql` con el Bloc de notas, copie todo, péguelo en el editor y pulse **Run**.
   - Debe terminar sin errores (los avisos tipo *NOTICE* son normales).
   - En **Table Editor → perfiles** verá 13 filas: 11 personas y 2 pantallas QR.
4. **Importante, seguridad:** vaya a **Authentication → Sign In / Providers** y **desactive "Allow new users to sign up"**. Así nadie puede crearse una cuenta por su cuenta; solo el administrador agrega usuarios desde la app.

### 2. Conectar la página con Supabase

1. En Supabase pulse el botón **Connect** (o **Project Settings → API Keys**) y copie:
   - la **Project URL** (`https://xxxx.supabase.co`)
   - la **Publishable key** (`sb_publishable_…`; en proyectos antiguos se llama *anon public*)
2. Abra `sitio-web/js/config.js` con el Bloc de notas y péguelas:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_CLAVE_PUBLICA: 'sb_publishable_xxxxxxxx',
   ```
   Esta clave es pública por diseño: la seguridad está en las reglas de la base de datos, que el script ya configuró.

### 3. Publicar en GitHub Pages

1. Cree una cuenta en <https://github.com> y un repositorio nuevo **público**, por ejemplo `giea-lab`.
2. En el repositorio: **Add file → Upload files**, arrastre **todo el contenido** de la carpeta `sitio-web` (no la carpeta en sí, sino lo que hay dentro: `index.html`, `css`, `js`, etc.) y pulse **Commit changes**.
3. Vaya a **Settings → Pages**. En *Source* elija **Deploy from a branch**, rama **main**, carpeta **/ (root)**, y guarde.
4. En uno o dos minutos la app estará en `https://SU-USUARIO.github.io/giea-lab/`.

### 4. Primer ingreso

- El administrador es **GE102** (Victor R. Jauja). Ingrese con su PIN inicial; la app le pedirá cambiarlo.
- Entregue a cada persona **solo su** código y PIN inicial (están en `PIN_iniciales_CONFIDENCIAL.xlsx`). Todos deberán cambiarlo en su primer ingreso.
- Para dar permisos de administrador a otra persona: **Administración → Usuarios → Editar → Rol: Administrador**.

### 5. Pantallas QR de asistencia

En la tablet, PC o celular fijo de cada laboratorio:

1. Abra la dirección de la app e ingrese con la cuenta de pantalla: **QR-LAB1** en el Laboratorio 1 y **QR-LAB2** en el Laboratorio 2 (PIN en el archivo confidencial).
2. Se mostrará el QR a pantalla completa. Pulse **Pantalla completa** y desactive la suspensión de pantalla del equipo.
3. Estas cuentas solo pueden mostrar el QR: no pueden reservar ni ver datos de nadie.

El QR cambia cada minuto y cada código sirve durante unos 5 minutos, así que una foto reenviada por WhatsApp deja de funcionar enseguida.

---

## Uso diario

- **Reservar:** menú *Reservar* → elegir equipo (los de prioridad alta aparecen primero) → arrastrar sobre el calendario el bloque de horas → escribir el uso → *Reservar*. En el celular: mantener presionado y deslizar, o usar el botón *Nueva reserva*.
- **Choques:** si el horario ya está ocupado, la app lo rechaza y muestra quién lo tiene. La base de datos lo impide incluso si dos personas reservan en el mismo segundo.
- **Reglas que se validan:** horario del equipo (08:00–21:30), duración máxima (4 h), que el equipo esté *Disponible*, que el usuario pertenezca al laboratorio del equipo (los equipos sin laboratorio son compartidos), y que no sea un horario pasado.
- **Asistencia:** escanear el QR con la cámara del celular. La primera marca del día es la entrada; la siguiente, la salida.
- **Reporte:** *Administración → Reporte de asistencia* → elegir fechas → *Descargar Excel*.

## Administración

- **Usuarios:** agregar, editar, desactivar (el historial se conserva) y generar un PIN nuevo si alguien lo olvida.
- **Equipos:** agregar o editar; ponerlo en *Mantenimiento* bloquea las reservas.
- **Importar Excel:** suba la plantilla (`plantilla/Plantilla_Laboratorio.xlsx`) para altas o cambios masivos. Verá una vista previa antes de aplicar. Nadie se borra por no estar en la planilla; para dar de baja, ponga *Inactivo*.

## Datos que conviene revisar

- Los 5 equipos que no tenían código ni laboratorio en la planilla quedaron como **compartidos** (los puede reservar cualquiera) con códigos `EQ-C01` a `EQ-C05`. Si pertenecen a un laboratorio, edítelos en *Administración → Equipos*.
- Las filas de ejemplo de la plantilla (U0231 y EQ-001) no se cargaron.

## Mantenimiento

- **Plan gratuito de Supabase:** si el proyecto pasa una semana sin ningún uso, Supabase lo pausa. Con uso diario no ocurre; si pasa (por ejemplo en vacaciones), entre al panel de Supabase y pulse **Restore**. Los datos no se pierden.
- **Respaldo:** descargue cada mes el reporte de asistencia en Excel.
- **Cambiar logos:** reemplace los archivos de `assets/` manteniendo los nombres.
- **Agregar un tercer laboratorio:** en el SQL Editor de Supabase ejecute
  ```sql
  insert into laboratorios (codigo, nombre, responsable) values ('LAB3', 'Laboratorio 3', 'Nombre');
  insert into qr_secretos (laboratorio) values ('LAB3');
  select _guardar_usuario('QR-LAB3', 'Pantalla QR Laboratorio 3', 'LAB3', null, '12345678', 'kiosco', true, null);
  ```
  y cambie ese PIN `12345678` por uno propio.
- **Hora:** la app usa la hora de Lima. Los celulares y la tablet deben tener la zona horaria de Perú.

## Detalles técnicos

- Página estática (HTML, CSS y JavaScript sin compilación). Librerías incluidas en `vendor/`: FullCalendar 6 (vistas estándar, licencia MIT), supabase-js 2, qrcode-generator y SheetJS.
- Cada código de usuario se convierte internamente en una cuenta de Supabase Auth (`codigo@giea-uni.local`); nadie recibe correos.
- La base de datos aplica seguridad por filas (RLS): cada persona solo puede crear, mover o cancelar sus propias reservas; solo los administradores modifican usuarios y equipos; el secreto del QR no es legible desde la web.
- Restricción `reservas_sin_choque` (exclusión con rangos de tiempo) como garantía final contra reservas superpuestas.
