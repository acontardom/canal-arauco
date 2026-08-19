export const TRAMOS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N1', 'N2', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y1', 'Y2', 'Z',
  'AZ', 'BZ', 'CZ', 'DZ', 'TEST',
  '2.1', '2.2', '2.3',
];

export const CAIDAS = [...Array.from({ length: 29 }, (_, i) => i + 1), 'CE', 'CS'];

export const ATRAVIESOS = ['1', '2', '3'];

export const PROTOCOLOS = [
  { id: 'PICE1',       codigo: 'PICE-01', nombre: 'Excavación',           subtipo: null },
  { id: 'PICE2_RADIER', codigo: 'PICE-02', nombre: 'Hormigones Radier',   subtipo: 'radier' },
  { id: 'PICE2_MURO',  codigo: 'PICE-02', nombre: 'Hormigones Muro',      subtipo: 'muro' },
  { id: 'PICE3',       codigo: 'PICE-03', nombre: 'Moldajes',              subtipo: null },
  { id: 'PICE4_RADIER', codigo: 'PICE-04', nombre: 'Enfierradura',      subtipo: 'radier', soloTramo: true },
  { id: 'PICE4_MURO',  codigo: 'PICE-04', nombre: 'Enfierradura Muro', subtipo: 'muro',   soloCaida: true },
  { id: 'G5',          codigo: 'G-05',    nombre: 'Emplantillado',         subtipo: null, soloFotos: true },
  { id: 'HA_RADIER',  codigo: 'H.A.',    nombre: 'Control H.A. Radier',   subtipo: 'radier' },
  { id: 'HA_MURO',    codigo: 'H.A.',    nombre: 'Control H.A. Muro',     subtipo: 'muro' },
  { id: 'COTAS',      codigo: 'PICE-COTAS', nombre: 'Cotas Topográficas', subtipo: null, soloFotos: false },
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
    { id: 'refuerzo_enfierradura', label: 'Refuerzo de enfierradura' },
  ],
  PICE4_MURO: [
    { id: 'diametros_conforme',    label: 'Diámetros conforme' },
    { id: 'separacion_conforme',   label: 'Separación conforme' },
    { id: 'recubrimiento_conforme', label: 'Recubrimiento conforme' },
    { id: 'armadura_fija',         label: 'Armadura fija' },
    { id: 'traslapes',             label: 'Traslapes' },
    { id: 'limpieza',              label: 'Limpieza' },
    { id: 'aprobacion',            label: 'Aprobación' },
    { id: 'refuerzo_enfierradura', label: 'Refuerzo de enfierradura' },
  ],
  G5: [],
};

export const PARTIDAS = [
  { id: 'excavacion',     nombre: 'Excavación',       orden: 1 },
  { id: 'emplantillado',  nombre: 'Emplantillado',     orden: 2 },
  { id: 'enfierradura',   nombre: 'Enfierradura',      orden: 3 },
  { id: 'hormigon_radier',nombre: 'Hormigón Radier',   orden: 4 },
  { id: 'moldaje',        nombre: 'Moldaje',           orden: 5 },
  { id: 'hormigon_muro',  nombre: 'Hormigón Muro',     orden: 6 },
];

export const USUARIOS = [
  'Álvaro Muñoz',
  'Diego Oñate',
  'Marcelo Contardo',
  'Francisco Contardo',
  'Arturo Contardo',
  'Otro',
];

