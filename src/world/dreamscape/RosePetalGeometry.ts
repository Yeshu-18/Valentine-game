import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';

export interface RosePetalGeometryOptions {
  /** Radial length of the petal from inner crown ring to outer tip (meters) */
  length?: number;
  /** Maximum width of the petal across its widest belly (meters) */
  maxWidth?: number;
  /** Inner stem width where the petal meets the central crown ring (meters) */
  baseWidth?: number;
  /** Extrusion thickness of the translucent petal shell (meters) */
  thickness?: number;
  /** Upward radial dome arch height across the span of the petal (meters) */
  archHeight?: number;
  /** Transverse concave cupping lift across the petal belly (meters) */
  cupDepth?: number;
  /** Elevation at the inner base of the petal relative to the dome origin (meters) */
  innerElevation?: number;
  /** Elevation at the outer tip of the petal relative to the dome origin (meters) */
  outerElevation?: number;
  /** Radius of the champagne-gold perimeter trim tube (meters) */
  trimRadius?: number;
  /** Curve subdivision segments for smooth Bezier silhouette */
  curveSegments?: number;
}

export interface RosePetalDomeAssemblyOptions {
  /** Outer radius of the 8-petal dome (meters) */
  outerRadius?: number;
  /** Elliptical Z-stretch factor to fit the Heart Gallery bay */
  stretchZ?: number;
  /** Number of large radial petals (defaults to 8) */
  petalCount?: number;
  /** Include overlapping inner 8-petal rosette tier */
  includeInnerTier?: boolean;
}

/**
 * Modular, GPU-optimized 3D Rose Petal Geometry generator for the Heart Gallery Ceiling.
 * Uses `THREE.Shape` and `THREE.ExtrudeGeometry` with a 3D dome-vault vertex deformation pass
 * and matching 3D champagne-gold perimeter trim derived from the exact same `THREE.Shape` contour.
 */
export class RosePetalGeometry extends THREE.ExtrudeGeometry {
  public readonly petalShape: THREE.Shape;
  public readonly options: Required<RosePetalGeometryOptions>;

  constructor(options: RosePetalGeometryOptions = {}) {
    const resolved: Required<RosePetalGeometryOptions> = {
      length: options.length ?? 3.85,
      maxWidth: options.maxWidth ?? 2.38,
      baseWidth: options.baseWidth ?? 0.34,
      thickness: options.thickness ?? 0.024,
      archHeight: options.archHeight ?? 0.11,
      cupDepth: options.cupDepth ?? 0.085,
      innerElevation: options.innerElevation ?? 0.03,
      outerElevation: options.outerElevation ?? -0.03,
      trimRadius: options.trimRadius ?? 0.034,
      curveSegments: options.curveSegments ?? 24,
    };

    const shape = RosePetalGeometry.createPetalShape(
      resolved.length,
      resolved.maxWidth,
      resolved.baseWidth,
    );

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: resolved.thickness,
      bevelEnabled: true,
      bevelThickness: resolved.thickness * 0.45,
      bevelSize: resolved.thickness * 0.55,
      bevelSegments: 2,
      curveSegments: resolved.curveSegments,
    };

    super(shape, extrudeSettings);

    this.petalShape = shape;
    this.options = resolved;

