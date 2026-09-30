
export interface OpcionesMenuAjustes {
  volumenInicial?: number;
  alCambiarVolumen: (volumen: number) => void;
  alSalirDeLaClase: () => void;
}
 
const ATAJOS_TECLADO = [
  { accion: "Moverse", tecla: "W A S D" },
  { accion: "Mirar alrededor", tecla: "Mouse" },
  { accion: "Sentarse / levantarse", tecla: "E" },
  { accion: "Ir al atril / salir del atril", tecla: "R" },
  { accion: "Cambiar cámara (1ra / 3ra persona)", tecla: "B" },
  { accion: "Alzar la mano", tecla: "H" },
  { accion: "Publicar en el tablero (en el atril)", tecla: "P" },
  { accion: "Cambiar diapositiva", tecla: "← / →" },
  { accion: "Pausar / reanudar video", tecla: "Espacio" },
  { accion: "Borrar el tablero", tecla: "Supr / Backspace" },
];
 
export function crearMenuAjustes(opciones: OpcionesMenuAjustes): { abrir: () => void; cerrar: () => void } {
  const botonAjustes = document.createElement("button");
  botonAjustes.innerText = "⚙️";
  botonAjustes.title = "Ajustes";
  botonAjustes.style.position = "absolute";
  botonAjustes.style.top = "16px";
  botonAjustes.style.left = "16px";
  botonAjustes.style.width = "44px";
  botonAjustes.style.height = "44px";
  botonAjustes.style.fontSize = "20px";
  botonAjustes.style.borderRadius = "50%";
  botonAjustes.style.border = "1px solid rgba(255,255,255,0.25)";
  botonAjustes.style.background = "rgba(15,23,42,0.85)";
  botonAjustes.style.color = "white";
  botonAjustes.style.cursor = "pointer";
  botonAjustes.style.zIndex = "1500";
  document.body.appendChild(botonAjustes);
 
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "2500";
  overlay.style.fontFamily = "sans-serif";
 
  overlay.innerHTML = `
    <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:14px; padding:28px; width:380px; color:white; max-height:85vh; overflow-y:auto;">
      <h2 style="margin:0 0 16px 0; text-align:center;">Ajustes</h2>
 
      <label style="font-size:13px; color:#9aa8c7;">🔊 Volumen</label>
      <input id="sliderVolumen" type="range" min="0" max="1" step="0.05" style="width:100%; margin:6px 0 20px 0;" />
 
      <p style="font-size:13px; color:#9aa8c7; margin-bottom:8px;">Controles</p>
      <div style="margin-bottom:20px;">
        ${ATAJOS_TECLADO.map(
          (a) => `
          <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13px;">
            <span>${a.accion}</span>
            <span style="color:#F2A93B; font-weight:bold;">${a.tecla}</span>
          </div>
        `
        ).join("")}
      </div>
 
      <button id="btnReanudar" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;">Reanudar</button>
      <button id="btnSalirClase" style="width:100%; padding:10px; border:none; border-radius:8px; background:#EF4444; color:white; font-weight:bold; cursor:pointer;">Salir de la clase</button>
    </div>
  `;
  document.body.appendChild(overlay);
 
  const sliderVolumen = overlay.querySelector<HTMLInputElement>("#sliderVolumen")!;
  sliderVolumen.value = String(opciones.volumenInicial ?? 1);
  sliderVolumen.addEventListener("input", () => {
    opciones.alCambiarVolumen(parseFloat(sliderVolumen.value));
  });
 
  function abrir() {
    overlay.style.display = "flex";
  }
  function cerrar() {
    overlay.style.display = "none";
  }
 
  overlay.querySelector("#btnReanudar")!.addEventListener("click", cerrar);
 
  overlay.querySelector("#btnSalirClase")!.addEventListener("click", () => {
    cerrar();
    botonAjustes.remove();
    overlay.remove();
    opciones.alSalirDeLaClase();
  });
 
  botonAjustes.addEventListener("click", () => {
    if (overlay.style.display === "none") abrir();
    else cerrar();
  });
 
  return { abrir, cerrar };
}