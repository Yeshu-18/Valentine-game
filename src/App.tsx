/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Footprints,
  KeyRound,
  Link as LinkIcon,
  Lock,
  MapPin,
  MousePointerClick,
  Sparkles,
  Upload,
  Wand2,
  Wind,
} from 'lucide-react';
import { createAtmosphereSystem } from './world/AtmosphereSystem';
import { createCentralPlaza } from './world/CentralPlaza';
import { createDistantLandmarks } from './world/DistantLandmarks';
import { createIslandTerrain } from './world/IslandTerrain';
import { createMagicFlightSystem } from './world/MagicFlight';
import { createMagicMysteryBoxSystem } from './world/MagicMysteryBox';
import { createPlayerAvatar } from './world/PlayerCharacter';
import {
  CameraMode,
  PlayerControllerBundle,
  PlayerTelemetry,
  createPlayerController,
} from './world/PlayerController';
import { createVegetationSystem } from './world/VegetationSystem';
import { createWizardingSchoolSystem } from './world/WizardingSchool';
import { createAncientForestSystem } from './world/forest/AncientForest';
import { createEnchantedGardenSystem } from './world/forest/EnchantedGarden';
import { createAuroraUndergroundCinematic } from './world/cinematics/AuroraUndergroundCinematic';
import { AuroraDialogueCard } from './world/cinematics/AuroraDialogueCard';
import { AuroraDialogueLine } from './world/cinematics/auroraDialogueData';
import { createCarnivalDistrict } from './world/carnival/CarnivalDistrict';
import { createDreamCastle } from './world/dreamscape/DreamCastle';
import {
  BROOM_STAND_POS,
  CASTLE_KEEP_POS,
  CASTLE_TERRACE_POS,
  ISLAND_ZONES,
  castleLocalToWorld,
  getTerrainHeight,
} from './world/terrainMath';

/**
 * Combined ACESFilmic Tone Mapping + Warm Golden-Hour Color-Grading + Soft Romantic Vignette + sRGB Output Pass.
 * Folds GoldenHourGradeShader and OutputPass into a single full-screen pass to cut fillrate overhead.
 */
const GoldenHourGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteStrength: { value: 0.26 },
    uToneMappingExposure: { value: 0.95 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignetteStrength;
    uniform float uToneMappingExposure;
    varying vec2 vUv;

    vec3 gradeRRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }

    vec3 gradeACESFilmic(vec3 color) {
      const mat3 ACESInputMat = mat3(
        0.59719, 0.07600, 0.02840,
        0.35458, 0.90834, 0.13383,
        0.04823, 0.01566, 0.83777
      );
      const mat3 ACESOutputMat = mat3(
         1.60475, -0.10208, -0.00327,
        -0.53108,  1.10813, -0.07276,
        -0.07367, -0.00605,  1.07602
      );
      color *= uToneMappingExposure / 0.6;
      color = ACESInputMat * color;
      color = gradeRRTAndODTFit(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }

    vec3 gradeLinearToSRGB(vec3 value) {
      return mix(
        pow(value, vec3(0.41666)) * 1.055 - vec3(0.055),
        value * 12.92,
        vec3(lessThanEqual(value, vec3(0.0031308)))
      );
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = gradeACESFilmic(texel.rgb);

      // Subtle warm golden-hour highlight & shadow balance
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 warmHighlight = vec3(1.03, 0.99, 0.93);
      vec3 cozyShadow = vec3(0.96, 0.94, 1.02);
      col *= mix(cozyShadow, warmHighlight, smoothstep(0.15, 0.85, luma));

      // Gentle S-curve contrast for natural depth
      col = mix(col, smoothstep(0.0, 1.0, col), 0.12);

      // Soft romantic peripheral vignette
      vec2 centered = vUv - vec2(0.5);
      float distSq = dot(centered, centered);
      float vig = 1.0 - smoothstep(0.16, 0.72, distSq) * uVignetteStrength;
      col *= vig;

      col = gradeLinearToSRGB(clamp(col, 0.0, 1.0));
      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<PlayerControllerBundle | null>(null);
  const hudCoordsRef = useRef<HTMLSpanElement | null>(null);
  const hudElevRef = useRef<HTMLSpanElement | null>(null);
  const hudAglRef = useRef<HTMLSpanElement | null>(null);
  const hudSpeedRef = useRef<HTMLSpanElement | null>(null);
  const hudMotionRef = useRef<HTMLSpanElement | null>(null);

  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [telemetry, setTelemetry] = useState<PlayerTelemetry>(() => ({
    x: -16.5,
    y: getTerrainHeight(-16.5, 16.0),
    z: 16.0,
    speed: 0,
    altitudeAboveGround: 0,
    isSprinting: false,
    isBoosting: false,
    locomotionState: 'walk',
    broomState: 'IDLE_AT_STAND',
    broomPromptMode: 'none',
    mysteryPromptMode: 'none',
    mysteryCaption: null,
    flightCaption: null,
    schoolPrompt: { id: 'none', title: '', actionLabel: '' },
    schoolBanner: null,
    hasHarshaKey: false,
    castleGateState: 'LOCKED',
    castleAwaitsBanner: false,
    cinematicTime: 0,
    isOverCastleTerrace: false,
    cameraMode: 'third-person',
    cameraDistance: 6.2,
    regionName: 'Central Plaza',
    regionSubtitle: 'The Heart of the Dream World',
    isPointerLocked: false,
    auroraPrompt: null,
    carnivalPrompt: null,
    carnivalOverlay: null,
    carnivalPrizesCount: 0,
    castlePrompt: null,
    castleFountainCaption: null,
  }));

  const [auroraDialogue, setAuroraDialogue] = useState<AuroraDialogueLine | null>(null);
  const lastAuroraDialogueRef = useRef<AuroraDialogueLine | null>(null);

  const [selectedGalleryFrame, setSelectedGalleryFrame] = useState(0);
  const [showGalleryUrlModal, setShowGalleryUrlModal] = useState(false);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGalleryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        controllerRef.current?.setGalleryFrameImage(selectedGalleryFrame, dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard & Renderer Initialization
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.35),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Camera & Post-Processing Pipeline Setup (Half-Res Bloom + Folded Grade/Output Pass)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.08, 1100);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, Math.floor(width * 0.5)),
        Math.max(1, Math.floor(height * 0.5)),
      ),
      0.38, // restrained bloom so no blinding halos appear
      0.65,
      0.85,
    );
    composer.addPass(bloomPass);

    const gradePass = new ShaderPass(GoldenHourGradeShader);
    gradePass.renderToScreen = true;
    composer.addPass(gradePass);

    // 3. Build Protected Theme-Park Modules + Ancient Realm MagicFlight & Mystery Box Systems
    const atmosphere = createAtmosphereSystem(scene, renderer, isSoftwareGl);
    const islandTerrain = createIslandTerrain(renderer);
    scene.add(islandTerrain.group);

    const centralPlaza = createCentralPlaza(renderer);
    scene.add(centralPlaza.group);

    const distantLandmarks = createDistantLandmarks();
    scene.add(distantLandmarks.group);

    const magicFlight = createMagicFlightSystem();
    scene.add(magicFlight.group);

    const mysteryBox = createMagicMysteryBoxSystem();
    scene.add(mysteryBox.group);

    const wizardingSchool = createWizardingSchoolSystem();
    scene.add(wizardingSchool.group);

    const enchantedGarden = createEnchantedGardenSystem();
    scene.add(enchantedGarden.group);
    wizardingSchool.setMagicalPlantSystem(enchantedGarden.magicalPlantSystem);

    const ancientForest = createAncientForestSystem();
    scene.add(ancientForest.group);
    wizardingSchool.setAncientForestSystem(ancientForest);

    const vegetation = createVegetationSystem();
    scene.add(vegetation.group);

    const auroraCinematic = createAuroraUndergroundCinematic();
    scene.add(auroraCinematic.group);

    const carnivalDistrict = createCarnivalDistrict();
    scene.add(carnivalDistrict.group);

    const dreamCastle = createDreamCastle();
    scene.add(dreamCastle.group);

    const allColliders = [
      ...centralPlaza.colliders,
      ...distantLandmarks.colliders,
      ...mysteryBox.colliders,
      ...wizardingSchool.colliders,
      ...enchantedGarden.colliders,
      ...ancientForest.colliders,
      ...vegetation.colliders,
      ...auroraCinematic.colliders,
      ...carnivalDistrict.colliders,
      ...dreamCastle.colliders,
    ];

    const avatar = createPlayerAvatar();
    scene.add(avatar.group);

    // 3B. Register all scene PointLights/SpotLights into the Dynamic PointLight Distance Culler (<= 10 active)
    atmosphere.registerPointLights();

    // 3C. Shadow Caster Discipline: disable castShadow on tiny decorative meshes (< 0.35m radius)
    const avatarSet = new Set<THREE.Object3D>();
    avatar.group.traverse((c) => avatarSet.add(c));
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.castShadow && !avatarSet.has(obj)) {
        const geo = obj.geometry;
        if (geo) {
          if (!geo.boundingSphere) {
            geo.computeBoundingSphere();
          }
          if (geo.boundingSphere) {
            const maxScale = Math.max(
              Math.abs(obj.scale.x),
              Math.abs(obj.scale.y),
              Math.abs(obj.scale.z),
            );
            const worldRadius = geo.boundingSphere.radius * maxScale;
            if (worldRadius < 0.35) {
              obj.castShadow = false;
              if (worldRadius < 0.22) {
                obj.receiveShadow = false;
              }
            }
          }
        }
      }
    });

    const playerController = createPlayerController(
      camera,
      renderer.domElement,
      avatar,
      magicFlight,
      mysteryBox,
      wizardingSchool,
      auroraCinematic,
      carnivalDistrict,
      allColliders,
      (nextTelemetry) => {
        setTelemetry(nextTelemetry);
      },
      dreamCastle,
    );
    controllerRef.current = playerController;

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 4. Resize & Keyboard HUD Toggle
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(
        Math.max(1, Math.floor(w * 0.5)),
        Math.max(1, Math.floor(h * 0.5)),
      );
    };

    const handleKeyHud = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'KeyH') {
        setHudCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyHud);

    // 5. Continuous Game Loop with Software-WebGL Frame Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;
    let hudFastTimer = 0;
    let visibilityCullTimer = 0.15;
    let idleFrameParity = 0;

    const gardenCenterW = castleLocalToWorld(25.0, 24.0);
    const forestCenterW = castleLocalToWorld(64.0, 12.0);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      playerController.update(delta, elapsed);
      const playerPos = playerController.getPosition();
      const isIdle = playerController.isCompletelyIdle();

      // Periodic District Detail Sub-Group Distance Visibility Culling (> 135m)
      visibilityCullTimer += delta;
      if (visibilityCullTimer >= 0.15) {
        visibilityCullTimer = 0;
        const distGardenSq =
          (playerPos.x - gardenCenterW.x) ** 2 +
          (playerPos.z - gardenCenterW.z) ** 2;
        const showGardenProps = distGardenSq <= 135.0 * 135.0;
        enchantedGarden.topiarySystem.group.visible = showGardenProps;
        enchantedGarden.magicalPlantSystem.group.visible = showGardenProps;

        const distForestSq =
          (playerPos.x - forestCenterW.x) ** 2 +
          (playerPos.z - forestCenterW.z) ** 2;
        const showForestProps = distForestSq <= 135.0 * 135.0;
        ancientForest.floorSystem.group.visible = showForestProps;
        ancientForest.mushroomGrove.group.visible = showForestProps;
        ancientForest.wildlifeSystem.group.visible = showForestProps;
        ancientForest.forestStream.group.visible = showForestProps;
        ancientForest.ancientRuins.group.visible = showForestProps;
        ancientForest.treeDetail.group.visible = showForestProps;
      }

      // Skip redundant post-processing passes & distant ambient updates on alternating frames when completely idle (> 1s)
      const shouldRenderPass = !isIdle || (idleFrameParity++ & 1) === 0;
      if (shouldRenderPass) {
        enchantedGarden.update(delta, elapsed, playerPos);
        ancientForest.update(delta, elapsed, playerPos);
        centralPlaza.update(elapsed);
        distantLandmarks.update(elapsed);
        vegetation.update(elapsed);
        islandTerrain.update(elapsed);
        atmosphere.update(playerPos, delta, elapsed);
        composer.render();
      }

      // Lightweight DOM Ref HUD update (zero React reconciliation thrashing)
      hudFastTimer += delta;
      if (hudFastTimer >= 0.12) {
        hudFastTimer = 0;
        const fast = playerController.getFastHudState();
        if (hudCoordsRef.current) {
          hudCoordsRef.current.textContent = `X ${fast.x.toFixed(0)}m / Z ${fast.z.toFixed(0)}m`;
        }
        if (hudElevRef.current) {
          hudElevRef.current.textContent = `Elev +${fast.y.toFixed(1)}m`;
        }
        if (hudAglRef.current && fast.isFlyingOrMounting) {
          hudAglRef.current.textContent = `AGL +${fast.altitudeAboveGround.toFixed(1)}m`;
        }
        if (hudSpeedRef.current && fast.isFlyingOrMounting) {
          hudSpeedRef.current.textContent = `${fast.speed.toFixed(1)} m/s`;
        }
        if (hudMotionRef.current) {
          hudMotionRef.current.textContent = fast.statusLabel;
        }
      }

      const curDial = auroraCinematic.getCurrentDialogue();
      if (curDial !== lastAuroraDialogueRef.current) {
        lastAuroraDialogueRef.current = curDial;
        setAuroraDialogue(curDial);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyHud);

      playerController.dispose();
      auroraCinematic.dispose();
      carnivalDistrict.dispose();
      dreamCastle.dispose();
      avatar.dispose();
      magicFlight.dispose();
      mysteryBox.dispose();
      wizardingSchool.dispose();
      enchantedGarden.dispose();
      ancientForest.dispose();
      centralPlaza.dispose();
      distantLandmarks.dispose();
      vegetation.dispose();
      islandTerrain.dispose();
      atmosphere.dispose();
      composer.dispose();
      renderer.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleToggleCameraMode = () => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const nextMode: CameraMode = ctrl.toggleCameraMode();
    setTelemetry((prev) => ({ ...prev, cameraMode: nextMode }));
  };

  const handleDistanceChange = (dist: number) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    ctrl.setCameraDistance(dist);
    setTelemetry((prev) => ({ ...prev, cameraDistance: dist }));
  };

  const lastPointerLockExitTimeRef = useRef<number>(0);

  useEffect(() => {
    const onPointerLockChange = () => {
      if (!document.pointerLockElement) {
        lastPointerLockExitTimeRef.current = performance.now();
      }
    };
    const onPointerLockError = (e: Event) => {
      e.preventDefault?.();
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
    };
  }, []);

  const handleEngagePointerLock = () => {
    const canvas = canvasMountRef.current?.querySelector('canvas');
    if (!canvas || document.pointerLockElement === canvas) return;
    // Respect browser security cooldown (~1.3s) after user exits pointer lock via Esc
    if (performance.now() - lastPointerLockExitTimeRef.current < 1350) {
      return;
    }
    try {
      const lockPromise = canvas.requestPointerLock?.() as unknown as
        | Promise<void>
        | undefined;
      if (lockPromise && typeof lockPromise.catch === 'function') {
        lockPromise.catch(() => {
          // Ignore transient browser cooldown rejection; click-and-drag camera rotation still works
        });
      }
    } catch {
      // Fallback for browsers that throw synchronously
    }
  };

  const handleTeleport = (x: number, z: number, yawRadians?: number) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    ctrl.teleportTo(x, z, yawRadians);
    setTelemetry(ctrl.getTelemetry());
  };

  const isFlyingOrMounting =
    telemetry.locomotionState === 'flight' ||
    telemetry.locomotionState === 'mounting';
  const isInMysteryCinematic =
    telemetry.locomotionState === 'mystery_cinematic';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated Unobstructed 3D WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        onClick={handleEngagePointerLock}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Heart Island 3D Viewport"
      />

      {/* Top-Left Minimal Region Discovery & Flight Telemetry Banner */}
      {!isInMysteryCinematic && (
        <div className="pointer-events-none absolute top-5 left-6 z-10 flex flex-col gap-0.5 bg-slate-950/85 border border-white/10 rounded-xl px-4 py-3 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-200/90">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Valentine’s Dream World</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.regionSubtitle}</span>
          </div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-white">
            {telemetry.regionName}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono-tabular">
            <span ref={hudCoordsRef}>
              X {telemetry.x.toFixed(0)}m / Z {telemetry.z.toFixed(0)}m
            </span>
            <span aria-hidden="true">·</span>
            <span ref={hudElevRef}>Elev +{telemetry.y.toFixed(1)}m</span>
            {isFlyingOrMounting && (
              <>
                <span aria-hidden="true">·</span>
                <span ref={hudAglRef} className="text-violet-300">
                  AGL +{telemetry.altitudeAboveGround.toFixed(1)}m
                </span>
                <span aria-hidden="true">·</span>
                <span ref={hudSpeedRef} className="text-amber-300">
                  {telemetry.speed.toFixed(1)} m/s
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span ref={hudMotionRef}>
              {telemetry.locomotionState === 'flight'
                ? telemetry.isBoosting
                  ? 'Broom Boost (22 m/s)'
                  : 'Broom Flight'
                : telemetry.locomotionState === 'mounting'
                  ? 'Mounting Broom'
                  : telemetry.isSprinting
                    ? 'Sprinting'
                    : telemetry.speed > 0.3
                      ? 'Walking'
                      : 'Standing'}
            </span>
            {telemetry.hasHarshaKey && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>HARSHA Key</span>
                </span>
              </>
            )}
            {telemetry.carnivalPrizesCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-rose-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Midway Keepsakes {telemetry.carnivalPrizesCount}/5</span>
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* #9 Mystery Box ("HARSHA" Key) & #10 Castle Gate Unsealing Cinematic Captions */}
      {telemetry.mysteryCaption && (
        <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
          <div className="flex flex-col items-center gap-2.5 bg-slate-950/92 border border-amber-300/45 rounded-2xl px-7 py-4 text-center shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-amber-300">
              <KeyRound className="w-3.5 h-3.5" />
              <span>{telemetry.mysteryCaption.speaker}</span>
            </div>
            {telemetry.mysteryCaption.headline && (
              <p className="font-display text-2xl font-bold tracking-wider text-amber-200">
                {telemetry.mysteryCaption.headline}
              </p>
            )}
            <p className="text-base leading-relaxed text-amber-50 font-serif italic">
              {telemetry.mysteryCaption.line}
            </p>
            <div className="mt-1 pt-2.5 border-t border-white/10 w-full flex items-center justify-between text-xs text-slate-300">
              <button
                type="button"
                onClick={() => controllerRef.current?.skipDialogueOrCinematic()}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/15 font-mono text-[11px] text-slate-300">
                  Esc
                </kbd>
                <span>Skip</span>
              </button>
              <span className="font-mono-tabular text-[11px] text-slate-400">
                {telemetry.mysteryCaption.stepIndex} /{' '}
                {telemetry.mysteryCaption.totalSteps}
              </span>
              <button
                type="button"
                onClick={() => controllerRef.current?.advanceDialogue()}
                className="flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
              >
                <span>Press Enter →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #8 Broom Flight Narrative Captions ("I want you beside me.") */}
      {!telemetry.mysteryCaption && telemetry.flightCaption && (
        <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
          <div className="flex flex-col items-center gap-2.5 bg-slate-950/90 border border-violet-300/45 rounded-2xl px-7 py-4 text-center shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-violet-300">
              <Wind className="w-3.5 h-3.5" />
              <span>Flight Over Heart Island • Yeshwanth to Harsha</span>
            </div>
            {telemetry.flightCaption.headline && (
              <p className="font-display text-2xl font-bold tracking-wider text-amber-200">
                {telemetry.flightCaption.headline}
              </p>
            )}
            <p className="text-base leading-relaxed text-amber-50 font-serif italic">
              {telemetry.flightCaption.line}
            </p>
            <div className="mt-1 pt-2.5 border-t border-white/10 w-full flex items-center justify-between text-xs text-slate-300">
              <button
                type="button"
                onClick={() => controllerRef.current?.skipDialogueOrCinematic()}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/15 font-mono text-[11px] text-slate-300">
                  Esc
                </kbd>
                <span>Skip</span>
              </button>
              <span className="font-mono-tabular text-[11px] text-slate-400">
                {telemetry.flightCaption.stepIndex} /{' '}
                {telemetry.flightCaption.totalSteps}
              </span>
              <button
                type="button"
                onClick={() => controllerRef.current?.advanceDialogue()}
                className="flex items-center gap-1.5 font-semibold text-violet-200 hover:text-white transition-colors cursor-pointer"
              >
                <span>Press Enter →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #1–#7 Wizarding School Master Flow Diegetic Voice & Story Captions */}
      {!telemetry.mysteryCaption &&
        !telemetry.flightCaption &&
        telemetry.schoolBanner && (
          <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
            <div className="flex flex-col items-center gap-2 bg-slate-950/92 border border-amber-300/45 rounded-2xl px-6 py-4 text-center shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-amber-300">
                <Wand2 className="w-3.5 h-3.5" />
                <span>{telemetry.schoolBanner.subtitle}</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                {telemetry.schoolBanner.title}
              </h2>
              {telemetry.schoolBanner.headline && (
                <p className="font-display text-xl font-bold tracking-wider text-amber-200 mt-0.5">
                  {telemetry.schoolBanner.headline}
                </p>
              )}
              {telemetry.schoolBanner.photoUrl && (
                <div className="my-2 w-full max-w-md overflow-hidden rounded-xl border border-cyan-300/40 shadow-lg bg-slate-900/80">
                  <img
                    src={telemetry.schoolBanner.photoUrl}
                    alt={telemetry.schoolBanner.title}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
              <p className="text-base leading-relaxed text-amber-100/95 font-serif italic">
                {telemetry.schoolBanner.message}
              </p>
              <div className="mt-1 pt-2.5 border-t border-white/10 w-full flex items-center justify-between text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() =>
                    controllerRef.current?.skipDialogueOrCinematic()
                  }
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/15 font-mono text-[11px] text-slate-300">
                    Esc
                  </kbd>
                  <span>Skip</span>
                </button>
                <span className="font-mono-tabular text-[11px] text-slate-400">
                  {telemetry.schoolBanner.stepIndex} /{' '}
                  {telemetry.schoolBanner.totalSteps}
                </span>
                <button
                  type="button"
                  onClick={() => controllerRef.current?.advanceDialogue()}
                  className="flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <span>Press Enter →</span>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Floating Mystery Box Proximity Prompt: [E] OPEN FOR A SURPRISE */}
      {telemetry.mysteryPromptMode === 'open_box' && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-violet-300/45 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-violet-200">
              Enchanted Walnut Mystery Box
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                [E]
              </kbd>{' '}
              OPEN FOR A SURPRISE
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerMysteryAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            [E] OPEN FOR A SURPRISE
          </button>
        </div>
      )}

      {/* Floating Castle Gate Unlock Prompt: [E] Unlock Castle Gate with HARSHA Key */}
      {telemetry.mysteryPromptMode === 'unlock_gate' && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-amber-300/45 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <KeyRound className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-amber-200">
              Grand Castle Gate • Heart Lock Escutcheon
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                [E]
              </kbd>{' '}
              Unlock Castle Gate with HARSHA Key
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerMysteryAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            [E] Unlock Castle Gate with HARSHA Key
          </button>
        </div>
      )}

      {/* Floating Locked Castle Gate Hint (if approached before opening the Mystery Box) */}
      {telemetry.mysteryPromptMode === 'locked_gate' && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-slate-950/90 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-slate-200 shadow-xl">
          <Lock className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            Grand Castle Gate is locked — examine the ornate Mystery Box on the
            Castle Landing Terrace.
          </span>
        </div>
      )}

      {/* Floating Wizarding School [E] Interaction Prompts (7 Sanctuary Stations) */}
      {telemetry.schoolPrompt.id !== 'none' &&
        telemetry.mysteryPromptMode === 'none' && (
          <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-amber-300/45 rounded-xl px-4 py-2.5 text-white shadow-xl">
            {telemetry.schoolPrompt.id === 'compendium_book' ? (
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
            ) : (
              <Wand2 className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-amber-200">
                {telemetry.schoolPrompt.title}
              </span>
              <span className="text-xs text-slate-200">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                  [E]
                </kbd>{' '}
                {telemetry.schoolPrompt.actionLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => controllerRef.current?.triggerSchoolAction()}
              className="ml-2 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              [E] {telemetry.schoolPrompt.actionLabel}
            </button>
          </div>
        )}

      {/* Minimal Aurora Lake Vista Stone Interaction Prompt: [E] Enter */}
      {telemetry.auroraPrompt && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-cyan-300/45 rounded-xl px-4 py-2.5 text-white shadow-xl backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-cyan-200">
              Aurora Lake Vista Stone
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-cyan-200">
                [E]
              </kbd>{' '}
              Enter
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerAuroraAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            [E] Enter
          </button>
        </div>
      )}

      {/* Romantic Aurora Underground Cinematic Dialogue Card */}
      <AuroraDialogueCard
        dialogue={auroraDialogue}
        onAdvance={() => controllerRef.current?.advanceDialogue()}
        onSkip={() => controllerRef.current?.skipDialogueOrCinematic()}
      />

      {/* Heartshot Minimal First-Person Aim Reticle */}
      {telemetry.carnivalOverlay?.showReticle && (
        <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
          <div
            className={`w-5 h-5 rounded-full border transition-all duration-150 flex items-center justify-center ${
              telemetry.carnivalOverlay.reticleHovered
                ? 'border-rose-400 bg-rose-400/20 shadow-[0_0_10px_rgba(251,113,133,0.85)] scale-110'
                : 'border-white/45 bg-white/5'
            }`}
          >
            <div
              className={`w-1 h-1 rounded-full ${
                telemetry.carnivalOverlay.reticleHovered
                  ? 'bg-rose-300'
                  : 'bg-white/75'
              }`}
            />
          </div>
        </div>
      )}

      {/* Romantic Midway / Carnival Active Attraction & Prize Reveal Card (Lower-Left Safe Area) */}
      {telemetry.carnivalOverlay && (
        <div className="pointer-events-auto absolute bottom-7 left-7 z-30 w-[340px] max-w-[calc(100vw-3.5rem)]">
          <div className="flex flex-col gap-2 bg-slate-950/85 backdrop-blur-md border border-rose-300/35 rounded-xl p-3.5 shadow-2xl">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-amber-300">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{telemetry.carnivalOverlay.subtitle}</span>
            </div>
            <h2 className="font-display text-base font-semibold text-white leading-tight">
              {telemetry.carnivalOverlay.title}
            </h2>

            {telemetry.carnivalOverlay.prizeName && (
              <div className="my-0.5 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-amber-300/35 flex flex-col items-center text-center">
                <span className="text-[10px] uppercase tracking-wider text-amber-200/90 font-semibold">
                  {telemetry.carnivalOverlay.prizeCategory || 'Keepsake Revealed'}
                </span>
                <span className="font-display text-base font-bold text-amber-200 mt-0.5">
                  {telemetry.carnivalOverlay.prizeName}
                </span>
              </div>
            )}

            {telemetry.carnivalOverlay.captionLine && (
              <p className="text-xs leading-relaxed text-amber-50 font-serif italic">
                {telemetry.carnivalOverlay.captionLine}
              </p>
            )}

            {typeof telemetry.carnivalOverlay.powerMeter === 'number' && (
              <div className="w-full my-0.5 flex flex-col gap-1">
                <div className="relative h-2.5 w-full rounded-full bg-slate-900 border border-white/15 overflow-hidden">
                  {/* Center bullseye sweet-spot indicator */}
                  <div className="absolute inset-y-0 left-[35%] right-[35%] bg-emerald-400/25 border-x border-emerald-300/50" />
                  <div
                    className="h-full bg-amber-300 rounded-full"
                    style={{
                      width: `${Math.round(telemetry.carnivalOverlay.powerMeter * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {telemetry.carnivalOverlay.progressText && (
              <span className="text-[11px] font-medium text-rose-200">
                {telemetry.carnivalOverlay.progressText}
              </span>
            )}

            {telemetry.carnivalOverlay.instruction && (
              <span className="text-[11px] text-slate-300 leading-snug">
                {telemetry.carnivalOverlay.instruction}
              </span>
            )}

            <div className="mt-1 pt-2 border-t border-white/10 w-full flex items-center justify-between text-[11px] text-slate-300">
              <button
                type="button"
                onClick={() => controllerRef.current?.skipDialogueOrCinematic()}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/15 font-mono text-[10px] text-slate-300">
                  Esc
                </kbd>
                <span>Exit</span>
              </button>

              {telemetry.carnivalOverlay.state === 'PLAYING' &&
                !telemetry.carnivalOverlay.requiresEnterToContinue &&
                !telemetry.carnivalOverlay.showReticle && (
                  <button
                    type="button"
                    onClick={() =>
                      controllerRef.current?.performCarnivalGameAction()
                    }
                    className="px-2.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold transition-colors cursor-pointer"
                  >
                    Action (Space/Click)
                  </button>
                )}

              {telemetry.carnivalOverlay.requiresEnterToContinue && (
                <button
                  type="button"
                  onClick={() => controllerRef.current?.advanceDialogue()}
                  className="flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <span>Press Enter →</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Minimal Romantic Midway Proximity Prompt: E Play / E Ride / E Enter */}
      {telemetry.carnivalPrompt && !telemetry.carnivalOverlay && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-rose-300/40 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-rose-200">
              {telemetry.carnivalPrompt.title}
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                [E]
              </kbd>{' '}
              {telemetry.carnivalPrompt.verb.replace(/^E\s+/, '')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerCarnivalAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            [{telemetry.carnivalPrompt.verb}]
          </button>
        </div>
      )}

      {/* Grand Entrance Hall Fountain Hologram & Starlight Orchid Floating Caption */}
      {telemetry.castleFountainCaption && !telemetry.carnivalOverlay && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4">
          <div className="flex flex-col items-center gap-1.5 bg-slate-950/88 backdrop-blur-md border border-pink-300/50 rounded-2xl px-6 py-3.5 text-center shadow-[0_0_28px_rgba(244,114,182,0.32)]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
              <span>
                {telemetry.castleFountainCaption === 'I Love u Mandu 💕'
                  ? 'Starlight Orchid Conservatory • Yeshwanth & Harsha'
                  : 'Crystal Lotus Fountain • Yeshwanth & Harsha'}
              </span>
            </div>
            <p className="text-lg leading-relaxed text-amber-100 font-serif italic font-semibold drop-shadow-[0_0_10px_rgba(244,114,182,0.7)]">
              {telemetry.castleFountainCaption}
            </p>
          </div>
        </div>
      )}

      {/* Dream Castle Interaction & Elevator Proximity Prompt */}
      {telemetry.castlePrompt && !telemetry.carnivalOverlay && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/92 border border-pink-300/40 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <Sparkles className="w-4 h-4 text-pink-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-pink-200">
              Pastel Dream Castle
            </span>
            <span className="text-xs text-slate-200 whitespace-nowrap">
              {telemetry.castlePrompt}
            </span>
          </div>
          {telemetry.castlePrompt.includes('Select Floor') ? (
            <div className="ml-2 flex items-center gap-1.5">
              {[
                { label: '1', floor: 1 },
                { label: '2', floor: 2 },
                { label: '3', floor: 3 },
                { label: '4', floor: 4 },
                { label: 'B', floor: -1 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() =>
                    controllerRef.current?.selectElevatorFloor(btn.floor)
                  }
                  className="px-2.5 py-1 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold border border-amber-200/40 transition-colors cursor-pointer"
                >
                  [{btn.label}]
                </button>
              ))}
              <button
                type="button"
                onClick={() => controllerRef.current?.triggerCastleAction()}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-200 text-xs font-semibold border border-pink-300/35 transition-colors cursor-pointer"
              >
                [E] Step Out
              </button>
            </div>
          ) : telemetry.castlePrompt.includes('Freestyle Dance') ||
            telemetry.castlePrompt.includes('Choose Song') ? (
            <div className="ml-2 flex flex-col gap-1.5">
              {/* Row 1: 5 Songs Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-pink-300 mr-1">Songs:</span>
                {[
                  { label: '1', name: 'Barbie Pop', idx: 0 },
                  { label: '2', name: 'Starlight Waltz', idx: 1 },
                  { label: '3', name: 'Pastel R&B', idx: 2 },
                  { label: '4', name: 'Electro Heart', idx: 3 },
                  { label: '5', name: 'Mandu Serenade', idx: 4 },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => controllerRef.current?.selectDanceSong(s.idx)}
                    className="px-2 py-0.5 rounded bg-pink-600/80 hover:bg-pink-500 text-white text-[11px] font-medium border border-pink-300/30 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    [{s.label}] {s.name}
                  </button>
                ))}
              </div>
              {/* Row 2: 10 Manual Dance Step Keys */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-semibold text-amber-300 mr-1">Steps:</span>
                {[
                  { key: 'W', name: 'Reach & Leap' },
                  { key: 'A', name: 'Left Sway' },
                  { key: 'S', name: 'Low Dip' },
                  { key: 'D', name: 'Right Sway' },
                  { key: 'F', name: 'Heart Claps' },
                  { key: 'G', name: 'Pirouette' },
                  { key: 'H', name: 'Heart Hands 💕' },
                  { key: 'J', name: 'Jeté Kick' },
                  { key: 'K', name: 'Shoulder Wave' },
                  { key: 'L', name: 'Curtsy' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => controllerRef.current?.performManualDance(m.key)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 text-[11px] font-medium border border-amber-300/30 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="font-bold text-white">[{m.key}]</span> {m.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => controllerRef.current?.triggerCastleAction()}
                  className="ml-1 px-2.5 py-0.5 rounded bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  [E] Finish
                </button>
              </div>
              {/* Row 3: 5 Predefined Choreography Steps (Keys 6, 7, 8, 9, 0) */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-semibold text-rose-300 mr-1">Choreo [6-0]:</span>
                {[
                  { key: '6', name: 'Pirouette ✧', stepIdx: 0 },
                  { key: '7', name: 'Arabesque ✧', stepIdx: 1 },
                  { key: '8', name: 'Pop Groove ✧', stepIdx: 2 },
                  { key: '9', name: 'Grand Jeté ✧', stepIdx: 3 },
                  { key: '0', name: 'Swan Waltz ✧', stepIdx: 4 },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => controllerRef.current?.performPredefinedDance(c.stepIdx)}
                    className="px-1.5 py-0.5 rounded bg-gradient-to-r from-pink-800/80 to-purple-800/80 hover:from-pink-600 hover:to-purple-600 text-pink-100 text-[11px] font-medium border border-pink-300/40 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="font-bold text-amber-300">[{c.key}]</span> {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : telemetry.castlePrompt.includes('Romantic Memory') ||
            telemetry.castlePrompt.includes('Memory Frames') ||
            telemetry.castlePrompt.includes('Gallery') ? (
            <div className="ml-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-pink-300 mr-1">Frame:</span>
                {[0, 1, 2, 3, 4].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedGalleryFrame(idx);
                      window.dispatchEvent(new KeyboardEvent('keydown', { key: String(idx + 1) }));
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                      selectedGalleryFrame === idx
                        ? 'bg-pink-500 text-white border-amber-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-pink-200 border-pink-300/30'
                    }`}
                  >
                    Frame {idx + 1}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => galleryFileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => setShowGalleryUrlModal(true)}
                  className="px-2.5 py-1 rounded bg-pink-600/80 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Paste Image URL
                </button>
                <button
                  type="button"
                  onClick={() => controllerRef.current?.triggerCastleAction()}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-pink-200 text-xs font-semibold border border-pink-300/30 transition-colors cursor-pointer"
                >
                  [E] View / Return
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => controllerRef.current?.triggerCastleAction()}
              className="ml-2 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Interact
            </button>
          )}
        </div>
      )}

      {/* Floating Interaction Prompt: [E] Pick up Broom & Fly */}
      {telemetry.broomPromptMode === 'pickup' && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/90 border border-amber-300/35 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-amber-200">
              Ancient Realm Travel Stand
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                [E]
              </kbd>{' '}
              Pick up Broom &amp; Fly
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerBroomAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            [E] Pick up Broom &amp; Fly
          </button>
        </div>
      )}

      {/* Floating Flight Prompt: [E] Dismount Broom */}
      {telemetry.broomPromptMode === 'dismount' && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-950/90 border border-violet-300/35 rounded-xl px-4 py-2.5 text-white shadow-xl">
          <Wind className="w-4 h-4 text-violet-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-violet-200">
              {telemetry.isOverCastleTerrace
                ? 'Castle Landing Terrace Below — Ready to Land'
                : 'Enchanted Broom Flight Active'}
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-violet-200">
                [E]
              </kbd>{' '}
              Dismount Broom{' '}
              <span className="text-slate-400">
                (Broom returns home to Travel Stand)
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerBroomAction()}
            className="ml-2 px-3 py-1.5 rounded-lg bg-violet-400 hover:bg-violet-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            [E] Dismount Broom
          </button>
        </div>
      )}

      {/* Floating Return-to-Home Status Banner */}
      {telemetry.broomPromptMode === 'returning' &&
        telemetry.mysteryPromptMode === 'none' &&
        !isInMysteryCinematic && (
          <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-slate-950/90 border border-amber-300/30 rounded-xl px-4 py-2 text-xs text-amber-200 shadow-xl">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Broom is banking through the air back to its Travel Stand at the
              Ancient Realm Gateway…
            </span>
          </div>
        )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      {!isInMysteryCinematic && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center w-full max-w-[min(1020px,95vw)]">
          {/* Collapse / Expand Tab */}
          <button
            type="button"
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="mb-1.5 flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-slate-950/85 border border-white/10 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 shadow cursor-pointer"
          >
            {hudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>

          {!hudCollapsed && (
          <div className="w-full bg-slate-950/90 border border-white/12 rounded-2xl px-5 py-3.5 text-white shadow-2xl flex flex-col gap-3">
            {/* Row 1: Camera Controls & Waypoint Quick-Jump */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Camera Perspective Switcher */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-white/10 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      controllerRef.current?.setCameraMode('third-person');
                      setTelemetry((prev) => ({
                        ...prev,
                        cameraMode: 'third-person',
                      }));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      telemetry.cameraMode === 'third-person'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>3rd Person (Default)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleCameraMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      telemetry.cameraMode === 'first-person'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>1st Person (V)</span>
                  </button>
                </div>

                {/* Follow Distance Slider (Active in 3rd Person Walk) */}
                {telemetry.cameraMode === 'third-person' &&
                  telemetry.locomotionState === 'walk' && (
                    <label className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap shrink-0">
                      <span>Zoom</span>
                      <input
                        type="range"
                        min={2.8}
                        max={14.5}
                        step={0.2}
                        value={telemetry.cameraDistance}
                        onChange={(e) =>
                          handleDistanceChange(parseFloat(e.target.value))
                        }
                        className="w-20 accent-rose-400 cursor-pointer"
                      />
                      <span className="font-mono-tabular text-slate-400 w-9">
                        {telemetry.cameraDistance.toFixed(1)}m
                      </span>
                    </label>
                  )}
              </div>

              {/* Quick Theme-Park Vista Waypoints */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="flex items-center gap-1 text-xs text-slate-400 mr-1 whitespace-nowrap shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Vistas:</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleTeleport(
                      BROOM_STAND_POS.x + 2.2,
                      BROOM_STAND_POS.z - 2.0,
                      Math.atan2(
                        CASTLE_KEEP_POS.x - BROOM_STAND_POS.x,
                        CASTLE_KEEP_POS.z - BROOM_STAND_POS.z,
                      ),
                    )
                  }
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Broom Stand (NW)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleTeleport(
                      CASTLE_TERRACE_POS.x,
                      CASTLE_TERRACE_POS.z,
                      Math.atan2(
                        CASTLE_KEEP_POS.x - CASTLE_TERRACE_POS.x,
                        CASTLE_KEEP_POS.z - CASTLE_TERRACE_POS.z,
                      ),
                    )
                  }
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-400/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Castle Terrace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const startW = castleLocalToWorld(9.2, 38.4);
                    const lookW = castleLocalToWorld(18.0, 38.0);
                    handleTeleport(
                      startW.x,
                      startW.z,
                      Math.atan2(lookW.x - startW.x, lookW.z - startW.z),
                    );
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Greenhouse Exit (F1)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const startW = castleLocalToWorld(39.4, 12.2);
                    const lookW = castleLocalToWorld(46.0, 4.0);
                    handleTeleport(
                      startW.x,
                      startW.z,
                      Math.atan2(lookW.x - startW.x, lookW.z - startW.z),
                    );
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ancient Forest (F2)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleTeleport(88.0, 1.5, 0)
                  }
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-400/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Dream Castle (5L)
                </button>
                {ISLAND_ZONES.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleTeleport(zone.x, zone.z)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Clean Input Instructions (Flight vs Walk) */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-slate-200 font-medium">
                  <Footprints className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {telemetry.locomotionState === 'flight'
                      ? 'W Forward (15 m/s) · Shift+W Boost (22 m/s) · S Brake/Reverse · A/D Yaw & Bank · Space Ascend · Ctrl/C Descend · E/Esc Dismount'
                      : 'WASD / Arrows to Walk · Hold Shift to Sprint · Press E near Broom Stand or Mystery Box'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <MousePointerClick className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  {telemetry.isPointerLocked
                    ? 'Mouse Aim Active (Press Esc to unlock)'
                    : 'Click island or drag mouse to rotate camera 360°'}
                </span>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Hidden file input for uploading custom romantic gallery pictures */}
      <input
        ref={galleryFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryFileUpload}
        className="hidden"
      />

      {/* Romantic Memory Gallery Custom Image URL Modal */}
      {showGalleryUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-pink-400/50 rounded-2xl p-5 max-w-md w-full shadow-2xl text-white">
            <h3 className="text-sm font-bold text-pink-300 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" /> Frame {selectedGalleryFrame + 1} Custom Picture
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              Enter a direct image URL (PNG, JPG, or WebP) to display inside this romantic gold filigree frame.
            </p>
            <input
              type="text"
              placeholder="https://example.com/photo.jpg"
              value={galleryUrlInput}
              onChange={(e) => setGalleryUrlInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-pink-400/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-300 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGalleryUrlModal(false);
                  setGalleryUrlInput('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (galleryUrlInput.trim()) {
                    controllerRef.current?.setGalleryFrameImage(
                      selectedGalleryFrame,
                      galleryUrlInput.trim(),
                    );
                  }
                  setShowGalleryUrlModal(false);
                  setGalleryUrlInput('');
                }}
                className="px-4 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold cursor-pointer"
              >
                Set Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