    this.apply3DDomeCurvature();
  }

  /**
   * Builds a 2D `THREE.Shape` silhouette for a single royal rose petal:
   * - Starts at `(0, 0)` (inner crown attachment) with `baseWidth`
   * - Swells smoothly via cubic Bezier curves to `maxWidth` across the upper-middle belly
   * - Tapers to a delicate scalloped cusp at `(0, length)` (outer petal tip)
   */
  public static createPetalShape(
    length: number,
    maxWidth: number,
    baseWidth: number,
  ): THREE.Shape {
    const shape = new THREE.Shape();
    const halfBase = baseWidth * 0.5;
    const halfMax = maxWidth * 0.5;

    // Start at bottom-left of petal base
    shape.moveTo(-halfBase, 0);

    // Left lower-to-mid petal curve (swelling outward into the lush rose-petal belly)
    shape.bezierCurveTo(
      -halfMax * 0.72,
      length * 0.18,
      -halfMax * 1.12,
      length * 0.52,
      -halfMax * 0.88,
      length * 0.76,
    );

    // Left upper shoulder tapering to the pointed outer rose-petal tip at (0, length)
    shape.bezierCurveTo(
      -halfMax * 0.64,
      length * 0.91,
      -halfMax * 0.22,
      length * 0.98,
      0,
      length,
    );

    // Right upper shoulder from pointed tip (0, length) down to right belly
    shape.bezierCurveTo(
      halfMax * 0.22,
      length * 0.98,
      halfMax * 0.64,
      length * 0.91,
      halfMax * 0.88,
      length * 0.76,
    );

    // Right mid-to-lower curve returning to inner crown base
    shape.bezierCurveTo(
      halfMax * 1.12,
      length * 0.52,
      halfMax * 0.72,
      length * 0.18,
      halfBase,
      0,
    );

    // Close inner base arc
    shape.quadraticCurveTo(0, -length * 0.015, -halfBase, 0);

    return shape;
  }

  /**
   * Projects a 2D shape coordinate `(sx, sy, sz)` into 3D ceiling-dome space `(wx, wy, wz)`
   * where `sy` (`0..length`) maps to radial distance `+Z`, `sx` maps to lateral width `X`,
   * and `wy` combines the radial dome arch + transverse concave petal cupping.
   */
  public projectShapePointTo3D(sx: number, sy: number, sz = 0): THREE.Vector3 {
    const { length, maxWidth, archHeight, cupDepth, innerElevation, outerElevation } =
      this.options;

    const v = THREE.MathUtils.clamp(sy / Math.max(0.001, length), 0, 1);
    const halfSpanAtV = Math.max(0.08, maxWidth * 0.5 * Math.sin(Math.pow(v, 0.65) * Math.PI * 0.95));
    const normU = THREE.MathUtils.clamp(sx / halfSpanAtV, -1, 1);

    // Radial dome arch profile from inner crown ring (v=0) to outer petal tip (v=1)
    const radialBaseY =
      THREE.MathUtils.lerp(innerElevation, outerElevation, v) +
      Math.sin(v * Math.PI) * archHeight;

    // Transverse concave cupping: center of petal (normU = 0) vaults upward while gold-trimmed edges dip slightly
    const transverseCupY =
      (1 - normU * normU) * cupDepth * (0.25 + 0.75 * Math.sin(v * Math.PI));

    // Clamp top elevation below +0.182m so the petal never clips into the ceiling backing plane above
    const wy = Math.min(0.182, radialBaseY + transverseCupY + sz);

    return new THREE.Vector3(sx, wy, sy);
  }

  /**
   * Deforms the `THREE.ExtrudeGeometry` vertices in-place from flat 2D XY extrusion into
   * a 3D vaulted ceiling petal oriented along `+Z` (radial) and `+Y` (upward dome arch),
   * and normalizes UVs to `[0, 1]` across petal width (`u`) and radial length (`v`).
   */
  private apply3DDomeCurvature(): void {
    const posAttr = this.getAttribute('position') as THREE.BufferAttribute;
    const uvAttr = this.getAttribute('uv') as THREE.BufferAttribute;
    const { length, maxWidth, thickness } = this.options;
    const halfMax = Math.max(0.001, maxWidth * 0.5);

    const projected = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      const sx = posAttr.getX(i);
      const sy = posAttr.getY(i);
      const sz = posAttr.getZ(i) - thickness * 0.5;

      projected.copy(this.projectShapePointTo3D(sx, sy, sz));
      posAttr.setXYZ(i, projected.x, projected.y, projected.z);

      if (uvAttr) {
        const v = THREE.MathUtils.clamp(sy / Math.max(0.001, length), 0, 1);
        const envelope = Math.max(0.18, Math.sin(Math.pow(v, 0.65) * Math.PI * 0.95));
        const u = THREE.MathUtils.clamp(sx / (halfMax * envelope) * 0.5 + 0.5, 0, 1);
        uvAttr.setXY(i, u, v);
      }
    }

    posAttr.needsUpdate = true;
    if (uvAttr) uvAttr.needsUpdate = true;
    this.computeVertexNormals();
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }

  /**
   * Generates a 3D tubular champagne-gold trim geometry (`THREE.TubeGeometry`) that follows
   * the exact 3D curved outer boundary of the `THREE.Shape` rose petal.
   */
  public createChampagneGoldTrimGeometry(
    tracker?: ResourceTracker,
    radiusOverride?: number,
    radialOffset = 1.0,
    verticalOffset = -0.012,
  ): THREE.TubeGeometry {
    const shapePts2D = this.petalShape.getSpacedPoints(this.options.curveSegments * 2);
    const curvePts3D: THREE.Vector3[] = [];

    for (let i = 0; i < shapePts2D.length; i++) {
      const pt = shapePts2D[i];
      const p3 = this.projectShapePointTo3D(pt.x * radialOffset, pt.y * radialOffset, verticalOffset);
      curvePts3D.push(p3);
    }

    const trimCurve = new THREE.CatmullRomCurve3(curvePts3D, true);
    const tubeGeo = new THREE.TubeGeometry(
      trimCurve,
      this.options.curveSegments * 2,
      radiusOverride ?? this.options.trimRadius,
      8,
      true,
    );

    if (tracker) {
      tracker.trackGeo(tubeGeo);
    }
    return tubeGeo;
  }

  /**
   * Builds a modular, GPU-optimized 8-petal translucent dome assembly with champagne-gold trim
   * and warm glowing inner seams, reusing shared geometries across all 8 radial petals.
   */
  public static createEightPetalDomeAssembly(
    tracker: ResourceTracker,
    outerPetalMat: THREE.Material,
    innerPetalMat: THREE.Material,
    goldTrimMat: THREE.Material,
    warmSeamGlowMat: THREE.Material,
    assemblyOptions: RosePetalDomeAssemblyOptions = {},
  ): {
    group: THREE.Group;
    outerTipPositions: THREE.Vector3[];
    innerTipPositions: THREE.Vector3[];
  } {
    const outerRadius = assemblyOptions.outerRadius ?? 4.62;
    const stretchZ = assemblyOptions.stretchZ ?? 1.08;
    const petalCount = assemblyOptions.petalCount ?? 8;
    const includeInnerTier = assemblyOptions.includeInnerTier ?? true;

    const group = new THREE.Group();
    group.name = 'RosePetalEightPetalDome';
    group.scale.set(1.0, 1.0, stretchZ);

    const outerTipPositions: THREE.Vector3[] = [];
    const innerTipPositions: THREE.Vector3[] = [];

    // 1. Shared Outer Ring RosePetalGeometry (8 large curved translucent petals reaching the outer cornice ring)
    const outerInnerStartR = 0.72;
    const outerPetalLen = outerRadius - outerInnerStartR - 0.08;
    const outerPetalWidth = (2 * Math.PI * (outerRadius * 0.64)) / petalCount * 1.24;

    const outerPetalGeo = tracker.trackGeo(
      new RosePetalGeometry({
        length: outerPetalLen,
        maxWidth: outerPetalWidth,
        baseWidth: 0.36,
        thickness: 0.022,
        archHeight: 0.095,
        cupDepth: 0.082,
        innerElevation: 0.06,
        outerElevation: -0.02,
        trimRadius: 0.034,
        curveSegments: 22,
      }),
    );

    const outerGoldTrimGeo = outerPetalGeo.createChampagneGoldTrimGeometry(
      tracker,
      0.034,
      1.0,
      -0.014,
    );
    const outerWarmSeamGeo = outerPetalGeo.createChampagneGoldTrimGeometry(
      tracker,
      0.02,
      0.975,
      0.005,
    );

    // 2. Shared Inner Ring RosePetalGeometry (8 overlapping curved translucent petals rotated by half-step)
    const innerStartR = 0.44;
    const innerOuterEndR = outerRadius * 0.68;
    const innerPetalLen = innerOuterEndR - innerStartR;
    const innerPetalWidth = (2 * Math.PI * (innerOuterEndR * 0.66)) / petalCount * 1.28;

    const innerPetalGeo = tracker.trackGeo(
      new RosePetalGeometry({
        length: innerPetalLen,
        maxWidth: innerPetalWidth,
        baseWidth: 0.28,
        thickness: 0.024,
        archHeight: 0.11,
        cupDepth: 0.09,
        innerElevation: 0.01,
        outerElevation: -0.05,
        trimRadius: 0.036,
        curveSegments: 22,
      }),
    );

    const innerGoldTrimGeo = innerPetalGeo.createChampagneGoldTrimGeometry(
      tracker,
      0.036,
      1.0,
      -0.015,
    );
    const innerWarmSeamGeo = innerPetalGeo.createChampagneGoldTrimGeometry(
      tracker,
      0.022,
      0.972,
      0.006,
    );

    // Instantiate the 8 radial petals using shared geometries
    for (let i = 0; i < petalCount; i++) {
      const outerYaw = (i / petalCount) * Math.PI * 2;
      const outerPivot = new THREE.Group();
      outerPivot.rotation.y = outerYaw;

      const outerPetalMesh = new THREE.Mesh(outerPetalGeo, outerPetalMat);
      outerPetalMesh.position.z = outerInnerStartR;
      const outerTrimMesh = new THREE.Mesh(outerGoldTrimGeo, goldTrimMat);
      outerTrimMesh.position.z = outerInnerStartR;
      const outerSeamMesh = new THREE.Mesh(outerWarmSeamGeo, warmSeamGlowMat);
      outerSeamMesh.position.z = outerInnerStartR;

      outerPivot.add(outerPetalMesh, outerTrimMesh, outerSeamMesh);
      group.add(outerPivot);

      const outerTipR = outerInnerStartR + outerPetalLen;
      outerTipPositions.push(
        new THREE.Vector3(
          Math.sin(outerYaw) * outerTipR,
          -0.03,
          Math.cos(outerYaw) * outerTipR,
        ),
      );

      if (includeInnerTier) {
        const innerYaw = outerYaw + Math.PI / petalCount;
        const innerPivot = new THREE.Group();
        innerPivot.rotation.y = innerYaw;

        const innerPetalMesh = new THREE.Mesh(innerPetalGeo, innerPetalMat);
        innerPetalMesh.position.set(0, -0.022, innerStartR);
        const innerTrimMesh = new THREE.Mesh(innerGoldTrimGeo, goldTrimMat);
        innerTrimMesh.position.set(0, -0.022, innerStartR);
        const innerSeamMesh = new THREE.Mesh(innerWarmSeamGeo, warmSeamGlowMat);
        innerSeamMesh.position.set(0, -0.022, innerStartR);

        innerPivot.add(innerPetalMesh, innerTrimMesh, innerSeamMesh);
        group.add(innerPivot);

        const innerTipR = innerStartR + innerPetalLen;
        innerTipPositions.push(
          new THREE.Vector3(
            Math.sin(innerYaw) * innerTipR,
            -0.06,
            Math.cos(innerYaw) * innerTipR,
          ),
        );
      }
    }

    return {
      group,
      outerTipPositions,
      innerTipPositions,
    };
  }
}
