import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { DreamCastleMaterials } from './CastleMaterials';

/**
 * All 26 canonical 3D micro-prop archetypes shared across the Floor 2 Creative Wing
 * (Photography Studio, Mini Fashion Boutique, and Doll Playroom).
 */
export type MicroPropType =
  | 'perfume_bottle'
  | 'jewellery_box'
  | 'jewelry_piece'
  | 'handbag'
  | 'shoe_pair'
  | 'flower_vase'
  | 'ribbon_roll'
  | 'picture_frame'
  | 'crystal_sconce'
  | 'decorative_mirror'
  | 'clothing_hanger'
  | 'fabric_roll'
  | 'small_book'
  | 'cosmetic_bottle'
  | 'gift_box'
  | 'sewing_kit'
  | 'tiny_scissors'
  | 'measuring_tape'
  | 'toy_block'
  | 'teddy_bear'
  | 'miniature_tree'
  | 'miniature_lamp'
  | 'miniature_chair'
  | 'miniature_table'
  | 'camera_accessory'
  | 'craft_supply';

/**
 * Each micro-prop archetype is composed of 2–6 sub-parts assigned to one of three
 * shared rendering buckets so hundreds of multi-material props across all 3 rooms
 * compile into just 3 static draw calls total.
 */
export type MicroPropMaterialBucket = 'pastel' | 'gold' | 'glow';

export interface MicroPropSubPart {
  geometry: THREE.BufferGeometry;
  bucket: MicroPropMaterialBucket;
  /** Default relative color multiplier for 'pastel' bucket parts (1,1,1 uses placement color) */
  tintMultiplier?: [number, number, number];
}

export interface MicroPropTemplate {
  type: MicroPropType;
  parts: MicroPropSubPart[];
}

export interface MicroPropPlacement {
  x: number;
  y: number;
  z: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  color?: string;
}

export interface MicroPropRowOptions {
  startX: number;
  startY: number;
  startZ: number;
  stepX?: number;
  stepY?: number;
  stepZ?: number;
  count: number;
  baseRotY?: number;
  yawJitter?: number;
  tiltJitter?: number;
  baseScale?: number;
  scaleVariation?: number;
  palette: string[];
  seed?: number;
}

export interface MicroPropStackOptions {
  x: number;
  y: number;
  z: number;
  itemHeight: number;
  count: number;
  baseRotY?: number;
  yawStep?: number;
  tiltStep?: number;
  scaleDecay?: number;
  palette: string[];
}

export interface MicroPropRingOptions {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
  count: number;
  faceCenter?: boolean;
  baseScale?: number;
  scaleVariation?: number;
  palette: string[];
  startAngle?: number;
}

export interface MicroPropClusterItem {
  type: MicroPropType;
  dx: number;
  dy?: number;
  dz: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  color?: string;
}

interface BakedChunk {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array | null;
  indices: Uint32Array;
  vertexCount: number;
}

const _mat4 = new THREE.Matrix4();
const _normMat3 = new THREE.Matrix3();
const _posVec = new THREE.Vector3();
const _normVec = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scaleVec = new THREE.Vector3();
const _colorObj = new THREE.Color();

export const CREATIVE_WING_PASTEL_PALETTE = [
  '#f472b6',
  '#c084fc',
  '#38bdf8',
  '#fbcfe8',
  '#fde047',
  '#fb7185',
  '#a7f3d0',
];

export const CREATIVE_WING_COUTURE_PALETTE = [
  '#fbcfe8',
  '#fff1f2',
  '#ddd6fe',
  '#fda4af',
  '#fef08a',
];

export const CREATIVE_WING_TOY_PALETTE = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#22c55e',
  '#ec4899',
  '#a855f7',
];

/**
 * Helper to create a translated/rotated/scaled clone of a primitive geometry
 * during template construction (run once at startup).
 */
