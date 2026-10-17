// Pure scene/UI colour data. The viewer owns URL/localStorage preference handling.
// Material colours are sRGB hex; Three.js handles conversion to its working space.
// "original" mirrors the original GLB linear baseColor factors in sRGB.
// VS Code / GitHub / CAD entries are adaptations, not official theme replicas.
// UI references: Dark Modern, Light Modern, and Microsoft's built-in Monokai:
// https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json
// https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/light_modern.json
// https://github.com/microsoft/vscode/blob/main/extensions/theme-monokai/themes/monokai-color-theme.json
// GitHub references: https://primer.style/product/primitives/color/
// https://github.com/primer/primitives/tree/main/src/tokens/base/color
// SolidWorks reference: adjustable gradient backgrounds and selection highlight schemes.
// https://help.solidworks.com/2018/english/SolidWorks/sldworks/HIDD_OPTIONS_SYSTEM_COLORS_modeldisplay.htm
// Creo Parametric 12: medium-grey viewport with cool blue-grey solids.
// https://support.ptc.com/help/creo/creo_pma/r12/usascii/assembly/asm/About_Display_Styles.html
// https://support.ptc.com/help/creo/creo_pma/r12/usascii/configuration_options/System_Colors.html
// https://support.ptc.com/help/creo/creo_pma/r12/usascii/configuration_options/About_System_Colors.html
// Shaded edge #222226 and selected item #33cc4d use the documented default RGB.
// Solid colours and gradient endpoints approximate the official screenshots.
// Fusion: Autodesk's Photo Booth / Shaded with Visible Edges Only example,
// page 6, plus blue selected faces with light borders on page 3:
// https://files.upskill-dev.autodesk.com/public/fusion360-design-for-manufacturing-cert-prep/220225_L2-07_Demonstrate-view-controls.pdf
// CAD entries follow the user's neutral opaque-solid viewport examples, with
// Lambert shading, charcoal visible edges and soft ground shadows. Except for
// the documented Creo edge/selection colours, colours are local adaptations;
// the entries do not claim a universal default across software versions/themes.
// Some foregrounds are adjusted for small UI text. 3D materials are independently
// designed for readable metal surfaces; green clearance and pink obstruction
// remain semantic colours rather than component material identities.
// The two line-art entries below reference the local 2D index.html iso strokes
// (neutral outlines, restrained face fills and non-scaling line weight). They
// are new teaching display styles, independent of the VS Code/GitHub branding.
// The viewer owns outline rendering and disables metal lighting/shadows in line mode.
export const PALETTES = [
  {
    id: 'ivory',
    name: "Ivory and brass",
    description: "Warm paper · Nickel-gray plug · Brass key",
    family: 'studio',
    scheme: 'light',
    ui: {
      page: '#f3f0e8', surface: '#fcfaf5', stage: '#ece7dc', stageEnd: '#ddd5c7',
      text: '#242c33', muted: '#4d5a65', line: '#c7c7bd',
      accent: '#2f6174', accentContrast: '#fffaf1', tint: '#e4e9e7',
      selected: '#ffffff', good: '#225f48', goodBg: '#e0eee4',
      warning: '#984b25', warningBg: '#f6e4d1', focus: '#9b7428',
      labelBg: '#fffdf6', labelBorder: '#9ca9a8', disabled: '#505e68', shadow: '#26313a18',
    },
    materials: {
      shell: { color: '#728592', metalness: 0.34, roughness: 0.43 },
      plug: { color: '#c9c5ba', metalness: 0.62, roughness: 0.33 },
      lower: { color: '#e1e8ec', metalness: 0.56, roughness: 0.27 },
      driver: { color: '#446e82', metalness: 0.38, roughness: 0.37 },
      spring: { color: '#bc754a', metalness: 0.61, roughness: 0.34 },
      key: { color: '#c79c47', metalness: 0.68, roughness: 0.29 },
      cam: { color: '#8b795f', metalness: 0.58, roughness: 0.36 },
      base: { color: '#536979', metalness: 0.20, roughness: 0.55 },
    },
    lighting: {
      exposure: 1.04, hemisphereGround: '#9e9b8f', fill: '#e5edf4',
      shadowColor: '#4d5559', shearColor: '#227352', selectionColor: '#b79143', blockedColor: '#b93f65',
    },
  },
  {
    id: 'midnight',
    name: "Midnight blue",
    description: "Deep-blue stage · Cool silver · Gold focus",
    family: 'studio',
    scheme: 'dark',
    ui: {
      page: '#0d1726', surface: '#13233a', stage: '#101e33', stageEnd: '#213958',
      text: '#f4f5f7', muted: '#b9c9da', line: '#425973',
      accent: '#8fbfdb', accentContrast: '#0d1d2b', tint: '#20364d',
      selected: '#263f59', good: '#9ce5c1', goodBg: '#173a35',
      warning: '#ffd28c', warningBg: '#422d1b', focus: '#d8b776',
      labelBg: '#172b40', labelBorder: '#68859c', disabled: '#9eaebf', shadow: '#00091648',
    },
    materials: {
      shell: { color: '#3e617f', metalness: 0.40, roughness: 0.39 },
      plug: { color: '#adbac5', metalness: 0.65, roughness: 0.32 },
      lower: { color: '#edf2f5', metalness: 0.58, roughness: 0.28 },
      driver: { color: '#559fc7', metalness: 0.35, roughness: 0.36 },
      spring: { color: '#d99255', metalness: 0.60, roughness: 0.35 },
      key: { color: '#dbba77', metalness: 0.67, roughness: 0.30 },
      cam: { color: '#879ba9', metalness: 0.62, roughness: 0.35 },
      base: { color: '#2a4257', metalness: 0.25, roughness: 0.53 },
    },
    lighting: {
      exposure: 0.92, hemisphereGround: '#263c58', fill: '#c4dcff',
      shadowColor: '#000b16', shearColor: '#74d5ad', selectionColor: '#e8cf7c', blockedColor: '#ec6687',
    },
  },
  {
    id: 'graphite',
    name: "Graphite and copper",
    description: "Graphite stage · Copper details · Teal pins",
    family: 'studio',
    scheme: 'dark',
    ui: {
      page: '#17191b', surface: '#22262a', stage: '#1d2225', stageEnd: '#3c4144',
      text: '#f2eee7', muted: '#c2c0bb', line: '#626665',
      accent: '#e4a678', accentContrast: '#231a14', tint: '#333c3d',
      selected: '#34443f', good: '#a4dbb9', goodBg: '#243b31',
      warning: '#f6bd78', warningBg: '#453024', focus: '#e4b080',
      labelBg: '#272d2e', labelBorder: '#818782', disabled: '#b1b4b4', shadow: '#06080850',
    },
    materials: {
      shell: { color: '#4e5358', metalness: 0.45, roughness: 0.42 },
      plug: { color: '#9cabb1', metalness: 0.65, roughness: 0.34 },
      lower: { color: '#edf0ed', metalness: 0.60, roughness: 0.27 },
      driver: { color: '#5f8f83', metalness: 0.37, roughness: 0.40 },
      spring: { color: '#d78355', metalness: 0.62, roughness: 0.33 },
      key: { color: '#d5ba82', metalness: 0.66, roughness: 0.31 },
      cam: { color: '#b2947c', metalness: 0.58, roughness: 0.36 },
      base: { color: '#343a40', metalness: 0.25, roughness: 0.56 },
    },
    lighting: {
      exposure: 0.95, hemisphereGround: '#343a3b', fill: '#eee6dc',
      shadowColor: '#080b0c', shearColor: '#8ccba8', selectionColor: '#dfb487', blockedColor: '#e1688a',
    },
  },
  {
    id: 'original',
    name: "Original blue and gold",
    description: "Cool-white stage · Original blue-and-gold materials",
    family: 'studio',
    scheme: 'light',
    ui: {
      page: '#f2f5f5', surface: '#ffffff', stage: '#e8efef', stageEnd: '#dce7e8',
      text: '#243d4a', muted: '#4f6670', line: '#dce5e6',
      accent: '#196958', accentContrast: '#ffffff', tint: '#edf4f1',
      selected: '#f9fcfb', good: '#247254', goodBg: '#e5f3ed',
      warning: '#8c5929', warningBg: '#fbede0', focus: '#b0822c',
      labelBg: '#fdfcf5', labelBorder: '#9fb9b6', disabled: '#506773', shadow: '#213c4818',
    },
    materials: {
      shell: { color: '#5590b5', metalness: 0.45, roughness: 0.32 },
      plug: { color: '#d3b87e', metalness: 0.62, roughness: 0.32 },
      lower: { color: '#dae6ec', metalness: 0.72, roughness: 0.28 },
      driver: { color: '#59b8e5', metalness: 0.38, roughness: 0.28 },
      spring: { color: '#fa974b', metalness: 0.45, roughness: 0.32 },
      key: { color: '#f5d06f', metalness: 0.72, roughness: 0.25 },
      cam: { color: '#d3b87e', metalness: 0.62, roughness: 0.32 },
      base: { color: '#3c6179', metalness: 0.28, roughness: 0.50 },
    },
    lighting: {
      exposure: 1.20, hemisphereGround: '#758e95', fill: '#e0efff',
      shadowColor: '#3b646a', shearColor: '#24856b', selectionColor: '#dba94f', blockedColor: '#b93f65',
    },
  },
  {
    id: 'vscode-dark',
    name: "VS Code Dark",
    description: "Dark-gray stage · Steel-blue structure · Bright-blue accents",
    family: 'vscode',
    scheme: 'dark',
    ui: {
      page: '#181818', surface: '#1f1f1f', stage: '#1f1f1f', stageEnd: '#2b2b2b',
      text: '#e0e0e0', muted: '#b8b8b8', line: '#4d4d4d',
      accent: '#4daafc', accentContrast: '#101c27', tint: '#292d32',
      selected: '#263342', good: '#8dd69d', goodBg: '#233426',
      warning: '#f3c77f', warningBg: '#40321f', focus: '#4daafc',
      labelBg: '#22272d', labelBorder: '#6b7785', disabled: '#b0b0b0', shadow: '#00000050',
    },
    materials: {
      shell: { color: '#4b5968', metalness: 0.40, roughness: 0.42 },
      plug: { color: '#c2cbd1', metalness: 0.63, roughness: 0.33 },
      lower: { color: '#eef2f6', metalness: 0.56, roughness: 0.28 },
      driver: { color: '#5b9bd0', metalness: 0.35, roughness: 0.37 },
      spring: { color: '#ce9178', metalness: 0.55, roughness: 0.36 },
      key: { color: '#d7ba7d', metalness: 0.66, roughness: 0.30 },
      cam: { color: '#8aa9b7', metalness: 0.57, roughness: 0.37 },
      base: { color: '#303c47', metalness: 0.23, roughness: 0.56 },
    },
    lighting: {
      exposure: 1.02, hemisphereGround: '#30383f', fill: '#d6e6ff',
      shadowColor: '#101315', shearColor: '#8dd69d', selectionColor: '#4daafc', blockedColor: '#ee6b9c',
    },
  },
  {
    id: 'vscode-light',
    name: "VS Code Light",
    description: "White-gray UI · Blue-nickel parts · Cool-silver plug",
    family: 'vscode',
    scheme: 'light',
    ui: {
      page: '#f8f8f8', surface: '#ffffff', stage: '#f3f5f7', stageEnd: '#e5ebf1',
      text: '#3b3b3b', muted: '#535b64', line: '#cecece',
      accent: '#005fb8', accentContrast: '#ffffff', tint: '#e5ebf1',
      selected: '#e5ebf1', good: '#22673b', goodBg: '#e5f2e8',
      warning: '#895503', warningBg: '#fff0d3', focus: '#005fb8',
      labelBg: '#ffffff', labelBorder: '#9daeba', disabled: '#535b64', shadow: '#1f1f1f18',
    },
    materials: {
      shell: { color: '#8295ab', metalness: 0.35, roughness: 0.44 },
      plug: { color: '#c7d0d6', metalness: 0.62, roughness: 0.34 },
      lower: { color: '#f3f5f8', metalness: 0.54, roughness: 0.29 },
      driver: { color: '#2872b6', metalness: 0.36, roughness: 0.37 },
      spring: { color: '#ad664c', metalness: 0.58, roughness: 0.36 },
      key: { color: '#bc9144', metalness: 0.66, roughness: 0.30 },
      cam: { color: '#617b94', metalness: 0.55, roughness: 0.38 },
      base: { color: '#4f637a', metalness: 0.22, roughness: 0.55 },
    },
    lighting: {
      exposure: 1.02, hemisphereGround: '#a5afb9', fill: '#e7efff',
      shadowColor: '#546475', shearColor: '#287c46', selectionColor: '#005fb8', blockedColor: '#b63470',
    },
  },
  {
    id: 'monokai',
    name: "Monokai inspired",
    description: "Purple pins · Cyan springs · Bright-yellow key",
    family: 'vscode',
    scheme: 'dark',
    ui: {
      page: '#1e1f1c', surface: '#272822', stage: '#272822', stageEnd: '#34362e',
      text: '#f8f8f2', muted: '#c4c5b6', line: '#626454',
      accent: '#bf9fff', accentContrast: '#241e30', tint: '#32332d',
      selected: '#35313e', good: '#a6e22e', goodBg: '#26351e',
      warning: '#ffc675', warningBg: '#44351e', focus: '#66d9ef',
      labelBg: '#292a25', labelBorder: '#888b74', disabled: '#babcaa', shadow: '#10110e50',
    },
    materials: {
      shell: { color: '#615574', metalness: 0.36, roughness: 0.45 },
      plug: { color: '#babdb4', metalness: 0.61, roughness: 0.34 },
      lower: { color: '#f3f3ed', metalness: 0.54, roughness: 0.29 },
      driver: { color: '#ae81ff', metalness: 0.31, roughness: 0.38 },
      spring: { color: '#66d9ef', metalness: 0.42, roughness: 0.35 },
      key: { color: '#e6db74', metalness: 0.62, roughness: 0.31 },
      cam: { color: '#d19852', metalness: 0.56, roughness: 0.37 },
      base: { color: '#45423e', metalness: 0.22, roughness: 0.56 },
    },
    lighting: {
      exposure: 0.98, hemisphereGround: '#3c3b35', fill: '#ece4ff',
      shadowColor: '#11120f', shearColor: '#a6e22e', selectionColor: '#fd971f', blockedColor: '#f92672',
    },
  },
  {
    id: 'github-light',
    name: "GitHub Light",
    description: "Cool-white UI · Brushed silver · Classic blue",
    family: 'github',
    scheme: 'light',
    ui: {
      page: '#f6f8fa', surface: '#ffffff', stage: '#f6f8fa', stageEnd: '#eff2f5',
      text: '#1f2328', muted: '#59636e', line: '#d1d9e0',
      accent: '#0969da', accentContrast: '#ffffff', tint: '#eaf4ff',
      selected: '#ffffff', good: '#1a7f37', goodBg: '#dafbe1',
      warning: '#7d4e00', warningBg: '#fff8c5', focus: '#0969da',
      labelBg: '#ffffff', labelBorder: '#9aaab8', disabled: '#59636e', shadow: '#1f232818',
    },
    materials: {
      shell: { color: '#8399ab', metalness: 0.33, roughness: 0.46 },
      plug: { color: '#c6ced4', metalness: 0.62, roughness: 0.34 },
      lower: { color: '#f0f4f7', metalness: 0.55, roughness: 0.29 },
      driver: { color: '#387ec8', metalness: 0.35, roughness: 0.37 },
      spring: { color: '#bd7550', metalness: 0.56, roughness: 0.36 },
      key: { color: '#c6a04a', metalness: 0.65, roughness: 0.31 },
      cam: { color: '#688598', metalness: 0.54, roughness: 0.39 },
      base: { color: '#536a7c', metalness: 0.21, roughness: 0.57 },
    },
    lighting: {
      exposure: 1.03, hemisphereGround: '#a4afb8', fill: '#e2efff',
      shadowColor: '#5c6d7b', shearColor: '#1a7f37', selectionColor: '#0969da', blockedColor: '#b52c72',
    },
  },
  {
    id: 'github-dark',
    name: "GitHub Dark",
    description: "Blue-black stage · Silver mechanism · Bright-blue accents",
    family: 'github',
    scheme: 'dark',
    ui: {
      page: '#0d1117', surface: '#151b23', stage: '#0d1117', stageEnd: '#212830',
      text: '#f0f6fc', muted: '#b7bdc8', line: '#3d444d',
      accent: '#58a6ff', accentContrast: '#0d1825', tint: '#1c2e42',
      selected: '#203247', good: '#7ee787', goodBg: '#1b3423',
      warning: '#f2cc60', warningBg: '#3b321e', focus: '#58a6ff',
      labelBg: '#151b23', labelBorder: '#657586', disabled: '#aeb8c4', shadow: '#01040960',
    },
    materials: {
      shell: { color: '#405a70', metalness: 0.39, roughness: 0.43 },
      plug: { color: '#b4c4d0', metalness: 0.64, roughness: 0.33 },
      lower: { color: '#f0f6fc', metalness: 0.56, roughness: 0.28 },
      driver: { color: '#58a6ff', metalness: 0.33, roughness: 0.37 },
      spring: { color: '#f0883e', metalness: 0.54, roughness: 0.35 },
      key: { color: '#e3b341', metalness: 0.63, roughness: 0.30 },
      cam: { color: '#9caac1', metalness: 0.58, roughness: 0.37 },
      base: { color: '#263a4b', metalness: 0.23, roughness: 0.56 },
    },
    lighting: {
      exposure: 1.00, hemisphereGround: '#263340', fill: '#cbdfff',
      shadowColor: '#010409', shearColor: '#7ee787', selectionColor: '#58a6ff', blockedColor: '#f778ba',
    },
  },
  {
    id: 'github-dimmed',
    name: "GitHub Dimmed",
    description: "Soft-gray stage · Matte steel · Pale-blue accents",
    family: 'github',
    scheme: 'dark',
    ui: {
      page: '#22272e', surface: '#2d333b', stage: '#2d333b', stageEnd: '#363e48',
      text: '#e1e8ef', muted: '#bac6d2', line: '#5b6672',
      accent: '#96d0ff', accentContrast: '#1e2a36', tint: '#34404d',
      selected: '#33495d', good: '#8ddb8c', goodBg: '#2b3d30',
      warning: '#eac55f', warningBg: '#453a25', focus: '#96d0ff',
      labelBg: '#2b333d', labelBorder: '#8594a4', disabled: '#b2bfcc', shadow: '#161b2250',
    },
    materials: {
      shell: { color: '#687482', metalness: 0.33, roughness: 0.48 },
      plug: { color: '#c5ccd3', metalness: 0.58, roughness: 0.37 },
      lower: { color: '#edf2f6', metalness: 0.52, roughness: 0.31 },
      driver: { color: '#779fd1', metalness: 0.31, roughness: 0.41 },
      spring: { color: '#c99463', metalness: 0.52, roughness: 0.39 },
      key: { color: '#e0bc67', metalness: 0.61, roughness: 0.34 },
      cam: { color: '#8293a3', metalness: 0.52, roughness: 0.41 },
      base: { color: '#475665', metalness: 0.20, roughness: 0.60 },
    },
    lighting: {
      exposure: 1.04, hemisphereGround: '#4d5863', fill: '#e0e9f5',
      shadowColor: '#19212a', shearColor: '#8ddb8c', selectionColor: '#96d0ff', blockedColor: '#e88fb5',
    },
  },
  {
    id: 'solidworks',
    name: "SolidWorks",
    description: "Cool-white stage · Gray-violet solids · Charcoal edges",
    family: 'cad',
    renderStyle: 'cad',
    scheme: 'light',
    line: { color: '#37363d', detailColor: '#62616b' },
    ui: {
      page: '#f3f3f5', surface: '#ffffff', stage: '#e8e8ee', stageEnd: '#ffffff',
      text: '#303039', muted: '#5e5e69', line: '#ccccd3',
      accent: '#555773', accentContrast: '#ffffff', tint: '#eaeaf0',
      selected: '#f4f4f8', good: '#287148', goodBg: '#e3f1e8',
      warning: '#804862', warningBg: '#f6e7ef', focus: '#b96c25',
      labelBg: '#ffffff', labelBorder: '#9797a5', disabled: '#626271', shadow: '#30303918',
    },
    materials: {
      shell: { color: '#a4a3b2', metalness: 0, roughness: 0.85 },
      plug: { color: '#bdbcc6', metalness: 0, roughness: 0.85 },
      lower: { color: '#d1d0d7', metalness: 0, roughness: 0.85 },
      driver: { color: '#aeadba', metalness: 0, roughness: 0.85 },
      spring: { color: '#92919e', metalness: 0, roughness: 0.85 },
      key: { color: '#c1c0c8', metalness: 0, roughness: 0.85 },
      cam: { color: '#a4a3ae', metalness: 0, roughness: 0.85 },
      base: { color: '#9695a3', metalness: 0, roughness: 0.85 },
    },
    lighting: {
      exposure: 1, hemisphereGround: '#b8b7be', fill: '#ffffff',
      hemisphereIntensity: 0.55 * Math.PI, sunIntensity: 0.65 * Math.PI, fillIntensity: 0.16 * Math.PI,
      shadowColor: '#6b6975', shadowOpacity: 0.14, shearColor: '#287148', selectionColor: '#e38b36', selectionStrength: 0.36, blockedColor: '#b84778',
    },
  },
  {
    id: 'creo',
    name: "Creo",
    description: "Parametric 12 · Cool blue-gray solids · Green selection",
    family: 'cad',
    renderStyle: 'cad',
    scheme: 'light',
    line: { color: '#222226', detailColor: '#42434a' },
    ui: {
      page: '#f2f3f5', surface: '#ffffff', stage: '#bfc1c5', stageEnd: '#d1d3d6',
      text: '#30353d', muted: '#5b6672', line: '#cbd0d6',
      accent: '#276a37', accentContrast: '#ffffff', tint: '#e6ede8',
      selected: '#f3f7f4', good: '#2d714b', goodBg: '#e5f0e7',
      warning: '#864465', warningBg: '#f4e8ef', focus: '#276a37',
      labelBg: '#ffffff', labelBorder: '#929fae', disabled: '#626c77', shadow: '#303b4818',
    },
    materials: {
      shell: { color: '#aebdcb', metalness: 0, roughness: 0.9 },
      plug: { color: '#bcc8d3', metalness: 0, roughness: 0.9 },
      lower: { color: '#cdd5dd', metalness: 0, roughness: 0.9 },
      driver: { color: '#a6b7c8', metalness: 0, roughness: 0.9 },
      spring: { color: '#738395', metalness: 0, roughness: 0.9 },
      key: { color: '#b7c3cf', metalness: 0, roughness: 0.9 },
      cam: { color: '#a1b1c1', metalness: 0, roughness: 0.9 },
      base: { color: '#95a4b4', metalness: 0, roughness: 0.9 },
    },
    lighting: {
      exposure: 1, hemisphereGround: '#b3bcc8', fill: '#ffffff',
      hemisphereIntensity: 0.55 * Math.PI, sunIntensity: 0.65 * Math.PI, fillIntensity: 0.16 * Math.PI,
      shadowColor: '#536171', shadowOpacity: 0.13, shearColor: '#2d714b', selectionColor: '#33cc4d', selectionStrength: 0.60, blockedColor: '#af4b7a',
    },
  },
  {
    id: 'fusion360',
    name: "Fusion 360",
    description: "Photo Booth gray · Neutral-gray solids · Blue selection",
    family: 'cad',
    renderStyle: 'cad',
    scheme: 'light',
    line: { color: '#303030', detailColor: '#515150' },
    ui: {
      page: '#f4f5f6', surface: '#ffffff', stage: '#9e9e9e', stageEnd: '#cacaca',
      text: '#30363d', muted: '#5e6872', line: '#ccd2d8',
      accent: '#347db4', accentContrast: '#ffffff', tint: '#e7eef5',
      selected: '#f4f8fc', good: '#2b704e', goodBg: '#e5f1e9',
      warning: '#844666', warningBg: '#f4e8ef', focus: '#277fbf',
      labelBg: '#ffffff', labelBorder: '#93a4b3', disabled: '#646f79', shadow: '#303d4818',
    },
    materials: {
      shell: { color: '#999a96', metalness: 0, roughness: 0.82 },
      plug: { color: '#b3b4b0', metalness: 0, roughness: 0.82 },
      lower: { color: '#c4c4c1', metalness: 0, roughness: 0.82 },
      driver: { color: '#9d9e9b', metalness: 0, roughness: 0.82 },
      spring: { color: '#747672', metalness: 0, roughness: 0.82 },
      key: { color: '#adaeaa', metalness: 0, roughness: 0.82 },
      cam: { color: '#90928f', metalness: 0, roughness: 0.82 },
      base: { color: '#80827d', metalness: 0, roughness: 0.82 },
    },
    lighting: {
      exposure: 1, hemisphereGround: '#bbbbbb', fill: '#ffffff',
      hemisphereIntensity: 0.58 * Math.PI, sunIntensity: 0.52 * Math.PI, fillIntensity: 0.12 * Math.PI,
      shadowColor: '#555555', shadowOpacity: 0.16, shearColor: '#2b704e', selectionColor: '#7395c7', selectionLineColor: '#f0f3f8', selectionStrength: 0.72, blockedColor: '#b3487d',
    },
  },
  {
    id: 'line-light',
    name: "Black lines on white",
    description: "White stage · Black outlines · Pale-gray fills",
    family: 'line',
    renderStyle: 'line',
    scheme: 'light',
    line: { color: '#26262a', detailColor: '#9b9ba1' },
    ui: {
      page: '#ffffff', surface: '#ffffff', stage: '#ffffff', stageEnd: '#ffffff',
      text: '#171717', muted: '#555555', line: '#cccccc',
      accent: '#171717', accentContrast: '#ffffff', tint: '#f1f1f1',
      selected: '#f5f5f5', good: '#285844', goodBg: '#edf2ef',
      warning: '#6e334b', warningBg: '#f3eef0', focus: '#111111',
      labelBg: '#ffffff', labelBorder: '#999999', disabled: '#595959', shadow: '#00000000',
    },
    materials: {
      shell: { color: '#ffffff', metalness: 0, roughness: 1 },
      plug: { color: '#fcfcfc', metalness: 0, roughness: 1 },
      lower: { color: '#ffffff', metalness: 0, roughness: 1 },
      driver: { color: '#f6f6f6', metalness: 0, roughness: 1 },
      spring: { color: '#ffffff', metalness: 0, roughness: 1 },
      key: { color: '#fcfcfc', metalness: 0, roughness: 1 },
      cam: { color: '#f7f7f7', metalness: 0, roughness: 1 },
      base: { color: '#f0f0f0', metalness: 0, roughness: 1 },
    },
    lighting: {
      exposure: 1, hemisphereGround: '#ffffff', fill: '#ffffff',
      hemisphereIntensity: 0.9 * Math.PI, sunIntensity: 0.12 * Math.PI, fillIntensity: 0.025 * Math.PI,
      shadowColor: '#ffffff', shearColor: '#373737', selectionColor: '#666666', blockedColor: '#9b4c6a',
    },
  },
  {
    id: 'line-dark',
    name: "White lines on black",
    description: "Near-black stage · White outlines · Gray fills",
    family: 'line',
    renderStyle: 'line',
    scheme: 'dark',
    line: { color: '#eeeeee', detailColor: '#77777d' },
    ui: {
      page: '#0b0b0b', surface: '#111111', stage: '#0b0b0b', stageEnd: '#0b0b0b',
      text: '#eeeeee', muted: '#b8b8b8', line: '#444444',
      accent: '#eeeeee', accentContrast: '#111111', tint: '#1d1d1d',
      selected: '#252525', good: '#a9c7b5', goodBg: '#18251d',
      warning: '#d4a8ba', warningBg: '#271b21', focus: '#ffffff',
      labelBg: '#111111', labelBorder: '#777777', disabled: '#b0b0b0', shadow: '#00000000',
    },
    materials: {
      shell: { color: '#101010', metalness: 0, roughness: 1 },
      plug: { color: '#141414', metalness: 0, roughness: 1 },
      lower: { color: '#0d0d0d', metalness: 0, roughness: 1 },
      driver: { color: '#181818', metalness: 0, roughness: 1 },
      spring: { color: '#101010', metalness: 0, roughness: 1 },
      key: { color: '#141414', metalness: 0, roughness: 1 },
      cam: { color: '#151515', metalness: 0, roughness: 1 },
      base: { color: '#1b1b1b', metalness: 0, roughness: 1 },
    },
    lighting: {
      exposure: 1, hemisphereGround: '#ffffff', fill: '#ffffff',
      hemisphereIntensity: 0.9 * Math.PI, sunIntensity: 0.12 * Math.PI, fillIntensity: 0.025 * Math.PI,
      shadowColor: '#0b0b0b', shearColor: '#d4d4d4', selectionColor: '#dddddd', blockedColor: '#b98298',
    },
  },
];

export function getPalette(id) {
  return PALETTES.find(palette => palette.id === id) ?? PALETTES.find(palette => palette.id === 'line-light');
}
