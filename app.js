const DEFAULT_CURSOR = 'default';
const canvas = document.getElementById('plan');
const ctx = canvas.getContext('2d');
const summaryEl = document.getElementById('summary');
const toolsEl = document.getElementById('tools');
const view3d = document.getElementById('view3d');
const fallback3d = document.getElementById('fallback3d');
const contextMenu = document.getElementById('contextMenu');

let majorGrid = 25;       // 25 px = 1 m
let snapGrid = 25;        // précision réelle de dessin
let metersPerMajor = 1;
let objects = [];
let selectedId = null;
let selectedIds = [];
let activeTool = null;
let drawing = null;
let polyDraft = [];
let dragging = null;
let resizing = null;
let selectingRect = null;
let clipboard = null;
let showDims = true;
let snapEnabled = true;
let threeRenderer = null;
let historyStack = [];
let redoStack = [];
let currentView = '2d';

const toolDefs = [
  {id:'select', label:'Sélection / déplacement', mode:'select'},
  {id:'terrain', label:'Terrain', mode:'rect', color:'#cbe8a7', unit:'m²', h:0.05, texture:'pelouse'},
  {id:'pelouse', label:'Pelouse', mode:'rect', color:'#7fcf63', unit:'m²', h:0.03, texture:'pelouse'},
  {id:'terrasse', label:'Terrasse', mode:'rect', color:'#c59b6b', unit:'m²', h:0.15, texture:'bois'},
  {id:'allee', label:'Allée / pavés', mode:'rect', color:'#b9b9b9', unit:'m²', h:0.10, texture:'paves'},
  {id:'gravier', label:'Gravier', mode:'rect', color:'#d8d2c3', unit:'m²', h:0.02, texture:'gravier'},
  {id:'massif', label:'Massif', mode:'poly', color:'#8b5a3c', unit:'m²', h:0.15, texture:'massif'},
  {id:'eau', label:'Plan d’eau', mode:'ellipse', color:'#55aee8', unit:'m²', h:-0.6, texture:'eau'},
  {id:'piscine', label:'Piscine', mode:'ellipse', color:'#55b9df', unit:'m²', h:-1.5, texture:'eau'},
  {id:'haie', label:'Haie', mode:'line', color:'#2f7d32', unit:'m', h:2.0, texture:'haie_dense', widthM:.65},
  {id:'cloture', label:'Clôture', mode:'line', color:'#6f5138', unit:'m', h:1.5, texture:'cloture'},
  {id:'bordure', label:'Bordure', mode:'line', color:'#6a6a6a', unit:'m', h:0.08, texture:'pierre'},
  {id:'courbe', label:'Courbe / tracé souple', mode:'curve', color:'#2f7d32', unit:'m', h:0.25, texture:''},
  {id:'arbre', label:'Arbre', mode:'point', color:'#217a35', unit:'pc', h:4, texture:'arbre'},
  {id:'arbuste', label:'Arbuste', mode:'point', color:'#4e9f43', unit:'pc', h:1.2, texture:'arbuste'},
  {id:'bbq', label:'BBQ', mode:'point', color:'#333333', unit:'pc', h:1.1, texture:'metal'},
  {id:'mobilier', label:'Mobilier', mode:'point', color:'#8b6b4d', unit:'pc', h:0.8, texture:'bois'},
  {id:'texte', label:'Texte', mode:'point', color:'#111111', unit:'pc', h:0},
  {id:'cote', label:'Cote manuelle', mode:'line', color:'#111111', unit:'m', h:0},
  {id:'abri', label:'Abri / garage', mode:'rect', color:'#9a7652', unit:'m²', h:2.4, texture:'bois'},
  {id:'maison', label:'Maison existante', mode:'rect', color:'#ded8ce', unit:'m²', h:3, texture:'maison'}
];