function xformGeo(
  geo: THREE.BufferGeometry,
  tx = 0,
  ty = 0,
  tz = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.BufferGeometry {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (tx !== 0 || ty !== 0 || tz !== 0) geo.translate(tx, ty, tz);
  return geo;
}

/**
 * Builds the canonical 3D geometry templates for all 26 micro-prop archetypes.
 * Every archetype uses 3–7 distinct sub-parts across primary body, gold hardware,
 * and crystal/glowing accents, all pivoted at bottom-center (y = 0).
 */
export function createSharedMicroPropLibrary(
  tracker: ResourceTracker,
): Map<MicroPropType, MicroPropTemplate> {
  const lib = new Map<MicroPropType, MicroPropTemplate>();
  const t = <T extends THREE.BufferGeometry>(g: T): T => tracker.trackGeo(g);

  // 1. PERFUME BOTTLE (Faceted body + gold atomizer collar + crystal stopper)
  lib.set('perfume_bottle', {
    type: 'perfume_bottle',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.034, 0.044, 0.095, 8), 0, 0.0475, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.016, 0.022, 0.028, 8), 0, 0.108, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.024, 0), 0, 0.142, 0)),
        bucket: 'glow',
      },
    ],
  });

  // 2. JEWELLERY BOX (Velvet casket base + beveled lid + gold trim band + heart lock)
  lib.set('jewellery_box', {
    type: 'jewellery_box',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.14, 0.055, 0.105), 0, 0.0275, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.148, 0.024, 0.112), 0, 0.066, 0)),
        bucket: 'pastel',
        tintMultiplier: [1.08, 1.05, 1.08],
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.152, 0.008, 0.115), 0, 0.055, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.016, 0), 0, 0.055, 0.058)),
        bucket: 'gold',
      },
    ],
  });

  // 3. JEWELRY PIECE (Velvet display bust pad + gold tiara/necklace ring + glowing crystal gem)
  lib.set('jewelry_piece', {
    type: 'jewelry_piece',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.085, 0.105, 0.025, 12), 0, 0.0125, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(
          xformGeo(
            new THREE.TorusGeometry(0.068, 0.012, 6, 16, Math.PI * 1.35),
            0,
            0.055,
            0,
            Math.PI * 0.32,
            0,
            0,
          ),
        ),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.026, 0), 0, 0.085, 0.042)),
        bucket: 'glow',
      },
    ],
  });

  // 4. HANDBAG (Structured couture body + top flap + arched gold handle + heart clasp)
  lib.set('handbag', {
    type: 'handbag',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.18, 0.145, 0.085), 0, 0.0725, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.186, 0.048, 0.092), 0, 0.125, 0.004)),
        bucket: 'pastel',
        tintMultiplier: [0.92, 0.92, 0.95],
      },
      {
        geometry: t(
          xformGeo(new THREE.TorusGeometry(0.048, 0.009, 6, 14, Math.PI), 0, 0.148, 0),
        ),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.018, 0), 0, 0.102, 0.048)),
        bucket: 'gold',
      },
    ],
  });

  // 5. SHOE PAIR (Left & right heeled couture shoes with sole, vamp, heel stiletto, and gold buckle)
  lib.set('shoe_pair', {
    type: 'shoe_pair',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.058, 0.038, 0.145), -0.045, 0.024, 0, 0.12, 0, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.01, 0.007, 0.055, 6), -0.045, 0.0275, -0.052)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.058, 0.038, 0.145), 0.045, 0.024, 0.01, 0.12, -0.08, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.01, 0.007, 0.055, 6), 0.045, 0.0275, -0.042)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.028, 0.012, 0.018), -0.045, 0.042, 0.048)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.028, 0.012, 0.018), 0.045, 0.042, 0.058)),
        bucket: 'gold',
      },
    ],
  });

  // 6. FLOWER VASE (Fluted vase + gold neck ring + 3 pastel rose blooms + glowing pollen heart)
  lib.set('flower_vase', {
    type: 'flower_vase',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.042, 0.058, 0.17, 10), 0, 0.085, 0)),
        bucket: 'pastel',
        tintMultiplier: [1.1, 1.08, 1.1],
      },
      {
        geometry: t(xformGeo(new THREE.TorusGeometry(0.044, 0.008, 6, 12), 0, 0.165, 0, Math.PI / 2, 0, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.044, 8, 8), -0.028, 0.205, 0.012)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.042, 8, 8), 0.03, 0.215, -0.012)),
        bucket: 'pastel',
        tintMultiplier: [0.9, 0.82, 1.05],
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.038, 8, 8), 0, 0.235, 0.018)),
        bucket: 'glow',
      },
    ],
  });

  // 7. RIBBON ROLL (Bottom & top gold flanges + wound pastel satin core)
  lib.set('ribbon_roll', {
    type: 'ribbon_roll',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.068, 10), 0, 0.038, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 10), 0, 0.004, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 10), 0, 0.072, 0)),
        bucket: 'gold',
      },
    ],
  });

  // 8. PICTURE FRAME (Standing/wall gold frame + easel back + pastel portrait relief)
  lib.set('picture_frame', {
    type: 'picture_frame',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.16, 0.21, 0.018), 0, 0.105, 0, -0.12, 0, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.125, 0.175, 0.022), 0, 0.105, 0.003, -0.12, 0, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.018, 0), 0, 0.215, -0.012)),
        bucket: 'glow',
      },
    ],
  });

  // 9. CRYSTAL SCONCE (Gold wall medallion + curved bracket + glowing crystal prism)
  lib.set('crystal_sconce', {
    type: 'crystal_sconce',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.022, 10), 0, 0, 0, Math.PI / 2, 0, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.022, 0.025, 0.085), 0, -0.015, 0.042)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.058, 0), 0, 0.048, 0.072, 0, 0, 0, 1, 1.45, 1)),
        bucket: 'glow',
      },
    ],
  });

  // 10. DECORATIVE MIRROR (Ornate pedestal base + gold oval ring + reflective crystal face)
  lib.set('decorative_mirror', {
    type: 'decorative_mirror',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.055, 0.075, 0.03, 10), 0, 0.015, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.TorusGeometry(0.095, 0.014, 8, 18), 0, 0.135, 0, 0, 0, 0, 0.85, 1.15, 1)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16), 0, 0.135, 0, Math.PI / 2, 0, 0, 0.85, 1, 1.15)),
        bucket: 'glow',
      },
    ],
  });

  // 11. CLOTHING HANGER (Sculpted pastel shoulder bar + gold hook)
  lib.set('clothing_hanger', {
    type: 'clothing_hanger',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6), 0, 0, 0, 0, 0, Math.PI / 2)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.TorusGeometry(0.028, 0.006, 6, 12, Math.PI * 1.3), 0, 0.032, 0)),
        bucket: 'gold',
      },
    ],
  });

  // 12. FABRIC ROLL (Rolled pastel couture bolt + gold end caps & ribbon band)
  lib.set('fabric_roll', {
    type: 'fabric_roll',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.48, 10), 0, 0.055, 0, 0, 0, Math.PI / 2)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 10), 0, 0.055, 0, 0, 0, Math.PI / 2)),
        bucket: 'gold',
      },
    ],
  });

  // 13. SMALL BOOK (Hardcover spine & covers + ivory page block + gold foil emblem)
  lib.set('small_book', {
    type: 'small_book',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.042, 0.165, 0.125), 0, 0.0825, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.032, 0.155, 0.118), 0.003, 0.0825, 0)),
        bucket: 'glow',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.044, 0.018, 0.127), 0, 0.135, 0)),
        bucket: 'gold',
      },
    ],
  });

  // 14. COSMETIC BOTTLE (Rounded cream jar + gold screw collar + crystal dome lid)
  lib.set('cosmetic_bottle', {
    type: 'cosmetic_bottle',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.038, 0.036, 0.052, 10), 0, 0.026, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 10), 0, 0.058, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.028, 8, 8), 0, 0.072, 0)),
        bucket: 'glow',
      },
    ],
  });

  // 15. GIFT BOX (Box base + overhanging lid + crossed gold ribbon + crystal heart bow)
  lib.set('gift_box', {
    type: 'gift_box',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.24, 0.13, 0.20), 0, 0.065, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.252, 0.036, 0.212), 0, 0.142, 0)),
        bucket: 'pastel',
        tintMultiplier: [1.06, 1.04, 1.06],
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.256, 0.162, 0.028), 0, 0.082, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.028, 0.162, 0.216), 0, 0.082, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.028, 0), 0, 0.175, 0)),
        bucket: 'glow',
      },
    ],
  });

  // 16. SEWING KIT (Gold dish base + plump velvet pincushion dome + 3 gold-headed pins)
  lib.set('sewing_kit', {
    type: 'sewing_kit',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.058, 0.068, 0.022, 10), 0, 0.011, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.054, 10, 8), 0, 0.038, 0, 0, 0, 0, 1, 0.72, 1)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.004, 0.002, 0.055, 5), -0.015, 0.078, 0.01, 0.25, 0, 0.2)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.011, 6, 6), 0.016, 0.092, -0.01)),
        bucket: 'glow',
      },
    ],
  });

  // 17. TINY SCISSORS (Crossed blades + dual gold finger loop rings)
  lib.set('tiny_scissors', {
    type: 'tiny_scissors',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.13, 0.008, 0.016), 0.02, 0.006, 0, 0, 0.22, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.13, 0.008, 0.016), 0.02, 0.01, 0, 0, -0.22, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.TorusGeometry(0.022, 0.005, 6, 12), -0.052, 0.008, 0.024, Math.PI / 2, 0, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.TorusGeometry(0.022, 0.005, 6, 12), -0.052, 0.008, -0.024, Math.PI / 2, 0, 0)),
        bucket: 'pastel',
      },
    ],
  });

  // 18. MEASURING TAPE (Coiled pastel tape cylinder + trailing tab + gold end clasp)
  lib.set('measuring_tape', {
    type: 'measuring_tape',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.028, 12), 0, 0.014, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.065, 0.004, 0.024), 0.045, 0.003, 0.028, 0, -0.35, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.012, 0.006, 0.026), 0.076, 0.004, 0.039, 0, -0.35, 0)),
        bucket: 'gold',
      },
    ],
  });

  // 19. TOY BLOCK (Building brick + 4 cylindrical studs on top)
  lib.set('toy_block', {
    type: 'toy_block',
    parts: [
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.085, 0.055, 0.085), 0, 0.0275, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 8), -0.022, 0.062, -0.022)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 8), 0.022, 0.062, -0.022)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 8), -0.022, 0.062, 0.022)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 8), 0.022, 0.062, 0.022)),
        bucket: 'pastel',
      },
    ],
  });

  // 20. TEDDY BEAR (Plump torso + head + 2 ears + 2 limbs + gold bow tie)
  lib.set('teddy_bear', {
    type: 'teddy_bear',
    parts: [
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.095, 10, 8), 0, 0.095, 0, 0, 0, 0, 1, 1.12, 0.92)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.072, 10, 8), 0, 0.23, 0.01)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.028, 8, 6), -0.055, 0.285, 0.01)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.028, 8, 6), 0.055, 0.285, 0.01)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.065, 0.024, 0.018), 0, 0.168, 0.078)),
        bucket: 'gold',
      },
    ],
  });

  // 21. MINIATURE TREE (Gold-tinted trunk + 2 tiered conical foliage crowns + glowing top blossom)
  lib.set('miniature_tree', {
    type: 'miniature_tree',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.018, 0.026, 0.08, 6), 0, 0.04, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.ConeGeometry(0.088, 0.16, 8), 0, 0.14, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.ConeGeometry(0.068, 0.14, 8), 0, 0.22, 0)),
        bucket: 'pastel',
        tintMultiplier: [1.08, 1.06, 1.08],
      },
      {
        geometry: t(xformGeo(new THREE.OctahedronGeometry(0.022, 0), 0, 0.30, 0)),
        bucket: 'glow',
      },
    ],
  });

  // 22. MINIATURE LAMP (Gold base + slender post + glowing lantern globe)
  lib.set('miniature_lamp', {
    type: 'miniature_lamp',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.028, 0.036, 0.02, 8), 0, 0.01, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.01, 0.014, 0.21, 6), 0, 0.115, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.SphereGeometry(0.034, 8, 8), 0, 0.235, 0)),
        bucket: 'glow',
      },
    ],
  });

  // 23. MINIATURE CHAIR (Gold base/legs + cushioned seat + arched backrest)
  lib.set('miniature_chair', {
    type: 'miniature_chair',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.048, 0.056, 0.055, 8), 0, 0.0275, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.062, 0.058, 0.028, 10), 0, 0.065, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.BoxGeometry(0.11, 0.105, 0.024), 0, 0.125, -0.045)),
        bucket: 'pastel',
      },
    ],
  });

  // 24. MINIATURE TABLE (Gold pedestal base + column + pastel beveled tabletop)
  lib.set('miniature_table', {
    type: 'miniature_table',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.055, 0.068, 0.02, 10), 0, 0.01, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.018, 0.022, 0.09, 8), 0, 0.055, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.115, 0.11, 0.022, 14), 0, 0.105, 0)),
        bucket: 'pastel',
      },
    ],
  });

  // 25. CAMERA ACCESSORY (Film roll canister + gold lens cap ring + glowing memory indicator)
  lib.set('camera_accessory', {
    type: 'camera_accessory',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.058, 10), 0, 0.029, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 10), 0, 0.062, 0)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 12), 0.055, 0.005, 0.02)),
        bucket: 'gold',
      },
    ],
  });

  // 26. CRAFT SUPPLY (Paint pot jar + gold ferrule + angled brush handle)
  lib.set('craft_supply', {
    type: 'craft_supply',
    parts: [
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.034, 0.03, 0.052, 10), 0, 0.026, 0)),
        bucket: 'pastel',
      },
      {
        geometry: t(xformGeo(new THREE.CylinderGeometry(0.006, 0.004, 0.13, 6), 0.012, 0.075, 0, 0, 0, -0.35)),
        bucket: 'gold',
      },
      {
        geometry: t(xformGeo(new THREE.ConeGeometry(0.01, 0.026, 6), 0.036, 0.135, 0, 0, 0, -0.35)),
        bucket: 'glow',
      },
    ],
  });

  return lib;
}