export const CHECKLIST_DEFAULTS = {
  PICE1: {
    items: [
      { id: 'replanteo_conforme', textos: [
        'Verificación de cotas de excavación perfil a perfil, realizada en conjunto con el topógrafo de obra',
        'Se continúa trabajando con PR Aux como referencia para control topográfico y verificación de la excavación',
      ]},
      { id: 'cotas_excavacion', textos: [
        'Verificación topográfica de cota de fondo (cota [X] y sello de excavación cota [X])',
        'Verificación topográfica perfil a perfil. (informe topográfico N°[X])',
      ]},
      { id: 'espesor_capas_relleno', textos: [
        'Compactación ejecutada para asegurar condiciones óptimas previas al emplantillado',
        'Espesor de capas de relleno controlado conforme a especificaciones técnicas',
      ]},
      { id: 'ancho_excavacion', textos: [
        'Ancho de excavación de canal proyectada de 2,26 mt, más excavación de seguridad variable según profundidad',
        'Ancho de excavación ejecutado conforme a medidas de seguridad, considerando sección de canal proyectada',
      ]},
      { id: 'aprobacion_hormigonado', textos: [
        'Se considera un ancho de [X] m para el emplantillado, con un espesor de 0,10 m',
        'Sección aprobada para hormigonado de emplantillado',
      ]},
    ],
    fotos_sugeridas: [
      'Vista general de la excavación',
      'Perfil transversal de la sección',
      'Fondo de excavación limpio',
      'Medición de ancho de excavación',
      'Compactación terminada',
    ],
  },
  PICE2_RADIER: {
    items: [
      { id: 'tratamiento_junta', textos: [
        'Se realiza tratamiento de junta de construcción en la sección entrada y salida, se incorpora promotor de adherencia',
        'Junta de construcción tratada con promotor de adherencia en toda la sección',
      ]},
      { id: 'limpieza_seccion', textos: [
        'Se realiza la limpieza del lugar previo al hormigonado de la sección de radier de la caída vertical',
        'Sección limpia y libre de residuos previo al hormigonado',
      ]},
      { id: 'herramientas_adecuadas', textos: [
        'Uso de sonda vibradora eléctrica para hormigón, en correcto estado operativo',
        'Equipos y herramientas de hormigonado en correcto estado operativo',
      ]},
      { id: 'cono_conforme', textos: [
        'Toma de asentamiento de cono como control de calidad, con el fin de verificar la trabajabilidad y consistencia del hormigón previo a su colocación. Se registra resultado de cono de [X] cm, correspondiente a la guía N°[X], para hormigón G20(10)40/08',
        'Control de docilidad conforme. Resultado de cono [X] cm, guía N°[X]',
      ]},
      { id: 'vibrado_adecuado', textos: [
        'Vibrado de hormigón en radier mediante sonda autónoma, asegurando correcta compactación y eliminación de vacíos',
        'Vibrado mecánico ejecutado correctamente en toda la sección del radier',
      ]},
      { id: 'platachado_afinado', textos: [
        'Se utilizan guías de apoyo a cota de nivel de piso terminado para el esparcimiento y nivelación del hormigón. Afinado de superficie mediante platacho tipo bullfloat',
        'Afinado de superficie ejecutado con bullfloat a nivel de cota de piso terminado',
      ]},
      { id: 'curado', textos: [
        'Sika Cure-11 como membrana de curado y recubrimiento superficial con nylon para protección y conservación de humedad',
        'Curado con membrana Sika Cure-11 y nylon de protección aplicados correctamente',
      ]},
    ],
    fotos_sugeridas: [
      'Limpieza previa de la sección',
      'Toma de cono (foto del resultado)',
      'Hormigonado en progreso con vibrado',
      'Superficie afinada terminada',
      'Membrana de curado aplicada',
    ],
  },
  PICE2_MURO: {
    items: [
      { id: 'tratamiento_junta', textos: [
        'Se realiza tratamiento de junta de construcción en la sección entrada y salida, se incorpora promotor de adherencia',
        'Junta de construcción tratada con promotor de adherencia en toda la sección',
      ]},
      { id: 'limpieza_seccion', textos: [
        'Se realiza la limpieza del lugar previo al hormigonado de muros',
        'Sección limpia y libre de residuos previo al hormigonado de muros',
      ]},
      { id: 'herramientas_adecuadas', textos: [
        'Uso de sonda vibradora para hormigón, en correcto estado operativo',
        'Equipos y herramientas de hormigonado en correcto estado operativo',
      ]},
      { id: 'cono_conforme', textos: [
        'Toma de asentamiento de cono como control de calidad, con el fin de verificar la trabajabilidad y consistencia del hormigón previo a su colocación. Se registra resultado de cono de [X] cm, correspondiente a la guía N°[X], para hormigón G20(10)40/08',
        'Control de docilidad conforme. Resultado de cono [X] cm, guía N°[X]',
      ]},
      { id: 'vibrado_adecuado', textos: [
        'El hormigonado de muros se realiza mediante la colocación del material en capas sucesivas, incorporando vibrado mecánico para asegurar la adecuada compactación y eliminar vacíos en el interior del elemento',
        'Vibrado mecánico en capas sucesivas asegurando compactación y eliminación de vacíos en el muro',
      ]},
      { id: 'platachado_afinado', textos: [
        'Ejecución de afinado en la coronación del muro',
        'Coronación del muro afinada correctamente',
      ]},
      { id: 'curado', textos: [
        'Sika Cure-11 como membrana de curado y recubrimiento superficial con nylon para protección y conservación de humedad',
        'Curado con membrana Sika Cure-11 y nylon de protección aplicados correctamente',
      ]},
    ],
    fotos_sugeridas: [
      'Limpieza previa de la sección',
      'Toma de cono (foto del resultado)',
      'Hormigonado de muros en progreso',
      'Vibrado en capas sucesivas',
      'Coronación del muro afinada',
      'Membrana de curado aplicada',
    ],
  },
  PICE3: {
    items: [
      { id: 'desmoldante', textos: [
        'Aplicación de desmoldante en moldajes previo al hormigonado',
        'Desmoldante aplicado en toda la superficie de contacto del moldaje',
      ]},
      { id: 'fijacion_moldajes', textos: [
        'Moldajes instalados y fijados correctamente conforme a planos',
        'Sistema de moldaje fijado y verificado previo al hormigonado',
      ]},
      { id: 'fijacion_puntales', textos: [
        'Se utilizan puntales de madera anclados a piso',
        'Puntales de madera instalados y anclados correctamente a piso',
      ]},
      { id: 'herramientas_adecuadas', textos: [
        'Herramientas y equipos de montaje en correcto estado operativo',
        'Equipos necesarios para instalación de moldajes en correcto estado',
      ]},
      { id: 'estanquidad', textos: [
        'Verificación de estanqueidad del sistema de moldaje previo al hormigonado',
        'Sellado de juntas y verificación de estanqueidad conforme',
      ]},
      { id: 'limpieza', textos: [
        'Limpieza interior de moldajes previo al hormigonado',
        'Moldajes limpios y libres de residuos antes del hormigonado',
      ]},
      { id: 'junta_dilatacion', textos: [
        'Se instala Aislapol de alta densidad, de espesor 10 mm. Se incorporan placas de fibrocemento en ambas caras del Aislapol, adheridas mediante adhesivo de montaje, asegurando su correcta fijación y estabilidad al momento del hormigonado',
        'Junta de dilatación instalada con Aislapol 10mm y placas de fibrocemento adheridas con adhesivo de montaje',
      ]},
      { id: 'junta_contraccion', textos: [
        'Junta de contracción instalada conforme a especificaciones técnicas',
        'Disposición de juntas de contracción según planos de proyecto',
      ]},
      { id: 'water_stop', textos: [
        'Instalación de wáter stop en juntas según especificaciones técnicas',
        'Wáter stop instalado y fijado correctamente en juntas de construcción',
      ]},
      { id: 'aprobacion_hormigonado', textos: [
        'Moldajes inspeccionados y aprobados para inicio de hormigonado',
        'Sistema de moldaje verificado y aprobado previo al hormigonado',
      ]},
    ],
    fotos_sugeridas: [
      'Vista general de moldajes instalados',
      'Detalle de puntales y fijación',
      'Detalle de junta de dilatación (Aislapol + fibrocemento)',
      'Verificación de aplome y nivel',
      'Vista interior del canal con moldajes listos',
    ],
  },
  PICE4_RADIER: {
    items: [
      { id: 'diametros_conforme', textos: [
        'Diámetro conforme a planimetría, Plano N°16 EDICIÓN D',
        'Diámetro de la malla conforme a planimetría, Plano N°3 y 4 EDICIÓN D',
      ]},
      { id: 'separacion_conforme', textos: [
        'Separadores dispuestos en toda la sección del radier',
        'Separadores dispuestos cada [0,70] mt uno del otro aprox.',
      ]},
      { id: 'recubrimiento_conforme', textos: [
        'Recubrimiento conforme a malla posicionada en el centro del espesor de radier de [0,17] mt',
        'Recubrimiento verificado conforme a especificaciones técnicas',
      ]},
      { id: 'armadura_fija', textos: [
        'Amarradura con alambre recocido negro N°18',
        'Se realiza la amarra de la malla mediante alambre recocido negro N°18, incorporando doseles para la fijación y correcta alineación de la armadura',
      ]},
      { id: 'traslapes', textos: [
        'Traslapes acorde a especificaciones técnicas, 40 veces el diámetro (barra de acero de 8mm y 10mm)',
        'Traslapes de 2 recuadros para la malla ACMA C139 conforme a especificaciones',
      ]},
      { id: 'limpieza', textos: [
        'Área despejada y limpia previo al hormigonado',
        'Sección libre de residuos y materiales ajenos a la armadura',
      ]},
      { id: 'aprobacion', textos: [
        'Armadura inspeccionada y aprobada para inicio de hormigonado',
        'Enfierradura verificada y aprobada conforme a planos',
      ]},
    ],
    fotos_sugeridas: [
      'Vista general de la malla instalada en radier',
      'Detalle de separadores',
      'Medición de recubrimiento',
      'Detalle de traslapes',
      'Vista general área limpia lista para hormigonar',
    ],
  },
  PICE4_MURO: {
    items: [
      { id: 'diametros_conforme', textos: [
        'Diámetro conforme a planimetría, Plano N°16 EDICIÓN D',
        'Diámetro de la malla de muro conforme a planimetría, Plano N°3 y 4 EDICIÓN D',
      ]},
      { id: 'separacion_conforme', textos: [
        'Separadores dispuestos en toda la sección del muro',
        'Separadores dispuestos cada [0,70] mt uno del otro aprox.',
      ]},
      { id: 'recubrimiento_conforme', textos: [
        'Recubrimiento conforme a malla posicionada en el centro del espesor de muro de [0,13] mt',
        'Recubrimiento verificado conforme a especificaciones técnicas de muro',
      ]},
      { id: 'armadura_fija', textos: [
        'Amarradura con alambre recocido negro N°18',
        'Se realiza la amarra de la malla mediante alambre recocido negro N°18, incorporando doseles para la fijación y correcta alineación de la armadura de muro',
      ]},
      { id: 'traslapes', textos: [
        'Traslapes acorde a especificaciones técnicas, 40 veces el diámetro (barra de acero de 8mm y 10mm)',
        'Traslapes de 2 recuadros para la malla ACMA C139 conforme a especificaciones',
      ]},
      { id: 'limpieza', textos: [
        'Área despejada y limpia previo al hormigonado de muros',
        'Sección libre de residuos y materiales ajenos a la armadura de muro',
      ]},
      { id: 'aprobacion', textos: [
        'Armadura de muro inspeccionada y aprobada para inicio de hormigonado',
        'Enfierradura de muro verificada y aprobada conforme a planos',
      ]},
    ],
    fotos_sugeridas: [
      'Vista general de la armadura de muro instalada',
      'Detalle de separadores en muro',
      'Medición de recubrimiento en muro',
      'Detalle de traslapes en muro',
      'Vista general área limpia lista para hormigonar',
    ],
  },
};

