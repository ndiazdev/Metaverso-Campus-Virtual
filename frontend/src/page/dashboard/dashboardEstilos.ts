export const COLOR_PRIMARIO = "#062a5c";
export const COLOR_PRIMARIO_CLARO = "#0d3f82";
export const COLOR_ACENTO = "#F2A93B";

export const LOGO_URL =
  "https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png";

export const IMAGEN_FONDO =
  "https://gestion.santototunja.edu.co/wp-content/uploads/2021/06/Santoto_Tunja_Produccion_fotografica_21.jpeg";

export const ESTILOS_COMUNES = `
  .dash-overlay {
    position: fixed; inset: 0; z-index: 1000; font-family: sans-serif;
    background: linear-gradient(rgba(10,25,60,0.82), rgba(10,25,60,0.82)),
      url('${IMAGEN_FONDO}') center/cover;
    overflow-y: auto;
  }

  
  .dash-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 32px; background: #ffffff;
    box-shadow: 0 2px 10px rgba(0,0,0,0.15);
  }
  .dash-marca { display: flex; align-items: center; gap: 10px; color: ${COLOR_PRIMARIO}; font-weight: bold; font-size: 17px; }
  .dash-marca-logo { height: 38px; width: auto; }
  .dash-tabs { display: flex; gap: 4px; background: rgba(6,42,92,0.06); padding: 4px; border-radius: 10px; }
  .dash-tab { padding: 8px 18px; border-radius: 8px; color: ${COLOR_PRIMARIO}; font-size: 13px; font-weight: 600; cursor: pointer; opacity: 0.6; }
  .dash-tab.activo { background: ${COLOR_PRIMARIO}; color: white; opacity: 1; }
  .dash-salir { color: ${COLOR_PRIMARIO}; font-size: 13px; cursor: pointer; font-weight: 600; }

  .dash-cuerpo { display: flex; gap: 48px; padding: 48px; max-width: 1100px; margin: 0 auto; flex-wrap: wrap; }
  .dash-columna-izq { flex: 0 0 260px; text-align: center; }
  .dash-etiqueta-rol {
    display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: bold;
    letter-spacing: 0.5px; margin-bottom: 10px; background: rgba(242,169,59,0.2); color: ${COLOR_ACENTO};
  }
  .dash-nombre-usuario { color: white; font-size: 24px; font-weight: bold; margin: 0 0 24px 0; }
  .dash-avatar-img { width: 140px; height: 140px; border-radius: 50%; object-fit: cover; object-position: center; margin: 0 auto 24px auto; border: 3px solid ${COLOR_ACENTO}; display: block; }
  .dash-boton-principal {
    width: 100%; padding: 15px; border: none; border-radius: 10px; background: ${COLOR_ACENTO};
    color: #1a1a1a; font-weight: bold; font-size: 15px; cursor: pointer; margin-bottom: 10px;
  }
  .dash-contador { color: #b8c4dd; font-size: 12px; }
  .dash-columna-der { flex: 1; min-width: 320px; }
  .dash-seccion-titulo { color: #b8c4dd; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 14px; }
  .dash-tarjeta-clase {
    background: rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px;
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;
  }
  .dash-clase-nombre { color: white; font-weight: bold; font-size: 15px; margin: 0 0 4px 0; }
  .dash-clase-meta { color: #9aa8c7; font-size: 12px; }
  .dash-boton-entrar {
    padding: 8px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25);
    background: transparent; color: white; font-size: 12px; cursor: pointer;
  }
  .dash-stats { display: flex; gap: 14px; margin-top: 24px; }
  .dash-stat { flex: 1; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 18px; text-align: center; }
  .dash-stat-numero { color: ${COLOR_ACENTO}; font-size: 24px; font-weight: bold; }
  .dash-stat-etiqueta { color: #9aa8c7; font-size: 12px; margin-top: 4px; }
  .dash-modal-fondo { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1100; }
  .dash-modal { background: #14233f; border-radius: 14px; padding: 28px; width: 320px; text-align: center; }
  .dash-modal h3 { color: white; margin: 0 0 8px 0; }
  .dash-modal p { color: #b8c4dd; font-size: 13px; margin-bottom: 16px; }
  .dash-codigo-grande { color: ${COLOR_ACENTO}; font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 12px 0 20px 0; }
  .dash-input-codigo {
    width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08); color: white; font-size: 16px; text-align: center; letter-spacing: 2px;
    text-transform: uppercase; box-sizing: border-box; margin-bottom: 12px;
  }
  .dash-error { color: #ff8080; font-size: 12px; min-height: 16px; margin-bottom: 8px; }

  .dash-tabla-usuarios { width: 100%; border-collapse: collapse; }
  .dash-tabla-usuarios th {
    text-align: left; color: #9aa8c7; font-size: 11px; text-transform: uppercase;
    padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .dash-tabla-usuarios td {
    color: white; font-size: 13px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .dash-badge-rol {
    display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;
    background: rgba(242,169,59,0.15); color: ${COLOR_ACENTO};
  }
  .dash-select-rol {
    background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px; padding: 5px 8px; font-size: 12px;
  }
  .dash-boton-guardar-rol {
    padding: 5px 12px; border-radius: 6px; border: none; background: ${COLOR_ACENTO};
    color: #1a1a1a; font-size: 11px; font-weight: bold; cursor: pointer; margin-left: 6px;
  }


  .dash-perfil-contenedor { max-width: 480px; margin: 40px auto; text-align: center; }
  .dash-perfil-tarjeta { background: rgba(255,255,255,0.06); border-radius: 14px; padding: 28px; text-align: left; }
  .dash-cargando { color: white; text-align: center; margin-top: 80px; }
  .dash-sin-clases { color: #9aa8c7; font-size: 13px; }
`;

export function inyectarEstilosDashboard() {
  if (document.getElementById("estilos-dashboard")) return;
  const style = document.createElement("style");
  style.id = "estilos-dashboard";
  style.textContent = ESTILOS_COMUNES;
  document.head.appendChild(style);
}