/**
 * High-efficiency Micro-Prop Composition System.
 * Collects placements of all 26 shared micro-prop archetypes across the
 * Photography Studio, Mini Fashion Boutique, and Doll Playroom, and compiles
 * them into just 3 merged static meshes (1 Pastel Vertex-Colored mesh,
 * 1 Champagne Gold mesh, and 1 Crystal/Warm Glow mesh).
 */
export class CreativeWingMicroPropComposer {
  private tracker: ResourceTracker;
  private mats: DreamCastleMaterials;
  private library: Map<MicroPropType, MicroPropTemplate>;
  private pastelChunks: BakedChunk[] = [];
  private goldChunks: BakedChunk[] = [];
  private glowChunks: BakedChunk[] = [];
  private totalPlacements = 0;

  constructor(
    tracker: ResourceTracker,
    mats: DreamCastleMaterials,
    library: Map<MicroPropType, MicroPropTemplate>,
  ) {
    this.tracker = tracker;
    this.mats = mats;
    this.library = library;
  }

  place(type: MicroPropType, p: MicroPropPlacement): void {
    const template = this.library.get(type);
    if (!template) return;

    this.totalPlacements++;

    const sx = (p.scale ?? 1.0) * (p.scaleX ?? 1.0);
    const sy = (p.scale ?? 1.0) * (p.scaleY ?? 1.0);
    const sz = (p.scale ?? 1.0) * (p.scaleZ ?? 1.0);

    _euler.set(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0, 'XYZ');
    _quat.setFromEuler(_euler);
    _posVec.set(p.x, p.y, p.z);
    _scaleVec.set(sx, sy, sz);
    _mat4.compose(_posVec, _quat, _scaleVec);
    _normMat3.getNormalMatrix(_mat4);

    _colorObj.set(p.color ?? '#fbcfe8');
    const baseR = _colorObj.r;
    const baseG = _colorObj.g;
    const baseB = _colorObj.b;

    for (let i = 0; i < template.parts.length; i++) {
      const part = template.parts[i];
      const mult = part.tintMultiplier;
      const r = mult ? Math.min(1, baseR * mult[0]) : baseR;
      const g = mult ? Math.min(1, baseG * mult[1]) : baseG;
      const b = mult ? Math.min(1, baseB * mult[2]) : baseB;

      const chunk = this.bakeSubPart(part.geometry, _mat4, _normMat3, part.bucket === 'pastel', r, g, b);
      if (part.bucket === 'pastel') {
        this.pastelChunks.push(chunk);
      } else if (part.bucket === 'gold') {
        this.goldChunks.push(chunk);
      } else {
        this.glowChunks.push(chunk);
      }
    }
  }