export const KM_DATA = {
  tramo: {
    'A':  { inicio: '10,3',     fin: '237,7' },
    'B':  { inicio: '249,7',    fin: '337,7' },
    'C':  { inicio: '349,7',    fin: '457,7' },
    'D':  { inicio: '469,7',    fin: '587,7' },
    'E':  { inicio: '599,7',    fin: '777,7' },
    'F':  { inicio: '789,7',    fin: '827,7' },
    'G':  { inicio: '839,7',    fin: '1.037,7' },
    'H':  { inicio: '1.049,7',  fin: '1.107,7' },
    'I':  { inicio: '1.119,7',  fin: '1.297,7' },
    'J':  { inicio: '1.309,7',  fin: '1.407,7' },
    'K':  { inicio: '1.419,7',  fin: '1.517,7' },
    'L':  { inicio: '1.529,7',  fin: '1.607,7' },
    'M':  { inicio: '1.619,7',  fin: '1.737,7' },
    'N1': { inicio: '1.749,7',  fin: '1.763,0' },
    'N2': { inicio: '1.769,0',  fin: '1.937,7' },
    'O':  { inicio: '1.949,7',  fin: '2.057,7' },
    'P':  { inicio: '2.069,7',  fin: '2.157,7' },
    'Q':  { inicio: '2.169,7',  fin: '2.277,7' },
    'R':  { inicio: '2.289,7',  fin: '2.377,7' },
    'S':  { inicio: '2.389,7',  fin: '2.427,7' },
    'T':  { inicio: '2.439,7',  fin: '2.517,7' },
    'U':  { inicio: '2.529,7',  fin: '2.627,7' },
    'V':  { inicio: '2.639,7',  fin: '2.717,7' },
    'W':  { inicio: '2.729,7',  fin: '2.807,7' },
    'X':  { inicio: '2.819,7',  fin: '2.937,7' },
    'Y1': { inicio: '2.949,7',  fin: '3.002,7' },
    'Y2': { inicio: '3.008,7',  fin: '3.037,7' },
    'Z':  { inicio: '3.049,7',  fin: '3.267,7' },
    'AZ': { inicio: '3.279,7',  fin: '3.417,7' },
    'BZ': { inicio: '3.429,7',  fin: '3.537,7' },
    'CZ': { inicio: '3.549,7',  fin: '3.597,7' },
    'DZ':   { inicio: '3.609,7',  fin: '3.934,2' },
    'TEST': { inicio: '0,0',      fin: '0,0' },
  },
  caida: {
    '1':  { inicio: '237,7',    fin: '249,7' },
    '2':  { inicio: '337,7',    fin: '349,7' },
    '3':  { inicio: '457,7',    fin: '469,7' },
    '4':  { inicio: '587,7',    fin: '599,7' },
    '5':  { inicio: '777,7',    fin: '789,7' },
    '6':  { inicio: '827,7',    fin: '839,7' },
    '7':  { inicio: '1.037,7',  fin: '1.049,7' },
    '8':  { inicio: '1.107,7',  fin: '1.119,7' },
    '9':  { inicio: '1.297,7',  fin: '1.309,7' },
    '10': { inicio: '1.407,7',  fin: '1.419,7' },
    '11': { inicio: '1.517,7',  fin: '1.529,7' },
    '12': { inicio: '1.607,7',  fin: '1.619,7' },
    '13': { inicio: '1.737,7',  fin: '1.749,7' },
    '14': { inicio: '1.937,7',  fin: '1.949,7' },
    '15': { inicio: '2.057,7',  fin: '2.069,7' },
    '16': { inicio: '2.157,7',  fin: '2.169,7' },
    '17': { inicio: '2.277,7',  fin: '2.289,7' },
    '18': { inicio: '2.377,7',  fin: '2.389,7' },
    '19': { inicio: '2.427,7',  fin: '2.439,7' },
    '20': { inicio: '2.517,7',  fin: '2.529,7' },
    '21': { inicio: '2.627,7',  fin: '2.639,7' },
    '22': { inicio: '2.717,7',  fin: '2.729,7' },
    '23': { inicio: '2.807,7',  fin: '2.819,7' },
    '24': { inicio: '2.937,7',  fin: '2.949,7' },
    '25': { inicio: '3.037,7',  fin: '3.049,7' },
    '26': { inicio: '3.267,7',  fin: '3.279,7' },
    '27': { inicio: '3.417,7',  fin: '3.429,7' },
    '28': { inicio: '3.537,7',  fin: '3.549,7' },
    '29': { inicio: '3.597,7',  fin: '3.609,7' },
  },
  atravieso: {
    '1': { inicio: '1.763,0', fin: '1.769,0' },
    '2': { inicio: '3.002,7', fin: '3.008,7' },
    '3': { inicio: '0,0',     fin: '0,0' },
  },
};

