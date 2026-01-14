let contadorActividades = 7;
const maxActividades = 20;

// 🔐 Debe coincidir con api/config.php
const API_KEY = "Ser0921*/";

document.addEventListener("DOMContentLoaded", () => {
  // sincroniza contador con filas reales
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

function esVacio(v) {
  return !v || !v.toString().trim();
}

function marcarError(el) {
  if (!el) return;
  el.classList.add("border-red-500", "bg-red-50");
}

function limpiarErrores() {
  document.querySelectorAll(".border-red-500").forEach(el => {
    el.classList.remove("border-red-500", "bg-red-50");
  });
}

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
 * Lee actividades desde FormData:
 * - solo cuenta filas con descripción
 * - exige ejecutor si existe descripción (lo validamos)
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
  limpiarErrores();

  const getEl = (name) => document.querySelector(`[name="${name}"]`);

  // Campos obligatorios
  const nombre = (fd.get("nombre_proceso") || "").toString().trim();
  const unidad = (fd.get("unidad_responsable") || "").toString().trim();
  const objetivo = (fd.get("objetivo_proceso") || "").toString().trim();
  const resultado = (fd.get("resultado_final") || "").toString().trim();
  const inicio = (fd.get("evento_inicio") || "").toString().trim();
  const termino = (fd.get("evento_termino") || "").toString().trim();
  const actores = (fd.get("actores") || "").toString().trim();

  const instExt = (fd.get("instituciones_externas") || "").toString().trim(); // si/no
  const instExtDet = (fd.get("instituciones_externas_detalle") || "").toString().trim();

  const validacion = (fd.get("validacion") || "").toString().trim(); // si/no

  const fecha = (fd.get("fecha_levantamiento") || "").toString().trim();
  const unidadPart = (fd.get("unidad_participante") || "").toString().trim();
  const profesional = (fd.get("profesional_levantamiento") || "").toString().trim();

  const almacenamiento = fd.getAll("almacenamiento");
  const almacenamientoOtro = (fd.get("almacenamiento_otro") || "").toString().trim();

  // Validaciones (ordenadas)
  if (esVacio(nombre)) { marcarError(getEl("nombre_proceso")); alert("Falta: Nombre del proceso"); return; }
  if (esVacio(unidad)) { marcarError(getEl("unidad_responsable")); alert("Falta: Unidad responsable"); return; }
  if (esVacio(objetivo)) { marcarError(getEl("objetivo_proceso")); alert("Falta: Objetivo del proceso"); return; }
  if (esVacio(resultado)) { marcarError(getEl("resultado_final")); alert("Falta: Resultado final"); return; }
  if (esVacio(inicio)) { marcarError(getEl("evento_inicio")); alert("Falta: Evento de inicio"); return; }
  if (esVacio(termino)) { marcarError(getEl("evento_termino")); alert("Falta: Evento de término"); return; }
  if (esVacio(actores)) { marcarError(getEl("actores")); alert("Falta: Actores (roles/unidades)"); return; }

  if (!["si", "no"].includes(instExt)) {
    alert("Falta: Instituciones externas (Sí/No)");
    return;
  }
  if (instExt === "si" && esVacio(instExtDet)) {
    marcarError(getEl("instituciones_externas_detalle"));
    alert("Falta: Indicar cuáles instituciones externas participan");
    return;
  }

  // Actividades y ejecutor obligatorio
  const actividades = leerActividadesDesdeFormData(fd);
  if (actividades.length === 0) {
    alert("Debes ingresar al menos 1 actividad");
    return;
  }
  for (const a of actividades) {
    if (esVacio(a.descripcion)) {
      marcarError(getEl(`actividad_${a.orden}`));
      alert(`Falta descripción en Actividad ${a.orden}`);
      return;
    }
    if (esVacio(a.ejecutor)) {
      marcarError(getEl(`ejecutor_${a.orden}`));
      alert(`Falta ejecutor (rol/cargo) en Actividad ${a.orden}`);
      return;
    }
  }

  // Almacenamiento al menos 1
  if (!almacenamiento || almacenamiento.length === 0) {
    alert("Falta: Selecciona al menos un medio de almacenamiento");
    return;
  }
  if (almacenamiento.includes("otro") && esVacio(almacenamientoOtro)) {
    marcarError(getEl("almacenamiento_otro"));
    alert("Falta: Detallar almacenamiento 'Otro'");
    return;
  }

  // Validación sí/no
  if (!["si", "no"].includes(validacion)) {
    alert("Falta: Validación (Sí/No)");
    return;
  }

  // Datos registro
  if (esVacio(fecha)) { marcarError(getEl("fecha_levantamiento")); alert("Falta: Fecha de levantamiento"); return; }
  if (esVacio(unidadPart)) { marcarError(getEl("unidad_participante")); alert("Falta: Unidad participante"); return; }
  if (esVacio(profesional)) { marcarError(getEl("profesional_levantamiento")); alert("Falta: Profesional levantamiento"); return; }

  // Payload
  const payload = {
    nombre_proceso: nombre,
    unidad_responsable: unidad,
    objetivo_proceso: objetivo,
    resultado_final: resultado,
    evento_inicio: inicio,
    evento_termino: termino,
    actores,

    instituciones_externas: instExt,
    instituciones_externas_detalle: instExtDet,

    docs_inicio: fd.get("docs_inicio"),
    docs_durante: fd.get("docs_durante"),
    momento_expediente: fd.get("momento_expediente"),

    almacenamiento,
    almacenamiento_otro: almacenamientoOtro,

    problemas: fd.get("problemas"),
    etapas_criticas: fd.get("etapas_criticas"),

    validacion,
    obs_adicionales: fd.get("obs_adicionales"),

    fecha_levantamiento: fecha,
    unidad_participante: unidadPart,
    profesional_levantamiento: profesional,
    contacto_validacion: fd.get("contacto_validacion"),

    actividades
  };

  // ⚠️ RUTA:
  // - si el formulario está en /formulario/ => "../api/save_proceso.php"
  // - si el formulario está en la raíz / => "api/save_proceso.php"
  const url = "../api/save_proceso.php";

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

    if (resp.ok && data.ok) {
      alert("Guardado ✅ ID: " + data.id);
    } else {
      alert("Error al guardar. Revisa consola.");
      console.error(data);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
