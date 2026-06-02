import { Project, ProjectType, ProductPart, Material } from './types';

// Comprehensive Material Library
export const MOCK_MATERIALS: Material[] = [
  // Woods
  { id: 'mat_oak', name: 'Oak Wood', color: '#8B5A2B', roughness: 0.8, metalness: 0, priceModifier: 1.0 },
  { id: 'mat_walnut', name: 'Walnut', color: '#4A3728', roughness: 0.7, metalness: 0, priceModifier: 1.5 },
  { id: 'mat_mahogany', name: 'Mahogany', color: '#421C02', roughness: 0.6, metalness: 0, priceModifier: 1.8 },
  { id: 'mat_birch', name: 'Birch Plywood', color: '#F6EAC2', roughness: 0.9, metalness: 0, priceModifier: 0.9 },

  // Metals
  { id: 'mat_steel', name: 'Brushed Steel', color: '#A0A0A0', roughness: 0.3, metalness: 0.8, priceModifier: 2.0 },
  { id: 'mat_gold', name: 'Gold Plated', color: '#FFD700', roughness: 0.2, metalness: 1.0, priceModifier: 5.0 },
  { id: 'mat_chrome', name: 'Polished Chrome', color: '#F0F0F0', roughness: 0.05, metalness: 1.0, priceModifier: 2.5 },
  { id: 'mat_brass', name: 'Satin Brass', color: '#D4AF37', roughness: 0.4, metalness: 0.9, priceModifier: 2.2 },
  { id: 'mat_black_metal', name: 'Matte Black Metal', color: '#1A1A1A', roughness: 0.6, metalness: 0.7, priceModifier: 1.9 },
  { id: 'mat_titanium', name: 'Titanium', color: '#8d9196', roughness: 0.4, metalness: 0.9, priceModifier: 3.0 },

  // Plastics / Synthetics
  { id: 'mat_plastic_red', name: 'Red Plastic', color: '#FF0000', roughness: 0.5, metalness: 0.1, priceModifier: 0.8 },
  { id: 'mat_plastic_white', name: 'White Matte', color: '#FFFFFF', roughness: 0.4, metalness: 0.1, priceModifier: 0.8 },
  { id: 'mat_plastic_blue', name: 'Blue Plastic', color: '#0000FF', roughness: 0.4, metalness: 0.1, priceModifier: 0.8 },
  { id: 'mat_carbon', name: 'Carbon Fiber', color: '#111111', roughness: 0.3, metalness: 0.5, priceModifier: 4.0 },

  // Transparent / Glass
  { id: 'mat_glass', name: 'Tempered Glass', color: '#E0F7FA', roughness: 0.0, metalness: 0.9, priceModifier: 1.8, opacity: 0.3, transparent: true },
  { id: 'mat_ruby', name: 'Ruby', color: '#D1001C', roughness: 0.0, metalness: 0.8, priceModifier: 10.0, opacity: 0.7, transparent: true },
  { id: 'mat_emerald', name: 'Emerald', color: '#50C878', roughness: 0.0, metalness: 0.8, priceModifier: 10.0, opacity: 0.7, transparent: true },

  // Fabrics / Textiles (Industrial)
  { id: 'mat_fabric_grey', name: 'Industrial Grey', color: '#6b7280', roughness: 0.9, metalness: 0, priceModifier: 1.2, texture: 'textile' },
  { id: 'mat_fabric_navy', name: 'Deep Navy Fabric', color: '#1e3a8a', roughness: 0.9, metalness: 0, priceModifier: 1.3, texture: 'textile' },
  { id: 'mat_fabric_charcoal', name: 'Charcoal Weave', color: '#374151', roughness: 0.9, metalness: 0, priceModifier: 1.2, texture: 'textile' },
  { id: 'mat_fabric_beige', name: 'Beige Textile', color: '#d1d5db', roughness: 0.9, metalness: 0, priceModifier: 1.2, texture: 'textile' },

  // Felts (Carpets)
  { id: 'mat_felt_grey', name: 'Grey Felt', color: '#4b5563', roughness: 1.0, metalness: 0, priceModifier: 1.0, texture: 'felt' },
  { id: 'mat_felt_charcoal', name: 'Dark Felt', color: '#1f2937', roughness: 1.0, metalness: 0, priceModifier: 1.0, texture: 'felt' },
  { id: 'mat_felt_beige', name: 'Sand Felt', color: '#d6d3d1', roughness: 1.0, metalness: 0, priceModifier: 1.0, texture: 'felt' },
  { id: 'mat_felt_blue', name: 'Office Blue Felt', color: '#2563eb', roughness: 1.0, metalness: 0, priceModifier: 1.0, texture: 'felt' },
  { id: 'mat_carpet_dark', name: 'Basic Dark', color: '#333333', roughness: 1.0, metalness: 0, priceModifier: 1.0 }, // Legacy
];

const SHARED_STRUCTURAL_MATERIALS = [
  'mat_fabric_grey',
  'mat_fabric_navy',
  'mat_fabric_charcoal',
  'mat_fabric_beige',
  'mat_oak',
  'mat_walnut',
  'mat_black_metal',
  'mat_plastic_white'
];

