// ============================================================
// PALETA
// Layout profesional tipo sidebar + cards: superficies
// blancas, filetes de 1px, fondo gris muy claro.
// El dorado #EDB732 se reserva como acento puntual
// (indicador de sección activa y botón principal).
// Sin degradados ni colores fuertes.
// ============================================================

/* Los colores del dashboard ya no se escriben aquí: el tema
   (claro/oscuro) se define con las variables --c-* que monta
   src/state/preferencias.ts. Así el login, el dashboard y los
   menús comparten la misma paleta. */

// Tipografía monoespaciada para códigos y datos técnicos
export const FUENTE_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

export const LOGO_URL =
  "https://campusvirtual.santototunja.edu.co/assets/Copia-de-FInal-Logo-campusprueba2-2-1-scaled-CAabIrYv.png";


// ============================================================
// ESTILOS
// Todo el CSS vive aquí. Los archivos .ts solo usan clases.
// ============================================================

export const ESTILOS_COMUNES = `
  /* ---------------------------------------------------------
     BASE
     --------------------------------------------------------- */

  .dash-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    background: var(--c-fondo);
    color: var(--c-texto);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .dash-overlay * {
    box-sizing: border-box;
  }

  .dash-overlay [hidden] {
    display: none !important;
  }

  .dash-overlay :is(button, a):focus-visible {
    outline: 2px solid var(--c-acento);
    outline-offset: 2px;
  }

  .dash-overlay :is(input, select):focus-visible {
    outline: none;
  }

  .dash-overlay ::selection {
    background: var(--c-accento-suave);
    color: var(--c-texto);
  }

  .dash-contenido {
    padding: 34px 36px 56px;
    max-width: 1160px;
    margin: 0 auto;
  }

  /* ---------------------------------------------------------
     SIDEBAR
     --------------------------------------------------------- */

  .dash-sidebar {
    flex: 0 0 248px;
    width: 248px;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 20px 14px 16px;
    background: var(--c-superficie);
    border-right: 1px solid var(--c-borde);
    overflow-y: auto;
  }

  .dash-marca {
    display: flex;
    align-items: center;
    padding: 2px 8px 18px;
    border-bottom: 1px solid var(--c-borde-suave);
    margin-bottom: 18px;
  }

  .dash-marca-logo {
    height: 30px;
    width: auto;
    display: block;
  }

  .dash-nav-etiqueta {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--c-texto-tenue);
    padding: 0 10px;
    margin: 0 0 8px 0;
  }

  .dash-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dash-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 9px 10px 9px 13px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--c-texto-suave);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .dash-nav-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 18px;
    border-radius: 0 3px 3px 0;
    background: var(--c-acento);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .dash-nav-item:hover {
    background: var(--c-superficie-suave);
    color: var(--c-texto);
  }

  .dash-nav-item.activo {
    background: var(--c-superficie-suave);
    color: var(--c-texto);
    font-weight: 600;
  }

  .dash-nav-item.activo::before {
    opacity: 1;
  }

  .dash-nav-icono {
    width: 16px;
    font-size: 13px;
    text-align: center;
    opacity: 0.75;
  }

  .dash-nav-item.activo .dash-nav-icono {
    color: var(--c-acento-hover);
    opacity: 1;
  }

  /* Cuenta y salir al pie del sidebar */

  .dash-sidebar-pie {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--c-borde-suave);
  }

  .dash-cuenta {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    margin-bottom: 6px;
  }

  .dash-cuenta-miniatura {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--c-borde);
    flex: 0 0 32px;
  }

  .dash-cuenta-bloque {
    min-width: 0;
    flex: 1;
  }

  .dash-cuenta-nombre {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-texto);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dash-cuenta-rol {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--c-texto-tenue);
    margin: 3px 0 0 0;
  }

  .dash-salir {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 13px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--c-texto-suave);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease,
      border-color 0.15s ease;
  }

  .dash-salir:hover {
    background: var(--c-superficie-suave);
    border-color: var(--c-borde);
    color: var(--c-error);
  }

  /* ---------------------------------------------------------
     ZONA PRINCIPAL
     --------------------------------------------------------- */

  .dash-principal {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
  }

  /* ---------------------------------------------------------
     CABECERA DE VISTA
     --------------------------------------------------------- */

  .dash-cabecera {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }

  .dash-cabecera-etiqueta {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: var(--c-texto-suave);
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 6px;
    padding: 3px 9px;
    margin: 0 0 11px 0;
  }

  .dash-cabecera-titulo {
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -0.4px;
    color: var(--c-texto);
    margin: 0;
  }

  .dash-cabecera-subtitulo {
    font-size: 13.5px;
    color: var(--c-texto-suave);
    margin: 6px 0 0 0;
  }

  .dash-cabecera-acciones {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .dash-avatar-mini {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--c-borde);
  }

  .dash-cabecera-acciones .dash-boton-principal {
    width: auto;
    margin: 0;
    padding: 11px 18px;
    font-size: 13.5px;
  }

  /* ---------------------------------------------------------
     CARDS
     --------------------------------------------------------- */

  .dash-grid {
    display: grid;
    gap: 16px;
  }

  .dash-grid-stats {
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    margin-bottom: 24px;
  }

  .dash-grid-stats > .dash-stat:only-child {
    max-width: 340px;
  }

  .dash-grid-tarjetas {
    gap: 24px;
  }

  .dash-card {
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 14px;
    padding: 22px 24px;
    box-shadow: 0 1px 2px color-mix(in srgb, var(--c-sombra) 4%, transparent);
    transition: box-shadow 0.15s ease;
  }

  .dash-card:hover {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--c-sombra) 7%, transparent);
  }

  .dash-card-encabezado {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding-bottom: 14px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--c-borde-suave);
  }

  .dash-card-titulo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--c-texto-suave);
    margin: 0;
  }

  .dash-card-titulo::before {
    content: "";
    width: 3px;
    height: 12px;
    border-radius: 2px;
    background: var(--c-acento);
  }

  .dash-card-herramientas {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .dash-stat {
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 10px;
    padding: 17px 18px;
  }

  .dash-stat-cabecera {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .dash-stat-icono {
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--c-borde);
    border-radius: 9px;
    background: var(--c-superficie-suave);
    color: var(--c-texto-suave);
    font-size: 13px;
  }

  .dash-stat-numero {
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.6px;
    color: var(--c-texto);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .dash-stat-etiqueta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--c-texto-tenue);
    margin-top: 9px;
  }

  /* ---------------------------------------------------------
     BOTÓN PRINCIPAL (dorado sólido: acento puntual)
     --------------------------------------------------------- */

  .dash-boton-principal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px 16px;
    border: 1px solid var(--c-acento);
    border-radius: 8px;
    background: var(--c-acento);
    color: var(--c-texto-boton);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--c-acento) 35%, transparent);
    transition: background 0.15s ease, border-color 0.15s ease,
      transform 0.15s ease, box-shadow 0.15s ease;
  }

  .dash-boton-principal:hover:not(:disabled) {
    background: var(--c-acento-hover);
    border-color: var(--c-acento-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--c-acento) 38%, transparent);
  }

  .dash-boton-principal:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 6px color-mix(in srgb, var(--c-acento) 30%, transparent);
  }

  .dash-boton-principal:disabled {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }

  .dash-boton-entrar {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border: 1px solid var(--c-borde);
    border-radius: 7px;
    background: var(--c-superficie);
    color: var(--c-texto);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex: 0 0 auto;
    transition: background 0.15s ease, border-color 0.15s ease,
      color 0.15s ease;
  }

  .dash-boton-entrar:hover {
    background: var(--c-superficie-suave);
    border-color: var(--c-acento);
    color: var(--c-accento-tinto);
  }

  /* ---------------------------------------------------------
     LISTA (filas dentro de una card)
     --------------------------------------------------------- */

  .dash-lista {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 8px;
    background: var(--c-borde-suave);
    border-radius: 8px;
    overflow: hidden;
  }

  .dash-tarjeta-clase {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 14px;
    background: var(--c-superficie);
    transition: background 0.15s ease;
  }

  .dash-tarjeta-clase:hover {
    background: var(--c-superficie-suave);
  }

  .dash-lista .dash-vacio {
    margin-top: 0;
    border: none;
    border-radius: 0;
  }

  .dash-clase-datos {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .dash-clase-icono {
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--c-accento-borde);
    border-radius: 9px;
    background: var(--c-accento-suave);
    color: var(--c-accento-tinto);
    font-size: 14px;
  }

  .dash-clase-texto {
    min-width: 0;
  }

  .dash-clase-nombre {
    color: var(--c-texto);
    font-weight: 600;
    font-size: 14.5px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dash-clase-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    color: var(--c-texto-tenue);
    font-size: 12px;
    margin: 5px 0 0 0;
  }

  .dash-dato {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .dash-dato i {
    font-size: 10.5px;
    color: var(--c-texto-tenue);
  }

  /* Códigos y datos técnicos en tipografía monoespaciada */
  .dash-codigo {
    font-family: ${FUENTE_MONO};
    font-size: 12px;
    letter-spacing: 0.3px;
  }

  /* ---------------------------------------------------------
     BUSCADOR Y FILTROS
     --------------------------------------------------------- */

  .dash-barra {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .dash-buscador {
    position: relative;
    flex: 1 1 190px;
    min-width: 150px;
    display: flex;
  }

  .dash-buscador-input {
    width: 100%;
    padding: 8px 12px 8px 32px;
    border: 1px solid var(--c-borde);
    border-radius: 8px;
    background-color: var(--c-superficie);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2398a0b0' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M20.5 20.5 16.7 16.7'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: 10px center;
    background-size: 14px 14px;
    color: var(--c-texto);
    font-family: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .dash-buscador-input::placeholder {
    color: var(--c-texto-tenue);
  }

  .dash-buscador-input:focus {
    background-color: var(--c-superficie-suave);
    border-color: var(--c-borde);
    box-shadow: none;
  }

  .dash-buscador-input::-webkit-search-cancel-button {
    cursor: pointer;
  }

  .dash-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .dash-chip {
    padding: 6px 12px;
    border: 1px solid var(--c-borde);
    border-radius: 7px;
    background: var(--c-superficie);
    color: var(--c-texto-suave);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease,
      color 0.15s ease;
  }

  .dash-chip:hover {
    border-color: var(--c-texto-tenue);
    color: var(--c-texto);
  }

  .dash-chip.activo {
    background: var(--c-accento-suave);
    border-color: var(--c-acento);
    color: var(--c-accento-tinto);
  }

  .dash-conteo {
    color: var(--c-texto-tenue);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ---------------------------------------------------------
     TABLAS
     --------------------------------------------------------- */

  .dash-tabla-envoltura {
    overflow-x: auto;
    margin-top: 4px;
  }

  .dash-tabla {
    width: 100%;
    border-collapse: collapse;
  }

  .dash-tabla th {
    text-align: left;
    color: var(--c-texto-tenue);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    padding: 9px 8px;
    border-bottom: 1px solid var(--c-borde);
    white-space: nowrap;
  }

  .dash-tabla td {
    color: var(--c-texto);
    font-size: 13px;
    padding: 12px 8px;
    border-bottom: 1px solid var(--c-borde-suave);
  }

  .dash-tabla tbody tr {
    transition: background 0.15s ease;
  }

  .dash-tabla tbody tr:hover {
    background: var(--c-superficie-suave);
  }

  .dash-tabla tr:last-child td {
    border-bottom: none;
  }

  .dash-tabla th.centro,
  .dash-tabla td.centro {
    text-align: center;
  }

  .dash-tabla td.tenue {
    color: var(--c-texto-tenue);
  }

  /* ---------------------------------------------------------
     FILAS DE USUARIO
     --------------------------------------------------------- */

  .dash-lista-cabecera {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 176px;
    gap: 16px;
    align-items: center;
    padding: 9px 14px;
    background: var(--c-superficie-suave);
    color: var(--c-texto-tenue);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .dash-lista-cabecera span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .dash-lista-cabecera span:last-child {
    justify-content: flex-end;
  }

  .dash-lista-cabecera i {
    font-size: 10px;
    color: var(--c-texto-tenue);
  }

  .dash-fila-usuario {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 176px;
    gap: 16px;
    align-items: center;
    padding: 11px 14px;
    background: var(--c-superficie);
    transition: background 0.15s ease;
  }

  .dash-fila-usuario:hover {
    background: var(--c-superficie-suave);
  }

  .dash-usuario-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .dash-usuario-avatar {
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--c-borde);
    border-radius: 50%;
    background: var(--c-superficie-suave);
    color: var(--c-texto-suave);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
  }

  .dash-usuario-bloque {
    min-width: 0;
  }

  .dash-usuario-rol {
    display: flex;
    justify-content: flex-end;
    min-width: 0;
  }

  .dash-usuario-nombre {
    color: var(--c-texto);
    font-weight: 600;
    font-size: 14px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dash-usuario-correo {
    color: var(--c-texto-tenue);
    font-size: 12px;
    margin: 3px 0 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dash-badge-rol {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border: 1px solid var(--c-borde);
    border-radius: 6px;
    background: var(--c-superficie-suave);
    color: var(--c-texto-suave);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }

  .dash-badge-rol i {
    font-size: 10px;
  }

  /* ---------------------------------------------------------
     COLOR POR ROL (avatar y distintivo)
     --------------------------------------------------------- */

  .dash-usuario-avatar.rol-admin,
  .dash-badge-rol.rol-admin {
    background: var(--c-accento-suave);
    border-color: var(--c-accento-borde);
    color: var(--c-accento-tinto);
  }

  .dash-usuario-avatar.rol-docente,
  .dash-badge-rol.rol-docente {
    background: var(--c-rol-docente-fondo);
    border-color: var(--c-rol-docente-borde);
    color: var(--c-rol-docente-texto);
  }

  .dash-usuario-avatar.rol-estudiante,
  .dash-badge-rol.rol-estudiante {
    background: var(--c-rol-alumno-fondo);
    border-color: var(--c-rol-alumno-borde);
    color: var(--c-rol-alumno-texto);
  }

  .dash-select-rol {
    width: 100%;
    background: var(--c-superficie);
    color: var(--c-texto);
    border: 1px solid var(--c-borde);
    border-left-width: 3px;
    border-left-color: var(--c-borde);
    border-radius: 7px;
    padding: 6px 8px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .dash-select-rol[data-rol="docente"] {
    border-left-color: var(--c-rol-docente-texto);
  }

  .dash-select-rol[data-rol="estudiante"],
  .dash-select-rol[data-rol="invitado"] {
    border-left-color: var(--c-rol-alumno-texto);
  }

  .dash-select-rol:focus {
    background: var(--c-superficie-suave);
    border-color: var(--c-borde);
    box-shadow: none;
  }

  .dash-select-rol:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .dash-error-panel {
    color: var(--c-error);
    font-size: 13px;
    margin: 0 0 12px 0;
  }

  /* ---------------------------------------------------------
     MODALES
     --------------------------------------------------------- */

  .dash-modal-fondo {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: color-mix(in srgb, var(--c-texto) 32%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .dash-modal {
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 14px;
    padding: 28px;
    width: 340px;
    max-width: 100%;
    text-align: center;
    box-shadow: 0 24px 60px color-mix(in srgb, var(--c-sombra) 22%, transparent);
  }

  .dash-modal h3 {
    color: var(--c-texto);
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .dash-modal p {
    color: var(--c-texto-suave);
    font-size: 13px;
    margin: 0 0 16px 0;
  }

  .dash-codigo-grande {
    color: var(--c-texto);
    font-family: ${FUENTE_MONO};
    font-size: 25px;
    font-weight: 700;
    letter-spacing: 3px;
    margin: 4px 0 20px 0;
    padding: 14px 10px;
    border: 1px dashed var(--c-borde);
    border-radius: 10px;
    background: var(--c-superficie-suave);
  }

  .dash-input-codigo {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid var(--c-borde);
    border-radius: 8px;
    background: var(--c-superficie);
    color: var(--c-texto);
    font-family: ${FUENTE_MONO};
    font-size: 14px;
    text-align: center;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .dash-input-codigo::placeholder {
    color: var(--c-texto-tenue);
    letter-spacing: normal;
    text-transform: none;
  }

  .dash-input-codigo:focus {
    border-color: var(--c-acento);
    box-shadow: 0 0 0 3px var(--c-accento-suave);
  }

  .dash-input-texto {
    letter-spacing: normal;
    text-transform: none;
    font-family: inherit;
  }

  .dash-error {
    color: var(--c-error);
    font-size: 12px;
    min-height: 16px;
    margin: 0 0 8px 0;
  }

  /* ---------------------------------------------------------
     PERFIL
     --------------------------------------------------------- */

  .dash-perfil-fila {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 0;
    border-top: 1px solid var(--c-borde-suave);
  }

  .dash-perfil-fila:first-of-type {
    border-top: none;
    padding-top: 0;
  }

.dash-perfil-etiqueta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-texto-tenue);
    font-size: 13px;
  }

  .dash-perfil-valor {
    color: var(--c-texto);
    font-size: 13px;
    text-align: right;
    word-break: break-word;
  }

  /* ---------------------------------------------------------
     PERFIL — edición de la cuenta
     --------------------------------------------------------- */

  .dash-grid-perfil {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .dash-perfil-seguridad {
    grid-column: 1 / -1;
  }

  .dash-perfil-avatar-marco {
    position: relative;
    width: 132px;
    height: 132px;
    margin: 6px auto 18px;
  }

  .dash-perfil-avatar {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    background: var(--c-superficie-suave);
    border: 1px solid var(--c-borde);
    box-shadow:
      0 0 0 5px var(--c-superficie),
      0 0 0 6px var(--c-borde-suave);
  }

  .dash-perfil-camara {
    position: absolute;
    right: 2px;
    bottom: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 2px solid var(--c-superficie);
    border-radius: 50%;
    background: var(--c-acento);
    color: var(--c-texto-boton);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .dash-perfil-camara:hover {
    background: var(--c-acento-hover);
    transform: scale(1.06);
  }

  .dash-perfil-botones {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .dash-perfil-pista {
    margin: 14px 0 0;
    text-align: center;
    color: var(--c-texto-tenue);
    font-size: 12px;
  }

  .dash-perfil-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dash-perfil-campo {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .dash-perfil-campo-etiqueta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--c-texto-suave);
  }

  .dash-perfil-campo-etiqueta i {
    font-size: 11px;
    color: var(--c-texto-tenue);
  }

  .dash-perfil-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--c-borde);
    border-radius: 8px;
    background: var(--c-superficie);
    color: var(--c-texto);
    font-family: inherit;
    font-size: 13.5px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .dash-perfil-input::placeholder {
    color: var(--c-texto-tenue);
  }

  .dash-perfil-input:focus {
    border-color: var(--c-acento);
    box-shadow: 0 0 0 3px var(--c-accento-suave);
  }

  .dash-perfil-input[readonly] {
    background: var(--c-superficie-suave);
    color: var(--c-texto-suave);
    cursor: default;
  }

  .dash-perfil-form-dos {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .dash-perfil-campo-ojo {
    position: relative;
  }

  .dash-perfil-campo-ojo .dash-perfil-input {
    padding-right: 38px;
  }

  .dash-perfil-ojo {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--c-texto-tenue);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .dash-perfil-ojo:hover {
    color: var(--c-texto-suave);
    background: var(--c-superficie-suave);
  }

  .dash-perfil-mensaje {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 9px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 12.5px;
  }

  .dash-perfil-mensaje.ok {
    background: var(--c-rol-alumno-fondo);
    border-color: var(--c-rol-alumno-borde);
    color: var(--c-rol-alumno-texto);
  }

  .dash-perfil-mensaje.error {
    background: color-mix(in srgb, var(--c-error) 8%, transparent);
    border-color: color-mix(in srgb, var(--c-error) 25%, transparent);
    color: var(--c-error);
  }

  .dash-perfil-mensaje i {
    font-size: 13px;
  }

  .dash-boton-secundario,
  .dash-boton-fantasma {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .dash-boton-secundario {
    border: 1px solid var(--c-borde);
    background: var(--c-superficie);
    color: var(--c-texto);
  }

  .dash-perfil-botones .dash-boton-secundario {
    flex: 1;
  }

  .dash-boton-secundario:hover:not(:disabled) {
    background: var(--c-superficie-suave);
    border-color: var(--c-texto-tenue);
  }

  .dash-boton-fantasma {
    border: 1px solid transparent;
    background: transparent;
    color: var(--c-texto-suave);
  }

  .dash-boton-fantasma:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c-error) 8%, transparent);
    border-color: color-mix(in srgb, var(--c-error) 25%, transparent);
    color: var(--c-error);
  }

  .dash-boton-secundario:disabled,
  .dash-boton-fantasma:disabled {
    opacity: 0.55;
    cursor: default;
  }

  /* ---------------------------------------------------------
     AJUSTES (preferencias)
     --------------------------------------------------------- */

  .dash-grid-ajustes {
    grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
    gap: 20px;
    align-items: start;
  }

  .dash-ajuste {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dash-ajuste .dash-card-encabezado {
    margin-bottom: 0;
    padding-bottom: 13px;
  }

  .dash-ajuste-fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    flex-wrap: wrap;
  }

  .dash-ajuste-texto {
    flex: 1 1 210px;
    min-width: 0;
  }

  .dash-ajuste-titulo {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--c-texto);
  }

  .dash-ajuste-pista {
    margin: 4px 0 0 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--c-texto-tenue);
  }

  .dash-ajuste-nota {
    margin: 0;
    padding-top: 13px;
    border-top: 1px dashed var(--c-borde-suave);
    font-size: 12px;
    line-height: 1.5;
    color: var(--c-texto-tenue);
  }

  /* Control segmentado: tema e idioma */
  .dash-segmentado {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    background: var(--c-superficie-suave);
    border: 1px solid var(--c-borde);
    border-radius: 10px;
    flex: 0 0 auto;
  }

  .dash-segmentado-opcion {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--c-texto-suave);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .dash-segmentado-opcion:hover {
    color: var(--c-texto);
  }

  .dash-segmentado-opcion[aria-pressed="true"] {
    background: var(--c-superficie);
    border-color: var(--c-borde);
    color: var(--c-texto);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--c-sombra) 6%, transparent);
  }

  .dash-segmentado-opcion[aria-pressed="true"] i {
    color: var(--c-acento);
  }

  /* Interruptor: reducir animaciones */
  .dash-interruptor {
    flex: 0 0 auto;
    width: 46px;
    height: 26px;
    padding: 3px;
    border: 1px solid var(--c-borde);
    border-radius: 999px;
    background: var(--c-superficie-suave);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .dash-interruptor-punto {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--c-texto-tenue);
    transition:
      transform 0.18s ease,
      background 0.18s ease;
  }

  .dash-interruptor[aria-checked="true"] {
    background: var(--c-acento-suave);
    border-color: var(--c-acento-borde);
  }

  .dash-interruptor[aria-checked="true"] .dash-interruptor-punto {
    background: var(--c-acento);
    transform: translateX(20px);
  }

  .dash-segmentado-opcion:focus-visible,
  .dash-interruptor:focus-visible {
    outline: 2px solid var(--c-acento);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    .dash-ajuste-fila {
      align-items: flex-start;
      flex-direction: column;
    }

    .dash-segmentado {
      width: 100%;
    }

    .dash-segmentado-opcion {
      flex: 1;
      justify-content: center;
    }
  }

  /* ---------------------------------------------------------
     ESTADOS DE CARGA / VACÍO
     --------------------------------------------------------- */

  .dash-cargando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--c-texto-tenue);
    font-size: 13px;
    padding: 80px 24px;
  }

  .dash-cargando::before {
    content: "";
    width: 17px;
    height: 17px;
    border-radius: 50%;
    border: 2px solid var(--c-borde);
    border-top-color: var(--c-acento);
    animation: dash-giro 0.7s linear infinite;
  }

  @keyframes dash-giro {
    to {
      transform: rotate(360deg);
    }
  }

  .dash-vacio {
    color: var(--c-texto-tenue);
    font-size: 13px;
    text-align: center;
    padding: 26px 18px;
    border: 1px dashed var(--c-borde);
    border-radius: 8px;
    background: var(--c-superficie-suave);
    margin-top: 8px;
  }

  /* ---------------------------------------------------------
     RESPONSIVE
     --------------------------------------------------------- */

  @media (max-width: 980px) {
    .dash-overlay {
      display: block;
      overflow-y: auto;
    }

    .dash-sidebar {
      position: sticky;
      top: 0;
      z-index: 30;
      width: 100%;
      height: auto;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-right: none;
      border-bottom: 1px solid var(--c-borde);
      overflow-x: auto;
    }

    .dash-marca {
      border-bottom: none;
      padding: 0;
      margin: 0;
      flex: 0 0 auto;
    }

    .dash-marca-logo {
      height: 26px;
    }

    .dash-nav-etiqueta {
      display: none;
    }

    .dash-nav {
      flex-direction: row;
      gap: 4px;
      flex: 1;
    }

    .dash-nav-item {
      width: auto;
      white-space: nowrap;
      padding: 8px 12px;
    }

    .dash-nav-item::before {
      top: auto;
      bottom: 0;
      left: 10px;
      right: 10px;
      width: auto;
      height: 2px;
      transform: none;
      border-radius: 2px;
    }


    .dash-sidebar-pie {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dash-cuenta {
      display: none;
    }

    .dash-salir {
      width: auto;
      padding: 8px 12px;
    }

    .dash-principal {
      height: auto;
      overflow: visible;
    }

    .dash-contenido {
      padding: 22px 16px 48px;
    }

    .dash-card {
      padding: 17px 16px;
    }

    .dash-cabecera-titulo {
      font-size: 20px;
    }

    .dash-lista-cabecera {
      display: none;
    }

    .dash-fila-usuario {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    .dash-usuario-rol {
      justify-content: flex-start;
    }

    .dash-select-rol {
      width: auto;
      min-width: 150px;
    }
  }
`;

export function inyectarEstilosDashboard(): void {
  const existente = document.getElementById("estilos-dashboard");

  if (existente) {
    return;
  }

  const style = document.createElement("style");

  style.id = "estilos-dashboard";
  style.textContent = ESTILOS_COMUNES;

  document.head.appendChild(style);
}