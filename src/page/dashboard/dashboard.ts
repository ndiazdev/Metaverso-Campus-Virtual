import type { Cuenta, Clase } from "../../state/estado";
import {
  crearDashboardComun,
  type DashboardComun,
} from "./dashboardComun";
import { mostrarDashboardDocente } from "./dashboardDocente";
import { mostrarDashboardEstudiante } from "./dashboardEstudiante";
import {
  mostrarDashboardAdmin,
  mostrarUsuariosAdmin,
} from "./dashboardAdmin";

export function mostrarDashboard(
  cuenta: Cuenta & { id?: number },
  alEntrarAClase: (clase: Clase) => void,
): void {
  let comun: DashboardComun;

  function mostrarClasesSegunRol(): void {
    const opcionesClases = {
      cuenta,
      contenido: comun.contenido,
      overlay: comun.overlay,
      alEntrarAClase,
    };

    if (cuenta.rol === "admin") {
      mostrarDashboardAdmin(opcionesClases);
    } else if (cuenta.rol === "docente") {
      mostrarDashboardDocente(opcionesClases);
    } else {
      mostrarDashboardEstudiante(opcionesClases);
    }
  }

  function mostrarUsuarios(): void {
    if (cuenta.rol !== "admin") {
      return;
    }

    mostrarUsuariosAdmin({
      cuenta,
      contenido: comun.contenido,
      overlay: comun.overlay,
      alEntrarAClase,
    });
  }

  comun = crearDashboardComun({
    cuenta,
    alMostrarClases: mostrarClasesSegunRol,
    alMostrarUsuarios: cuenta.rol === "admin" ? mostrarUsuarios : undefined,
    pestanaInicial: cuenta.rol === "admin" ? "usuarios" : "clases",
  });

  if (cuenta.rol === "admin") {
    mostrarUsuarios();
  } else {
    mostrarClasesSegunRol();
  }
}