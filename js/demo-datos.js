/* Datos de ejemplo para el MODO DEMOSTRACIÓN (usuarios ficticios).
   No se usan cuando la app está conectada a Supabase. */
window.DEMO_DATOS = {
 "laboratorios": [
  {
   "codigo": "LAB1",
   "nombre": "Laboratorio 1",
   "responsable": "Dra. Angélica Baena M.",
   "observaciones": null
  },
  {
   "codigo": "LAB2",
   "nombre": "Laboratorio 2",
   "responsable": "Dr. Adolfo La Rosa Toro G.",
   "observaciones": null
  }
 ],
 "equipos": [
  {
   "codigo": "EQ2-001",
   "nombre": "Potenciostato Autolab 1 (EIS)",
   "laboratorio": "LAB1",
   "prioridad": 1,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ2-002",
   "nombre": "Potenciostato Autolab 2",
   "laboratorio": "LAB1",
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ2-003",
   "nombre": "Espectrómetro UV-vis",
   "laboratorio": "LAB1",
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ1-001",
   "nombre": "Potenciostato Autolab booster",
   "laboratorio": "LAB2",
   "prioridad": 1,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ1-002",
   "nombre": "Potenciostato GAMRY",
   "laboratorio": "LAB2",
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ1-003",
   "nombre": "Equipo Carga-Descarga",
   "laboratorio": "LAB1",
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ-C01",
   "nombre": "Microscopio Raman Horiba",
   "laboratorio": null,
   "prioridad": 1,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ-C02",
   "nombre": "Microscopio Electroquímico de Barrido",
   "laboratorio": null,
   "prioridad": 3,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ-C03",
   "nombre": "Microbalanza Electroquímica de Cuarzo",
   "laboratorio": null,
   "prioridad": 3,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ-C04",
   "nombre": "Electrodo RRDE Rotatorio de Disco Anillo",
   "laboratorio": null,
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  },
  {
   "codigo": "EQ-C05",
   "nombre": "Ciclador de baterías NEWARE BTS4008 (8 canales)",
   "laboratorio": null,
   "prioridad": 2,
   "hora_inicio": "08:00:00",
   "hora_fin": "21:30:00",
   "duracion_max_h": 4,
   "estado": "Disponible"
  }
 ],
 "usuarios": [
  {
   "codigo": "DEMO-ADMIN",
   "nombre": "Administrador Demo",
   "laboratorio": "AMBOS",
   "supervisor": null,
   "rol": "admin",
   "pin": "1234"
  },
  {
   "codigo": "DEMO1",
   "nombre": "Ana Torres (demo)",
   "laboratorio": "LAB1",
   "supervisor": "A. Baena",
   "rol": "usuario",
   "pin": "1111"
  },
  {
   "codigo": "DEMO2",
   "nombre": "Luis Ramos (demo)",
   "laboratorio": "LAB2",
   "supervisor": "A. La Rosa Toro",
   "rol": "usuario",
   "pin": "2222"
  },
  {
   "codigo": "DEMO3",
   "nombre": "María Salas (demo)",
   "laboratorio": "LAB2",
   "supervisor": "A. La Rosa Toro",
   "rol": "usuario",
   "pin": "3333"
  },
  {
   "codigo": "DEMO4",
   "nombre": "Carlos Díaz (demo)",
   "laboratorio": "LAB1",
   "supervisor": "A. Baena",
   "rol": "usuario",
   "pin": "4444"
  },
  {
   "codigo": "DEMO5",
   "nombre": "Rosa Quispe (demo)",
   "laboratorio": "AMBOS",
   "supervisor": "A. La Rosa Toro",
   "rol": "usuario",
   "pin": "5555"
  },
  {
   "codigo": "QR-LAB1",
   "nombre": "Pantalla QR Laboratorio 1",
   "laboratorio": "LAB1",
   "supervisor": null,
   "rol": "kiosco",
   "pin": "9991"
  },
  {
   "codigo": "QR-LAB2",
   "nombre": "Pantalla QR Laboratorio 2",
   "laboratorio": "LAB2",
   "supervisor": null,
   "rol": "kiosco",
   "pin": "9992"
  }
 ]
};