const libraryItems = [
  // Végétation - haies
  {id:'lib_haie_laurier_palme', label:'Laurier palme', category:'Végétation / Haies', mode:'line', color:'#2f7d32', unit:'m', h:2.0, widthM:.7, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_dense'},
  {id:'lib_haie_laurier_portugal', label:'Laurier du Portugal', category:'Végétation / Haies', mode:'line', color:'#245f34', unit:'m', h:1.8, widthM:.55, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_fine'},
  {id:'lib_haie_hetre', label:'Hêtre', category:'Végétation / Haies', mode:'line', color:'#6d8f34', unit:'m', h:1.8, widthM:.55, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_feuillu'},
  {id:'lib_haie_charme', label:'Charme', category:'Végétation / Haies', mode:'line', color:'#4f8b3b', unit:'m', h:1.8, widthM:.55, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_feuillu'},
  {id:'lib_haie_troene', label:'Troène', category:'Végétation / Haies', mode:'line', color:'#3f7e3a', unit:'m', h:1.8, widthM:.5, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_dense'},
  {id:'lib_haie_photinia', label:'Photinia', category:'Végétation / Haies', mode:'line', color:'#7f2f37', unit:'m', h:1.8, widthM:.6, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_rouge'},
  {id:'lib_haie_if', label:'If', category:'Végétation / Haies', mode:'line', color:'#1f5f2e', unit:'m', h:1.8, widthM:.55, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'haie_sombre'},
  {id:'lib_haie_thuya', label:'Thuya', category:'Végétation / Haies', mode:'line', color:'#1f6b38', unit:'m', h:2.0, widthM:.65, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'conifere'},
  {id:'lib_haie_cypres', label:'Cyprès de Leyland', category:'Végétation / Haies', mode:'line', color:'#236b42', unit:'m', h:2.2, widthM:.7, shapes:['line','rectangle','square','ellipse','circle','free'], texture:'conifere'},
  // arbres / arbustes
  {id:'lib_arbre_feuillu', label:'Arbre feuillu', category:'Végétation / Arbres', mode:'point', color:'#2f8a3f', unit:'pc', h:5, shapes:['point'], texture:'arbre'},
  {id:'lib_arbre_conifere', label:'Conifère', category:'Végétation / Arbres', mode:'point', color:'#1f6b38', unit:'pc', h:6, shapes:['point'], texture:'conifere'},
  {id:'lib_arbre_fruitier', label:'Arbre fruitier', category:'Végétation / Arbres', mode:'point', color:'#5e9f42', unit:'pc', h:3.5, shapes:['point'], texture:'arbre'},
  {id:'lib_arbre_ornement', label:'Arbre ornemental', category:'Végétation / Arbres', mode:'point', color:'#8b4fa3', unit:'pc', h:3, shapes:['point'], texture:'arbre_fleuri'},
  {id:'lib_arbuste_persistant', label:'Arbuste persistant', category:'Végétation / Arbustes', mode:'point', color:'#4e9f43', unit:'pc', h:1.2, shapes:['point'], texture:'arbuste'},
  {id:'lib_arbuste_fleuri', label:'Arbuste fleuri', category:'Végétation / Arbustes', mode:'point', color:'#b24d8d', unit:'pc', h:1.2, shapes:['point'], texture:'fleurs'},
  {id:'lib_massif_vivaces', label:'Massif de vivaces', category:'Végétation / Massifs', mode:'poly', color:'#8b5a3c', unit:'m²', h:.15, shapes:['free','ellipse','circle','rectangle'], texture:'massif'},
  {id:'lib_massif_graminees', label:'Massif graminées', category:'Végétation / Massifs', mode:'poly', color:'#b8a85f', unit:'m²', h:.6, shapes:['free','ellipse','circle','rectangle'], texture:'graminees'},
  {id:'lib_potager', label:'Potager', category:'Végétation / Massifs', mode:'rect', color:'#8a5c32', unit:'m²', h:.1, shapes:['rectangle','square','free'], texture:'terre'},
  // revêtements
  {id:'lib_pelouse', label:'Pelouse', category:'Revêtements', mode:'rect', color:'#7fcf63', unit:'m²', h:.03, shapes:['rectangle','square','ellipse','circle','free'], texture:'pelouse'},
  {id:'lib_prairie', label:'Prairie fleurie', category:'Revêtements', mode:'poly', color:'#9fd36f', unit:'m²', h:.04, shapes:['free','rectangle','ellipse'], texture:'prairie'},
  {id:'lib_gravier_gris', label:'Gravier gris', category:'Revêtements', mode:'rect', color:'#c7c7c0', unit:'m²', h:.04, shapes:['rectangle','square','ellipse','free'], texture:'gravier'},
  {id:'lib_gravier_jaune', label:'Gravier jaune', category:'Revêtements', mode:'rect', color:'#d8c37a', unit:'m²', h:.04, shapes:['rectangle','square','ellipse','free'], texture:'gravier'},
  {id:'lib_dolomie', label:'Dolomie', category:'Revêtements', mode:'rect', color:'#d6c98d', unit:'m²', h:.04, shapes:['rectangle','square','ellipse','free'], texture:'dolomie'},
  {id:'lib_ecorce', label:'Écorces', category:'Revêtements', mode:'rect', color:'#8b4d2e', unit:'m²', h:.05, shapes:['rectangle','square','ellipse','free'], texture:'ecorce'},
  {id:'lib_paves', label:'Pavés', category:'Revêtements', mode:'rect', color:'#a8a8a8', unit:'m²', h:.06, shapes:['rectangle','square','free'], texture:'paves'},
  {id:'lib_dalles', label:'Dalles', category:'Revêtements', mode:'rect', color:'#b9b9b9', unit:'m²', h:.06, shapes:['rectangle','square','free'], texture:'dalles'},
  {id:'lib_terrasse_bois', label:'Terrasse bois', category:'Terrasses', mode:'rect', color:'#b8834c', unit:'m²', h:.08, shapes:['rectangle','square','free'], texture:'bois'},
  {id:'lib_terrasse_pierre', label:'Terrasse pierre', category:'Terrasses', mode:'rect', color:'#9c9f9f', unit:'m²', h:.08, shapes:['rectangle','square','free'], texture:'pierre'},
  {id:'lib_terrasse_composite', label:'Terrasse composite', category:'Terrasses', mode:'rect', color:'#7a5b45', unit:'m²', h:.08, shapes:['rectangle','square','free'], texture:'bois'},
  // eau
  {id:'lib_piscine_rect', label:'Piscine rectangulaire', category:'Eau / Piscines', mode:'rect', color:'#4fbde8', unit:'m²', h:-1.5, shapes:['rectangle','square'], texture:'eau'},
  {id:'lib_piscine_arrondie', label:'Piscine arrondie', category:'Eau / Piscines', mode:'rect', color:'#55b9df', unit:'m²', h:-1.5, shapes:['rectangle','ellipse'], texture:'eau'},
  {id:'lib_piscine_ovale', label:'Piscine ovale', category:'Eau / Piscines', mode:'ellipse', color:'#55b9df', unit:'m²', h:-1.5, shapes:['ellipse','circle'], texture:'eau'},
  {id:'lib_plan_eau', label:'Plan d’eau', category:'Eau / Bassins', mode:'ellipse', color:'#55aee8', unit:'m²', h:-0.6, shapes:['ellipse','circle','free'], texture:'eau'},
  {id:'lib_bassin_naturel', label:'Bassin naturel', category:'Eau / Bassins', mode:'poly', color:'#4b9bc9', unit:'m²', h:-0.6, shapes:['free','ellipse','circle'], texture:'eau_naturelle'},
  {id:'lib_fontaine', label:'Fontaine', category:'Eau / Bassins', mode:'point', color:'#5bbce2', unit:'pc', h:.8, shapes:['point'], texture:'eau'},
  // constructions et équipements
  {id:'lib_maison', label:'Maison existante', category:'Constructions', mode:'rect', color:'#ded8ce', unit:'m²', h:3, shapes:['rectangle','square'], texture:'maison'},
  {id:'lib_abri', label:'Abri de jardin', category:'Constructions', mode:'rect', color:'#9a7652', unit:'m²', h:2.3, shapes:['rectangle','square'], texture:'bois'},
  {id:'lib_garage', label:'Garage', category:'Constructions', mode:'rect', color:'#b8afa5', unit:'m²', h:2.6, shapes:['rectangle','square'], texture:'maison'},
  {id:'lib_carport', label:'Carport', category:'Constructions', mode:'rect', color:'#9c8265', unit:'m²', h:2.4, shapes:['rectangle'], texture:'bois'},
  {id:'lib_serre', label:'Serre', category:'Constructions', mode:'rect', color:'#b8d6c9', unit:'m²', h:2.2, shapes:['rectangle'], texture:'verre'},
  {id:'lib_bbq', label:'BBQ', category:'Équipements', mode:'point', color:'#333333', unit:'pc', h:1, shapes:['point'], texture:'metal'},
  {id:'lib_brasero', label:'Brasero', category:'Équipements', mode:'point', color:'#6d3b24', unit:'pc', h:.45, shapes:['point'], texture:'metal'},
  {id:'lib_pergola', label:'Pergola', category:'Équipements', mode:'rect', color:'#8b6b4d', unit:'m²', h:2.4, shapes:['rectangle','square'], texture:'bois'},
  {id:'lib_jacuzzi', label:'Jacuzzi', category:'Équipements', mode:'ellipse', color:'#6bb9d7', unit:'pc', h:-0.9, shapes:['circle','ellipse','square'], texture:'eau'},
  {id:'lib_salon_jardin', label:'Salon de jardin', category:'Équipements', mode:'point', color:'#8b6b4d', unit:'pc', h:.7, shapes:['point'], texture:'bois'},
  {id:'lib_aire_jeux', label:'Aire de jeux', category:'Équipements', mode:'rect', color:'#d5a245', unit:'m²', h:.1, shapes:['rectangle','circle','free'], texture:'copeaux'},
  // clôtures / limites
  {id:'lib_cloture_rigide', label:'Clôture rigide', category:'Clôtures et limites', mode:'line', color:'#51605a', unit:'m', h:1.5, shapes:['line','rectangle','square','free'], texture:'cloture'},
  {id:'lib_palissade_bois', label:'Palissade bois', category:'Clôtures et limites', mode:'line', color:'#7a5638', unit:'m', h:1.8, shapes:['line','rectangle','square','free'], texture:'bois'},
  {id:'lib_gabion', label:'Gabions', category:'Clôtures et limites', mode:'line', color:'#8d8d86', unit:'m', h:1.2, shapes:['line','rectangle','square','free'], texture:'pierre'},
  {id:'lib_mur_soutenement', label:'Mur de soutènement', category:'Clôtures et limites', mode:'line', color:'#77736c', unit:'m', h:1, shapes:['line','rectangle','square','free'], texture:'pierre'},
  {id:'lib_bordure', label:'Bordure', category:'Clôtures et limites', mode:'line', color:'#6a6a6a', unit:'m', h:.25, shapes:['line','rectangle','square','free'], texture:'pierre'}
];

const shapeLabels={auto:'Automatique', line:'Ligne', curve:'Courbe', rectangle:'Rectangle', square:'Carré', ellipse:'Ovale', circle:'Rond', free:'Forme libre', point:'Point / symbole'};
const allShapeValues=['auto','line','curve','rectangle','square','ellipse','circle','free','point'];
let preferredBaseShape='auto';
let preferredLibraryShape='auto';
let openLibraryCats=new Set();
function modeForShape(item, shape){
  if(!shape || shape==='auto') return item.mode;
  if(shape==='line') return 'line';
  if(shape==='curve') return 'curve';
  if(shape==='free') return 'poly';
  if(shape==='circle' || shape==='ellipse') return 'ellipse';
  if(shape==='square' || shape==='rectangle') return 'rect';
  if(shape==='point') return 'point';
  return item.mode;
}
function allowedShape(item, requested){
  const shapes=item.shapes || ['rectangle'];
  if(requested==='auto') return true;
  return shapes.includes(requested) || (requested==='square' && shapes.includes('rectangle')) || (requested==='circle' && shapes.includes('ellipse'));
}
function shapeForItem(item, requested){
  if(requested==='auto') return (item.shapes && item.shapes[0]) || item.mode || 'rectangle';
  if(allowedShape(item, requested)) return requested;
  return (item.shapes && item.shapes[0]) || requested;
}
function baseShapeFor(item){
  const sel=document.getElementById('baseShapeSelect');
  const requested=sel ? sel.value : preferredBaseShape || 'auto';
  if(requested==='auto') return item.mode || 'rectangle';
  return requested;
}
function libraryShapeFor(item){
  const sel=document.getElementById('shapeSelect');
  const requested=sel ? sel.value : preferredLibraryShape || 'auto';
  return shapeForItem(item, requested);
}
function fillShapeSelect(sel, current, item=null){
  if(!sel) return;
  sel.innerHTML=allShapeValues.map(v=>`<option value="${v}" ${v!=='auto' && item && !allowedShape(item,v)?'disabled':''}>${shapeLabels[v]||v}</option>`).join('');
  sel.value=(current==='auto' || !item || allowedShape(item,current)) ? current : 'auto';
}
function updateShapeSelect(){
  fillShapeSelect(document.getElementById('baseShapeSelect'), preferredBaseShape || 'auto');
  fillShapeSelect(document.getElementById('shapeSelect'), preferredLibraryShape || 'auto', activeTool?.source==='library' ? activeTool : null);
}
libraryItems.forEach(item=>toolDefs.push({...item, mode:item.mode, source:'library'}));
const texturePatterns={
  pelouse:['#7fcf63','#68b957'], prairie:['#9fd36f','#f3d46b'], gravier:['#c7c7c0','#9e9e99'], dolomie:['#d6c98d','#b9a862'], ecorce:['#8b4d2e','#5f321f'], paves:['#a8a8a8','#777'], dalles:['#b9b9b9','#888'], bois:['#b8834c','#6f4329'], pierre:['#9c9f9f','#6f7272'], eau:['#55b9df','#d3f6ff'], eau_naturelle:['#4b9bc9','#2b6b74'], massif:['#8b5a3c','#c48f6a'], graminees:['#b8a85f','#e0d586'], terre:['#8a5c32','#5e3a1f'], haie_dense:['#2f7d32','#174a20'], haie_fine:['#245f34','#96c66c'], haie_feuillu:['#6d8f34','#3d651f'], haie_rouge:['#7f2f37','#328242'], haie_sombre:['#1f5f2e','#0e3518'], conifere:['#1f6b38','#103d22'], arbre:['#2f8a3f','#17501f'], arbre_fleuri:['#8b4fa3','#f4bfdc'], arbuste:['#4e9f43','#28702b'], fleurs:['#b24d8d','#f5c34d'], maison:['#ded8ce','#b8afa5'], verre:['#b8d6c9','#e7ffff'], metal:['#333','#888'], cloture:['#51605a','#202825'], copeaux:['#d5a245','#7a4b24']
};

const textureAssetPaths={
  // Textures 2D utilisées dans le plan.
  // La pelouse pointe maintenant vers la vraie texture AmbientCG que tu as placée dans le dossier.
  "pelouse":"textures/revetements/pelouse/pelouse_color.png",
  "prairie":"textures/revetements/pelouse/prairie.svg",
  "gravier":"textures/revetements/gravier/gravier_color.png",
  "dolomie":"textures/revetements/dolomie/dolomie_color.png",
  "ecorce":"textures/revetements/ecorce/ecorce_color.png",
  "paves":"textures/revetements/paves/paves_color.png",
  "dalles":"textures/revetements/dalles/dalles_color.png",
  "bois":"textures/revetements/terrasse/bois_color.png",
  "pierre":"textures/revetements/pierre/pierre_color.png",
  "eau":"textures/eau/eau.svg",
  "eau_naturelle":"textures/eau/bassin/eau_naturelle.svg",
  "haie_dense":"textures/vegetation/haies/haie_dense.svg",
  "haie_fine":"textures/vegetation/haies/haie_fine.svg",
  "haie_feuillu":"textures/vegetation/haies/haie_feuillu.svg",
  "haie_rouge":"textures/vegetation/haies/haie_rouge.svg",
  "haie_sombre":"textures/vegetation/haies/haie_sombre.svg",
  "conifere":"textures/vegetation/haies/conifere.svg",
  "arbre":"textures/vegetation/arbres/arbre.svg",
  "arbre_fleuri":"textures/vegetation/arbres/arbre_fleuri.svg",
  "arbuste":"textures/vegetation/arbustes/arbuste.svg",
  "fleurs":"textures/vegetation/massifs/fleurs.svg",
  "massif":"textures/vegetation/massifs/massif.svg",
  "graminees":"textures/vegetation/massifs/graminees.svg",
  "terre":"textures/vegetation/massifs/terre.svg",
  "maison":"textures/constructions/maison.svg",
  "verre":"textures/constructions/verre.svg",
  "metal":"textures/equipements/metal.svg",
  "copeaux":"textures/equipements/copeaux.svg",
  "cloture":"textures/clotures/cloture.svg"
};

// Textures 2D de secours si la texture PNG réaliste n'existe pas encore.
const textureFallbackPaths={
  "pelouse":"textures/revetements/pelouse/pelouse.svg",
  "gravier":"textures/revetements/gravier/gravier.svg",
  "dolomie":"textures/revetements/dolomie/dolomie.svg",
  "ecorce":"textures/revetements/ecorce/ecorce.svg",
  "paves":"textures/revetements/pave/paves.svg",
  "dalles":"textures/revetements/dalles/dalles.svg",
  "bois":"textures/revetements/terrasse/bois.svg",
  "pierre":"textures/revetements/pierre/pierre.svg"
};

// Cartes PBR pour la 3D. La pelouse est prête maintenant.
// Les autres sont déjà préparées : il suffira de placer les fichiers aux mêmes noms.
const texturePBRPaths={
  "pelouse":{
    color:"textures/revetements/pelouse/pelouse_color.png",
    normal:"textures/revetements/pelouse/pelouse_normal.png",
    roughness:"textures/revetements/pelouse/pelouse_roughness.png",
    ao:"textures/revetements/pelouse/pelouse_ao.png",
    displacement:"textures/revetements/pelouse/pelouse_displacement.png"
  },
  "gravier":{
    color:"textures/revetements/gravier/gravier_color.png",
    normal:"textures/revetements/gravier/gravier_normal.png",
    roughness:"textures/revetements/gravier/gravier_roughness.png",
    ao:"textures/revetements/gravier/gravier_ao.png",
    displacement:"textures/revetements/gravier/gravier_displacement.png"
  },
  "dolomie":{
    color:"textures/revetements/dolomie/dolomie_color.png",
    normal:"textures/revetements/dolomie/dolomie_normal.png",
    roughness:"textures/revetements/dolomie/dolomie_roughness.png",
    ao:"textures/revetements/dolomie/dolomie_ao.png",
    displacement:"textures/revetements/dolomie/dolomie_displacement.png"
  },
  "ecorce":{
    color:"textures/revetements/ecorce/ecorce_color.png",
    normal:"textures/revetements/ecorce/ecorce_normal.png",
    roughness:"textures/revetements/ecorce/ecorce_roughness.png",
    ao:"textures/revetements/ecorce/ecorce_ao.png",
    displacement:"textures/revetements/ecorce/ecorce_displacement.png"
  },
  "paves":{
    color:"textures/revetements/paves/paves_color.png",
    normal:"textures/revetements/paves/paves_normal.png",
    roughness:"textures/revetements/paves/paves_roughness.png",
    ao:"textures/revetements/paves/paves_ao.png",
    displacement:"textures/revetements/paves/paves_displacement.png"
  },
  "bois":{
    color:"textures/revetements/terrasse/bois_color.png",
    normal:"textures/revetements/terrasse/bois_normal.png",
    roughness:"textures/revetements/terrasse/bois_roughness.png",
    ao:"textures/revetements/terrasse/bois_ao.png",
    displacement:"textures/revetements/terrasse/bois_displacement.png"
  },
  "pierre":{
    color:"textures/revetements/pierre/pierre_color.png",
    normal:"textures/revetements/pierre/pierre_normal.png",
    roughness:"textures/revetements/pierre/pierre_roughness.png",
    ao:"textures/revetements/pierre/pierre_ao.png",
    displacement:"textures/revetements/pierre/pierre_displacement.png"
  }
};


const NO_TEXTURE = '__none';
const textureLabels = {
  pelouse:'Pelouse réaliste', prairie:'Prairie', gravier:'Gravier', dolomie:'Dolomie', ecorce:'Écorces',
  paves:'Pavés', dalles:'Dalles', bois:'Bois / terrasse', pierre:'Pierre', eau:'Eau', eau_naturelle:'Eau naturelle',
  haie_dense:'Haie dense', haie_fine:'Haie fine', haie_feuillu:'Haie feuillue', haie_rouge:'Haie rouge', haie_sombre:'Haie sombre', conifere:'Conifère',
  arbre:'Arbre', arbre_fleuri:'Arbre fleuri', arbuste:'Arbuste', fleurs:'Fleurs', massif:'Massif', graminees:'Graminées', terre:'Terre',
  maison:'Maison', verre:'Verre', metal:'Métal', copeaux:'Copeaux', cloture:'Clôture'
};
const textureFamilies = {
  pelouse:['pelouse','prairie'], prairie:['prairie','pelouse'], gravier:['gravier','dolomie'], dolomie:['dolomie','gravier'],
  ecorce:['ecorce','terre','massif'], paves:['paves','dalles','pierre'], dalles:['dalles','paves','pierre'], bois:['bois','pierre'], pierre:['pierre','paves','dalles'],
  eau:['eau','eau_naturelle'], eau_naturelle:['eau_naturelle','eau'],
  haie_dense:['haie_dense','haie_fine','haie_feuillu','haie_rouge','haie_sombre','conifere'],
  haie_fine:['haie_fine','haie_dense','haie_feuillu','haie_rouge','haie_sombre','conifere'],
  haie_feuillu:['haie_feuillu','haie_dense','haie_fine','haie_rouge','haie_sombre','conifere'],
  haie_rouge:['haie_rouge','haie_dense','haie_fine','haie_feuillu','haie_sombre'],
  haie_sombre:['haie_sombre','haie_dense','haie_fine','haie_feuillu','conifere'], conifere:['conifere','haie_sombre','haie_dense','haie_fine'],
  massif:['massif','fleurs','graminees','terre','ecorce'], fleurs:['fleurs','massif','graminees'], graminees:['graminees','massif','fleurs'], terre:['terre','ecorce','massif'],
  arbre:['arbre','arbre_fleuri','arbuste'], arbre_fleuri:['arbre_fleuri','arbre','fleurs'], arbuste:['arbuste','fleurs','massif'],
  metal:['metal'], maison:['maison','pierre','bois'], verre:['verre'], cloture:['cloture','bois','pierre'], copeaux:['copeaux','ecorce']
};
function defaultTextureOf(o,t){ return (t && t.texture) || ''; }
function effectiveTextureName(o,t){
  if(!o || !o.texture || o.texture === NO_TEXTURE) return '';
  return o.texture;
}
function compatibleTextureKeys(o,t){
  const base = defaultTextureOf(o,t);
  let keys = textureFamilies[base] || (base ? [base] : []);
  const label = ((o && o.name) || (t && t.label) || '').toLowerCase();
  const type = String((o && o.type) || (t && t.id) || '').toLowerCase();
  if(type==='pelouse' || label.includes('pelouse')) keys = ['pelouse','prairie'];
  if(type==='gravier' || label.includes('gravier')) keys = ['gravier','dolomie'];
  if(type==='eau' || type==='piscine' || label.includes('piscine') || label.includes('bassin') || label.includes('eau')) keys = ['eau','eau_naturelle'];
  return [...new Set(keys.filter(Boolean))];
}
function populateTextureSelectForSelection(){
  const texEl=document.getElementById('propTexture');
  if(!texEl) return;
  const arr=selectedObjects();
  if(!arr.length){ texEl.innerHTML='<option value="">Pas de texture</option>'; texEl.disabled=true; return; }
  texEl.disabled=false;
  const first=arr[0], t=getTool(first.type);
  let keys=compatibleTextureKeys(first,t);
  if(arr.length>1){
    const common = keys.filter(k => arr.every(o => compatibleTextureKeys(o,getTool(o.type)).includes(k)));
    keys = common.length ? common : [];
  }
  const current=arr.length===1 ? ((first.texture && first.texture !== NO_TEXTURE) ? first.texture : '') : (arr.every(o=>((o.texture && o.texture !== NO_TEXTURE) ? o.texture : '')===((first.texture && first.texture !== NO_TEXTURE) ? first.texture : '')) ? ((first.texture && first.texture !== NO_TEXTURE) ? first.texture : '') : '');
  texEl.innerHTML = [
    '<option value="">Pas de texture</option>',
    ...keys.map(k=>`<option value="${k}">${textureLabels[k]||k}</option>`)
  ].join('');
  texEl.value = current;
}

const textureImages={};
function loadTextureAssets(){
  Object.entries(textureAssetPaths).forEach(([name,path])=>{
    const img=new Image();
    img.onload=()=>{ textureImages[name]=img; draw(); };
    img.onerror=()=>{
      const fallback=textureFallbackPaths[name];
      if(fallback && fallback!==path){
        const fallbackImg=new Image();
        fallbackImg.onload=()=>{ textureImages[name]=fallbackImg; draw(); };
        fallbackImg.onerror=()=>console.warn('Texture introuvable', path, 'et secours introuvable', fallback);
        fallbackImg.src=fallback;
      } else {
        console.warn('Texture introuvable', path);
      }
    };
    img.src=path;
  });
}

activeTool = toolDefs[0];
const selectToolBtn = document.getElementById('selectToolBtn');
const printArea = document.getElementById('printArea');

function uid(){return 'obj_' + Date.now() + '_' + Math.floor(Math.random()*9999)}
function snap(v){return snapEnabled ? Math.round(v/snapGrid)*snapGrid : v}
function toM(px){return px/majorGrid}
function meters(n){return Math.round(n*100)/100}
function getTool(id){return toolDefs.find(t=>t.id===id) || libraryItems.find(t=>t.id===id) || toolDefs[0]}
function pos(evt){ const r=canvas.getBoundingClientRect(); return {x:snap(evt.clientX-r.left), y:snap(evt.clientY-r.top)}; }
function rawPos(evt){ const r=canvas.getBoundingClientRect(); return {x:evt.clientX-r.left, y:evt.clientY-r.top}; }
function lineSnapPoint(p, type){
  // Pour les haies/clôtures/bordures : si on clique très près d'une extrémité existante,
  // le nouveau tronçon s'y accroche automatiquement. Si on clique plus loin, il démarre séparément.
  const tolerance = Math.max(10, snapGrid * 0.65);
  let best = null;
  for (const o of objects) {
    if (o.type !== type || o.x1 === undefined) continue;
    for (const pt of [{x:o.x1,y:o.y1},{x:o.x2,y:o.y2}]) {
      const d = Math.hypot(p.x-pt.x, p.y-pt.y);
      if (d <= tolerance && (!best || d < best.d)) best = {x:pt.x, y:pt.y, d};
    }
  }
  return best ? {x:best.x, y:best.y} : p;
}
function clone(o){return JSON.parse(JSON.stringify(o))}
function stateSnapshot(){ return JSON.stringify({majorGrid,snapGrid,objects}); }
function pushHistory(){ historyStack.push(stateSnapshot()); if(historyStack.length>80) historyStack.shift(); redoStack=[]; }
function restoreSnapshot(str){ try{ const d=JSON.parse(str); majorGrid=d.majorGrid||25; snapGrid=d.snapGrid||25; objects=d.objects||[]; clearSelection(); setScaleSelect(); updateProps(); draw(); saveLocal(); }catch(e){console.warn(e)} }
function setSelection(ids){ selectedIds=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))]; selectedId=selectedIds[0]||null; }
function clearSelection(){ selectedIds=[]; selectedId=null; }
function isSelected(id){ return selectedIds.includes(id); }
function selectedObjects(){ return objects.filter(o=>selectedIds.includes(o.id)); }
function primarySelected(){ return objects.find(o=>o.id===selectedId) || selectedObjects()[0] || null; }
function cssColorToHex(c){ const d=document.createElement('div'); d.style.color=c; document.body.appendChild(d); const rgb=getComputedStyle(d).color.match(/\d+/g).map(Number); d.remove(); return (rgb[0]<<16)+(rgb[1]<<8)+rgb[2]; }

function initTools(){
  toolsEl.innerHTML='';
  if(selectToolBtn){
    selectToolBtn.className='tool main-select'+(activeTool.id==='select'?' active':'');
    selectToolBtn.onclick=()=>setActiveTool('select');
  }
  toolDefs.filter(t=>t.id!=='select' && !t.source).forEach(t=>{
    const b=document.createElement('button');
    b.className='tool'+(t.id===activeTool.id?' active':'');
    b.textContent=t.label;
    b.onclick=()=>setActiveTool(t.id);
    toolsEl.appendChild(b);
  });
  updateShapeSelect();
  renderLibrary();
}
function setActiveTool(id){
  activeTool={...getTool(id)};
  updateShapeSelect();
  if(activeTool.id!=='select'){
    if(activeTool.source==='library') activeTool.shape=libraryShapeFor(activeTool);
    else activeTool.shape=baseShapeFor(activeTool);
    activeTool.mode=modeForShape(activeTool, activeTool.shape);
    updateShapeSelect();
  }
  polyDraft=[]; drawing=null; dragging=null; resizing=null;
  hideContextMenu(); initTools(); draw();
}

function textureCss(name){
  const pair=texturePatterns[name]||['#777','#aaa'];
  return `repeating-linear-gradient(45deg, ${pair[0]} 0 4px, ${pair[1]} 4px 8px)`;
}
function renderLibrary(){
  const panel=document.getElementById('libraryPanel'); if(!panel) return;
  const q=(document.getElementById('librarySearch')?.value||'').toLowerCase().trim();
  const groups={};
  libraryItems.filter(i=>!q || (i.label+' '+i.category).toLowerCase().includes(q)).forEach(i=>{(groups[i.category] ||= []).push(i);});
  const activeCat=activeTool?.source==='library' ? activeTool.category : null;
  panel.innerHTML=Object.entries(groups).map(([cat,items])=>{
    const open = q || openLibraryCats.has(cat) || cat===activeCat;
    return `<details class="lib-category" data-cat="${cat}" ${open?'open':''}><summary>${cat}</summary><div class="lib-list">${items.map(i=>`<button class="lib-item ${activeTool?.id===i.id?'active':''}" data-lib="${i.id}"><span class="lib-swatch" style="--swatch:${i.color};--texture:${textureCss(i.texture)}"></span><span><span class="lib-name">${i.label}</span><span class="lib-meta">${(i.shapes||[]).map(v=>shapeLabels[v]||v).join(' · ')}</span></span></button>`).join('')}</div></details>`;
  }).join('') || '<p class="small">Aucun objet trouvé.</p>';
  panel.querySelectorAll('[data-lib]').forEach(b=>b.onclick=()=>setActiveTool(b.dataset.lib));
  panel.querySelectorAll('.lib-category').forEach(d=>d.addEventListener('toggle',()=>{ const cat=d.dataset.cat; if(d.open) openLibraryCats.add(cat); else openLibraryCats.delete(cat); }));
}
document.addEventListener('input', e=>{ if(e.target?.id==='librarySearch') renderLibrary(); });
document.addEventListener('change', e=>{
  if(e.target?.id==='baseShapeSelect'){ preferredBaseShape=e.target.value; if(activeTool && activeTool.id!=='select' && !activeTool.source) setActiveTool(activeTool.id); }
  if(e.target?.id==='shapeSelect'){ preferredLibraryShape=e.target.value; if(activeTool?.source==='library') setActiveTool(activeTool.id); }
});


canvas.addEventListener('mousedown', e=>{
  hideContextMenu();
  if(e.button!==0) return;
  const p=pos(e);
  if(activeTool.mode==='select'){
    const handle = selectedId ? handleHit(p.x,p.y, primarySelected()) : null;
    if(handle){ const ro=primarySelected(); if(ro?.locked) return; resizing={id:ro.id, handle, start:p, original:clone(ro)}; pushHistory(); return; }
    const clickedId = hitTest(p.x,p.y);
    if(e.ctrlKey && clickedId){
      if(isSelected(clickedId)) setSelection(selectedIds.filter(id=>id!==clickedId));
      else setSelection([...selectedIds, clickedId]);
      updateProps(); draw(); return;
    }
    if(clickedId){
      if(!isSelected(clickedId) && !e.ctrlKey) setSelection(clickedId);
      const mo=objects.find(o=>o.id===clickedId);
      if(!mo?.locked){ dragging={ids:[...selectedIds], start:p, originals:selectedObjects().map(clone)}; pushHistory(); canvas.style.cursor = DEFAULT_CURSOR; }
      updateProps(); draw(); return;
    }
    selectingRect={start:p, end:p, add:e.ctrlKey, remove:e.altKey};
    if(!e.ctrlKey && !e.altKey) clearSelection();
    updateProps(); draw(); return;
  }
  if(activeTool.mode==='point') { addObject({type:activeTool.id, shape:'point', x:p.x, y:p.y, r:majorGrid*.55}); return; }
  if(activeTool.mode==='poly' || activeTool.mode==='curve') { polyDraft.push(p); draw(); return; }
  const start = activeTool.mode==='line' ? lineSnapPoint(p, activeTool.id) : p;
  drawing={start, end:start};
});
canvas.addEventListener('mousemove', e=>{
  const p=pos(e);
  if(activeTool.mode==='select' && resizing){ resizeObject(resizing, p); draw(); return; }
  if(activeTool.mode==='select' && dragging){ moveSelection(dragging, p); draw(); return; }
  if(activeTool.mode==='select' && selectingRect){ selectingRect.end=p; draw(); drawSelectionRect(); return; }
  if(activeTool.mode==='select'){
    const h = selectedId ? handleHit(p.x,p.y, primarySelected()) : null;
    canvas.style.cursor = h ? 'nwse-resize' : DEFAULT_CURSOR;
    return;
  }
  if(drawing){ drawing.end=p; draw(); drawPreview(); }
});
canvas.addEventListener('mouseup', e=>{
  if(resizing){ resizing=null; saveLocal(); return; }
  if(dragging){ dragging=null; canvas.style.cursor = DEFAULT_CURSOR; saveLocal(); return; }
  if(selectingRect){ finishSelectionRect(); selectingRect=null; canvas.style.cursor = DEFAULT_CURSOR; updateProps(); draw(); return; }
  if(!drawing) return;
  drawing.end=pos(e);
  const s=drawing.start, en=drawing.end;
  if(Math.abs(en.x-s.x)<snapGrid && Math.abs(en.y-s.y)<snapGrid){drawing=null; draw(); return;}
  if(activeTool.mode==='line') {
    const end = lineSnapPoint(en, activeTool.id);
    addObject({type:activeTool.id, shape:'line', x1:s.x, y1:s.y, x2:end.x, y2:end.y});
  }
  if(activeTool.mode==='rect'){ let w=Math.abs(en.x-s.x), h=Math.abs(en.y-s.y); if(activeTool.shape==='square'){ const m=Math.max(w,h); w=h=m; } addObject({type:activeTool.id, shape:activeTool.shape||'rectangle', x:Math.min(s.x,en.x), y:Math.min(s.y,en.y), w, h}); }
  if(activeTool.mode==='ellipse'){ let w=Math.abs(en.x-s.x), h=Math.abs(en.y-s.y); if(activeTool.shape==='circle'){ const m=Math.max(w,h); w=h=m; } addObject({type:activeTool.id, shape:activeTool.shape||'ellipse', x:Math.min(s.x,en.x), y:Math.min(s.y,en.y), w, h}); }
  drawing=null; draw();
});
canvas.addEventListener('dblclick', e=>{
  const p=pos(e);
  if(activeTool.mode==='select'){
    const id=hitTest(p.x,p.y);
    if(id){ setSelection(id); updateProps(); draw(); const o=primarySelected(); if(o?.type==='texte'){ const txt=prompt('Modifier le texte', o.name||'Texte'); if(txt!==null){ pushHistory(); o.name=txt; draw(); saveLocal(); } } else openDimensionModal(); }
    return;
  }
  if(activeTool.mode==='poly' && polyDraft.length>=3){ addObject({type:activeTool.id, shape:activeTool.shape||'free', points:[...polyDraft]}); polyDraft=[]; draw(); }
  if(activeTool.mode==='curve' && polyDraft.length>=2){ addObject({type:activeTool.id, shape:'curve', open:true, points:[...polyDraft]}); polyDraft=[]; draw(); }
});
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const p=pos(e); const id=hitTest(p.x,p.y);
  if(id) setSelection(id);
  updateProps(); draw(); showContextMenu(e.clientX, e.clientY);
});
document.addEventListener('click', e=>{ if(!contextMenu.contains(e.target)) hideContextMenu(); });
contextMenu.addEventListener('click', e=>{
  const a=e.target.dataset.action; if(!a) return;
  if(a==='copy') copySelection();
  if(a==='paste') pasteSelection();
  if(a==='duplicate'){ copySelection(); pasteSelection(); }
  if(a==='dimensions') openDimensionModal();
  if(a==='front') bringFront();
  if(a==='back') sendBack();
  if(a==='lock') toggleLock();
  if(a==='delete') deleteSelection();
  hideContextMenu();
});
document.addEventListener('keydown', e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  const k=e.key.toLowerCase();
  if((e.key==='Delete'||e.key==='Backspace') && selectedIds.length){ e.preventDefault(); deleteSelection(); }
  if(e.ctrlKey && k==='c'){ e.preventDefault(); copySelection(); }
  if(e.ctrlKey && k==='x'){ e.preventDefault(); cutSelection(); }
  if(e.ctrlKey && k==='v'){ e.preventDefault(); pasteSelection(); }
  if(e.ctrlKey && k==='a'){ e.preventDefault(); setSelection(objects.map(o=>o.id)); updateProps(); draw(); }
  if(e.ctrlKey && k==='d'){ e.preventDefault(); duplicateSelection(); }
  if(e.ctrlKey && k==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
  if((e.ctrlKey && k==='y') || (e.ctrlKey && e.shiftKey && k==='z')){ e.preventDefault(); redo(); }
  if(e.ctrlKey && k==='s'){ e.preventDefault(); document.getElementById('btnSave').click(); }
  if(e.ctrlKey && k==='o'){ e.preventDefault(); document.getElementById('fileLoad').click(); }
  if(e.key==='Escape'){ e.preventDefault(); clearSelection(); drawing=null; polyDraft=[]; selectingRect=null; updateProps(); draw(); }
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(k) && selectedIds.length){
    e.preventDefault(); const step=e.shiftKey?majorGrid:snapGrid; const dx=k==='arrowleft'?-step:k==='arrowright'?step:0; const dy=k==='arrowup'?-step:k==='arrowdown'?step:0; pushHistory(); selectedObjects().forEach(o=>{ if(!o.locked) offsetObject(o,dx,dy); }); updateProps(); draw(); saveLocal();
  }
});

