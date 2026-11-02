import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export interface InteractivePortraitExhibit {
  id: string; // 'portrait-0' through 'portrait-9'
  name: string;
  group: THREE.Group;
  defaultTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface PortraitTransformData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export type GalleryPlacementStorage = Record<string, PortraitTransformData>;

export const GALLERY_PLACEMENT_STORAGE_KEY = 'heart_island_gallery_placement_v2';

export interface HeartGalleryPlacementToolOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  domElement: HTMLElement;
  castleOrigin: THREE.Vector3;
  portraitExhibits: InteractivePortraitExhibit[];
  partitionMeshes: THREE.Mesh[];
  onActiveChange?: (active: boolean) => void;
  canActivate?: () => boolean;
}

export interface HeartGalleryPlacementTool {
  isActive: () => boolean;
  setActive: (active: boolean) => void;
  toggle: () => boolean;
  update: () => void;
  dispose: () => void;
}

export function createHeartGalleryPlacementTool(
  options: HeartGalleryPlacementToolOptions,
): HeartGalleryPlacementTool {
  const {
    scene,
    camera,
    domElement,
    castleOrigin,
    portraitExhibits,
    partitionMeshes,
    onActiveChange,
    canActivate,
  } = options;

  let active = false;
  let selectedIndex = 0;
  let transformMode: 'translate' | 'rotate' | 'scale' = 'translate';
  let snapEnabled = true;
  let spaceMode: 'local' | 'world' = 'local';
  let isGizmoDragging = false;
  let toastMessage: string | null = null;
  let toastTimer: number | null = null;

  // 1. TransformControls Setup
  const controls = new TransformControls(camera, domElement);
  controls.size = 0.85;
  controls.setMode(transformMode);
  controls.setSpace(spaceMode);
  applySnaps();

  const helper = controls.getHelper();
  helper.visible = false;
  scene.add(helper);

  // 2. Selection Box Helper
  const boxHelper = new THREE.BoxHelper(portraitExhibits[0].group, 0xf472b6);
  boxHelper.visible = false;
  scene.add(boxHelper);

  // 3. Raycaster for click selection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  // 4. Create HUD DOM
  const hudContainer = document.createElement('div');
  hudContainer.id = 'heart-gallery-placement-hud';
  hudContainer.style.display = 'none';
  hudContainer.style.position = 'fixed';
  hudContainer.style.top = '16px';
  hudContainer.style.right = '16px';
  hudContainer.style.zIndex = '9999';
  hudContainer.style.width = '380px';
  hudContainer.style.maxWidth = 'calc(100vw - 32px)';
  hudContainer.style.maxHeight = 'calc(100vh - 32px)';
  hudContainer.style.overflowY = 'auto';
  hudContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.94)';
  hudContainer.style.backdropFilter = 'blur(16px)';
  hudContainer.style.border = '1px solid rgba(244, 114, 182, 0.45)';
  hudContainer.style.borderRadius = '16px';
  hudContainer.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(244, 114, 182, 0.2)';
  hudContainer.style.color = '#fdf2f8';
  hudContainer.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
  hudContainer.style.padding = '18px';
  hudContainer.style.fontSize = '12px';
  hudContainer.style.userSelect = 'none';

  const parentMount = domElement.parentElement || document.body;
  parentMount.appendChild(hudContainer);

  function applySnaps() {
    if (snapEnabled) {
      controls.translationSnap = 0.05; // 0.05m
      controls.rotationSnap = THREE.MathUtils.degToRad(1); // 1 degree
      controls.scaleSnap = 0.01; // 0.01 scale
    } else {
      controls.translationSnap = null;
      controls.rotationSnap = null;
      controls.scaleSnap = null;
    }
  }

  function showToast(msg: string, durationMs = 3200) {
    toastMessage = msg;
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      toastMessage = null;
      toastTimer = null;
      renderHud();
    }, durationMs);
    renderHud();
  }

  function getSelectedExhibit(): InteractivePortraitExhibit | null {
    if (selectedIndex < 0 || selectedIndex >= portraitExhibits.length) return null;
    return portraitExhibits[selectedIndex];
  }

  function selectExhibit(index: number) {
    const nextIdx = ((index % portraitExhibits.length) + portraitExhibits.length) % portraitExhibits.length;
    selectedIndex = nextIdx;
    const exhibit = portraitExhibits[selectedIndex];
    if (exhibit && active) {
      controls.attach(exhibit.group);
      boxHelper.setFromObject(exhibit.group);
      boxHelper.visible = true;
    }
    renderHud();
  }

  // --- SAVE / LOAD / EXPORT / RESET ---
  function loadStoredPlacements(): GalleryPlacementStorage {
    try {
      const raw = localStorage.getItem(GALLERY_PLACEMENT_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore parse failure
    }
    return {};
  }

  function saveStoredPlacements(data: GalleryPlacementStorage) {
    try {
      localStorage.setItem(GALLERY_PLACEMENT_STORAGE_KEY, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[HeartGalleryPlacementTool] Failed to save placements to localStorage:', err);
    }
  }

  function saveSelected() {
    const exhibit = getSelectedExhibit();
    if (!exhibit) return;
    const storage = loadStoredPlacements();
    const g = exhibit.group;
    storage[exhibit.id] = {
      position: [
        parseFloat(g.position.x.toFixed(4)),
        parseFloat(g.position.y.toFixed(4)),
        parseFloat(g.position.z.toFixed(4)),
      ],
      rotation: [
        parseFloat(g.rotation.x.toFixed(4)),
        parseFloat(g.rotation.y.toFixed(4)),
        parseFloat(g.rotation.z.toFixed(4)),
      ],
      scale: [
        parseFloat(g.scale.x.toFixed(4)),
        parseFloat(g.scale.y.toFixed(4)),
        parseFloat(g.scale.z.toFixed(4)),
      ],
    };
    saveStoredPlacements(storage);
    showToast(`✓ Saved [${exhibit.id}] to localStorage!`);
  }

  function saveAll() {
    const storage = loadStoredPlacements();
    portraitExhibits.forEach((ex) => {
      const g = ex.group;
      storage[ex.id] = {
        position: [
          parseFloat(g.position.x.toFixed(4)),
          parseFloat(g.position.y.toFixed(4)),
          parseFloat(g.position.z.toFixed(4)),
        ],
        rotation: [
          parseFloat(g.rotation.x.toFixed(4)),
          parseFloat(g.rotation.y.toFixed(4)),
          parseFloat(g.rotation.z.toFixed(4)),
        ],
        scale: [
          parseFloat(g.scale.x.toFixed(4)),
          parseFloat(g.scale.y.toFixed(4)),
          parseFloat(g.scale.z.toFixed(4)),
        ],
      };
    });
    saveStoredPlacements(storage);
    showToast(`✓ Saved ALL ${portraitExhibits.length} portraits to localStorage!`);
  }

  function resetSelected() {
    const exhibit = getSelectedExhibit();
    if (!exhibit) return;
    const d = exhibit.defaultTransform;
    exhibit.group.position.set(d.position[0], d.position[1], d.position[2]);
    exhibit.group.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
    exhibit.group.scale.set(d.scale[0], d.scale[1], d.scale[2]);
    exhibit.group.updateMatrixWorld(true);

    const storage = loadStoredPlacements();
    delete storage[exhibit.id];
    saveStoredPlacements(storage);

    helper.updateMatrixWorld();
    boxHelper.setFromObject(exhibit.group);
    showToast(`↺ Reset [${exhibit.id}] to defaults`);
  }

  function resetAll() {
    portraitExhibits.forEach((ex) => {
      const d = ex.defaultTransform;
      ex.group.position.set(d.position[0], d.position[1], d.position[2]);
      ex.group.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
      ex.group.scale.set(d.scale[0], d.scale[1], d.scale[2]);
      ex.group.updateMatrixWorld(true);
    });
    try {
      localStorage.removeItem(GALLERY_PLACEMENT_STORAGE_KEY);
    } catch {
      // Ignore
    }
    const current = getSelectedExhibit();
    if (current) {
      boxHelper.setFromObject(current.group);
    }
    helper.updateMatrixWorld();
    showToast(`↺ Reset ALL ${portraitExhibits.length} portraits to default layout`);
  }

  function exportTypeScript() {
    const lines: string[] = [];
    lines.push('// Auto-generated Heart Gallery Portrait Layout from Developer Placement Tool');
    lines.push('export const HEART_GALLERY_PORTRAIT_LAYOUT = [');
    portraitExhibits.forEach((ex, idx) => {
      const g = ex.group;
      const pos = `[${g.position.x.toFixed(3)}, ${g.position.y.toFixed(3)}, ${g.position.z.toFixed(3)}]`;
      const rot = `[${g.rotation.x.toFixed(3)}, ${g.rotation.y.toFixed(3)}, ${g.rotation.z.toFixed(3)}]`;
      const scl = `[${g.scale.x.toFixed(3)}, ${g.scale.y.toFixed(3)}, ${g.scale.z.toFixed(3)}]`;
      lines.push('  {');
      lines.push(`    id: '${ex.id}',`);
      lines.push(`    title: '${ex.name.replace(/'/g, "\\'")}',`);
      lines.push(`    position: ${pos},`);
      lines.push(`    rotation: ${rot},`);
      lines.push(`    scale: ${scl},`);
      lines.push('  },');
    });
    lines.push('] as const;');
    const output = lines.join('\n');
    console.log('[HeartGalleryPlacementTool] Exported Layout:\n' + output);
    showToast('📋 Exported TypeScript layout to Dev Console (F12)');
  }

  // --- WALL SNAP ---
  function snapToNearestWall() {
    const exhibit = getSelectedExhibit();
    if (!exhibit) return;

    const group = exhibit.group;
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);

    // Cast rays in 4 cardinal directions and along the back normal of the portrait
    const checkDirections = [
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 1),
    ];

    const portraitBack = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion).normalize();
    checkDirections.push(portraitBack);

    let closestHit: THREE.Intersection | null = null;
    let closestDist = Infinity;

    const snapRay = new THREE.Raycaster();
    snapRay.far = 5.0; // Search within 5 meters

    for (const dir of checkDirections) {
      snapRay.set(worldPos, dir);
      const hits = snapRay.intersectObjects(partitionMeshes, false);
      if (hits.length > 0) {
        const hit = hits[0];
        if (hit.distance < closestDist) {
          closestDist = hit.distance;
          closestHit = hit;
        }
      }
    }

    if (closestHit && closestHit.face) {
      const normal = closestHit.face.normal.clone().transformDirection(closestHit.object.matrixWorld).normalize();

      // Position portrait 0.06m in front of wall surface along wall normal
      const snappedWorldPos = closestHit.point.clone().addScaledVector(normal, 0.06);

      // Keep height level at current exhibit world Y
      snappedWorldPos.y = worldPos.y;

      if (group.parent) {
        group.parent.worldToLocal(snappedWorldPos);
      }
      group.position.copy(snappedWorldPos);

      // Orient facing outward from wall along normal
      const targetYaw = Math.atan2(normal.x, normal.z);
      group.rotation.set(0, targetYaw, 0);
      group.updateMatrixWorld(true);

      helper.updateMatrixWorld();
      boxHelper.setFromObject(group);
      showToast(`✓ Snapped to nearest wall (Dist: ${closestDist.toFixed(2)}m)`);
    } else {
      showToast(`⚠ No wall partition detected within 5m`);
    }
  }

  // --- VISIBILITY & WARNING CHECKS ---
  function checkStatusAndWarnings(): {
    isVisible: boolean;
    warnings: string[];
  } {
    const exhibit = getSelectedExhibit();
    if (!exhibit) return { isVisible: true, warnings: [] };

    const warnings: string[] = [];
    const group = exhibit.group;

    // 1. Gallery bounds check: lx in [4.5, 15.2], lz in [-15.2, 8.0]
    const lx = group.position.x;
    const lz = group.position.z;
    if (lx < 4.4 || lx > 15.2 || lz < -15.2 || lz > 8.0) {
      warnings.push('⚠ OUTSIDE GALLERY BOUNDS');
    }

    // 2. Wall penetration check
    const portraitBackWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion).normalize();
    const groupWorld = new THREE.Vector3();
    group.getWorldPosition(groupWorld);

    const wallRay = new THREE.Raycaster(groupWorld, portraitBackWorld, 0, 0.6);
    const wallHits = wallRay.intersectObjects(partitionMeshes, false);
    if (wallHits.length > 0 && wallHits[0].distance < 0.04) {
      warnings.push('⚠ WALL PENETRATION / EMBEDDED');
    }

    // 3. Line of sight visibility check from camera
    const camPos = camera.position.clone();
    const toExhibit = groupWorld.clone().sub(camPos);
    const distToExhibit = toExhibit.length();
    const rayDir = toExhibit.normalize();

    const losRay = new THREE.Raycaster(camPos, rayDir, 0.1, distToExhibit);
    const losHits = losRay.intersectObjects(partitionMeshes, false);

    let isVisible = true;
    if (losHits.length > 0 && losHits[0].distance < distToExhibit - 0.25) {
      isVisible = false;
    }

    return { isVisible, warnings };
  }

  // --- HUD RENDERING ---
  function renderHud() {
    if (!active) {
      hudContainer.style.display = 'none';
      return;
    }
    hudContainer.style.display = 'block';

    const exhibit = getSelectedExhibit();
    if (!exhibit) return;

    const g = exhibit.group;
    const yawDeg = THREE.MathUtils.radToDeg(g.rotation.y);
    const { isVisible, warnings } = checkStatusAndWarnings();

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(244,114,182,0.25); padding-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:#db2777; color:#fff; font-weight:bold; font-size:10px; padding:3px 7px; border-radius:6px; letter-spacing:0.5px;">DEV TOOL</span>
          <span style="font-weight:700; font-size:13px; color:#fbcfe8;">POSTER PLACEMENT MODE</span>
        </div>
        <button id="hgp-btn-close" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fbcfe8; cursor:pointer; border-radius:6px; padding:3px 8px; font-size:11px;">✕ (P)</button>
      </div>

      ${toastMessage ? `
        <div style="background:linear-gradient(90deg, #be185d, #9d174d); border:1px solid #f472b6; border-radius:8px; padding:7px 10px; margin-bottom:12px; font-weight:600; font-size:11.5px; text-align:center; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          ${toastMessage}
        </div>
      ` : ''}

      <!-- Portrait Selector -->
      <div style="margin-bottom:12px;">
        <div style="font-size:11px; color:#94a3b8; margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Select Portrait (1–9, 0 = 10 / ↑↓)</div>
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:4px;">
          ${portraitExhibits.map((p, idx) => {
            const isSel = idx === selectedIndex;
            return `
              <button id="hgp-sel-${idx}" style="
                background:${isSel ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'rgba(30, 41, 59, 0.8)'};
                border:1px solid ${isSel ? '#f472b6' : 'rgba(255,255,255,0.1)'};
                color:${isSel ? '#fff' : '#cbd5e1'};
                cursor:pointer;
                padding:6px 2px;
                border-radius:6px;
                font-weight:700;
                font-size:11px;
                text-align:center;
              ">
                #${idx + 1}
              </button>
            `;
          }).join('')}
        </div>
        <div style="margin-top:6px; font-weight:600; color:#f472b6; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${exhibit.id}: <span style="color:#fdf2f8;">${exhibit.name}</span>
        </div>
      </div>

      <!-- Live Transform Readout -->
      <div style="background:rgba(15, 23, 42, 0.7); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px; margin-bottom:12px; font-family:ui-monospace, monospace; font-size:11.5px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#94a3b8;">POSITION:</span>
          <span style="color:#38bdf8; font-weight:700;">X: ${g.position.x.toFixed(3)} | Y: ${g.position.y.toFixed(3)} | Z: ${g.position.z.toFixed(3)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#94a3b8;">ROTATION (YAW):</span>
          <span style="color:#a78bfa; font-weight:700;">${yawDeg.toFixed(1)}° (${g.rotation.y.toFixed(3)} rad)</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">SCALE:</span>
          <span style="color:#34d399; font-weight:700;">${g.scale.x.toFixed(3)}</span>
        </div>
      </div>

      <!-- Visibility & Warnings -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <span style="
          background:${isVisible ? '#065f46' : '#991b1b'};
          border:1px solid ${isVisible ? '#34d399' : '#f87171'};
          color:${isVisible ? '#a7f3d0' : '#fecaca'};
          padding:2px 8px;
          border-radius:6px;
          font-weight:700;
          font-size:10px;
          letter-spacing:0.5px;
        ">
          ${isVisible ? '● VISIBLE' : '▲ OBSTRUCTED'}
        </span>
        ${warnings.length > 0 ? `
          <div style="color:#fbbf24; font-size:11px; font-weight:600;">
            ${warnings.join(' ')}
          </div>
        ` : `
          <span style="color:#94a3b8; font-size:11px;">Sightline clear</span>
        `}
      </div>

      <!-- Mode Toggles -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:10px;">
        <button id="hgp-btn-m" style="
          background:${transformMode === 'translate' ? '#ec4899' : 'rgba(30, 41, 59, 0.9)'};
          border:1px solid ${transformMode === 'translate' ? '#f472b6' : 'rgba(255,255,255,0.1)'};
          color:#fff; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;
        ">
          [M] Move
        </button>
        <button id="hgp-btn-r" style="
          background:${transformMode === 'rotate' ? '#ec4899' : 'rgba(30, 41, 59, 0.9)'};
          border:1px solid ${transformMode === 'rotate' ? '#f472b6' : 'rgba(255,255,255,0.1)'};
          color:#fff; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;
        ">
          [R] Rotate
        </button>
        <button id="hgp-btn-s" style="
          background:${transformMode === 'scale' ? '#ec4899' : 'rgba(30, 41, 59, 0.9)'};
          border:1px solid ${transformMode === 'scale' ? '#f472b6' : 'rgba(255,255,255,0.1)'};
          color:#fff; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;
        ">
          [S] Scale
        </button>
      </div>

      <!-- Space & Snapping -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
        <button id="hgp-btn-q" style="background:rgba(30, 41, 59, 0.9); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; cursor:pointer; padding:5px; border-radius:6px; font-size:11px;">
          Space: <strong style="color:#f472b6;">${spaceMode.toUpperCase()}</strong> [Q]
        </button>
        <button id="hgp-btn-x" style="background:rgba(30, 41, 59, 0.9); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; cursor:pointer; padding:5px; border-radius:6px; font-size:11px;">
          Snap: <strong style="color:${snapEnabled ? '#34d399' : '#f87171'};">${snapEnabled ? '0.05m / 1°' : 'OFF'}</strong> [X]
        </button>
      </div>

      <!-- Quick Actions -->
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
        <button id="hgp-btn-w" style="
          background:linear-gradient(90deg, #be185d, #db2777);
          border:1px solid #f472b6;
          color:#fff;
          cursor:pointer;
          padding:7px;
          border-radius:8px;
          font-weight:700;
          font-size:11.5px;
        ">
          🧲 [W] Wall-Snap to Nearest Wall
        </button>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button id="hgp-btn-save-sel" style="background:#1e293b; border:1px solid rgba(244,114,182,0.4); color:#fbcfe8; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;">
            💾 [Enter] Save
          </button>
          <button id="hgp-btn-save-all" style="background:#1e293b; border:1px solid rgba(244,114,182,0.4); color:#fbcfe8; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;">
            💾 [Ctrl+S] Save All
          </button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button id="hgp-btn-export" style="background:#1e293b; border:1px solid rgba(56,189,248,0.4); color:#bae6fd; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;">
            📋 [E] Export TS
          </button>
          <button id="hgp-btn-reset-sel" style="background:#1e293b; border:1px solid rgba(248,113,113,0.4); color:#fecaca; cursor:pointer; padding:6px; border-radius:6px; font-weight:600; font-size:11px;">
            ↺ [Bksp] Reset
          </button>
        </div>
      </div>

      <div style="font-size:10.5px; color:#64748b; line-height:1.4; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
        Tip: Drag gizmo in viewport. Click portrait in 3D scene to select. Press <strong>P</strong> to return to normal gameplay.
      </div>
    `;

    hudContainer.innerHTML = html;

    // Attach button click listeners
    const closeBtn = document.getElementById('hgp-btn-close');
    closeBtn?.addEventListener('click', () => setModeActive(false));

    portraitExhibits.forEach((_, idx) => {
      document.getElementById(`hgp-sel-${idx}`)?.addEventListener('click', () => selectExhibit(idx));
    });

    document.getElementById('hgp-btn-m')?.addEventListener('click', () => setTransformMode('translate'));
    document.getElementById('hgp-btn-r')?.addEventListener('click', () => setTransformMode('rotate'));
    document.getElementById('hgp-btn-s')?.addEventListener('click', () => setTransformMode('scale'));

    document.getElementById('hgp-btn-q')?.addEventListener('click', () => toggleSpace());
    document.getElementById('hgp-btn-x')?.addEventListener('click', () => toggleSnapping());

    document.getElementById('hgp-btn-w')?.addEventListener('click', snapToNearestWall);
    document.getElementById('hgp-btn-save-sel')?.addEventListener('click', saveSelected);
    document.getElementById('hgp-btn-save-all')?.addEventListener('click', saveAll);
    document.getElementById('hgp-btn-export')?.addEventListener('click', exportTypeScript);
    document.getElementById('hgp-btn-reset-sel')?.addEventListener('click', resetSelected);
  }

  function setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
    transformMode = mode;
    controls.setMode(mode);
    renderHud();
  }

  function toggleSpace() {
    spaceMode = spaceMode === 'local' ? 'world' : 'local';
    controls.setSpace(spaceMode);
    renderHud();
  }

  function toggleSnapping() {
    snapEnabled = !snapEnabled;
    applySnaps();
    renderHud();
  }

  function setModeActive(nextActive: boolean) {
    if (active === nextActive) return;
    active = nextActive;
    onActiveChange?.(active);

    helper.visible = active;
    boxHelper.visible = active;

    if (active) {
      selectExhibit(selectedIndex);
      renderHud();
    } else {
      controls.detach();
      hudContainer.style.display = 'none';
    }
  }

  // --- TRANSFORMS & GIZMO EVENT HOOKS ---
  controls.addEventListener('dragging-changed', (event) => {
    isGizmoDragging = Boolean(event.value);
  });

  controls.addEventListener('change', () => {
    if (!active) return;
    const exhibit = getSelectedExhibit();
    if (exhibit) {
      boxHelper.setFromObject(exhibit.group);
      renderHud();
    }
  });

  // --- POINTER / CLICK SELECTION IN VIEWPORT ---
  const onPointerDown = (e: MouseEvent) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: MouseEvent) => {
    if (!active || isGizmoDragging) return;
    const dx = Math.abs(e.clientX - pointerDownPos.x);
    const dy = Math.abs(e.clientY - pointerDownPos.y);
    if (dx > 4 || dy > 4) return; // Ignore drag moves

    // Don't raycast if clicking inside HUD panel
    if (hudContainer.contains(e.target as Node)) return;

    const rect = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Test ray against all child objects of all the exhibits
    for (let i = 0; i < portraitExhibits.length; i++) {
      const hits = raycaster.intersectObject(portraitExhibits[i].group, true);
      if (hits.length > 0) {
        selectExhibit(i);
        break;
      }
    }
  };

  // --- KEYBOARD CAPTURE & DISPATCH ---
  const onKeyDown = (e: KeyboardEvent) => {
    // If typing in input or textarea, let it pass
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Key 'P' toggles placement mode ONLY when already active OR when inside Dream Castle Floor 3 Heart Gallery
    if (e.code === 'KeyP') {
      if (!active) {
        if (canActivate && !canActivate()) {
          return;
        }
        const inHeartGallery =
          Math.abs(camera.position.x - castleOrigin.x) <= 22.0 &&
          Math.abs(camera.position.z - castleOrigin.z) <= 22.0 &&
          camera.position.y >= castleOrigin.y + 15.0;
        if (!inHeartGallery) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      setModeActive(!active);
      return;
    }

    if (!active) return;

    // While placement mode is active, prevent gameplay actions from triggering
    let handled = false;

    if (e.code === 'Digit1') {
      selectExhibit(0);
      handled = true;
    } else if (e.code === 'Digit2') {
      selectExhibit(1);
      handled = true;
    } else if (e.code === 'Digit3') {
      selectExhibit(2);
      handled = true;
    } else if (e.code === 'Digit4') {
      selectExhibit(3);
      handled = true;
    } else if (e.code === 'Digit5') {
      selectExhibit(4);
      handled = true;
    } else if (e.code === 'Digit6') {
      selectExhibit(5);
      handled = true;
    } else if (e.code === 'Digit7') {
      selectExhibit(6);
      handled = true;
    } else if (e.code === 'Digit8') {
      selectExhibit(7);
      handled = true;
    } else if (e.code === 'Digit9') {
      selectExhibit(8);
      handled = true;
    } else if (e.code === 'Digit0') {
      selectExhibit(9);
      handled = true;
    } else if (e.code === 'ArrowUp' || e.code === 'BracketRight') {
      selectExhibit(selectedIndex + 1);
      handled = true;
    } else if (e.code === 'ArrowDown' || e.code === 'BracketLeft') {
      selectExhibit(selectedIndex - 1);
      handled = true;
    } else if (e.code === 'KeyM') {
      setTransformMode('translate');
      handled = true;
    } else if (e.code === 'KeyR') {
      setTransformMode('rotate');
      handled = true;
    } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
      setTransformMode('scale');
      handled = true;
    } else if (e.code === 'KeyQ') {
      toggleSpace();
      handled = true;
    } else if (e.code === 'KeyX') {
      toggleSnapping();
      handled = true;
    } else if (e.code === 'KeyW') {
      snapToNearestWall();
      handled = true;
    } else if (e.code === 'KeyE') {
      exportTypeScript();
      handled = true;
    } else if (e.code === 'Enter') {
      saveSelected();
      handled = true;
    } else if ((e.code === 'KeyS' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      saveAll();
      handled = true;
    } else if (e.code === 'Backspace') {
      if (e.shiftKey) {
        resetAll();
      } else {
        resetSelected();
      }
      handled = true;
    } else if (
      ['KeyA', 'KeyD', 'Space'].includes(e.code)
    ) {
      // Suppress player walk / jump movement during placement mode
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  domElement.addEventListener('mousedown', onPointerDown);
  domElement.addEventListener('mouseup', onPointerUp);
  window.addEventListener('keydown', onKeyDown, true); // Capture phase to preempt game controls

  return {
    isActive: () => active,
    setActive: setModeActive,
    toggle: () => {
      setModeActive(!active);
      return active;
    },
    update: () => {
      if (!active) return;
      const ex = getSelectedExhibit();
      if (ex) {
        boxHelper.update();
      }
    },
    dispose: () => {
      controls.dispose();
      scene.remove(helper);
      scene.remove(boxHelper);
      domElement.removeEventListener('mousedown', onPointerDown);
      domElement.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown, true);
      hudContainer.remove();
      if (toastTimer !== null) {
        window.clearTimeout(toastTimer);
      }
    },
  };
}
