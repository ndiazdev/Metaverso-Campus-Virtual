/**
 * PÍLDORA DE CONECTADOS DEL SALÓN
 *
 * La pregunta más frecuente dentro de un aula virtual es "¿cuántas
 * personas hay aquí?". Este módulo la responde sin salir del 3D:
 * una píldora arriba a la izquierda con el código de la clase, quantos
 * conectados hay y, al pulsarla, el listado con nombre y rol de cada
 * uno. Además trae el botón de COPIAR ENLACE, que es lo que permite
 * abrir la misma clase en otro navegador (el enlace lleva la clase en
 * la dirección: ver state/enlaceClase.ts).
 *
 * Módulo independiente: NO conoce Babylon ni los sockets. Solo recibe
 * la lista de participantes y la pinta, igual que la barra de usuario
 * (src/ui/barraUsuario.ts) o los ajustes.
 *
 *   const pill = crearListadoConectados("FIS-101");
 *   pill.reflejar(participantes, miId);
 *   pill.reflejarConexion("conectado");
 *   pill.destruir();
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import type { EstadoConexion, Participante } from "../red/presencia";
import type { Rol } from "../state/estado";

export interface ListadoConectados {
  /** Pinta la gente que hay en la clase. */
  reflejar: (participantes: Participante[], miId: string | null) => void;
  /** Pinta el estado de la conexión (conectando / conectado / error). */
  reflejarConexion: (estado: EstadoConexion, detalle?: string) => void;
  /** Mensaje suelto (por ejemplo, por qué no le dejaron entrar). */
  avisar: (mensaje: string) => void;
  /** Quita la píldora del DOM (al salir de la partida). */
  destruir: () => void;
}

const COLOR_POR_ROL: Record<Rol, string> = {
  docente: "#F2A93B",
  admin: "#A78BFA",
  estudiante: "#38BDF8",
  invitado: "#94A3B8",
};

const ETIQUETA_ROL: Record<Rol, string> = {
  docente: "Docente",
  admin: "Admin",
  estudiante: "Estudiante",
  invitado: "Invitado",
};

const ESTILO = `
.cv-presencia{position:fixed;top:16px;left:76px;z-index:1400;font-family:sans-serif;display:flex;flex-direction:column;align-items:flex-start;gap:6px;user-select:none}/* left 76 = engranaje (16 + 44 + 16): la píldora y el engranaje, lado a lado */
.cv-presencia-caja{background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,0.35);overflow:hidden;min-width:210px}
.cv-presencia-cabecera{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;background:transparent;color:#E2E8F0;font-size:14px;cursor:pointer;text-align:left}
.cv-presencia-cabecera:hover{background:rgba(255,255,255,0.06)}
.cv-presencia-cabecera:focus-visible{outline:2px solid #7DD3FC;outline-offset:-2px}
.cv-presencia-flecha{font-size:10px;color:#94A3B8;transition:transform .15s ease}
.cv-presencia-caja.cv-abierto .cv-presencia-flecha{transform:rotate(90deg)}
.cv-presencia-clase{font-weight:700;color:#7DD3FC;font-size:12px;letter-spacing:.04em}
.cv-presencia-cuenta{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-weight:700;color:#fff;background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.45);border-radius:999px;padding:2px 9px;font-size:12px}
.cv-presencia-lista{display:none;margin:0;padding:6px;list-style:none;border-top:1px solid rgba(255,255,255,0.12);max-height:46vh;overflow-y:auto}
.cv-presencia-caja.cv-abierto .cv-presencia-lista{display:block}
.cv-presencia-fila{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:13px;color:#E2E8F0}
.cv-presencia-fila:hover{background:rgba(255,255,255,0.06)}
.cv-presencia-punto{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.cv-presencia-nombre{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv-presencia-yo{margin-left:auto;font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em}
.cv-presencia-rol{font-size:10px;border-radius:999px;padding:1px 7px;border:1px solid;flex:0 0 auto}
.cv-presencia-estado{display:none;padding:7px 12px;font-size:12px;border-top:1px solid rgba(255,255,255,0.12);color:#cbd5e1}
.cv-presencia-estado.cv-visible{display:block}
.cv-presencia-estado.cv-error{color:#FCA5A5}
.cv-presencia-acciones{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.12)}
.cv-presencia-boton{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(30,41,59,0.9);color:#E2E8F0;font-size:12px;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.cv-presencia-boton:hover{background:rgba(51,65,85,0.95);border-color:#7DD3FC;color:#fff}
.cv-presencia-boton:focus-visible{outline:2px solid #7DD3FC;outline-offset:1px}
.cv-presencia-enlace{width:100%;word-break:break-all;font-size:11px;color:#94A3B8;text-align:center;padding:0 10px 9px}
`;

