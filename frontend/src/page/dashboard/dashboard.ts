import type { Cuenta, Clase } from "../../state/estado";
import { elegirSkin } from "../../ui/elegirSkin";
import { escribirPantallaEnLaUrl } from "../../state/enlaceClase";
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
  // La dirección identifica la pantalla: con sesión abierta el panel
  // vive en /dashboard (si se llega con /login, se corrige sin
  // recargar; la consigna de la barra es decir dónde se está).
  escribirPantallaEnLaUrl("/dashboard");

  let comun: DashboardComun;

  // ---------------------------------------------------------------------
  // INTERCEPTOR ÚNICO: cada botón "Entrar" (clases del rol y panel de
  // usuarios) pasa por aquí. La mini-ventana de skin y el salón arrancan
  // A LA VEZ: el usuario ve el aula detrás del modal (antes salía todo en
  // blanco) y el modelo 3D se carga al cerrar la ventana, con la skin que
  // se eligió. Así todos los dashboards comparten el mismo punto.
  // ---------------------------------------------------------------------
  const entrarConSkin = (clase: Clase): void => {
    void elegirSkin(cuenta.rol);
    alEntrarAClase(clase);
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