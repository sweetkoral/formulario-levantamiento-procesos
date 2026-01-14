let contadorActividades = 7;
const maxActividades = 20;

// 🔐 Debe coincidir con api/config.php
const API_KEY = "Ser0921*/";

document.addEventListener("DOMContentLoaded", () => {
  // ✅ sincroniza contador con la cantidad real de filas existentes en el HTML
  const filas = document.querySelectorAll("#lista-actividades tr[data-idx]");
  if (filas && filas.length > 0) contadorActividades = filas.length;

  document.getElementById("btn-guardar")?.addEventListener("click", guardarEnBD);
  document.getElementById("btn-imprimir")?.addEventListener("click", () => window.print());
  document.getElementById("btn-add-actividad")?.addEventListener("click", agregarActividad);
  document.getElementById("btn-remove-actividad")?.addEventListener("click", quitarActividad);

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
  otroChk?.addEventListener("change", syncOtro);
  syncOtro();
});

function agregarActividad() {
  if (contadorActividades >= maxActividades) {
    alert("Se recomienda no exceder " + maxActividades + " actividades por proceso.");
    return;
  }
  contadorActividades++;

  const tbody = document.getElementById("lista-actividades");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.setAttribute("data-idx", String(contadorActividades));
  tr.className = "border-t border-slate-200";

  tr.innerHTML = `
    <td class="px-3 py-2 text-slate-600">${contadorActividades}</td>
    <td class="px-3 py-2">
      <input type="text" name="actividad_${contadorActividades}" placeholder="Actividad ${contadorActividades}"
        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
    </td>
    <td class="px-3 py-2">
      <input type="text" name="ejecutor_${contadorActividades}" placeholder="Rol/cargo"
        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
    </td>
  `;

  tbody.appendChild(tr);
}

function quitarActividad() {
  const tbody = document.getElementById("lista-actividades");
  if (!tbody) return;

  if (contadorActividades <= 1) return;

  tbody.removeChild(tbody.lastElementChild);
  contadorActividades--;
}

/**
 * ✅ Lectura robusta:
 * - usa FormData para leer actividad_X y ejecutor_X
 * - cuenta SOLO las actividades con descripción no vacía
 * - tolera filas intermedias en blanco (ej: 1 y 3 llenas, 2 vacía)
 */
function leerActividadesDesdeFormData(fd) {
  const actividades = [];

  for (let i = 1; i <= contadorActividades; i++) {
    const desc = (fd.get(`actividad_${i}`) || "").toString().trim();
    const ejec = (fd.get(`ejecutor_${i}`) || "").toString().trim();

    if (desc) {
      actividades.push({
        orden: i,
        descripcion: desc,
        ejecutor: ejec || null
      });
    }
  }

  return actividades;
}

async function guardarEnBD() {
  const form = document.getElementById("form-levantamiento");
  if (!form) return alert("No se encontró el formulario (id=form-levantamiento).");

  const fd = new FormData(form);

  // ✅ Validaciones mínimas
  const nombre = (fd.get("nombre_proceso") || "").toString().trim();
  const unidad = (fd.get("unidad_responsable") || "").toString().trim();

  if (!nombre) return alert("Falta: Nombre del proceso");
  if (!unidad) return alert("Falta: Unidad responsable");

  const actividades = leerActividadesDesdeFormData(fd);
  if (actividades.length === 0) return alert("Debes ingresar al menos 1 actividad");

  const payload = {
    nombre_proceso: nombre,
    unidad_responsable: unidad,
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

  // ⚠️ RUTA (ajústala según dónde esté tu formulario):
  // - si está en /formulario/ => "../api/save_proceso.php"
  // - si está en la raíz / => "api/save_proceso.php"
  const url = "../api/save_proceso.php";

  // Bloqueo anti doble click
  const btn = document.getElementById("btn-guardar");
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.ok && data.ok) alert("Guardado ✅ ID: " + data.id);
    else {
      alert("Error al guardar. Revisa consola.");
      console.error(data);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
