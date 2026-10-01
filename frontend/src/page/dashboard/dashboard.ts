import type { Cuenta, Clase } from "../../state/estado";
import { elegirSkin } from "../../ui/elegirSkin";
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

  // ---------------------------------------------------------------------
  // INTERCEPTOR ÚNICO: cada botón "Entrar" (clases del rol y panel de
  // usuarios) pasa por aquí. Primero se elige la skin del rol en la
  // mini-ventana y, al cerrarla, se continúa con la entrada a la clase.
  // Así todos los dashboards comparten el mismo punto de interceptación.
  // ---------------------------------------------------------------------
  const entrarConSkin = (clase: Clase): void => {
    void elegirSkin(cuenta.rol).then(() => alEntrarAClase(clase));
  };

  function mostrarClasesSegunRol(): void {
    const opcionesClases = {
      cuenta,
      contenido: comun.contenido,
      overlay: comun.overlay,
      alEntrarAClase: entrarConSkin,
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
      alEntrarAClase: entrarConSkin,
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