  placeRow(type: MicroPropType, opts: MicroPropRowOptions): void {
    let seed = opts.seed ?? 42;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const stepX = opts.stepX ?? 0;
    const stepY = opts.stepY ?? 0;
    const stepZ = opts.stepZ ?? 0;
    const baseRotY = opts.baseRotY ?? 0;
    const yawJitter = opts.yawJitter ?? 0.14;
    const tiltJitter = opts.tiltJitter ?? 0.04;
    const baseScale = opts.baseScale ?? 1.0;
    const scaleVar = opts.scaleVariation ?? 0.1;

    for (let i = 0; i < opts.count; i++) {
      const r1 = nextRand() * 2 - 1;
      const r2 = nextRand() * 2 - 1;
      const r3 = nextRand() * 2 - 1;
      this.place(type, {
        x: opts.startX + i * stepX,
        y: opts.startY + i * stepY,
        z: opts.startZ + i * stepZ,
        rotY: baseRotY + r1 * yawJitter,
        rotZ: r2 * tiltJitter,
        scale: baseScale * (1.0 + r3 * scaleVar),
        color: opts.palette[i % opts.palette.length],
      });
    }
  }

  placeStack(type: MicroPropType, opts: MicroPropStackOptions): void {
    const baseRotY = opts.baseRotY ?? 0;
    const yawStep = opts.yawStep ?? 0.24;
    const tiltStep = opts.tiltStep ?? 0.03;
    const scaleDecay = opts.scaleDecay ?? 0.94;

    let curY = opts.y;
    let curScale = 1.0;
    for (let i = 0; i < opts.count; i++) {
      this.place(type, {
        x: opts.x + (i % 2 === 0 ? -0.012 : 0.012) * i,
        y: curY,
        z: opts.z + (i % 2 === 0 ? 0.01 : -0.01) * i,
        rotY: baseRotY + i * yawStep,
        rotZ: (i % 2 === 0 ? 1 : -1) * i * tiltStep,
        scale: curScale,
        color: opts.palette[i % opts.palette.length],
      });
      curY += opts.itemHeight * curScale;
      curScale *= scaleDecay;
    }
  }

  placeRing(type: MicroPropType, opts: MicroPropRingOptions): void {
    const startAng = opts.startAngle ?? 0;
    const baseScale = opts.baseScale ?? 1.0;
    const scaleVar = opts.scaleVariation ?? 0.1;

    for (let i = 0; i < opts.count; i++) {
      const ang = startAng + (i * Math.PI * 2) / opts.count;
      const px = opts.centerX + Math.cos(ang) * opts.radius;
      const pz = opts.centerZ + Math.sin(ang) * opts.radius;
      const scaleMod = 1.0 + ((i % 3) - 1) * scaleVar;
      this.place(type, {
        x: px,
        y: opts.centerY,
        z: pz,
        rotY: opts.faceCenter ? -ang + Math.PI / 2 : ang,
        scale: baseScale * scaleMod,
        color: opts.palette[i % opts.palette.length],
      });
    }
  }

  placeCluster(
    centerX: number,
    centerY: number,
    centerZ: number,
    items: MicroPropClusterItem[],
  ): void {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      this.place(it.type, {
        x: centerX + it.dx,
        y: centerY + (it.dy ?? 0),
        z: centerZ + it.dz,
        rotY: it.rotY ?? 0,
        rotZ: it.rotZ ?? 0,
        scale: it.scale ?? 1.0,
        color: it.color ?? '#fbcfe8',
      });
    }
  }

  buildAndAttach(targetGroup: THREE.Group): {
    totalPropsPlaced: number;
    drawCallsAdded: number;
  } {
    let drawCallsAdded = 0;

    if (this.pastelChunks.length > 0) {
      const geo = this.mergeChunkList(this.pastelChunks, true);
      const mat = this.tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          roughness: 0.38,
          metalness: 0.08,
        }),
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'CreativeWingMicroProps_PastelBatch';
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      targetGroup.add(mesh);
      drawCallsAdded++;
    }

    if (this.goldChunks.length > 0) {
      const geo = this.mergeChunkList(this.goldChunks, false);
      const mesh = new THREE.Mesh(geo, this.mats.champagneGold);
      mesh.name = 'CreativeWingMicroProps_GoldBatch';
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      targetGroup.add(mesh);
      drawCallsAdded++;
    }

    if (this.glowChunks.length > 0) {
      const geo = this.mergeChunkList(this.glowChunks, false);
      const glowMat = this.tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: '#fffbeb',
          emissive: '#fde047',
          emissiveIntensity: 1.15,
          roughness: 0.18,
          metalness: 0.1,
        }),
      );
      const mesh = new THREE.Mesh(geo, glowMat);
      mesh.name = 'CreativeWingMicroProps_GlowBatch';
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      targetGroup.add(mesh);
      drawCallsAdded++;
    }

    return {
      totalPropsPlaced: this.totalPlacements,
      drawCallsAdded,
    };
  }

  private bakeSubPart(
    srcGeo: THREE.BufferGeometry,
    mat4: THREE.Matrix4,
    normMat3: THREE.Matrix3,
    includeColor: boolean,
    r: number,
    g: number,
    b: number,
  ): BakedChunk {
    const posAttr = srcGeo.getAttribute('position');
    const normAttr = srcGeo.getAttribute('normal');
    const vCount = posAttr.count;

    const positions = new Float32Array(vCount * 3);
    const normals = new Float32Array(vCount * 3);
    const colors = includeColor ? new Float32Array(vCount * 3) : null;

    for (let i = 0; i < vCount; i++) {
      _posVec.fromBufferAttribute(posAttr, i).applyMatrix4(mat4);
      const i3 = i * 3;
      positions[i3] = _posVec.x;
      positions[i3 + 1] = _posVec.y;
      positions[i3 + 2] = _posVec.z;

      if (normAttr) {
        _normVec.fromBufferAttribute(normAttr, i).applyMatrix3(normMat3).normalize();
        normals[i3] = _normVec.x;
        normals[i3 + 1] = _normVec.y;
        normals[i3 + 2] = _normVec.z;
      } else {
        normals[i3] = 0;
        normals[i3 + 1] = 1;
        normals[i3 + 2] = 0;
      }

      if (colors) {
        colors[i3] = r;
        colors[i3 + 1] = g;
        colors[i3 + 2] = b;
      }
    }

    const srcIndex = srcGeo.getIndex();
    let indices: Uint32Array;
    if (srcIndex) {
      indices = new Uint32Array(srcIndex.count);
      for (let i = 0; i < srcIndex.count; i++) {
        indices[i] = srcIndex.getX(i);
      }
    } else {
      indices = new Uint32Array(vCount);
      for (let i = 0; i < vCount; i++) {
        indices[i] = i;
      }
    }

    return {
      positions,
      normals,
      colors,
      indices,
      vertexCount: vCount,
    };
  }

  private mergeChunkList(chunks: BakedChunk[], withColors: boolean): THREE.BufferGeometry {
    let totalVerts = 0;
    let totalIndices = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalVerts += chunks[i].vertexCount;
      totalIndices += chunks[i].indices.length;
    }

    const mergedPos = new Float32Array(totalVerts * 3);
    const mergedNorm = new Float32Array(totalVerts * 3);
    const mergedCol = withColors ? new Float32Array(totalVerts * 3) : null;
    const mergedIdx = new Uint32Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;

    for (let c = 0; c < chunks.length; c++) {
      const ch = chunks[c];
      mergedPos.set(ch.positions, vOffset * 3);
      mergedNorm.set(ch.normals, vOffset * 3);
      if (mergedCol && ch.colors) {
        mergedCol.set(ch.colors, vOffset * 3);
      }
      for (let k = 0; k < ch.indices.length; k++) {
        mergedIdx[iOffset + k] = ch.indices[k] + vOffset;
      }
      vOffset += ch.vertexCount;
      iOffset += ch.indices.length;
    }

    const outGeo = this.tracker.trackGeo(new THREE.BufferGeometry());
    outGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    outGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
    if (mergedCol) {
      outGeo.setAttribute('color', new THREE.BufferAttribute(mergedCol, 3));
    }
    outGeo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
    outGeo.computeBoundingSphere();
    return outGeo;
  }
}