function showContextMenu(x,y){
  const wr=document.querySelector('.workspace').getBoundingClientRect();
  contextMenu.style.left=(x-wr.left+8)+'px'; contextMenu.style.top=(y-wr.top+8)+'px'; contextMenu.style.display='block';
}
function hideContextMenu(){contextMenu.style.display='none'}
function copySelection(){ const arr=selectedObjects(); if(arr.length) clipboard=arr.map(clone); }
function bringFront(){ if(!selectedIds.length) return; pushHistory(); const moved=objects.filter(o=>selectedIds.includes(o.id)); objects=objects.filter(o=>!selectedIds.includes(o.id)).concat(moved); draw(); saveLocal();}
function sendBack(){ if(!selectedIds.length) return; pushHistory(); const moved=objects.filter(o=>selectedIds.includes(o.id)); objects=moved.concat(objects.filter(o=>!selectedIds.includes(o.id))); draw(); saveLocal();}
function toggleLock(){ const arr=selectedObjects(); if(!arr.length) return; pushHistory(); const lockState=!arr.every(o=>o.locked); arr.forEach(o=>o.locked=lockState); updateProps(); draw(); saveLocal();}
function pasteSelection(){ if(!clipboard) return; pushHistory(); const arr=Array.isArray(clipboard)?clipboard:[clipboard]; const newIds=[]; arr.forEach(src=>{ const o=clone(src); o.id=uid(); offsetObject(o, majorGrid, majorGrid); objects.push(o); newIds.push(o.id); }); setSelection(newIds); updateProps(); draw(); saveLocal(); }
function cutSelection(){ if(!selectedIds.length) return; copySelection(); deleteSelection(); }
function duplicateSelection(){ copySelection(); pasteSelection(); }