function inyectarEstilo(): void {
  if (document.getElementById("cv-estilo-presencia")) return;
  const estilo = document.createElement("style");
  estilo.id = "cv-estilo-presencia";
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);
}

export function crearListadoConectados(codigoClase: string): ListadoConectados {
  inyectarEstilo();

  const contenedor = document.createElement("div");
  contenedor.className = "cv-presencia";

  const caja = document.createElement("div");
  caja.className = "cv-presencia-caja";

  const cabecera = document.createElement("button");
  cabecera.type = "button";
  cabecera.className = "cv-presencia-cabecera";
  cabecera.title = "Ver quién está en esta clase";
  cabecera.innerHTML =
    '<i class="fa-solid fa-chevron-right cv-presencia-flecha"></i>' +
    '<i class="fa-solid fa-users"></i>' +
    `<span class="cv-presencia-clase">${escapar(codigoClase)}</span>` +
    '<span class="cv-presencia-cuenta"><span data-cuenta>0</span></span>';

  const lista = document.createElement("ul");
  lista.className = "cv-presencia-lista";

  const estado = document.createElement("div");
  estado.className = "cv-presencia-estado";

  const acciones = document.createElement("div");
  acciones.className = "cv-presencia-acciones";

  const botonEnlace = document.createElement("button");
  botonEnlace.type = "button";
  botonEnlace.className = "cv-presencia-boton";
  botonEnlace.innerHTML = '<i class="fa-solid fa-link"></i>Copiar enlace';
  botonEnlace.title = "Copia una dirección que abre directamente esta clase";

  const enlace = document.createElement("div");
  enlace.className = "cv-presencia-enlace";
  enlace.textContent = window.location.href;

  acciones.appendChild(botonEnlace);
  enlace.hidden = true;

  caja.appendChild(cabecera);
  caja.appendChild(lista);
  caja.appendChild(estado);
  caja.appendChild(acciones);
  caja.appendChild(enlace);
  contenedor.appendChild(caja);
  document.body.appendChild(contenedor);

  const contador = cabecera.querySelector<HTMLElement>("[data-cuenta]")!;

  cabecera.addEventListener("click", () => {
    caja.classList.toggle("cv-abierto");
  });

  botonEnlace.addEventListener("click", () => {
    // navigator.clipboard necesita un contexto seguro (https o localhost).
    // Si no lo hay, no se rompe nada: se muestra el enlace para copiarlo
    // a mano, que es justo lo que hace falta en una red de la biblioteca.
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          botonEnlace.innerHTML = '<i class="fa-solid fa-check"></i>¡Copiado!';
          enlace.hidden = false;
          window.setTimeout(() => {
            botonEnlace.innerHTML = '<i class="fa-solid fa-link"></i>Copiar enlace';
            enlace.hidden = true;
          }, 2200);
        })
        .catch(() => {
          enlace.hidden = false;
        });
    } else {
      enlace.hidden = false;
    }
  });

  // Cierra el desplegable al pulsar Esc: si no, se queda abierto encima
  // de la escena y molesta al jugar (Esc ya lo usa el menú de ajustes).
  const alPulsarEscape = (evento: KeyboardEvent) => {
    if (evento.key === "Escape") caja.classList.remove("cv-abierto");
  };
  document.addEventListener("keydown", alPulsarEscape);

  function reflejar(participantes: Participante[], miId: string | null): void {
    // Cuántos HAY en la sala. Se cuenta a los demás + yo: el servidor
    // incluye el propio socket en la lista, así que el tamaño es el real.
    contador.textContent = String(participantes.length);
    cabecera.title = `${participantes.length} persona${participantes.length === 1 ? "" : "s"} en ${codigoClase}`;

    lista.replaceChildren();

    if (participantes.length === 0) {
      const vacio = document.createElement("li");
      vacio.className = "cv-presencia-fila";
      vacio.style.color = "#94A3B8";
      vacio.textContent = "Todavía no hay nadie más";
      lista.appendChild(vacio);
      return;
    }

    // Primero el docente, luego admin, y los demás por nombre: es el
    // orden en el que se lee un aula de verdad.
    const prioridad: Record<Rol, number> = { docente: 0, admin: 1, invitado: 2, estudiante: 3 };
    const ordenados = [...participantes].sort(
      (a, b) => prioridad[a.rol] - prioridad[b.rol] || a.nombre.localeCompare(b.nombre, "es"),
    );

    for (const participante of ordenados) {
      const fila = document.createElement("li");
      fila.className = "cv-presencia-fila";

      const color = COLOR_POR_ROL[participante.rol] ?? COLOR_POR_ROL.invitado;

      const punto = document.createElement("span");
      punto.className = "cv-presencia-punto";
      punto.style.background = color;

      const nombre = document.createElement("span");
      nombre.className = "cv-presencia-nombre";
      // Lo que está haciendo ahora mismo, para reconocerlo de un vistazo.
      const acciones: string[] = [];
      if (participante.estado?.manoAlzada) acciones.push("✋");
      if (participante.estado?.sentado) acciones.push("sentado");
      if (participante.estado?.enAtril) acciones.push("en el atril");
      if (participante.estado?.caminando) acciones.push("camina");
      nombre.textContent = acciones.length ? `${participante.nombre} · ${acciones.join(" · ")}` : participante.nombre;
      nombre.title = participante.correo;

      const insignia = document.createElement("span");
      insignia.className = "cv-presencia-rol";
      insignia.textContent = ETIQUETA_ROL[participante.rol] ?? "Invitado";
      insignia.style.color = color;
      insignia.style.borderColor = color;

      fila.appendChild(punto);
      fila.appendChild(nombre);
      fila.appendChild(insignia);

      if (participante.id === miId) {
        const yo = document.createElement("span");
        yo.className = "cv-presencia-yo";
        yo.textContent = "tú";
        fila.appendChild(yo);
      }

      lista.appendChild(fila);
    }
  }

  function reflejarConexion(estadoConexion: EstadoConexion, detalle?: string): void {
    const textos: Record<EstadoConexion, string> = {
      conectando: "Conectando con la clase…",
      conectado: "",
      cerrado: "Sin conexión con el servidor",
      error: detalle ?? "Error de conexión",
    };

    const texto = textos[estadoConexion];
    estado.textContent = texto;
    estado.classList.toggle("cv-visible", texto !== "");
    estado.classList.toggle("cv-error", estadoConexion === "error" || estadoConexion === "cerrado");
  }

  function avisar(mensaje: string): void {
    estado.textContent = mensaje;
    estado.classList.add("cv-visible", "cv-error");
  }

  function destruir(): void {
    document.removeEventListener("keydown", alPulsarEscape);
    contenedor.remove();
  }

  return { reflejar, reflejarConexion, avisar, destruir };
}

/** Escapa texto que va dentro de innerHTML (el nombre viene de la base de datos). */
function escapar(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
