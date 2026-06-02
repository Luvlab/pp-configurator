
export enum ProjectType {
  FURNITURE = 'FURNITURE',
  JEWELRY = 'JEWELRY',
}

export interface Branding {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logoText: string;
  fontFamily: string;
}

export interface ConnectionPoint {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles
  type: 'slot' | 'base';
  allowedCategories?: string[]; // If defined, only parts with these categories can be placed here
}

export interface ProductPart {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  geometryType: 'box' | 'cylinder' | 'sphere' | 'torus' | 'custom_H' | 'sprint' | 'custom_lock' | 'rounded_box' | 'door_acoustic' | 'gem_plus' | 'gem_i' | 'gem_o_small' | 'gem_o_big';
  dimensions: number[]; // width, height, depth or radius args
  allowedMaterials: string[]; // references Material IDs
  thumbnailUrl?: string;
  modelUrl?: string; // URL for uploaded GLB/GLTF models
  layoutWidth?: number; // Width along the placement axis (for jewelry)
}

export interface Material {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  priceModifier: number;
  opacity?: number;
  transparent?: boolean;
  texture?: 'textile' | 'felt'; // Procedural texture type
  textureUrl?: string; // Uploaded texture URL (Base64 or Link)
}

export interface PartProperties {
  isOpen?: boolean;
  hinge?: 'left' | 'right';
  [key: string]: any;
}

export interface PlacedPart {
  id: string; // unique instance ID
  partId: string; // reference to ProductPart
  slotId: string; // which slot on the base it occupies
  materialId: string;
  properties?: PartProperties; // Configuration for specific parts like doors
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  basePrice: number;
  branding: Branding;
  partsLibrary: ProductPart[];
  materialsLibrary: Material[];
  baseSlots: ConnectionPoint[]; // Where parts can be attached
}

export interface CustomPartRequest {
  description: string;
  aiResponse?: string;
  estimatedCost?: number;
  feasibility?: 'high' | 'medium' | 'low';
  suggestedMaterials?: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface SavedDesign {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string;
  projectType: ProjectType;
  placedParts: PlacedPart[];
  thumbnail: string;
  likes: number;
  isPublic: boolean;
  createdAt: number;
}
