import * as THREE from 'three';
import { mergeGeometries as threeMergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges an array of BufferGeometries, ensuring they are compatible by:
 * 1. Standardizing index status (converting to non-indexed if mixed)
 * 2. Standardizing attributes (ensuring missing attributes like uv/normal are populated or harmonized)
 * 3. Never returning null so downstream callers never crash
 */
export function mergeCompatibleGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) return new THREE.BufferGeometry();
  if (geos.length === 1) return geos[0].clone();

  // Always convert all geometries to non-indexed to ensure 100% indexing compatibility
  const processedGeos = geos.map((g) => (g.index !== null ? g.toNonIndexed() : g.clone()));

  // Find all attribute names across geometries
  const attrNameSet = new Set<string>();
  processedGeos.forEach((g) => {
    Object.keys(g.attributes).forEach((name) => attrNameSet.add(name));
  });

  // Harmonize attributes across all geometries
  attrNameSet.forEach((attrName) => {
    const presentInAll = processedGeos.every((g) => g.attributes[attrName] !== undefined);
    if (!presentInAll) {
      if (attrName === 'uv') {
        // If uv is missing on some, synthesize default uvs
        processedGeos.forEach((g) => {
          if (!g.attributes['uv']) {
            const count = g.attributes.position.count;
            g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
          }
        });
      } else if (attrName === 'normal') {
        // If normal is missing, compute it
        processedGeos.forEach((g) => {
          if (!g.attributes['normal']) {
            g.computeVertexNormals();
          }
        });
      } else {
        // For other custom attributes, delete from geometries that have it
        processedGeos.forEach((g) => {
          if (g.attributes[attrName]) {
            g.deleteAttribute(attrName);
          }
        });
      }
    }
  });

  const merged = threeMergeGeometries(processedGeos);
  if (merged) {
    return merged;
  }

  // Safe fallback if threeMergeGeometries failed
  return processedGeos[0] || new THREE.BufferGeometry();
}