/**
 * High-level `MicroPropLibrary` class that encapsulates the 26 shared 3D micro-prop
 * templates and provides room-specific prop instantiation methods for the
 * Photography Studio, Mini Fashion Boutique, and Doll Playroom.
 */
export class MicroPropLibrary {
  public readonly templates: Map<MicroPropType, MicroPropTemplate>;
  public readonly composer: CreativeWingMicroPropComposer;

  constructor(tracker: ResourceTracker, mats: DreamCastleMaterials) {
    this.templates = createSharedMicroPropLibrary(tracker);
    this.composer = new CreativeWingMicroPropComposer(tracker, mats, this.templates);
  }

  /**
   * Instantiates props specifically curated for Room 1: The Portrait Atelier (Photography Studio)
   * within lx in [8.8, 15.3], lz in [-15.2, -6.2].
   */
  instantiatePhotographyStudioProps(y0: number): void {
    const c = this.composer;

    // Entrance & Interior Archway Sconces
    c.place('crystal_sconce', { x: 8.58, y: y0 + 2.4, z: -12.1, rotY: -Math.PI / 2 });
    c.place('crystal_sconce', { x: 8.58, y: y0 + 2.4, z: -9.1, rotY: -Math.PI / 2 });
    c.place('crystal_sconce', { x: 9.02, y: y0 + 2.4, z: -12.1, rotY: Math.PI / 2 });
    c.place('crystal_sconce', { x: 9.02, y: y0 + 2.4, z: -9.1, rotY: Math.PI / 2 });
    c.place('crystal_sconce', { x: 10.5, y: y0 + 2.4, z: -5.98, rotY: 0 });
    c.place('crystal_sconce', { x: 13.5, y: y0 + 2.4, z: -5.98, rotY: 0 });
    c.place('crystal_sconce', { x: 10.5, y: y0 + 2.4, z: -6.42, rotY: Math.PI });
    c.place('crystal_sconce', { x: 13.5, y: y0 + 2.4, z: -6.42, rotY: Math.PI });

    // Hero Backdrop Frame Corner Crystal Ornaments & Floor Studio Lamps
    c.place('crystal_sconce', { x: 15.05, y: y0 + 3.65, z: -12.75, rotY: -Math.PI / 2, scale: 1.35 });
    c.place('crystal_sconce', { x: 15.05, y: y0 + 3.65, z: -8.45, rotY: -Math.PI / 2, scale: 1.35 });
    c.place('miniature_lamp', { x: 14.4, y: y0, z: -12.4, scale: 1.8 });
    c.place('miniature_lamp', { x: 14.4, y: y0, z: -8.8, scale: 1.8 });

    // Photographer's Side Utility Table beside Tripod (film canisters, lens caps, notebook, gold scissors)
    c.place('miniature_table', { x: 10.2, y: y0, z: -11.45, scale: 3.6, color: '#fff1f2' });
    c.placeCluster(10.2, y0 + 0.39, -11.45, [
      { type: 'camera_accessory', dx: -0.12, dz: -0.06, color: '#1e1b4b' },
      { type: 'camera_accessory', dx: 0.06, dz: -0.08, rotY: 0.9, color: '#831843' },
      { type: 'small_book', dx: 0.1, dz: 0.08, rotZ: Math.PI / 2, scale: 0.85, color: '#f472b6' },
      { type: 'tiny_scissors', dx: -0.08, dz: 0.1, rotY: 0.4, color: '#fbbf24' },
    ]);

    // Makeup & Preparation Vanity Stool + Tabletop Cosmetics & Perfume Vignette
    c.place('miniature_chair', { x: 13.6, y: y0, z: -13.95, rotY: Math.PI, scale: 3.4, color: '#e3d7f4' });
    c.placeCluster(13.6, y0 + 0.76, -14.6, [
      { type: 'perfume_bottle', dx: -0.62, dz: 0.06, scale: 1.15, color: '#f43f5e' },
      { type: 'perfume_bottle', dx: -0.48, dz: 0.12, rotY: 0.4, scale: 0.95, color: '#c084fc' },
      { type: 'perfume_bottle', dx: -0.36, dz: 0.04, rotY: -0.3, scale: 1.05, color: '#38bdf8' },
      { type: 'cosmetic_bottle', dx: -0.18, dz: 0.10, scale: 1.1, color: '#fbcfe8' },
      { type: 'cosmetic_bottle', dx: -0.06, dz: 0.14, scale: 0.9, color: '#fde047' },
      { type: 'jewellery_box', dx: 0.16, dz: 0.06, rotY: -0.18, scale: 1.15, color: '#ddd6fe' },
      { type: 'jewelry_piece', dx: 0.38, dz: 0.10, rotY: 0.25, scale: 0.95, color: '#831843' },
      { type: 'decorative_mirror', dx: 0.56, dz: 0.04, rotY: -0.4, scale: 1.1, color: '#fbcfe8' },
      { type: 'flower_vase', dx: -0.74, dz: -0.12, scale: 1.15, color: '#f472b6' },
      { type: 'craft_supply', dx: 0.68, dz: 0.12, rotY: 0.8, scale: 0.95, color: '#fb7185' },
    ]);

    // Wardrobe Corner Hangers, Couture Handbags, Heeled Shoes & Hat Box
    const dressColors = ['#f472b6', '#c084fc', '#38bdf8', '#fbcfe8', '#fef08a', '#be185d'];
    for (let d = 0; d < 6; d++) {
      c.place('clothing_hanger', {
        x: 10.0 - 0.7 + d * 0.27,
        y: y0 + 1.44,
        z: -6.9,
        color: dressColors[d],
      });
    }
    c.place('handbag', { x: 10.65, y: y0, z: -6.72, rotY: -0.3, scale: 1.15, color: '#f43f5e' });
    c.place('shoe_pair', { x: 9.45, y: y0, z: -6.72, rotY: 0.15, scale: 1.1, color: '#fbcfe8' });
    c.place('shoe_pair', { x: 9.75, y: y0, z: -6.72, rotY: -0.1, scale: 1.1, color: '#fde047' });
    c.place('gift_box', { x: 10.35, y: y0, z: -6.75, rotY: 0.25, scale: 0.95, color: '#ddd6fe' });

    // Equipment Storage Cabinet Top Rolled Backdrops, Cases & Film Rolls
    c.placeCluster(10.4, y0 + 1.85, -14.6, [
      { type: 'fabric_roll', dx: -0.52, dz: 0, rotY: 0.08, scale: 1.1, color: '#f43f5e' },
      { type: 'fabric_roll', dx: 0.12, dz: 0.04, rotY: -0.12, scale: 1.05, color: '#c084fc' },
      { type: 'fabric_roll', dx: 0.55, dz: -0.04, rotY: 0.2, scale: 0.95, color: '#38bdf8' },
      { type: 'gift_box', dx: -0.18, dy: 0.11, dz: 0, rotY: 0.3, scale: 0.9, color: '#fef08a' },
      { type: 'camera_accessory', dx: 0.78, dz: 0.12, scale: 1.2, color: '#1e1b4b' },
      { type: 'camera_accessory', dx: -0.78, dz: 0.14, scale: 1.15, color: '#831843' },
    ]);
  }

