let contadorActividades = 7;
const maxActividades = 15;

document.addEventListener("DOMContentLoaded", () => {
  const btnGuardar = document.getElementById("btn-guardar");
  const btnImprimir = document.getElementById("btn-imprimir");
  const btnAdd = document.getElementById("btn-add-actividad");
  const btnRemove = document.getElementById("btn-remove-actividad");

  if (btnGuardar) btnGuardar.addEventListener("click", guardarEnBD);
  if (btnImprimir) btnImprimir.addEventListener("click", () => window.print());
  if (btnAdd) btnAdd.addEventListener("click", agregarActividad);
  if (btnRemove) btnRemove.addEventListener("click", quitarActividad);

  // UX: instituciones externas detalle
  const radiosExt = document.querySelectorAll('input[name="instituciones_externas"]');
  const detalleExt = document.querySelector('input[name="instituciones_externas_detalle"]');

  function syncExt() {
    const val = document.querySelector('input[name="instituciones_externas"]:checked')?.value;
    const enable = (val === "si");
    if (detalleExt) {
      detalleExt.disabled = !enable;
      if (!enable) detalleExt.value = "";
    }
  }
  radiosExt.forEach(r => r.addEventListener("change", syncExt));
  syncExt();

  // UX: almacenamiento otro
  const otroChk = document.querySelector('input[type="checkbox"][name="almacenamiento"][value="otro"]');
  const otroTxt = document.querySelector('input[name="almacenamiento_otro"]');

  function syncOtro() {
    const enable = !!(otroChk && otroChk.checked);
    if (otroTxt) {
      otroTxt.disabled = !enable;
      if (!enable) otroTxt.value = "";
    }
  }
  if (otroChk) otroChk.addEventListener("change", syncOtro);
  syncOtro();
});

function crearFilaActividad(idx) {
  const row = document.createElement("div");
  row.className = "grid grid-cols-12 gap-3 items-start";
  row.setAttribute("data-idx", String(idx));

  row.innerHTML = `
    <div class="col-span-7">
      <input name="actividad_desc_${idx}" type="text" placeholder="Actividad ${idx}"
        class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"/>
    </div>
    <div class="col-span-5">
      <input name="actividad_ejec_${idx}" type="text" placeholder="Ejecutor / Rol"
        class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"/>
    </div>
  `;
  return row;
}

function agregarActividad() {
  if (contadorActividades >= maxActividades) {
    alert("Se recomienda no exceder " + maxActividades + " actividades por proceso.");
    return;
  }
  contadorActividades++;

  const cont = document.getElementById("lista-actividades");
  if (!cont) return;

  cont.appendChild(crearFilaActividad(contadorActividades));
}

function quitarActividad() {
  const cont = document.getElementById("lista-actividades");
  if (!cont) return;

  if (contadorActividades <= 1) return;

  cont.removeChild(cont.lastElementChild);
  contadorActividades--;
}

async function guardarEnBD() {
  const form = document.getElementById("form-levantamiento");
  if (!form) {
    alert("No se encontró el formulario (id=form-levantamiento).");
    return;
  }

  const fd = new FormData(form);

  // Recolectar actividades como array de objetos
  const actividades = [];
  for (let i = 1; i <= contadorActividades; i++) {
    const desc = (fd.get(`actividad_desc_${i}`) || "").toString().trim();
    const ejec = (fd.get(`actividad_ejec_${i}`) || "").toString().trim();

    if (desc) {
      actividades.push({ descripcion: desc, ejecutor: ejec || null });
    }
  }

  const payload = {
    nombre_proceso: fd.get("nombre_proceso"),
    unidad_responsable: fd.get("unidad_responsable"),
    objetivo_proceso: fd.get("objetivo_proceso"),
    resultado_final: fd.get("resultado_final"),
    evento_inicio: fd.get("evento_inicio"),
    evento_termino: fd.get("evento_termino"),
    actores: fd.get("actores"),
    instituciones_externas: fd.get("instituciones_externas"),
    instituciones_externas_detalle: fd.get("instituciones_externas_detalle"),
    docs_inicio: fd.get("docs_inicio"),
    docs_durante: fd.get("docs_durante"),
    momento_expediente: fd.get("momento_expediente"),
    almacenamiento: fd.getAll("almacenamiento"),
    almacenamiento_otro: fd.get("almacenamiento_otro"),
    problemas: fd.get("problemas"),
    etapas_criticas: fd.get("etapas_criticas"),
    validacion: fd.get("validacion"),
    obs_adicionales: fd.get("obs_adicionales"),
    fecha_levantamiento: fd.get("fecha_levantamiento"),
    unidad_participante: fd.get("unidad_participante"),
    profesional_levantamiento: fd.get("profesional_levantamiento"),
    contacto_validacion: fd.get("contacto_validacion"),
    actividades
  };

  // LOCAL XAMPP (desde /public/ hacia /api/)
  const url = "../api/save_proceso.php";

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await resp.json().catch(() => ({}));

  if (resp.ok && data.ok) alert("Guardado ✅ ID: " + data.id);
  else {
    alert("Error al guardar. Revisa la consola.");
    console.error(data);
  }
}
