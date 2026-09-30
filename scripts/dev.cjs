// ======================================================
// npm run dev
// ------------------------------------------------------
// Levanta las DOS partes del proyecto a la vez, cada una
// en su carpeta y con su color en la consola:
//
//   [front] → frontend  (Vite)   http://localhost:5173
//   [back ] → backend   (Express) http://localhost:3000
//
// Ctrl+C detiene las dos.
// ======================================================

const { spawn } = require("child_process");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");

const PROCESOS = [
  { nombre: "front", comando: "npm --prefix frontend run dev", color: "\x1b[36m" },
  { nombre: "back", comando: "npm --prefix backend run dev", color: "\x1b[35m" },
];

const RESET = "\x1b[0m";
const hijos = [];

for (const { nombre, comando, color } of PROCESOS) {
  const hijo = spawn(comando, {
    cwd: RAIZ,
    shell: true,
    env: process.env,
  });

  const pintar = (flujo) => {
    let buffer = "";
    flujo.on("data", (dato) => {
      buffer += dato.toString();
      const lineas = buffer.split(/\r?\n/);
      buffer = lineas.pop() ?? "";
      for (const linea of lineas) {
        if (linea.trim() !== "") console.log(`${color}[${nombre}]${RESET} ${linea}`);
      }
    });
  };

  pintar(hijo.stdout);
  pintar(hijo.stderr);

  hijo.on("exit", (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      console.log(`${color}[${nombre}]${RESET} terminó con código ${codigo}`);
    }
  });

  hijos.push({ nombre, proceso: hijo });
}

function terminar() {
  for (const { nombre, proceso } of hijos) {
    if (proceso.exitCode !== null || proceso.killed) continue;
    if (process.platform === "win32") {
      // En Windows hay que matar el árbol completo (npm → vite/tsx)
      spawn(`taskkill /pid ${proceso.pid} /T /F`, { shell: true, stdio: "ignore" });
    } else {
      proceso.kill("SIGTERM");
    }
    console.log(`Deteniendo [${nombre}]...`);
  }
}

process.on("SIGINT", () => {
  terminar();
  process.exit(0);
});

process.on("SIGTERM", () => {
  terminar();
  process.exit(0);
});
