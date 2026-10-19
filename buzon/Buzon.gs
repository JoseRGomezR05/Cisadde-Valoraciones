/* =====================================================================
   BUZÓN CISADDE — recibe los reportes de problemas y cuenta las valoraciones.
   Va pegado en una hoja de Google (Extensiones → Apps Script).
   Guarda dos pestañas: "Reportes" y "Uso". En "Uso" no hay datos de niños:
   solo fecha, formato, área, terapeuta y un código al azar por valoración.

   1) Cambia la clave de abajo por una tuya (la pedirá el Panel para LEER).
   2) Guarda, y luego Implementar → Nueva implementación → Aplicación web:
        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
   3) Copia la URL que termina en /exec y pégala en el Panel CISADDE.
   ===================================================================== */
const CLAVE = 'CAMBIA-ESTA-CLAVE';

const COLUMNAS = {
  Reportes: ['Fecha', 'Formato', 'Nombre', 'Problema', 'Página', 'Navegador', 'Estado', 'ID'],
  Uso:      ['Fecha', 'Formato', 'Área', 'Terapeuta', 'Valoración']
};

function hoja_(nombre){
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(nombre);
  if(!h){
    h = ss.insertSheet(nombre);
    h.appendRow(COLUMNAS[nombre]);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, COLUMNAS[nombre].length).setFontWeight('bold');
  }
  return h;
}
function filas_(h){
  const n = h.getLastRow() - 1;
  return n > 0 ? h.getRange(2, 1, n, h.getLastColumn()).getValues() : [];
}
function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function corto_(s, n){ return String(s == null ? '' : s).slice(0, n); }

/* Lo que envían los formatos (y el Panel para marcar resueltos). */
function doPost(e){
  let d;
  try{ d = JSON.parse(e.postData.contents); }catch(err){ return json_({ ok:false, error:'formato' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    if(d.tipo === 'reporte'){
      if(!corto_(d.texto, 2000).trim()) return json_({ ok:false, error:'vacio' });
      const id = Utilities.getUuid().slice(0, 8);
      hoja_('Reportes').appendRow([new Date(), corto_(d.formato, 60), corto_(d.nombre, 80), corto_(d.texto, 2000),
        corto_(d.pagina, 200), corto_(d.navegador, 200), 'Abierto', id]);
      return json_({ ok:true, id: id });
    }
    if(d.tipo === 'uso'){
      const h = hoja_('Uso');
      const val = corto_(d.valoracion, 40);
      const ya = val && filas_(h).some(r => r[4] === val); // una valoración se cuenta una sola vez
      if(!ya) h.appendRow([d.fecha ? new Date(d.fecha) : new Date(), corto_(d.formato, 60), corto_(d.area, 40), corto_(d.terapeuta, 80), val]);
      return json_({ ok:true, repetida: !!ya });
    }
    if(d.tipo === 'estado'){
      if(d.clave !== CLAVE) return json_({ ok:false, error:'clave' });
      const h = hoja_('Reportes'), rows = filas_(h);
      for(let i = 0; i < rows.length; i++){
        if(rows[i][7] === d.id){ h.getRange(i + 2, 7).setValue(d.estado === 'Resuelto' ? 'Resuelto' : 'Abierto'); return json_({ ok:true }); }
      }
      return json_({ ok:false, error:'no-existe' });
    }
    return json_({ ok:false, error:'tipo' });
  }finally{
    lock.releaseLock();
  }
}

/* Lo que lee el Panel (necesita la clave). */
function doGet(e){
  const p = e.parameter || {};
  if(p.accion === 'ping') return json_({ ok:true });
  if(p.clave !== CLAVE) return json_({ ok:false, error:'clave' });
  const fecha = v => v instanceof Date ? v.toISOString() : String(v);
  const reportes = filas_(hoja_('Reportes')).slice(-150).reverse().map(r => ({
    fecha: fecha(r[0]), formato: r[1], nombre: r[2], texto: r[3], pagina: r[4], navegador: r[5], estado: r[6], id: r[7]
  }));
  const desde = Date.now() - 400 * 24 * 3600 * 1000;
  const uso = filas_(hoja_('Uso')).filter(r => new Date(r[0]).getTime() >= desde).map(r => ({
    fecha: fecha(r[0]), formato: r[1], area: r[2], terapeuta: r[3]
  }));
  return json_({ ok:true, reportes: reportes, uso: uso });
}