// ─── Etapa 2 ───────────────────────────────────────────────
// Entidades de la segunda etapa del proyecto, en orden físico del canal.
// Las cámaras usan tipo 'caida' porque comparten los mismos protocolos.
export const ETAPA_2 = [
  { tipo: 'caida',     id: 'CE'  },
  { tipo: 'tramo',     id: '2.1' },
  { tipo: 'atravieso', id: '3'   },
  { tipo: 'tramo',     id: '2.2' },
  { tipo: 'tramo',     id: '2.3' },
  { tipo: 'caida',     id: 'CS'  },
];

export function esEtapa2(tipo, id) {
  return ETAPA_2.some(e => e.tipo === tipo && String(e.id) === String(id));
}

// Nombres visibles que sobreescriben el label por defecto
export const ETIQUETAS_ENTIDAD = {
  'caida-CE': 'Cámara de Entrada',
  'caida-CS': 'Cámara de Salida',
};

export function nombreEntidad(tipo, id) {
  const custom = ETIQUETAS_ENTIDAD[`${tipo}-${id}`];
  if (custom) return custom;
  if (tipo === 'tramo')     return `Tramo ${id}`;
  if (tipo === 'caida')     return `Caída ${id}`;
  if (tipo === 'atravieso') return `Atravieso ${id}`;
  return String(id);
}

// Convierte entidad_id a número solo cuando es numérico.
// Para caídas 1-29 devuelve el mismo número que Number().
// Para IDs de texto como 'CE' o 'CS' devuelve el string sin alterar.
export function normalizarEntidadId(tipo, id) {
  if (tipo !== 'caida') return id;
  const n = Number(id);
  return Number.isNaN(n) ? String(id) : n;
}

export function esVisible(tipo, id) {
  return !(tipo === 'tramo' && String(id) === 'TEST');
}