  /**
   * Instantiates props specifically curated for Room 2: Harsha's Couture Corner (Mini Fashion Boutique)
   * within lx in [8.8, 15.3], lz in [-6.2, +6.2].
   */
  instantiateBoutiqueProps(y0: number): void {
    const c = this.composer;

    // Entrance Archway Crystal Pendant, Sconces & Floral Pedestals
    c.place('crystal_sconce', { x: 8.8, y: y0 + 3.55, z: 0.0, scale: 1.5 });
    c.place('crystal_sconce', { x: 8.58, y: y0 + 2.4, z: -1.55, rotY: -Math.PI / 2 });
    c.place('crystal_sconce', { x: 8.58, y: y0 + 2.4, z: 1.55, rotY: -Math.PI / 2 });
    c.place('flower_vase', { x: 8.45, y: y0, z: -1.8, scale: 1.3, color: '#f43f5e' });
    c.place('flower_vase', { x: 8.45, y: y0, z: 1.8, scale: 1.3, color: '#c084fc' });

    // South & North Display Window Vignettes
    c.placeCluster(9.4, y0 + 0.24, -3.5, [
      { type: 'flower_vase', dx: 0.42, dz: 0.42, scale: 1.25, color: '#f43f5e' },
      { type: 'flower_vase', dx: -0.35, dz: -0.42, scale: 1.15, color: '#fbcfe8' },
      { type: 'handbag', dx: 0.35, dz: -0.38, rotY: -0.6, scale: 1.1, color: '#fde047' },
      { type: 'shoe_pair', dx: -0.38, dz: 0.36, rotY: 0.8, scale: 1.1, color: '#f43f5e' },
    ]);
    c.placeCluster(9.4, y0 + 0.24, 3.5, [
      { type: 'flower_vase', dx: 0.42, dz: -0.42, scale: 1.25, color: '#c084fc' },
      { type: 'gift_box', dx: -0.35, dz: 0.38, rotY: 0.4, scale: 0.95, color: '#fbcfe8' },
      { type: 'perfume_bottle', dx: 0.32, dz: 0.35, scale: 1.3, color: '#38bdf8' },
    ]);

    // Boutique Checkout Countertop Cluster
    c.placeCluster(11.8, y0 + 0.86, -2.6, [
      { type: 'jewellery_box', dx: 0.08, dz: 0.04, rotY: 0.12, scale: 1.1, color: '#fbcfe8' },
      { type: 'jewelry_piece', dx: 0.26, dz: 0.06, rotY: -0.2, scale: 0.95, color: '#831843' },
      { type: 'handbag', dx: 0.52, dz: -0.04, rotY: 0.35, scale: 1.05, color: '#f43f5e' },
      { type: 'perfume_bottle', dx: -0.08, dz: -0.12, scale: 1.05, color: '#fde047' },
      { type: 'flower_vase', dx: -0.60, dz: 0.08, scale: 1.15, color: '#f472b6' },
      { type: 'picture_frame', dx: 0.62, dz: 0.12, rotY: -0.4, scale: 0.85, color: '#ddd6fe' },
    ]);

    // Packaging Shelf: Tilted Stacked Gift Boxes & Satin Ribbon Rolls
    c.placeStack('gift_box', {
      x: 14.78,
      y: y0 + 1.65,
      z: -2.18,
      itemHeight: 0.16,
      count: 4,
      baseRotY: 0.2,
      yawStep: 0.28,
      tiltStep: 0.035,
      palette: CREATIVE_WING_COUTURE_PALETTE,
    });
    c.placeStack('gift_box', {
      x: 14.78,
      y: y0 + 1.65,
      z: -1.62,
      itemHeight: 0.16,
      count: 3,
      baseRotY: -0.3,
      yawStep: -0.22,
      tiltStep: 0.03,
      palette: CREATIVE_WING_PASTEL_PALETTE,
    });
    c.placeRow('ribbon_roll', {
      startX: 14.65,
      startY: y0 + 1.65,
      startZ: -1.95,
      stepZ: 0.12,
      count: 3,
      palette: CREATIVE_WING_PASTEL_PALETTE,
    });

    // Glass Jewellery Counter Display (6 Luxury Tiara/Necklace/Ring Displays + Mirror & Perfumes)
    c.placeRow('jewelry_piece', {
      startX: 14.78,
      startY: y0 + 0.86,
      startZ: -0.75,
      stepZ: 0.38,
      count: 6,
      baseRotY: -Math.PI / 2,
      yawJitter: 0.12,
      tiltJitter: 0.01,
      baseScale: 1.15,
      palette: ['#831843', '#4c0519', '#581c87', '#9d174d', '#be185d', '#3b0764'],
    });
    c.place('decorative_mirror', {
      x: 14.75,
      y: y0 + 1.20,
      z: 0.2,
      rotY: -Math.PI / 2,
      scale: 1.25,
    });
    c.place('perfume_bottle', { x: 14.75, y: y0 + 1.20, z: -0.65, scale: 1.15, color: '#f43f5e' });
    c.place('perfume_bottle', { x: 14.75, y: y0 + 1.20, z: 1.05, scale: 1.15, color: '#c084fc' });

    // North Wall 3-Tiered Couture Shoe Display (18 pairs = 36 shoes)
    [0.22, 0.52, 0.82].forEach((tierY, tierIdx) => {
      c.placeRow('shoe_pair', {
        startX: 11.05,
        startY: y0 + tierY,
        startZ: 5.3,
        stepX: 0.38,
        count: 6,
        baseRotY: Math.PI,
        yawJitter: 0.14,
        tiltJitter: 0.02,
        baseScale: 1.05,
        palette: CREATIVE_WING_PASTEL_PALETTE,
        seed: 100 + tierIdx * 37,
      });
    });

    // South Wall 3-Tiered Handbag Display (15 couture bags)
    [0.42, 0.87, 1.32].forEach((tierY, tierIdx) => {
      c.placeRow('handbag', {
        startX: 11.05,
        startY: y0 + tierY,
        startZ: -5.3,
        stepX: 0.46,
        count: 5,
        baseRotY: 0,
        yawJitter: 0.16,
        tiltJitter: 0.02,
        baseScale: 1.05,
        palette: CREATIVE_WING_PASTEL_PALETTE,
        seed: 200 + tierIdx * 53,
      });
    });

    // Mini Tailoring Station (sewing kit pincushion, tiny scissors, measuring tape, ribbon spools, fabric bolts, lookbook)
    c.placeCluster(14.6, y0 + 0.74, 3.8, [
      { type: 'sewing_kit', dx: 0.14, dz: 0.08, scale: 1.15, color: '#f43f5e' },
      { type: 'tiny_scissors', dx: -0.16, dz: 0.22, rotY: 0.5, scale: 1.15, color: '#fbbf24' },
      { type: 'measuring_tape', dx: 0.16, dz: 0.32, rotY: -0.4, scale: 1.2, color: '#fde047' },
      { type: 'ribbon_roll', dx: -0.18, dz: 0.42, scale: 1.05, color: '#c084fc' },
      { type: 'ribbon_roll', dx: -0.06, dz: 0.48, scale: 0.95, color: '#f472b6' },
      { type: 'ribbon_roll', dx: 0.06, dz: 0.45, scale: 1.0, color: '#38bdf8' },
      { type: 'fabric_roll', dx: -0.05, dz: -0.52, rotY: 0.3, scale: 0.85, color: '#fbcfe8' },
      { type: 'fabric_roll', dx: 0.12, dz: 0.56, rotY: -0.25, scale: 0.8, color: '#ddd6fe' },
      { type: 'small_book', dx: -0.22, dz: -0.45, rotZ: Math.PI / 2, scale: 0.95, color: '#831843' },
    ]);

    // Semi-Private Fitting Area (velvet stool chair, side table, flower vase, heeled shoes)
    c.place('miniature_chair', { x: 14.1, y: y0, z: -3.55, rotY: -0.8, scale: 3.4, color: '#fbcfe8' });
    c.place('miniature_table', { x: 14.2, y: y0, z: -4.25, scale: 3.2, color: '#fff1f2' });
    c.place('flower_vase', { x: 14.2, y: y0 + 0.35, z: -4.25, scale: 1.15, color: '#f43f5e' });
    c.place('shoe_pair', { x: 13.95, y: y0, z: -3.95, rotY: 0.5, scale: 1.05, color: '#c084fc' });
  }

