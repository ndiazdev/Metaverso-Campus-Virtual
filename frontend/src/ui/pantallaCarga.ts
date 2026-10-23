// PANTALLA DE CARGA DEL SALÓN
//
// Cubre el canvas mientras se monta la clase para que el usuario no vea el aula
// "construyéndose" (el render loop arranca antes de importar el .glb). Se pinta
// al entrar al salón por debajo de la ventana de skins (z-index 6000) y se
// reinicia cuando la skin ya está elegida, para que la transición dure entre 5 y
// 7 segundos aunque el mapa haya cargado antes.
//
// Se autoinyecta (estilo + DOM) igual que el resto del UI, así que el mapa solo
// la importa y llama a su API sin tocar index.html.

const DURACION_MIN_MS = 4600;
// Failsafe: si la carga se atasca, el usuario nunca se queda atrapado.
const TOPE_ESPERA_MS = 20000;

const ESTILO = `
.pc-capa{position:fixed;inset:0;z-index:5900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:sans-serif;color:#e2e8f0;pointer-events:auto;transition:opacity .4s ease;
  background:linear-gradient(180deg,rgba(8,20,44,.88),rgba(4,10,26,.96)),url(`${import.meta.env.BASE_URL}images/fondo_carga.jpeg`) center/cover no-repeat #04070f}
.pc-capa.pc-fuera{opacity:0;pointer-events:none}
.pc-titulo{margin:0;font-size:clamp(28px,4.4vw,46px);font-weight:800;letter-spacing:.34em;text-indent:.34em;color:#F2A93B;text-shadow:0 0 22px rgba(242,169,59,.45)}
.pc-barra{position:relative;width:min(66vw,640px);height:18px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.08);border:1px solid rgba(242,169,59,.4);box-shadow:inset 0 0 24px rgba(0,0,0,.5)}
.pc-relleno{position:absolute;inset:0 auto 0 0;width:0%;border-radius:999px;background:linear-gradient(90deg,#F2A93B,#F7C568);box-shadow:0 0 18px rgba(242,169,59,.55)}
.pc-porcentaje{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.06em;color:#0b1220}
.pc-subtitulo{margin:0;font-size:13px;letter-spacing:.08em;color:#9aa8c7}
`;

let capa: HTMLElement | null = null;
let relleno: HTMLElement | null = null;
let porcentaje: HTMLElement | null = null;
let inicio = 0;
let cargado = false;
let ocultando = false;
let cuadro = 0;
let tope = 0;

function inyectarEstilo(): void {
  if (document.getElementById("pc-estilo")) return;
  const estilo = document.createElement("style");
  estilo.id = "pc-estilo";
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);
}

// easeOutCubic: arranca rápido y frena al final, como las barras de carga.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function pintarProgreso(): void {
  if (!capa || ocultando) return;
  const transcurrido = performance.now() - inicio;
  // La barra llega al 96 % en DURACION_MIN_MS y solo pasa al 100 % cuando el
  // salón ya está montado: así nunca se revela un mapa a medias.
  const avance = easeOutCubic(Math.min(1, transcurrido / DURACION_MIN_MS)) * 100;
  const pct = Math.min(100, Math.round(cargado ? avance : Math.min(avance, 96)));
  if (relleno) relleno.style.width = `${pct}%`;
  if (porcentaje) porcentaje.textContent = `${pct}%`;

  if (pct >= 100) {
    intentarOcultar();
    return;
  }
  cuadro = requestAnimationFrame(pintarProgreso);
}

function intentarOcultar(): void {
  if (!capa || ocultando || !cargado) return;
  if (performance.now() - inicio < DURACION_MIN_MS) {
    // El mapa ya está listo pero la transición no ha cumplido su tiempo:
    // se deja la barra seguir hasta el 100 % antes de retirar la capa.
    if (!cuadro) cuadro = requestAnimationFrame(pintarProgreso);
    return;
  }
  ocultando = true;
  window.clearTimeout(tope);
  cancelAnimationFrame(cuadro);
  cuadro = 0;

  const capaActual = capa;
  capaActual.classList.add("pc-fuera");
  window.setTimeout(() => {
    capaActual.remove();
    if (capa === capaActual) {
      capa = null;
      relleno = null;
      porcentaje = null;
    }
  }, 420);
}

/**
 * Muestra la pantalla de carga (idempotente) y arranca la barra. Si ya existe
 * no la recrea: solo se usa `reiniciarPantallaCarga` para volver a contar el
 * tiempo cuando se cierra la ventana de skins.
 */
export function mostrarPantallaCarga(): void {
  if (capa) return;
  inyectarEstilo();

  cargado = false;
  ocultando = false;

  capa = document.createElement("div");
  capa.className = "pc-capa";
  capa.setAttribute("role", "status");
  capa.setAttribute("aria-live", "polite");
  capa.innerHTML = `
    <h1 class="pc-titulo">LOADING</h1>
    <div class="pc-barra">
      <div class="pc-relleno"></div>
      <span class="pc-porcentaje">0%</span>
    </div>
    <p class="pc-subtitulo">Cargando el salón…</p>
  `;
  document.body.appendChild(capa);

  relleno = capa.querySelector(".pc-relleno");
  porcentaje = capa.querySelector(".pc-porcentaje");

  inicio = performance.now();
  cancelAnimationFrame(cuadro);
  cuadro = requestAnimationFrame(pintarProgreso);

  window.clearTimeout(tope);
  tope = window.setTimeout(() => {
    cargado = true;
    intentarOcultar();
  }, TOPE_ESPERA_MS);
}

/**
 * Vuelve a empezar la cuenta de los 5,5 s sin recrear la capa. Se llama al
 * cerrarse la ventana de skins: desde ahí es cuando el usuario debe ver la
 * pantalla de carga.
 */
export function reiniciarPantallaCarga(): void {
  if (!capa || ocultando) return;
  inicio = performance.now();
  if (!cuadro) cuadro = requestAnimationFrame(pintarProgreso);
}

/** Marca que el salón ya está montado: la barra puede llegar al 100 % y salir. */
export function marcarSalonCargado(): void {
  cargado = true;
  if (!cuadro) cuadro = requestAnimationFrame(pintarProgreso);
  intentarOcultar();
}

/** Fuerza la retirada (ante un error de carga). Idempotente. */
export function ocultarPantallaCarga(): void {
  cargado = true;
  ocultando = true;
  window.clearTimeout(tope);
  cancelAnimationFrame(cuadro);
  cuadro = 0;
  if (!capa) return;
  const capaActual = capa;
  capaActual.classList.add("pc-fuera");
  window.setTimeout(() => {
    capaActual.remove();
    if (capa === capaActual) {
      capa = null;
      relleno = null;
      porcentaje = null;
    }
  }, 420);
}