function addObject(data){
  pushHistory();
  const t=getTool(data.type);
  const obj={id:uid(), name:t.label, height:t.h, price:0, rot:0, color:t.color, locked:false, texture:'', shape:t.shape||data.shape||'', libraryId:t.source==='library'?t.id:'', ...data};
  objects.push(obj);
  setSelection(obj.id);
  // On garde volontairement l'outil actif après création :
  // cela permet de tracer plusieurs haies, clôtures, arbres, massifs, etc. à la suite.
  initTools();
  updateProps();
  draw();
  saveLocal();
}
function deleteSelection(){ if(!selectedIds.length) return; const locked=selectedObjects().some(o=>o.locked); if(locked) return alert('Au moins un objet est verrouillé. Déverrouille-le avant suppression.'); pushHistory(); objects=objects.filter(o=>!selectedIds.includes(o.id)); clearSelection(); updateProps(); draw(); saveLocal(); }
function offsetObject(o,dx,dy){ if(o.x!==undefined){o.x+=dx;o.y+=dy;} if(o.x1!==undefined){o.x1+=dx;o.y1+=dy;o.x2+=dx;o.y2+=dy;} if(o.points){o.points=o.points.map(p=>({x:p.x+dx,y:p.y+dy}));} }
function moveObject(d,p){ const dx=p.x-d.start.x, dy=p.y-d.start.y; const o=objects.find(x=>x.id===d.id); Object.assign(o, clone(d.original)); offsetObject(o, dx, dy); }
function moveSelection(d,p){ const dx=p.x-d.start.x, dy=p.y-d.start.y; d.originals.forEach(orig=>{ const o=objects.find(x=>x.id===orig.id); if(o && !o.locked){ Object.assign(o, clone(orig)); offsetObject(o, dx, dy); } }); }
function resizeObject(r,p){ const o=objects.find(x=>x.id===r.id), b=r.original; if(!o) return;
  if(b.r){ const dist=Math.max(snapGrid, Math.hypot(p.x-b.x, p.y-b.y)); o.r=dist; return; }
  if(b.x1!==undefined){ if(r.handle==='a'){o.x1=p.x;o.y1=p.y;} else {o.x2=p.x;o.y2=p.y;} return; }
  if(b.points){ const c=centroid(b.points); const start=Math.max(1, Math.hypot(r.start.x-c.x,r.start.y-c.y)); const now=Math.max(.1, Math.hypot(p.x-c.x,p.y-c.y)); const f=now/start; o.points=b.points.map(pt=>({x:snap(c.x+(pt.x-c.x)*f), y:snap(c.y+(pt.y-c.y)*f)})); return; }
  let x=b.x, y=b.y, w=b.w, h=b.h;
  if(r.handle.includes('e')) w=Math.max(snapGrid, p.x-b.x);
  if(r.handle.includes('s')) h=Math.max(snapGrid, p.y-b.y);
  if(r.handle.includes('w')){ const right=b.x+b.w; x=Math.min(p.x,right-snapGrid); w=right-x; }
  if(r.handle.includes('n')){ const bottom=b.y+b.h; y=Math.min(p.y,bottom-snapGrid); h=bottom-y; }
  Object.assign(o,{x,y,w,h});
}