  /**
   * Instantiates props specifically curated for Room 3: The Little Dream World (Doll Playroom)
   * within lx in [9.2, 15.3], lz in [+6.2, +15.2].
   */
  instantiateDollPlayroomProps(y0: number, yCeil: number): void {
    const c = this.composer;

    // Entrance Sconces & Ceiling Cloud Star Drops
    c.place('crystal_sconce', { x: 10.5, y: y0 + 2.4, z: 5.98, rotY: Math.PI });
    c.place('crystal_sconce', { x: 13.5, y: y0 + 2.4, z: 5.98, rotY: Math.PI });
    c.place('crystal_sconce', { x: 10.5, y: y0 + 2.4, z: 6.42, rotY: 0 });
    c.place('crystal_sconce', { x: 13.5, y: y0 + 2.4, z: 6.42, rotY: 0 });
    [
      [11.2, 9.2],
      [13.3, 10.4],
      [11.8, 12.2],
    ].forEach(([cx, cz]) => {
      c.place('crystal_sconce', { x: cx + 0.1, y: yCeil - 0.8, z: cz, scale: 1.25 });
    });

    // Tabletop Miniature Castle & Village Ring of Miniature Trees & Lamp Posts
    c.placeRing('miniature_tree', {
      centerX: 12.25,
      centerY: y0 + 0.55,
      centerZ: 10.6,
      radius: 1.28,
      count: 10,
      baseScale: 1.05,
      scaleVariation: 0.15,
      palette: ['#a7f3d0', '#fbcfe8', '#c084fc', '#86efac', '#fda4af'],
    });
    c.placeRing('miniature_lamp', {
      centerX: 12.25,
      centerY: y0 + 0.55,
      centerZ: 10.6,
      radius: 0.72,
      count: 6,
      baseScale: 0.9,
      palette: CREATIVE_WING_PASTEL_PALETTE,
      startAngle: 0.3,
    });

    // 4-Room Open Dollhouse Interior Furniture (Living Room, Kitchen, Bedroom, Bathroom)
    c.placeCluster(14.72, y0 + 0.06, 10.0, [
      { type: 'miniature_table', dx: 0, dz: 0, scale: 1.5, color: '#fff1f2' },
      { type: 'miniature_chair', dx: 0, dz: -0.25, rotY: 0, scale: 1.4, color: '#f472b6' },
      { type: 'miniature_chair', dx: 0, dz: 0.25, rotY: Math.PI, scale: 1.4, color: '#f472b6' },
      { type: 'miniature_lamp', dx: -0.1, dz: -0.42, scale: 1.25 },
      { type: 'flower_vase', dx: 0, dy: 0.16, dz: 0, scale: 0.65, color: '#fb7185' },
    ]);
    c.placeCluster(14.72, y0 + 0.06, 11.2, [
      { type: 'miniature_table', dx: 0, dz: -0.15, scale: 1.45, color: '#fef08a' },
      { type: 'miniature_chair', dx: 0, dz: 0.15, rotY: Math.PI, scale: 1.35, color: '#38bdf8' },
      { type: 'cosmetic_bottle', dx: 0, dy: 0.15, dz: -0.15, scale: 0.85, color: '#f43f5e' },
      { type: 'gift_box', dx: -0.08, dz: 0.42, scale: 0.9, color: '#a7f3d0' },
    ]);
    c.placeCluster(14.72, y0 + 0.93, 10.0, [
      { type: 'gift_box', dx: 0, dz: -0.15, scale: 1.35, color: '#c084fc' },
      { type: 'teddy_bear', dx: 0.04, dy: 0.18, dz: -0.15, rotY: -Math.PI / 2, scale: 0.75, color: '#fbcfe8' },
      { type: 'miniature_lamp', dx: -0.08, dz: 0.28, scale: 1.15 },
      { type: 'decorative_mirror', dx: -0.05, dz: 0.44, rotY: -Math.PI / 2, scale: 0.95 },
    ]);
    c.placeCluster(14.72, y0 + 0.93, 11.2, [
      { type: 'decorative_mirror', dx: -0.06, dz: -0.22, rotY: -Math.PI / 2, scale: 1.15 },
      { type: 'perfume_bottle', dx: 0, dz: 0.08, scale: 0.95, color: '#38bdf8' },
      { type: 'cosmetic_bottle', dx: 0, dz: 0.24, scale: 0.95, color: '#fbcfe8' },
    ]);

    // LEGO-Style Construction Corner (30 studded blocks + 5-block tower stack)
    for (let row = 0; row < 5; row++) {
      c.placeRow('toy_block', {
        startX: 9.78,
        startY: y0 + 0.55,
        startZ: 7.05 + row * 0.17,
        stepX: 0.17,
        count: 6,
        yawJitter: 0.35,
        tiltJitter: 0.02,
        baseScale: 1.0,
        palette: CREATIVE_WING_TOY_PALETTE,
        seed: 300 + row * 29,
      });
    }
    c.placeStack('toy_block', {
      x: 10.2,
      y: y0 + 0.61,
      z: 7.4,
      itemHeight: 0.058,
      count: 5,
      yawStep: 0.12,
      tiltStep: 0.01,
      scaleDecay: 0.96,
      palette: CREATIVE_WING_TOY_PALETTE,
    });

    // Craft Table & Reading Chair Corner
    c.place('miniature_chair', { x: 13.55, y: y0, z: 7.4, rotY: Math.PI / 2, scale: 3.2, color: '#e3d7f4' });
    c.placeCluster(14.3, y0 + 0.52, 7.4, [
      { type: 'craft_supply', dx: -0.22, dz: -0.14, scale: 1.2, color: '#f43f5e' },
      { type: 'craft_supply', dx: -0.08, dz: -0.20, rotY: 0.7, scale: 1.15, color: '#38bdf8' },
      { type: 'craft_supply', dx: 0.08, dz: -0.18, rotY: -0.5, scale: 1.1, color: '#eab308' },
      { type: 'tiny_scissors', dx: 0.18, dz: 0.12, rotY: 0.4, scale: 1.15, color: '#ec4899' },
      { type: 'ribbon_roll', dx: -0.18, dz: 0.18, scale: 1.0, color: '#a855f7' },
      { type: 'small_book', dx: 0.05, dz: 0.22, rotZ: Math.PI / 2, scale: 0.95, color: '#f472b6' },
    ]);

    // North Toy Shelf & Miniature Storybook Library (2 Teddy Bears + 14 Storybooks)
    c.place('teddy_bear', { x: 11.35, y: y0 + 1.60, z: 14.6, rotY: -0.2, scale: 1.35, color: '#fbcfe8' });
    c.place('teddy_bear', { x: 12.95, y: y0 + 1.60, z: 14.6, rotY: 0.25, scale: 1.2, color: '#ddd6fe' });
    c.placeRow('small_book', {
      startX: 11.65,
      startY: y0 + 1.60,
      startZ: 14.6,
      stepX: 0.075,
      count: 14,
      yawJitter: 0.06,
      tiltJitter: 0.05,
      baseScale: 1.05,
      palette: CREATIVE_WING_PASTEL_PALETTE,
      seed: 501,
    });

    // Doll Bedroom Corner (Teddy Bear on bed, bedside table, lamp, treasure box)
    c.place('teddy_bear', { x: 10.15, y: y0 + 0.28, z: 13.8, rotY: 0.6, scale: 1.1, color: '#f472b6' });
    c.place('miniature_table', { x: 9.65, y: y0, z: 14.3, scale: 2.6, color: '#fff1f2' });
    c.place('miniature_lamp', { x: 9.65, y: y0 + 0.28, z: 14.3, scale: 1.35 });
    c.place('jewellery_box', { x: 10.65, y: y0, z: 14.3, rotY: -0.3, scale: 1.4, color: '#c084fc' });

    // Indoor Miniature Raised Garden (Mini trees, flowers, glowing lantern, tiny chair)
    c.placeCluster(14.4, y0 + 0.26, 13.8, [
      { type: 'miniature_tree', dx: -0.18, dz: -0.12, scale: 1.85, color: '#a7f3d0' },
      { type: 'miniature_tree', dx: 0.22, dz: -0.16, scale: 1.45, color: '#fbcfe8' },
      { type: 'miniature_tree', dx: -0.05, dz: 0.24, scale: 1.55, color: '#c084fc' },
      { type: 'flower_vase', dx: 0.18, dz: 0.18, scale: 1.1, color: '#f43f5e' },
      { type: 'miniature_lamp', dx: -0.28, dz: 0.15, scale: 1.25 },
      { type: 'miniature_chair', dx: 0.02, dz: -0.02, rotY: -0.7, scale: 1.2, color: '#fde047' },
    ]);
  }

  /**
   * Compiles all room-specific prop instantiations into 3 static batched meshes.
   */
  compileIntoGroup(targetGroup: THREE.Group): {
    totalPropsPlaced: number;
    drawCallsAdded: number;
  } {
    return this.composer.buildAndAttach(targetGroup);
  }
}
