export const TRAMOS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  'AZ', 'BZ', 'CZ', 'DZ',
];

export const CAIDAS = Array.from({ length: 29 }, (_, i) => i + 1);

export const PROTOCOLOS = [
  { id: 'PICE1',       codigo: 'PICE-01', nombre: 'Excavación',           subtipo: null },
  { id: 'PICE2_RADIER', codigo: 'PICE-02', nombre: 'Hormigones Radier',   subtipo: 'radier' },
  { id: 'PICE2_MURO',  codigo: 'PICE-02', nombre: 'Hormigones Muro',      subtipo: 'muro' },
  { id: 'PICE3',       codigo: 'PICE-03', nombre: 'Moldajes',              subtipo: null },
  { id: 'PICE4_RADIER', codigo: 'PICE-04', nombre: 'Enfierradura Radier', subtipo: 'radier' },
  { id: 'PICE4_MURO',  codigo: 'PICE-04', nombre: 'Enfierradura Muro',    subtipo: 'muro' },
  { id: 'G5',          codigo: 'G5',      nombre: 'Emplantillado',         subtipo: null },
  { id: 'HA_RADIER',  codigo: 'H.A.',    nombre: 'Control H.A. Radier',   subtipo: 'radier' },
  { id: 'HA_MURO',    codigo: 'H.A.',    nombre: 'Control H.A. Muro',     subtipo: 'muro' },
];

export const CHECKLISTS = {
  PICE1: [
    { id: 'pr_verificados',        label: 'PR verificados' },
    { id: 'replanteo_conforme',    label: 'Replanteo conforme a planos' },
    { id: 'cotas_excavacion',      label: 'Cotas de excavación' },
    { id: 'espesor_capas_relleno', label: 'Espesor de capas de relleno conforme' },
    { id: 'ancho_excavacion',      label: 'Ancho excavación' },
    { id: 'registro_fotografico',  label: 'Registro fotográfico' },
    { id: 'compactacion',          label: 'Compactación' },
    { id: 'aprobacion_hormigonado', label: 'Aprobación para hormigonado' },
  ],
  PICE2_RADIER: [
    { id: 'tratamiento_junta',     label: 'Tratamientos de junta' },
    { id: 'limpieza_seccion',      label: 'Limpieza de la sección a hormigonar' },
    { id: 'herramientas_adecuadas', label: 'Herramientas adecuadas' },
    { id: 'cono_conforme',         label: 'Cono conforme' },
    { id: 'vibrado_adecuado',      label: 'Vibrado adecuado' },
    { id: 'platachado_afinado',    label: 'Platachado / Afinado' },
    { id: 'curado',                label: 'Curado' },
  ],
  PICE2_MURO: [
    { id: 'tratamiento_junta',     label: 'Tratamientos de junta' },
    { id: 'limpieza_seccion',      label: 'Limpieza de la sección a hormigonar' },
    { id: 'herramientas_adecuadas', label: 'Herramientas adecuadas' },
    { id: 'cono_conforme',         label: 'Cono conforme' },
    { id: 'vibrado_adecuado',      label: 'Vibrado adecuado' },
    { id: 'platachado_afinado',    label: 'Platachado / Afinado' },
    { id: 'curado',                label: 'Curado' },
  ],
  PICE3: [
    { id: 'desmoldante',           label: 'Desmoldante' },
    { id: 'fijacion_moldajes',     label: 'Fijación moldajes' },
    { id: 'fijacion_puntales',     label: 'Fijación puntales' },
    { id: 'herramientas_adecuadas', label: 'Herramientas adecuadas' },
    { id: 'estanquidad',           label: 'Estanquidad' },
    { id: 'limpieza',              label: 'Limpieza' },
    { id: 'junta_dilatacion',      label: 'Junta de dilatación' },
    { id: 'junta_contraccion',     label: 'Junta de contracción' },
    { id: 'water_stop',            label: 'Wáter stop' },
    { id: 'aprobacion_hormigonado', label: 'Aprobación para hormigonado' },
  ],
  PICE4_RADIER: [
    { id: 'diametros_conforme',    label: 'Diámetros conforme' },
    { id: 'separacion_conforme',   label: 'Separación conforme' },
    { id: 'recubrimiento_conforme', label: 'Recubrimiento conforme' },
    { id: 'armadura_fija',         label: 'Armadura fija' },
    { id: 'traslapes',             label: 'Traslapes' },
    { id: 'limpieza',              label: 'Limpieza' },
    { id: 'aprobacion',            label: 'Aprobación' },
  ],
  PICE4_MURO: [
    { id: 'diametros_conforme',    label: 'Diámetros conforme' },
    { id: 'separacion_conforme',   label: 'Separación conforme' },
    { id: 'recubrimiento_conforme', label: 'Recubrimiento conforme' },
    { id: 'armadura_fija',         label: 'Armadura fija' },
    { id: 'traslapes',             label: 'Traslapes' },
    { id: 'limpieza',              label: 'Limpieza' },
    { id: 'aprobacion',            label: 'Aprobación' },
  ],
  G5: [],
};

export const USUARIOS = [
  'Álvaro Muñoz',
  'Diego Oñate',
  'Otro',
];