// Project 1: Office Phonebooth
export const PROJECT_PHONEBOOTH: Project = {
  id: 'proj_booth',
  name: 'BOX ADD',
  type: ProjectType.FURNITURE,
  basePrice: 2500,
  branding: {
    primaryColor: '#2563eb', // blue-600
    secondaryColor: '#1e40af', // blue-800
    backgroundColor: '#f8fafc', // slate-50
    textColor: '#0f172a', // slate-900
    logoText: 'BOX ADD',
    fontFamily: 'sans-serif',
  },
  baseSlots: [
    // Floor at 0. 1x1m base.
    { id: 'slot_floor', position: [0, 0.005, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Floor'] },
    // Walls: Center is at 0.5 offset. Height is 2.2m, so center Y is 1.1m.
    { id: 'slot_wall_back', position: [0, 1.1, -0.5], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Walls'] },
    { id: 'slot_wall_left', position: [-0.5, 1.1, 0], rotation: [0, Math.PI / 2, 0], type: 'slot', allowedCategories: ['Walls'] },
    { id: 'slot_wall_right', position: [0.5, 1.1, 0], rotation: [0, -Math.PI / 2, 0], type: 'slot', allowedCategories: ['Walls'] },
    // Door: Front (Z=0.5).
    { id: 'slot_door', position: [0, 1.1, 0.51], rotation: [0, Math.PI, 0], type: 'slot', allowedCategories: ['Doors'] },
    // Roof: Top. Height 2.2m.
    { id: 'slot_roof', position: [0, 2.15, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Roof'] },
  ],
  partsLibrary: [
    { id: 'part_floor_carpet', name: 'Felt Carpet', description: '10mm acoustic felt.', price: 150, category: 'Floor', geometryType: 'box', dimensions: [1.0, 0.01, 1.0], allowedMaterials: ['mat_felt_grey', 'mat_felt_charcoal', 'mat_felt_beige', 'mat_felt_blue'] },
    { id: 'part_floor_wood', name: 'Hardwood Floor', description: 'Premium wood finish.', price: 250, category: 'Floor', geometryType: 'box', dimensions: [1.0, 0.01, 1.0], allowedMaterials: ['mat_oak', 'mat_walnut', 'mat_birch'] },

    // Walls height 2.2m, Width 1.0m
    { id: 'part_wall_solid', name: 'Acoustic Panel Wall', description: 'Soundproof textile panel with soft edges.', price: 200, category: 'Walls', geometryType: 'rounded_box', dimensions: [1.0, 2.2, 0.1], allowedMaterials: SHARED_STRUCTURAL_MATERIALS },
    // 12mm thickness for glass wall
    { id: 'part_wall_glass', name: 'Glass Wall', description: 'Transparency with silence.', price: 350, category: 'Walls', geometryType: 'box', dimensions: [1.0, 2.2, 0.012], allowedMaterials: ['mat_glass'] },

    // Doors - 1.02 Width (to overlap walls), 2.22 Height (to overlap roof)
    // 12mm thickness for glass door
    { id: 'part_door_glass', name: 'Glass Door', description: 'Full-height glass door.', price: 400, category: 'Doors', geometryType: 'box', dimensions: [1.02, 2.22, 0.012], allowedMaterials: ['mat_glass', 'mat_steel', 'mat_black_metal'] },
    // Acoustic Door - Overlapping
    { id: 'part_door_acoustic', name: 'Acoustic Door with Window', description: 'Solid door with a small viewport.', price: 450, category: 'Doors', geometryType: 'door_acoustic', dimensions: [1.02, 2.22, 0.1], allowedMaterials: SHARED_STRUCTURAL_MATERIALS },

    // Roof - Rounded Box, inside walls. Walls are 1.0 outer, 0.1 thick -> inner is 0.9.
    // Dimensions: [Width, Thickness, Depth] -> [0.94, 0.1, 0.94] tightly fitted inside
    { id: 'part_roof_std', name: 'Standard Roof', description: 'Ventilated roof unit.', price: 300, category: 'Roof', geometryType: 'rounded_box', dimensions: [0.94, 0.1, 0.94], allowedMaterials: SHARED_STRUCTURAL_MATERIALS },
    // 12mm thickness for glass roof, increased width to 1.02 to fill space on top of walls
    { id: 'part_roof_glass', name: 'Glass Roof', description: 'Panoramic glass ceiling.', price: 450, category: 'Roof', geometryType: 'rounded_box', dimensions: [1.02, 0.012, 1.02], allowedMaterials: ['mat_glass'] },
  ],
  materialsLibrary: MOCK_MATERIALS,
};

// Jewelry materials
const JEWELRY_MATERIALS: Material[] = [
  { id: 'mat_gold_18k',    name: 'Yellow Gold 18K',  color: '#FFD700', roughness: 0.08, metalness: 1.0, priceModifier: 5.0 },
  { id: 'mat_rose_gold',   name: 'Rose Gold 14K',    color: '#E8A090', roughness: 0.10, metalness: 1.0, priceModifier: 4.5 },
  { id: 'mat_silver_925',  name: 'Sterling Silver',  color: '#C8C8C8', roughness: 0.10, metalness: 1.0, priceModifier: 2.0 },
  { id: 'mat_platinum',    name: 'Platinum',          color: '#E8E8E8', roughness: 0.05, metalness: 1.0, priceModifier: 8.0 },
  { id: 'mat_black_rhodium', name: 'Black Rhodium',  color: '#1a1a1a', roughness: 0.12, metalness: 1.0, priceModifier: 4.0 },
  { id: 'mat_j_ruby',      name: 'Ruby',             color: '#D1001C', roughness: 0.0,  metalness: 0.8, priceModifier: 10.0, opacity: 0.75, transparent: true },
  { id: 'mat_j_emerald',   name: 'Emerald',          color: '#50C878', roughness: 0.0,  metalness: 0.8, priceModifier: 10.0, opacity: 0.75, transparent: true },
  { id: 'mat_j_sapphire',  name: 'Sapphire',         color: '#0F52BA', roughness: 0.0,  metalness: 0.8, priceModifier: 12.0, opacity: 0.70, transparent: true },
  { id: 'mat_j_diamond',   name: 'Diamond',          color: '#EAF4FD', roughness: 0.0,  metalness: 0.95, priceModifier: 20.0, opacity: 0.55, transparent: true },
  { id: 'mat_j_amethyst',  name: 'Amethyst',         color: '#9B59B6', roughness: 0.0,  metalness: 0.8, priceModifier: 8.0,  opacity: 0.70, transparent: true },
];

const JEWELRY_METALS = ['mat_gold_18k', 'mat_rose_gold', 'mat_silver_925', 'mat_platinum', 'mat_black_rhodium'];
const JEWELRY_GEMS   = ['mat_j_ruby', 'mat_j_emerald', 'mat_j_sapphire', 'mat_j_diamond', 'mat_j_amethyst'];

// Project 2: Jewel Chain Configurator
export const PROJECT_JEWELRY: Project = {
  id: 'proj_jewel',
  name: 'JEWEL',
  type: ProjectType.JEWELRY,
  basePrice: 500,
  branding: {
    primaryColor: '#C5A028',
    secondaryColor: '#8B6914',
    backgroundColor: '#FAFAF8',
    textColor: '#0f0f0f',
    logoText: 'JEWEL',
    fontFamily: 'serif',
  },
  // Linear bracelet layout — 9 slots across ~0.8 units
  baseSlots: [
    { id: 'slot_lock_l',  position: [-0.40, 0, 0], rotation: [0, 0, Math.PI / 2], type: 'slot', allowedCategories: ['Lock'] },
    { id: 'slot_link_1',  position: [-0.30, 0, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Main Link'] },
    { id: 'slot_inter_1', position: [-0.20, 0, 0], rotation: [0, 0, Math.PI / 2], type: 'slot', allowedCategories: ['Interlink'] },
    { id: 'slot_link_2',  position: [-0.10, 0, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Main Link'] },
    { id: 'slot_inter_2', position: [  0.00, 0, 0], rotation: [0, 0, Math.PI / 2], type: 'slot', allowedCategories: ['Interlink'] },
    { id: 'slot_link_3',  position: [  0.10, 0, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Main Link'] },
    { id: 'slot_inter_3', position: [  0.20, 0, 0], rotation: [0, 0, Math.PI / 2], type: 'slot', allowedCategories: ['Interlink'] },
    { id: 'slot_link_4',  position: [  0.30, 0, 0], rotation: [0, 0, 0], type: 'slot', allowedCategories: ['Main Link'] },
    { id: 'slot_lock_r',  position: [  0.40, 0, 0], rotation: [0, 0, Math.PI / 2], type: 'slot', allowedCategories: ['Lock'] },
  ],
  partsLibrary: [
    {
      id: 'part_h_link',
      name: 'Classic H-Link',
      description: 'Rectangular chain link, the main building block.',
      price: 50,
      category: 'Main Link',
      geometryType: 'custom_H',
      dimensions: [0.09, 0.05, 0.015],
      allowedMaterials: JEWELRY_METALS,
      layoutWidth: 0.10,
    },
    {
      id: 'part_gem_setting',
      name: 'Gem Setting',
      description: 'Faceted gemstone connector link.',
      price: 150,
      category: 'Interlink',
      geometryType: 'gem_plus',
      dimensions: [0.04, 0.04, 0.04],
      allowedMaterials: JEWELRY_GEMS,
      layoutWidth: 0.10,
    },
    {
      id: 'part_barrel_clasp',
      name: 'Barrel Clasp',
      description: 'Classic barrel-style clasp.',
      price: 80,
      category: 'Lock',
      geometryType: 'custom_lock',
      dimensions: [0.06, 0.028, 0.028],
      allowedMaterials: JEWELRY_METALS,
      layoutWidth: 0.10,
    },
  ],
  materialsLibrary: JEWELRY_MATERIALS,
};