function hitTest(x,y){
  for(let i=objects.length-1;i>=0;i--){
    const o=objects[i];
    if(o.r && Math.hypot(x-o.x,y-o.y)<=o.r+8) return o.id;
    if(o.x1!==undefined && distLine(x,y,o.x1,o.y1,o.x2,o.y2)<10) return o.id;
    if(o.points && ((o.shape==='curve'||o.open) ? curveHit(x,y,o.points,12) : pointInPoly({x,y}, o.points))) return o.id;
    if(o.x!==undefined && o.w!==undefined && x>=o.x && x<=o.x+o.w && y>=o.y && y<=o.y+o.h) return o.id;
  }
  return null;
}
function handleHit(x,y,o){ if(!o) return null; return handles(o).find(h=>Math.abs(x-h.x)<=8 && Math.abs(y-h.y)<=8)?.key || null; }
function handles(o){
  if(!o) return [];
  if(o.r) return [{key:'r',x:o.x+o.r,y:o.y}];
  if(o.x1!==undefined) return [{key:'a',x:o.x1,y:o.y1},{key:'b',x:o.x2,y:o.y2}];
  if(o.points){ const c=centroid(o.points); const bb=polyBounds(o.points); return [{key:'scale', x:bb.maxX, y:bb.maxY}, {key:'scale2',x:bb.minX,y:bb.minY}, {key:'center',x:c.x,y:c.y}]; }
  if(o.x!==undefined) return [
    {key:'nw',x:o.x,y:o.y},{key:'n',x:o.x+o.w/2,y:o.y},{key:'ne',x:o.x+o.w,y:o.y},
    {key:'e',x:o.x+o.w,y:o.y+o.h/2},{key:'se',x:o.x+o.w,y:o.y+o.h},
    {key:'s',x:o.x+o.w/2,y:o.y+o.h},{key:'sw',x:o.x,y:o.y+o.h},{key:'w',x:o.x,y:o.y+o.h/2}
  ];
  return [];
}
function drawHandles(o){ ctx.save(); ctx.fillStyle='#ff7b00'; ctx.strokeStyle='white'; ctx.lineWidth=0.8; handles(o).forEach(h=>{ctx.beginPath();ctx.rect(h.x-3,h.y-3,6,6);ctx.fill();ctx.stroke();}); ctx.restore(); }
function drawSelectionBox(o){
  const pts=[];
  if(o.x1!==undefined) pts.push({x:o.x1,y:o.y1},{x:o.x2,y:o.y2});
  else if(o.points) pts.push(...o.points);
  else if(o.r) pts.push({x:o.x-o.r,y:o.y-o.r},{x:o.x+o.r,y:o.y+o.r});
  else if(o.x!==undefined) pts.push({x:o.x,y:o.y},{x:o.x+o.w,y:o.y+o.h});
  if(!pts.length) return;
  const b={minX:Math.min(...pts.map(p=>p.x)), minY:Math.min(...pts.map(p=>p.y)), maxX:Math.max(...pts.map(p=>p.x)), maxY:Math.max(...pts.map(p=>p.y))};
  ctx.save(); ctx.strokeStyle='#ff7b00'; ctx.lineWidth=0.8; ctx.setLineDash([5,4]); ctx.strokeRect(b.minX-4,b.minY-4,b.maxX-b.minX+8,b.maxY-b.minY+8); ctx.restore();
}
function distLine(px,py,x1,y1,x2,y2){const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1;const dot=A*C+B*D,len=C*C+D*D||1;let t=Math.max(0,Math.min(1,dot/len));return Math.hypot(px-(x1+t*C),py-(y1+t*D));}
function pointInPoly(p, pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){if(((pts[i].y>p.y)!=(pts[j].y>p.y))&&(p.x<(pts[j].x-pts[i].x)*(p.y-pts[i].y)/(pts[j].y-pts[i].y)+pts[i].x))c=!c;}return c;}


function objectBounds(o){
  const pts=[];
  if(!o) return null;
  if(o.x1!==undefined) pts.push({x:o.x1,y:o.y1},{x:o.x2,y:o.y2});
  else if(o.points) pts.push(...o.points);
  else if(o.r) pts.push({x:o.x-o.r,y:o.y-o.r},{x:o.x+o.r,y:o.y+o.r});
  else if(o.x!==undefined && o.w!==undefined) pts.push({x:o.x,y:o.y},{x:o.x+o.w,y:o.y+o.h});
  if(!pts.length) return null;
  return {
    minX:Math.min(...pts.map(p=>p.x)),
    minY:Math.min(...pts.map(p=>p.y)),
    maxX:Math.max(...pts.map(p=>p.x)),
    maxY:Math.max(...pts.map(p=>p.y))
  };
}
function normalizeRect(a,b){
  return {minX:Math.min(a.x,b.x), minY:Math.min(a.y,b.y), maxX:Math.max(a.x,b.x), maxY:Math.max(a.y,b.y)};
}
function rectContainsBounds(r,b){
  return b && b.minX>=r.minX && b.maxX<=r.maxX && b.minY>=r.minY && b.maxY<=r.maxY;
}
function rectIntersectsBounds(r,b){
  return b && !(b.maxX<r.minX || b.minX>r.maxX || b.maxY<r.minY || b.minY>r.maxY);
}
function drawSelectionRect(){
  if(!selectingRect) return;
  const r=normalizeRect(selectingRect.start, selectingRect.end);
  const leftToRight = selectingRect.end.x >= selectingRect.start.x;
  ctx.save();
  ctx.lineWidth=1;
  ctx.setLineDash(leftToRight ? [7,4] : [3,3]);
  ctx.strokeStyle=leftToRight ? 'rgba(40,95,190,.9)' : 'rgba(45,145,75,.9)';
  ctx.fillStyle=leftToRight ? 'rgba(40,95,190,.10)' : 'rgba(45,145,75,.12)';
  ctx.fillRect(r.minX,r.minY,r.maxX-r.minX,r.maxY-r.minY);
  ctx.strokeRect(r.minX,r.minY,r.maxX-r.minX,r.maxY-r.minY);
  ctx.restore();
}
function finishSelectionRect(){
  if(!selectingRect) return;
  const r=normalizeRect(selectingRect.start, selectingRect.end);
  const tiny = Math.abs(r.maxX-r.minX)<4 || Math.abs(r.maxY-r.minY)<4;
  if(tiny) return;
  const leftToRight = selectingRect.end.x >= selectingRect.start.x;
  const found = objects
    .filter(o=>{
      const b=objectBounds(o);
      return leftToRight ? rectContainsBounds(r,b) : rectIntersectsBounds(r,b);
    })
    .map(o=>o.id);
  if(selectingRect.remove){
    setSelection(selectedIds.filter(id=>!found.includes(id)));
  } else if(selectingRect.add){
    setSelection([...selectedIds, ...found]);
  } else {
    setSelection(found);
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height); drawGrid(); objects.forEach(drawObj);
  if(polyDraft.length){ctx.strokeStyle='#111';ctx.setLineDash([6,4]); if(activeTool?.mode==='curve') drawSmoothOpenPath(polyDraft, false); else {ctx.beginPath();polyDraft.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();} ctx.setLineDash([]);polyDraft.forEach(p=>dot(p.x,p.y)); if(showDims) activeTool?.mode==='curve' ? drawCurveDims(polyDraft) : drawPolyDims(polyDraft); }
  selectedObjects().forEach((so,i)=>{ if(i===0) drawHandles(so); else drawSelectionBox(so); });
  if(selectingRect) drawSelectionRect();
  updateSummary();
}
function drawGrid(){
  ctx.strokeStyle='#f5f8f3';ctx.lineWidth=0.25;
  for(let x=0;x<canvas.width;x+=snapGrid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=snapGrid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  ctx.strokeStyle='#d5e0d0';ctx.lineWidth=0.45;
  for(let x=0;x<canvas.width;x+=majorGrid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=majorGrid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  ctx.fillStyle='#839080';ctx.font='12px Arial';ctx.textAlign='left';ctx.fillText(`Échelle : ${majorGrid}px = 1 m | précision : ${meters(snapGrid/majorGrid)} m`, 12, canvas.height-14);
}
function patternFill(o, fallback){
  const t=getTool(o.type), tex=effectiveTextureName(o,t);
  if(tex && textureImages[tex]){
    try{ return ctx.createPattern(textureImages[tex], 'repeat') || fallback; }catch(e){}
  }
  if(!tex || !texturePatterns[tex]) return fallback;
  const [a,b]=texturePatterns[tex];
  const pc=document.createElement('canvas'); pc.width=12; pc.height=12;
  const g=pc.getContext('2d'); g.fillStyle=a; g.fillRect(0,0,12,12); g.fillStyle=b;
  if(['gravier','dolomie','ecorce','massif','prairie','fleurs'].includes(tex)){ for(let i=0;i<14;i++){g.beginPath();g.arc(Math.random()*12,Math.random()*12,Math.random()*1.8+.5,0,Math.PI*2);g.fill();} }
  else if(['paves','dalles'].includes(tex)){ g.strokeStyle=b; g.lineWidth=1; g.strokeRect(.5,.5,5,5); g.strokeRect(6.5,.5,5,5); g.strokeRect(.5,6.5,5,5); g.strokeRect(6.5,6.5,5,5); }
  else if(['bois'].includes(tex)){ g.strokeStyle=b; g.lineWidth=2; for(let x=1;x<12;x+=4){g.beginPath();g.moveTo(x,0);g.lineTo(x,12);g.stroke();} }
  else if(['eau','eau_naturelle'].includes(tex)){ g.strokeStyle=b; g.lineWidth=1.5; g.beginPath(); g.moveTo(0,8); g.quadraticCurveTo(3,4,6,8); g.quadraticCurveTo(9,12,12,8); g.stroke(); }
  else { g.fillStyle=b; g.fillRect(0,0,6,6); g.fillRect(6,6,6,6); }
  return ctx.createPattern(pc,'repeat') || fallback;
}
function drawRoundRect(x,y,w,h,r){
  r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawSmoothOpenPath(pts, doStroke=true){
  if(!pts || pts.length<2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if(pts.length===2){ ctx.lineTo(pts[1].x, pts[1].y); }
  else {
    for(let i=1;i<pts.length-1;i++){
      const xc=(pts[i].x+pts[i+1].x)/2;
      const yc=(pts[i].y+pts[i+1].y)/2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    const last=pts[pts.length-1];
    const prev=pts[pts.length-2];
    ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
  }
  if(doStroke) ctx.stroke(); else ctx.stroke();
}
function drawSmoothClosedPath(pts){
  if(!pts || pts.length<3) return;
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const n=pts.length;
  const start=mid(pts[n-1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start.x,start.y);
  for(let i=0;i<n;i++){
    const next=pts[(i+1)%n];
    const end=mid(pts[i], next);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, end.x, end.y);
  }
  ctx.closePath();
}
function curveLengthPx(pts){
  if(!pts || pts.length<2) return 0;
  let len=0;
  for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  return len;
}
function curveHit(x,y,pts,tol=10){
  if(!pts || pts.length<2) return false;
  for(let i=1;i<pts.length;i++) if(distLine(x,y,pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y)<tol) return true;
  return false;
}
function drawCurveDims(pts){
  if(!pts || pts.length<2) return;
  const mid=pts[Math.floor(pts.length/2)];
  dimText(`${meters(curveLengthPx(pts)/majorGrid)} m`, mid.x, mid.y-18, 0);
}
function drawObj(o){
  const t=getTool(o.type); const fill=o.color||t.color; ctx.lineWidth=isSelected(o.id)?1.0:0.35; ctx.strokeStyle=isSelected(o.id)?'#ff7b00':'#263328'; ctx.fillStyle=patternFill(o, fill);
  if(o.points){
    if(o.shape==='curve' || o.open){
      ctx.strokeStyle=isSelected(o.id)?'#ff7b00':patternFill(o, fill);
      ctx.lineWidth=(Number(o.widthM||t.widthM||0.25)*majorGrid)||2;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      drawSmoothOpenPath(o.points);
      ctx.lineWidth=0.35;
      label(o, centroid(o.points).x, centroid(o.points).y-8);
      if(showDims) drawCurveDims(o.points);
      return;
    }
    drawSmoothClosedPath(o.points);
    ctx.fill();
    ctx.stroke();
    label(o, centroid(o.points).x, centroid(o.points).y);
    if(showDims) drawPolyDims(o.points);
    return;
  }
  if(o.x1!==undefined){ctx.strokeStyle=isSelected(o.id)?'#ff7b00':fill;ctx.lineWidth=(String(o.type).includes('haie')||String(o.libraryId).includes('haie'))?1.2:(o.type==='cote'?0.75:0.85);ctx.beginPath();ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();if(o.type==='cote'){ drawLineDim({x:o.x1,y:o.y1},{x:o.x2,y:o.y2}); return; } label(o,(o.x1+o.x2)/2,(o.y1+o.y2)/2-8); if(showDims) drawLineDim({x:o.x1,y:o.y1},{x:o.x2,y:o.y2}); return;}
  if(o.r){ if(o.type==='texte'){ctx.fillStyle=fill;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(o.name||'Texte',o.x,o.y); return;} ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.stroke();label(o,o.x,o.y-o.r-8); if(showDims) drawCircleDim(o); return;}
  if(o.shape==='ellipse'||o.shape==='circle'||(!o.shape && (o.type==='eau'||o.type==='piscine'))){ctx.beginPath();ctx.ellipse(o.x+o.w/2,o.y+o.h/2,o.w/2,o.h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();label(o,o.x+o.w/2,o.y+o.h/2); if(showDims) drawEllipseDims(o); return;}
  if(o.shape==='rounded'){ drawRoundRect(o.x,o.y,o.w,o.h,Math.min(o.w,o.h)*.15); ctx.fill(); ctx.stroke(); label(o,o.x+o.w/2,o.y+o.h/2); if(showDims) drawRectDims(o); return; }
  ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeRect(o.x,o.y,o.w,o.h);label(o,o.x+o.w/2,o.y+o.h/2); if(showDims) drawRectDims(o);
}
function drawPreview(){ let x=Math.min(drawing.start.x,drawing.end.x), y=Math.min(drawing.start.y,drawing.end.y), w=Math.abs(drawing.end.x-drawing.start.x), h=Math.abs(drawing.end.y-drawing.start.y); if(activeTool.shape==='square'||activeTool.shape==='circle'){ const m=Math.max(w,h); w=h=m; } const o={id:'preview',type:activeTool.id,libraryId:activeTool.source==='library'?activeTool.id:'',shape:activeTool.shape||'',texture:'',color:activeTool.color,...(activeTool.mode==='line'?{x1:drawing.start.x,y1:drawing.start.y,x2:drawing.end.x,y2:drawing.end.y}:{x,y,w,h})}; ctx.globalAlpha=.45;drawObj(o);ctx.globalAlpha=1; }
function label(o,x,y){ctx.fillStyle='#172017';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(o.name||getTool(o.type).label,x,y);}
function dot(x,y){ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
function centroid(pts){return pts.reduce((a,p)=>({x:a.x+p.x/pts.length,y:a.y+p.y/pts.length}),{x:0,y:0});}
function polyBounds(pts){return pts.reduce((b,p)=>({minX:Math.min(b.minX,p.x),minY:Math.min(b.minY,p.y),maxX:Math.max(b.maxX,p.x),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});}
function dimText(txt,x,y,angle=0){
  ctx.save();
  ctx.translate(x,y);
  if(angle) ctx.rotate(angle);
  ctx.font='bold 10px Arial';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const w=ctx.measureText(txt).width+8;
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.fillRect(-w/2,-8,w,16);
  ctx.strokeStyle='rgba(30,45,35,.8)';
  ctx.lineWidth=.35;
  ctx.strokeRect(-w/2,-8,w,16);
  ctx.fillStyle='#111';
  ctx.fillText(txt,0,0);
  ctx.restore();
}
function drawTick(x,y,nx,ny){
  const s=6;
  ctx.beginPath();
  ctx.moveTo(x - ny*s - nx*s*.45, y + nx*s - ny*s*.45);
  ctx.lineTo(x + ny*s + nx*s*.45, y - nx*s + ny*s*.45);
  ctx.stroke();
}
function drawAlignedDimension(a,b,offset=18,labelOverride=null){
  const dx=b.x-a.x, dy=b.y-a.y;
  const lenPx=Math.hypot(dx,dy);
  if(lenPx < 2) return;
  const ux=dx/lenPx, uy=dy/lenPx;
  const nx=-uy, ny=ux;
  const ao={x:a.x+nx*offset, y:a.y+ny*offset};
  const bo={x:b.x+nx*offset, y:b.y+ny*offset};
  const ext=6;
  ctx.save();
  ctx.strokeStyle='rgba(25,35,30,.9)';
  ctx.fillStyle='rgba(25,35,30,.9)';
  ctx.lineWidth=.55;
  ctx.setLineDash([]);
  // lignes d'attache
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(a.x+nx*(offset+Math.sign(offset)*ext), a.y+ny*(offset+Math.sign(offset)*ext));
  ctx.moveTo(b.x, b.y); ctx.lineTo(b.x+nx*(offset+Math.sign(offset)*ext), b.y+ny*(offset+Math.sign(offset)*ext));
  ctx.stroke();
  // ligne de cote
  ctx.beginPath();
  ctx.moveTo(ao.x,ao.y); ctx.lineTo(bo.x,bo.y);
  ctx.stroke();
  drawTick(ao.x,ao.y,nx,ny);
  drawTick(bo.x,bo.y,nx,ny);
  const txt=labelOverride || `${meters(lenPx/majorGrid)} m`;
  const angle = Math.abs(Math.atan2(dy,dx)) > Math.PI/2 ? Math.atan2(dy,dx)+Math.PI : Math.atan2(dy,dx);
  dimText(txt, (ao.x+bo.x)/2, (ao.y+bo.y)/2 - 10*Math.sign(offset||1), angle);
  ctx.restore();
}
function drawLineDim(a,b){
  drawAlignedDimension(a,b,18);
}
function drawRectDims(o){
  // vraies cotes : lignes de cote extérieures + lignes d'attache
  drawAlignedDimension({x:o.x,y:o.y},{x:o.x+o.w,y:o.y},-18);
  drawAlignedDimension({x:o.x+o.w,y:o.y},{x:o.x+o.w,y:o.y+o.h},18);
}
function drawEllipseDims(o){
  const cx=o.x+o.w/2, cy=o.y+o.h/2;
  drawAlignedDimension({x:o.x,y:cy},{x:o.x+o.w,y:cy},-(o.h/2+20), `${meters(o.w/majorGrid)} m`);
  drawAlignedDimension({x:cx,y:o.y},{x:cx,y:o.y+o.h},(o.w/2+20), `${meters(o.h/majorGrid)} m`);
}
function drawCircleDim(o){
  drawAlignedDimension({x:o.x-o.r,y:o.y},{x:o.x+o.r,y:o.y},o.r+18, `Ø ${meters((o.r*2)/majorGrid)} m`);
}
function drawPolyDims(pts){
  for(let i=1;i<pts.length;i++) drawAlignedDimension(pts[i-1],pts[i],16);
  if(pts.length>2) drawAlignedDimension(pts[pts.length-1],pts[0],16);
}

function measure(o){
  if(o.x1!==undefined) return meters(Math.hypot(o.x2-o.x1,o.y2-o.y1)/majorGrid);
  if(o.r) return 1;
  if(o.points){ if(o.shape==='curve'||o.open) return meters(curveLengthPx(o.points)/majorGrid); let area=0; const pts=o.points; for(let i=0,j=pts.length-1;i<pts.length;j=i++) area+=(pts[j].x+pts[i].x)*(pts[j].y-pts[i].y); return meters(Math.abs(area/2)/(majorGrid*majorGrid));}
  if(o.type==='eau') return meters(Math.PI*(o.w/2)*(o.h/2)/(majorGrid*majorGrid));
  return meters((o.w*o.h)/(majorGrid*majorGrid));
}
function updateSummary(){
  const groups={};
  objects.forEach(o=>{const t=getTool(o.type), m=measure(o); if(!groups[o.type]) groups[o.type]={name:t.label,unit:t.unit,qty:0}; groups[o.type].qty+=m;});
  summaryEl.innerHTML = Object.values(groups).map(g=>`<div><b>${g.name}</b> : ${meters(g.qty)} ${g.unit}</div>`).join('') || '<em>Aucun élément sur le plan.</em>';
}
function getObjCenter(o){ if(!o) return {x:0,y:0}; if(o.x1!==undefined) return {x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2}; if(o.r) return {x:o.x,y:o.y}; if(o.points) return centroid(o.points); return {x:o.x+o.w/2,y:o.y+o.h/2}; }
function updateProps(){
  const o=primarySelected();
  const arr=selectedObjects();
  const info=document.getElementById('selectedInfo');
  ['propName','propHeight','propX','propY','propW','propD','propRot'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  populateTextureSelectForSelection();
  if(!o){ if(info) info.textContent='Aucun objet sélectionné'; populateTextureSelectForSelection(); return; }
  if(arr.length>1){
    if(info) info.textContent=`${arr.length} objets sélectionnés`;
    const sameColor=arr.every(x=>(x.color||getTool(x.type).color)===(arr[0].color||getTool(arr[0].type).color));
    const sameHeight=arr.every(x=>(x.height??getTool(x.type).h)===(arr[0].height??getTool(arr[0].type).h));
    const sameRot=arr.every(x=>(x.rot||0)===(arr[0].rot||0));
    const sameTexture=arr.every(x=>(x.texture||getTool(x.type).texture||'')===(arr[0].texture||getTool(arr[0].type).texture||''));
    populateTextureSelectForSelection();
    const texEl=document.getElementById('propTexture');
    if(texEl) texEl.value=sameTexture ? (arr[0].texture||'') : '';
    document.getElementById('propHeight').value=sameHeight ? (arr[0].height??getTool(arr[0].type).h??0) : '';
    document.getElementById('propRot').value=sameRot ? (arr[0].rot||0) : '';
    document.getElementById('propColor').value=sameColor ? (arr[0].color||getTool(arr[0].type).color) : '#7fcf63';
    return;
  }
  const t=getTool(o.type), c=getObjCenter(o), size=getObjectSizeMeters(o);
  if(info) info.textContent=(o.locked?'🔒 ':'')+(o.name||t.label);
  document.getElementById('propName').value=o.name||'';
  document.getElementById('propHeight').value=o.height??'';
  document.getElementById('propX').value=meters(c.x/majorGrid);
  document.getElementById('propY').value=meters(c.y/majorGrid);
  document.getElementById('propW').value=size.width??size.length??'';
  document.getElementById('propD').value=size.depth??size.diameter??'';
  document.getElementById('propRot').value=o.rot||0;
  document.getElementById('propColor').value=o.color||t.color;
  populateTextureSelectForSelection();
  const texEl=document.getElementById('propTexture');
  if(texEl) texEl.value=o.texture||'';
}




function getObjectSizeMeters(o){
  if(!o) return {};
  if(o.x1!==undefined) return {length: meters(Math.hypot(o.x2-o.x1,o.y2-o.y1)/majorGrid)};
  if(o.r) return {diameter: meters((o.r*2)/majorGrid)};
  if(o.points){ const b=polyBounds(o.points); return {width: meters((b.maxX-b.minX)/majorGrid), depth: meters((b.maxY-b.minY)/majorGrid)}; }
  return {width: meters(o.w/majorGrid), depth: meters(o.h/majorGrid)};
}
function setObjectSizeMeters(o, vals){
  if(!o) return;
  if(o.x1!==undefined){
    const current=Math.hypot(o.x2-o.x1,o.y2-o.y1)||1;
    const target=Math.max(0.01, Number(vals.length)||current/majorGrid)*majorGrid;
    const f=target/current; o.x2=snap(o.x1+(o.x2-o.x1)*f); o.y2=snap(o.y1+(o.y2-o.y1)*f); return;
  }
  if(o.r){ o.r=Math.max(snapGrid, (Number(vals.diameter)||((o.r*2)/majorGrid))*majorGrid/2); return; }
  if(o.points){
    const b=polyBounds(o.points), w=(b.maxX-b.minX)||1, h=(b.maxY-b.minY)||1;
    const tw=Math.max(0.01, Number(vals.width)||w/majorGrid)*majorGrid;
    const th=Math.max(0.01, Number(vals.depth)||h/majorGrid)*majorGrid;
    const fx=tw/w, fy=th/h;
    o.points=o.points.map(pt=>({x:snap(b.minX+(pt.x-b.minX)*fx), y:snap(b.minY+(pt.y-b.minY)*fy)})); return;
  }
  o.w=Math.max(snapGrid, (Number(vals.width)||o.w/majorGrid)*majorGrid);
  o.h=Math.max(snapGrid, (Number(vals.depth)||o.h/majorGrid)*majorGrid);
}
function openDimensionModal(){
  const o=primarySelected(); if(!o || selectedIds.length>1) return alert('Sélectionne un seul objet pour modifier ses dimensions précises.');
  const modal=document.getElementById('dimensionModal'), fields=document.getElementById('dimFields'), help=document.getElementById('dimHelp');
  const t=getTool(o.type), size=getObjectSizeMeters(o);
  help.textContent=`Objet : ${o.name||t.label}. Les valeurs sont en mètres.`;
  const rows=[];
  if('width' in size) rows.push(['width','Largeur (m)',size.width]);
  if('depth' in size) rows.push(['depth','Profondeur / hauteur plan (m)',size.depth]);
  if('length' in size) rows.push(['length','Longueur (m)',size.length]);
  if('diameter' in size) rows.push(['diameter','Diamètre (m)',size.diameter]);
  rows.push(['height3d','Hauteur 3D (m)', meters(o.height ?? t.h ?? 0)]);
  fields.innerHTML=rows.map(([id,label,val])=>`<div class="dim-row"><label for="dim_${id}">${label}</label><input id="dim_${id}" data-dim="${id}" type="number" step="0.01" value="${val}"></div>`).join('');
  modal.style.display='flex'; hideContextMenu();
}
function closeDimensionModal(){ document.getElementById('dimensionModal').style.display='none'; }
function applyDimensionModal(){
  const o=primarySelected(); if(!o) return closeDimensionModal();
  pushHistory();
  const vals={}; document.querySelectorAll('#dimFields input').forEach(i=>vals[i.dataset.dim]=i.value);
  setObjectSizeMeters(o, vals); if(vals.height3d!==undefined) o.height=Number(vals.height3d)||0;
  updateProps(); draw(); saveLocal(); closeDimensionModal();
}
document.getElementById('btnDimCancel').onclick=closeDimensionModal;
document.getElementById('btnDimApply').onclick=applyDimensionModal;
document.getElementById('dimensionModal').addEventListener('click', e=>{ if(e.target.id==='dimensionModal') closeDimensionModal(); });



const propTextureLive=document.getElementById('propTexture');
if(propTextureLive){
  propTextureLive.addEventListener('change',()=>{
    const arr=selectedObjects();
    if(!arr.length) return;
    pushHistory();
    const tex=propTextureLive.value;
    arr.forEach(o=>{
      if(o.locked) return;
      if(tex==='') delete o.texture;
      else o.texture=tex;
    });
    draw(); saveLocal(); if(currentView!=='2d') build3D(); updateProps();
  });
}

const propColorLive=document.getElementById('propColor');
if(propColorLive){
  propColorLive.addEventListener('input',()=>{
    const arr=selectedObjects();
    if(!arr.length) return;
    const color=propColorLive.value;
    arr.forEach(o=>{ if(!o.locked) o.color=color; });
    draw();
    if(currentView!=='2d') build3D();
  });
  propColorLive.addEventListener('change',()=>saveLocal());
}

document.getElementById('btnApplyProps').onclick=()=>{
  const arr=selectedObjects(); if(!arr.length) return;
  pushHistory();
  if(arr.length>1){
    const h=document.getElementById('propHeight').value, r=document.getElementById('propRot').value, c=document.getElementById('propColor').value;
    const texEl=document.getElementById('propTexture'), tex=texEl ? texEl.value : '';
    arr.forEach(o=>{ if(!o.locked){ if(h!=='') o.height=+h||0; if(r!=='') o.rot=+r||0; if(c) o.color=c; if(texEl){ if(tex==='') delete o.texture; else o.texture=tex; } } });
    updateProps(); draw(); saveLocal(); if(currentView!=='2d') build3D(); return;
  }
  const o=arr[0];
  o.name=document.getElementById('propName').value||getTool(o.type).label; o.height=+document.getElementById('propHeight').value||0; o.rot=+document.getElementById('propRot').value||0; o.color=document.getElementById('propColor').value;
  const texEl=document.getElementById('propTexture'); if(texEl){ if(texEl.value==='') delete o.texture; else o.texture=texEl.value; }
  setObjectSizeMeters(o,{width:document.getElementById('propW').value, depth:document.getElementById('propD').value, length:document.getElementById('propW').value, diameter:document.getElementById('propD').value}); draw(); saveLocal(); if(currentView!=='2d') build3D();};
document.getElementById('btnPreciseRight').onclick=openDimensionModal;
document.getElementById('snapToggle').onchange=e=>{snapEnabled=e.target.checked;};
document.getElementById('btnUndo').onclick=undo;
document.getElementById('btnRedo').onclick=redo;
function undo(){ if(!historyStack.length) return; redoStack.push(stateSnapshot()); restoreSnapshot(historyStack.pop()); }
function redo(){ if(!redoStack.length) return; historyStack.push(stateSnapshot()); restoreSnapshot(redoStack.pop()); }
document.getElementById('showDims').onchange=e=>{showDims=e.target.checked; draw();};
document.getElementById('scaleSelect').onchange=e=>{const [maj,snapv]=e.target.value.split('|').map(Number); majorGrid=maj; snapGrid=snapv; draw(); saveLocal();};
document.getElementById('btnClear').onclick=()=>{if(confirm('Créer un nouveau plan ?')){pushHistory(); objects=[];clearSelection();draw();saveLocal();}};
document.getElementById('btnSave').onclick=()=>download('bastplan-paysage.json', JSON.stringify({version:14, majorGrid, snapGrid, objects}, null, 2));
document.getElementById('fileLoad').onchange=e=>{const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{const data=JSON.parse(r.result); objects=data.objects||[]; majorGrid=data.majorGrid||data.grid||25; snapGrid=data.snapGrid||majorGrid; clearSelection(); setScaleSelect(); draw(); saveLocal();}; r.readAsText(f);};
document.getElementById('btnExport').onclick=exportPNG;
function exportPNG(){
  draw();
  const out=document.createElement('canvas'); out.width=canvas.width; out.height=canvas.height;
  const g=out.getContext('2d'); g.fillStyle='#ffffff'; g.fillRect(0,0,out.width,out.height); g.drawImage(canvas,0,0);
  if(out.toBlob){ out.toBlob(b=>{ if(b) downloadBlob('plan-paysage.png',b); else downloadDataUrl('plan-paysage.png', out.toDataURL('image/png')); }, 'image/png'); }
  else downloadDataUrl('plan-paysage.png', out.toDataURL('image/png'));
}
function downloadDataUrl(name,url){ const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
document.getElementById('btnPrint').onclick=()=>openPrintModal();
document.getElementById('btnPrintCancel').onclick=()=>closePrintModal();
document.getElementById('printModal').addEventListener('click', e=>{ if(e.target.id==='printModal') closePrintModal(); });
document.getElementById('btnPrint2D').onclick=()=>preparePrint('2d');
document.getElementById('btnPrint3D').onclick=()=>preparePrint('3d');
document.getElementById('btnPrintBoth').onclick=()=>preparePrint('both');
function openPrintModal(){ document.getElementById('printModal').style.display='flex'; }
function closePrintModal(){ document.getElementById('printModal').style.display='none'; }
function setPrintPage(){
  const [paper,orient]=document.getElementById('paperSelect').value.split(' ');
  let st=document.getElementById('printPageStyle');
  if(!st){st=document.createElement('style');st.id='printPageStyle';document.head.appendChild(st);}
  st.textContent=`@page{size:${paper.toUpperCase()} ${orient}; margin:8mm;}`;
}
function cropCanvasToObjects(source){
  const b=bounds();
  const pad=majorGrid*1.2;
  const sx=Math.max(0,b.minX-pad), sy=Math.max(0,b.minY-pad);
  const sw=Math.min(source.width-sx, Math.max(100,b.maxX-b.minX+pad*2));
  const sh=Math.min(source.height-sy, Math.max(100,b.maxY-b.minY+pad*2));
  const out=document.createElement('canvas'); out.width=sw; out.height=sh;
  out.getContext('2d').drawImage(source,sx,sy,sw,sh,0,0,sw,sh);
  return out.toDataURL('image/png');
}
function get3DImage(){
  build3D();
  const c=view3d.querySelector('canvas');
  try{return c ? c.toDataURL('image/png') : '';}catch(e){return '';}
}
function preparePrint(kind){
  setPrintPage(); closePrintModal();
  const previousView=currentView;
  const planUrl=cropCanvasToObjects(canvas);
  const threeUrl=(kind==='3d'||kind==='both') ? get3DImage() : '';
  printArea.innerHTML='';
  if(kind==='2d'||kind==='both') printArea.insertAdjacentHTML('beforeend', `<section class="print-page"><h1>Plan 2D</h1><img src="${planUrl}" /></section>`);
  if(kind==='3d'||kind==='both') printArea.insertAdjacentHTML('beforeend', `<section class="print-page"><h1>Vue 3D</h1>${threeUrl?`<img src="${threeUrl}" />`:'<p>La vue 3D n’a pas pu être générée.</p>'}</section>`);
  setTimeout(()=>{ window.print(); setView(previousView); },150);
}

function download(name,text){downloadBlob(name,new Blob([text],{type:'application/json'}));}
function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);a.remove();}
function saveLocal(){localStorage.setItem('bastplan_paysage', JSON.stringify({majorGrid,snapGrid,objects})); if(currentView==='split') build3D();}
function loadLocal(){try{const d=JSON.parse(localStorage.getItem('bastplan_paysage')||'{}'); objects=d.objects||[]; majorGrid=d.majorGrid||d.grid||25; snapGrid=d.snapGrid||majorGrid;}catch{objects=[]}}
function setScaleSelect(){ const v=`${majorGrid}|${snapGrid}`; const s=document.getElementById('scaleSelect'); if([...s.options].some(o=>o.value===v)) s.value=v; }

function setView(v){ currentView=v; canvas.style.display=(v==='3d')?'none':'block'; view3d.style.display=(v==='2d')?'none':'block'; view3d.classList.toggle('split3d', v==='split'); ['btn2d','btn3d','btnSplit'].forEach(id=>document.getElementById(id).classList.remove('active')); document.getElementById(v==='2d'?'btn2d':v==='3d'?'btn3d':'btnSplit').classList.add('active'); if(v!=='2d') build3D(); }
document.getElementById('btn2d').onclick=()=>setView('2d');
document.getElementById('btn3d').onclick=()=>setView('3d');
document.getElementById('btnSplit').onclick=()=>setView('split');

function bounds(){ if(!objects.length) return {minX:0,minY:0,maxX:canvas.width,maxY:canvas.height}; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; objects.forEach(o=>{ const pts=[]; if(o.x1!==undefined) pts.push({x:o.x1,y:o.y1},{x:o.x2,y:o.y2}); else if(o.points) pts.push(...o.points); else if(o.r) pts.push({x:o.x-o.r,y:o.y-o.r},{x:o.x+o.r,y:o.y+o.r}); else pts.push({x:o.x,y:o.y},{x:o.x+o.w,y:o.y+o.h}); pts.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}); }); return {minX,minY,maxX,maxY}; }
function worldX(x,b){ return (x-(b.minX+b.maxX)/2)/majorGrid; }
function worldZ(y,b){ return (y-(b.minY+b.maxY)/2)/majorGrid; }
function build3D(){ if(window.THREE){ try{ buildThree3D(); return; }catch(err){ console.warn('Fallback 3D canvas',err); } } buildCanvas3D(); }
const threeTextureCache={};
function loadThreeTexture(path, repeat=2){
  if(!window.THREE || !path) return null;
  if(threeTextureCache[path]) return threeTextureCache[path];
  const loader=new THREE.TextureLoader();
  const tex=loader.load(path, () => {
    tex.needsUpdate = true;
    if(threeRenderer && currentView !== '2d') {
      try { threeRenderer.render?.(threeRenderer.__scene, threeRenderer.__camera); } catch(e) {}
    }
  }, undefined, () => console.warn('Texture 3D introuvable :', path));
  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if(THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  threeTextureCache[path]=tex;
  return tex;
}
function materialForObject3D(o,t){
  const texName=effectiveTextureName(o,t);
  const baseColor=cssColorToHex(o.color||t.color||'#999999');

  // En 3D on garde toujours la couleur de base.
  // Avant : texture = color:0xffffff, ce qui pouvait donner un rendu noir si la texture chargeait mal.
  if(!texName){
    return new THREE.MeshLambertMaterial({color:baseColor, side:THREE.DoubleSide});
  }

  const pbr=texturePBRPaths[texName];
  const colorPath = pbr?.color || textureAssetPaths[texName] || textureFallbackPaths[texName];
  const colorMap = colorPath ? loadThreeTexture(colorPath, texName==='pelouse'?8:3) : null;

  if(colorMap){
    return new THREE.MeshLambertMaterial({
      color:baseColor,
      map:colorMap,
      side:THREE.DoubleSide
    });
  }

  return new THREE.MeshLambertMaterial({color:baseColor, side:THREE.DoubleSide});
}
function buildThree3D(){
  view3d.innerHTML=''; if(threeRenderer) threeRenderer.dispose(); const w=view3d.clientWidth||900,h=view3d.clientHeight||600,b=bounds();
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0xd7e4d2);
  const camera=new THREE.PerspectiveCamera(55,w/h,.1,1000); camera.position.set(12,14,18); camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(w,h); if(THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace; view3d.appendChild(renderer.domElement); threeRenderer=renderer;
  renderer.__scene=scene; renderer.__camera=camera;
  scene.add(new THREE.HemisphereLight(0xffffff,0x63705d,2.4)); const sun=new THREE.DirectionalLight(0xffffff,1.8); sun.position.set(15,25,10); scene.add(sun);
  const baseMaterial = new THREE.MeshLambertMaterial({color:0x9fc28c, side:THREE.DoubleSide});
  const base=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(30,(b.maxX-b.minX)/majorGrid+10), Math.max(20,(b.maxY-b.minY)/majorGrid+10)), baseMaterial); base.rotation.x=-Math.PI/2; scene.add(base);
  objects.forEach(o=>add3D(scene,o,b));
  let rot=0; function animate(){rot+=0.002; camera.position.x=Math.sin(rot)*22; camera.position.z=Math.cos(rot)*22; camera.lookAt(0,0,0); requestAnimationFrame(animate); renderer.render(scene,camera)} animate();
}
function heightOf(o,t, minimum=0){
  const raw = (o.height !== undefined && o.height !== null && o.height !== '') ? Number(o.height) : Number(t.h ?? 0);
  return Number.isFinite(raw) ? raw : minimum;
}
function geomHeight(value, minimum=.02){ return Math.max(minimum, Math.abs(Number(value)||0)); }
function geomY(value){ const h=geomHeight(value,.02); return value>=0 ? h/2 : -h/2; }
function isWaterLike(o){
  const id=String(o.libraryId||'').toLowerCase(), type=String(o.type||'').toLowerCase(), name=String(o.name||'').toLowerCase();
  return type==='eau'||type==='piscine'||id.includes('piscine')||id.includes('plan_eau')||id.includes('bassin')||id.includes('jacuzzi')||name.includes('piscine')||name.includes('eau')||name.includes('bassin')||name.includes('jacuzzi');
}
function sampleOpenSmoothPoints(points, samplesPerSegment=8){
  const pts=(points||[]).filter(Boolean);
  if(pts.length<2) return pts;
  if(pts.length===2) return pts.map(p=>({x:p.x,y:p.y}));
  const out=[{x:pts[0].x,y:pts[0].y}];
  for(let i=1;i<pts.length-1;i++){
    const p0=out[out.length-1];
    const cp=pts[i];
    const next=pts[i+1];
    const end={x:(cp.x+next.x)/2,y:(cp.y+next.y)/2};
    for(let s=1;s<=samplesPerSegment;s++){
      const t=s/samplesPerSegment, mt=1-t;
      out.push({x:mt*mt*p0.x+2*mt*t*cp.x+t*t*end.x, y:mt*mt*p0.y+2*mt*t*cp.y+t*t*end.y});
    }
  }
  const prev=pts[pts.length-2], last=pts[pts.length-1], p0=out[out.length-1];
  for(let s=1;s<=samplesPerSegment;s++){
    const t=s/samplesPerSegment, mt=1-t;
    out.push({x:mt*mt*p0.x+2*mt*t*prev.x+t*t*last.x, y:mt*mt*p0.y+2*mt*t*prev.y+t*t*last.y});
  }
  return out;
}
function sampleClosedSmoothPoints(points, samplesPerCorner=8){
  const pts=(points||[]).filter(Boolean);
  if(pts.length<3) return pts;
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const out=[];
  const n=pts.length;
  let start=mid(pts[n-1], pts[0]);
  for(let i=0;i<n;i++){
    const cp=pts[i];
    const end=mid(pts[i], pts[(i+1)%n]);
    for(let s=0;s<samplesPerCorner;s++){
      const t=s/samplesPerCorner, mt=1-t;
      out.push({x:mt*mt*start.x+2*mt*t*cp.x+t*t*end.x, y:mt*mt*start.y+2*mt*t*cp.y+t*t*end.y});
    }
    start=end;
  }
  return out;
}
function cleanPolyPoints(points){
  const pts=(points||[]).filter(Boolean);
  const out=[];
  for(const p of pts){
    const last=out[out.length-1];
    if(!last || Math.hypot(p.x-last.x,p.y-last.y)>0.01) out.push({x:p.x,y:p.y});
  }
  if(out.length>2 && Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y)<0.01) out.pop();
  return out;
}
function makeFlatShapeGeometryFromPoints(points,b){
  const pts=cleanPolyPoints(sampleClosedSmoothPoints(points, 6));
  if(!window.THREE || pts.length<3) return null;
  const shape=new THREE.Shape();
  shape.moveTo(worldX(pts[0].x,b), worldZ(pts[0].y,b));
  for(let i=1;i<pts.length;i++) shape.lineTo(worldX(pts[i].x,b), worldZ(pts[i].y,b));
  shape.closePath();
  const geo=new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI/2);
  geo.computeVertexNormals();
  return geo;
}

function makeCurveRibbon3D(points,b,y,width){
  const pts=sampleOpenSmoothPoints(points, 7);
  if(!window.THREE || pts.length<2) return null;
  const half=Math.max(0.03, width/2);
  const positions=[], uvs=[], indices=[];
  let distance=0;
  for(let i=0;i<pts.length;i++){
    const p=pts[i];
    const prev=pts[Math.max(0,i-1)], next=pts[Math.min(pts.length-1,i+1)];
    const dx=next.x-prev.x, dy=next.y-prev.y;
    const l=Math.hypot(dx,dy)||1;
    const nx=-dy/l, ny=dx/l;
    if(i>0) distance += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y)/majorGrid;
    positions.push(worldX(p.x+nx*half*majorGrid,b), y, worldZ(p.y+ny*half*majorGrid,b));
    positions.push(worldX(p.x-nx*half*majorGrid,b), y, worldZ(p.y-ny*half*majorGrid,b));
    uvs.push(distance, 1, distance, 0);
    if(i<pts.length-1){
      const a=i*2, c=a+2;
      indices.push(a,a+1,c, a+1,c+1,c);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return {geometry:geo};
}

function makeCurve3D(points,b,y,thickness){
  return makeCurveRibbon3D(points,b,Math.max(0.035,y),Math.max(0.06, thickness));
}

function add3D(scene,o,b){
  const t=getTool(o.type), mat=materialForObject3D(o,t);
  const hv=heightOf(o,t,0);
  const water=isWaterLike(o);
  const h=water ? Math.max(0.035, Math.min(0.10, geomHeight(hv,.02))) : geomHeight(hv,.02);
  const y=water ? 0.035 : geomY(hv);

  if(o.x1!==undefined){
    const len=Math.max(.05, Math.hypot(o.x2-o.x1,o.y2-o.y1)/majorGrid);
    const thickness = Math.max(.06, Number(o.widthM||t.widthM||0.25));
    const geo=new THREE.BoxGeometry(len,h,thickness);
    const m=new THREE.Mesh(geo,mat);
    m.position.set((worldX(o.x1,b)+worldX(o.x2,b))/2,y,(worldZ(o.y1,b)+worldZ(o.y2,b))/2);
    m.rotation.y=-Math.atan2(o.y2-o.y1,o.x2-o.x1);
    scene.add(m); return;
  }

  if(o.r){
    let geo=o.type==='arbre'||String(o.libraryId).includes('arbre') ? new THREE.ConeGeometry(Math.max(.35,o.r/majorGrid),h,18) : new THREE.CylinderGeometry(Math.max(.25,o.r/majorGrid*.7),Math.max(.3,o.r/majorGrid),h,24);
    if(o.type==='bbq'||String(o.libraryId).includes('bbq')) geo=new THREE.BoxGeometry(Math.max(.4,o.r/majorGrid*1.4),h,Math.max(.4,o.r/majorGrid*1.4));
    const m=new THREE.Mesh(geo,mat); m.position.set(worldX(o.x,b),y,worldZ(o.y,b)); scene.add(m); return;
  }

  if(o.points){
    if(o.shape==='curve'||o.open){
      const thickness=Math.max(.06, Number(o.widthM||t.widthM||0.25));
      const made=makeCurve3D(o.points,b,y,thickness);
      if(made){
        const m=new THREE.Mesh(made.geometry,mat);
        if(made.position) m.position.copy(made.position);
        if(made.rotationY!==undefined) m.rotation.y=made.rotationY;
        scene.add(m);
      }
      return;
    }

    // Forme libre fermée : vraie surface 3D, pas gros carré noir.
    const geo=makeFlatShapeGeometryFromPoints(o.points,b);
    if(geo){
      const m=new THREE.Mesh(geo,mat);
      m.position.y = water ? 0.035 : Math.max(0.025, h/2);
      scene.add(m);
      return;
    }

    const c=centroid(o.points), area=measure(o), side=Math.sqrt(Math.max(.2,area));
    const geoFallback=new THREE.BoxGeometry(side, h, side);
    const m=new THREE.Mesh(geoFallback,mat); m.position.set(worldX(c.x,b),y,worldZ(c.y,b)); scene.add(m); return;
  }

  if(o.shape==='ellipse'||o.shape==='circle'||water){
    const geo=new THREE.CylinderGeometry(.5,.5,h,64);
    const m=new THREE.Mesh(geo,mat);
    m.scale.set(Math.max(.1,o.w/majorGrid),1,Math.max(.1,o.h/majorGrid));
    m.position.set(worldX(o.x+o.w/2,b),y,worldZ(o.y+o.h/2,b));
    scene.add(m); return;
  }

  const geo=new THREE.BoxGeometry(Math.max(.1,o.w/majorGrid),h,Math.max(.1,o.h/majorGrid));
  const m=new THREE.Mesh(geo,mat); m.position.set(worldX(o.x+o.w/2,b),y,worldZ(o.y+o.h/2,b)); scene.add(m);
}
function buildCanvas3D(){
  view3d.innerHTML=''; view3d.appendChild(fallback3d); const c=fallback3d, dpr=window.devicePixelRatio||1, rect=view3d.getBoundingClientRect(); c.width=rect.width*dpr; c.height=rect.height*dpr; c.style.width=rect.width+'px'; c.style.height=rect.height+'px'; const g=c.getContext('2d'); g.scale(dpr,dpr); g.fillStyle='#d7e4d2'; g.fillRect(0,0,rect.width,rect.height); g.fillStyle='#607b52'; g.font='14px Arial'; g.fillText('Vue 3D simplifiée - Three.js non chargé, fallback canvas actif',20,28);
  const b=bounds(), cx=rect.width/2, cy=rect.height*.7; const iso=(x,y,z=0)=>({x:cx+(worldX(x,b)-worldZ(y,b))*18,y:cy+(worldX(x,b)+worldZ(y,b))*9-z*22});
  objects.forEach(o=>{ const t=getTool(o.type); g.fillStyle=t.color; g.strokeStyle='#253'; if(o.x1!==undefined){const p1=iso(o.x1,o.y1,0),p2=iso(o.x2,o.y2,0),p3=iso(o.x2,o.y2,heightOf(o,t,.02)),p4=iso(o.x1,o.y1,heightOf(o,t,.02)); g.beginPath();g.moveTo(p1.x,p1.y);g.lineTo(p2.x,p2.y);g.lineTo(p3.x,p3.y);g.lineTo(p4.x,p4.y);g.closePath();g.fill();g.stroke();} else if(o.r){const p=iso(o.x,o.y,heightOf(o,t,.02)); g.beginPath();g.arc(p.x,p.y,Math.max(8,o.r/majorGrid*10),0,Math.PI*2);g.fill();g.stroke();} else {const h=heightOf(o,t,.02), x=o.x||centroid(o.points||[]).x, y=o.y||centroid(o.points||[]).y, w=o.w||majorGrid, hh=o.h||majorGrid; const p=iso(x+w/2,y+hh/2,h); g.fillRect(p.x-16,p.y-16,32,32); g.strokeRect(p.x-16,p.y-16,32,32);} });
}

loadTextureAssets(); loadLocal(); setScaleSelect(); initTools(); draw();
