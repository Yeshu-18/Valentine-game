import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  DoorOpen,
  Eye,
  Film,
  Heart,
  KeyRound,
  Lock,
  MessageSquare,
  PhoneCall,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  PrequelSceneId,
  loadSavedChatScreenshot,
  saveChatScreenshot,
} from './GameStoryDirector';
import { StoryAudioSynthesizer } from './storyAudio';

interface PrequelSceneProps {
  onCompletePrequel: () => void;
  onJumpToEpilogue: () => void;
}

const SCENE_ORDER: readonly PrequelSceneId[] = [
  'SCENE_1_NIGHT_WALK',
  'SCENE_2_DARK_CAR',
  'SCENE_3_THE_DRIVE',
  'SCENE_4_CELL_04_AWAKENING',
  'SCENE_5_THE_PHONE',
  'SCENE_6_7_THE_CLUES',
  'SCENE_8_MEMORY_1_HAIL_MARY',
  'SCENE_8_MEMORY_2_PINKY_MOMENT',
  'SCENE_8_MEMORY_3_CONFESSION',
  'SCENE_9_10_THE_DOOR',
  'SCENE_11_12_THE_REVEAL',
];

export const PrequelScene: React.FC<PrequelSceneProps> = ({
  onCompletePrequel,
  onJumpToEpilogue,
}) => {
  const [sceneId, setSceneId] = useState<PrequelSceneId>('SCENE_1_NIGHT_WALK');
  const [phoneStep, setPhoneStep] = useState<number>(0);
  const [inspectedNotes, setInspectedNotes] = useState<boolean>(false);
  const [inspectedPhoto, setInspectedPhoto] = useState<boolean>(false);
  const [photoFlipped, setPhotoFlipped] = useState<boolean>(false);
  const [blindfoldRemoved, setBlindfoldRemoved] = useState<boolean>(false);
  const [chatScreenshot, setChatScreenshot] = useState<string | null>(() =>
    loadSavedChatScreenshot(),
  );

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<StoryAudioSynthesizer | null>(null);
  const sceneIdRef = useRef<PrequelSceneId>(sceneId);
  const blindfoldRemovedRef = useRef<boolean>(blindfoldRemoved);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    sceneIdRef.current = sceneId;
  }, [sceneId]);

  useEffect(() => {
    blindfoldRemovedRef.current = blindfoldRemoved;
  }, [blindfoldRemoved]);

  useEffect(() => {
    const audio = new StoryAudioSynthesizer();
    audioRef.current = audio;
    return () => {
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  // Trigger scene-specific procedural audio cues
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (sceneId === 'SCENE_1_NIGHT_WALK' || sceneId === 'SCENE_3_THE_DRIVE') {
      audio.playPhoneMessageCue();
    } else if (sceneId === 'SCENE_2_DARK_CAR') {
      audio.playSuspensePulse();
    } else if (sceneId === 'SCENE_4_CELL_04_AWAKENING') {
      audio.playRotaryPhoneRing();
    } else if (sceneId === 'SCENE_5_THE_PHONE') {
      audio.playPhonePickupAndFlicker();
    } else if (sceneId === 'SCENE_6_7_THE_CLUES') {
      audio.playClueInspectCue();
    } else if (sceneId === 'SCENE_8_MEMORY_1_HAIL_MARY') {
      audio.playMemoryChord(1);
    } else if (sceneId === 'SCENE_8_MEMORY_2_PINKY_MOMENT') {
      audio.playMemoryChord(2);
    } else if (sceneId === 'SCENE_8_MEMORY_3_CONFESSION') {
      audio.playMemoryChord(3);
    } else if (sceneId === 'SCENE_9_10_THE_DOOR') {
      audio.playSteelDoorUnlock();
    }
  }, [sceneId]);

  // Keyboard shortcut (E / Enter) for natural scene progression
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        if (sceneId === 'SCENE_4_CELL_04_AWAKENING') {
          setSceneId('SCENE_5_THE_PHONE');
        } else if (sceneId === 'SCENE_5_THE_PHONE') {
          if (phoneStep < 2) {
            setPhoneStep((prev) => prev + 1);
            audioRef.current?.playClueInspectCue();
          } else {
            setSceneId('SCENE_6_7_THE_CLUES');
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sceneId, phoneStep]);

  // Live 3D Three.js Background Canvas for Street/Car (Scenes 1-3), Cell 04: The Awakening (Scenes 4-10), & Golden Reveal (Scenes 11-12)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06080e');
    scene.fog = new THREE.FogExp2('#06080e', 0.085);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      60,
    );
    camera.position.set(0, 1.65, 3.6);

    // =========================================================================
    // GROUP A: NIGHT STREET & DARK CAR (SCENES 1 - 3)
    // =========================================================================
    const streetGroup = new THREE.Group();
    scene.add(streetGroup);

    const roadMat = new THREE.MeshStandardMaterial({
      color: '#0f131d',
      roughness: 0.42,
      metalness: 0.15,
    });
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 36), roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    streetGroup.add(roadMesh);

    const lampPostMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.6,
      metalness: 0.5,
    });
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: '#fde68a' });
    [-4.5, 4.5].forEach((lx, idx) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8),
        lampPostMat,
      );
      pole.position.set(lx, 2.1, -3.5 - idx * 4.5);
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        lampBulbMat,
      );
      globe.position.set(lx, 4.25, -3.5 - idx * 4.5);
      streetGroup.add(pole, globe);
    });

    // Dark Car Silhouette
    const carGroup = new THREE.Group();
    carGroup.position.set(1.2, 0.0, -5.5);
    streetGroup.add(carGroup);

    const carBodyMat = new THREE.MeshStandardMaterial({
      color: '#090b10',
      roughness: 0.2,
      metalness: 0.8,
    });
    const carLower = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.65, 4.2),
      carBodyMat,
    );
    carLower.position.y = 0.55;
    const carCabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 2.1),
      carBodyMat,
    );
    carCabin.position.set(0, 1.1, -0.2);
    carGroup.add(carLower, carCabin);

    const headlightMat = new THREE.MeshBasicMaterial({ color: '#fef3c7' });
    [-0.65, 0.65].forEach((hx) => {
      const hl = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        headlightMat,
      );
      hl.position.set(hx, 0.58, 2.12);
      carGroup.add(hl);
    });

    const carHeadlightSpot = new THREE.PointLight('#fef3c7', 3.5, 14);
    carHeadlightSpot.position.set(0, 0.8, 2.6);
    carGroup.add(carHeadlightSpot);

    // =========================================================================
    // GROUP B: CELL 04 — THE AWAKENING (SCENES 4 - 10)
    // =========================================================================
    const cellGroup = new THREE.Group();
    scene.add(cellGroup);

    const wallMat = new THREE.MeshStandardMaterial({
      color: '#161b26',
      roughness: 0.88,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#11151f',
      roughness: 0.82,
    });

    // Room Shell (Floor, Ceiling, Back Wall, Left/Right Walls)
    const cellFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    cellFloor.rotation.x = -Math.PI / 2;
    cellFloor.receiveShadow = true;
    const cellBackWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), wallMat);
    cellBackWall.position.set(0, 2.25, -2.6);
    cellBackWall.receiveShadow = true;
    const cellLeftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), wallMat);
    cellLeftWall.rotation.y = Math.PI / 2;
    cellLeftWall.position.set(-3.4, 2.25, 0);
    const cellRightWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), wallMat);
    cellRightWall.rotation.y = -Math.PI / 2;
    cellRightWall.position.set(3.4, 2.25, 0);
    cellGroup.add(cellFloor, cellBackWall, cellLeftWall, cellRightWall);

    // Heavy Steel Door on Back-Left Wall
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-2.35, 0, -2.55);
    cellGroup.add(doorPivot);

    const steelDoorMat = new THREE.MeshStandardMaterial({
      color: '#27303f',
      roughness: 0.45,
      metalness: 0.72,
    });
    const steelDoorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.45, 0.12),
      steelDoorMat,
    );
    steelDoorMesh.position.set(0.675, 1.225, 0);
    steelDoorMesh.castShadow = true;
    doorPivot.add(steelDoorMesh);

    // Bed on Right Side
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#452c1e',
      roughness: 0.72,
    });
    const mattressMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.85,
    });
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.35, 2.2),
      woodMat,
    );
    bedFrame.position.set(2.1, 0.175, -0.9);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.22, 2.05),
      mattressMat,
    );
    mattress.position.set(2.1, 0.42, -0.9);
    cellGroup.add(bedFrame, mattress);

    // Wooden Desk & Chair in Center-Right
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.08, 0.95),
      woodMat,
    );
    deskTop.position.set(0.15, 0.82, -1.35);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    cellGroup.add(deskTop);

    [-0.72, 0.72].forEach((dx) => {
      [-0.38, 0.38].forEach((dz) => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.8, 0.08),
          woodMat,
        );
        leg.position.set(0.15 + dx, 0.4, -1.35 + dz);
        cellGroup.add(leg);
      });
    });

    // Vintage Rotary Telephone on the Desk
    const phoneGroup = new THREE.Group();
    phoneGroup.position.set(-0.28, 0.86, -1.25);
    cellGroup.add(phoneGroup);

    const bakeliteMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.25,
      metalness: 0.3,
    });
    const dialMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      roughness: 0.4,
    });
    const phoneBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.28),
      bakeliteMat,
    );
    phoneBase.position.y = 0.07;
    const rotaryDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.02, 16),
      dialMat,
    );
    rotaryDial.rotation.x = 0.45;
    rotaryDial.position.set(0, 0.13, 0.08);
    const handset = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.06, 0.09),
      bakeliteMat,
    );
    handset.position.set(0, 0.18, -0.02);
    phoneGroup.add(phoneBase, rotaryDial, handset);

    // Photograph ("14 / 02 / 2024") & Clue Cards on Desk
    const photoCardMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.5,
    });
    const photoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.01, 0.18),
      photoCardMat,
    );
    photoMesh.position.set(0.32, 0.868, -1.22);
    photoMesh.rotation.y = -0.22;
    cellGroup.add(photoMesh);

    // Desk Lamp & Overhead Tungsten Pendant Light
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#b45309',
      roughness: 0.35,
      metalness: 0.75,
    });
    const deskLampStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.09, 0.42, 10),
      brassMat,
    );
    deskLampStand.position.set(0.68, 1.07, -1.52);
    const deskLampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.18, 12, 1, true),
      brassMat,
    );
    deskLampShade.position.set(0.62, 1.28, -1.45);
    deskLampShade.rotation.z = 0.35;
    cellGroup.add(deskLampStand, deskLampShade);

    const overheadLight = new THREE.PointLight('#fbbf24', 4.2, 11);
    overheadLight.position.set(0.1, 2.75, -1.1);
    overheadLight.castShadow = true;
    cellGroup.add(overheadLight);

    const deskWarmLight = new THREE.PointLight('#f59e0b', 2.8, 5.5);
    deskWarmLight.position.set(0.45, 1.22, -1.35);
    cellGroup.add(deskWarmLight);

    const ambientLight = new THREE.AmbientLight('#1e293b', 0.9);
    scene.add(ambientLight);

    // =========================================================================
    // GROUP C: GOLDEN DREAM WORLD REVEAL (SCENES 11 - 12)
    // =========================================================================
    const revealGroup = new THREE.Group();
    scene.add(revealGroup);

    const goldenSunLight = new THREE.PointLight('#fde68a', 6.5, 25);
    goldenSunLight.position.set(0, 3.5, -2.0);
    revealGroup.add(goldenSunLight);

    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.35);
    heartShape.bezierCurveTo(0, 0.65, -0.5, 0.65, -0.5, 0.25);
    heartShape.bezierCurveTo(-0.5, -0.1, 0, -0.35, 0, -0.55);
    heartShape.bezierCurveTo(0, -0.35, 0.5, -0.1, 0.5, 0.25);
    heartShape.bezierCurveTo(0.5, 0.65, 0, 0.65, 0, 0.35);

    const revealHeartGeo = new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    revealHeartGeo.center();
    const revealHeartMat = new THREE.MeshStandardMaterial({
      color: '#fb7185',
      emissive: '#e11d48',
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });
    const revealHeartMesh = new THREE.Mesh(revealHeartGeo, revealHeartMat);
    revealHeartMesh.position.set(0, 1.85, -2.2);
    revealGroup.add(revealHeartMesh);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (ev: MouseEvent) => {
      mouseX = (ev.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      mouseY = (ev.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const cur = sceneIdRef.current;

      const isStreet =
        cur === 'SCENE_1_NIGHT_WALK' ||
        cur === 'SCENE_2_DARK_CAR' ||
        cur === 'SCENE_3_THE_DRIVE';
      const isReveal = cur === 'SCENE_11_12_THE_REVEAL';
      const isCell = !isStreet && !isReveal;

      streetGroup.visible = isStreet;
      cellGroup.visible = isCell;
      revealGroup.visible = isReveal;

      if (isStreet) {
        scene.background = new THREE.Color('#05070c');
        if (cur === 'SCENE_1_NIGHT_WALK') {
          carGroup.position.z = -9.5;
          camera.position.set(mouseX * 0.25, 1.6 + Math.sin(t * 2.5) * 0.03, 3.8);
          camera.lookAt(0, 1.4, -4.0);
        } else if (cur === 'SCENE_2_DARK_CAR') {
          carGroup.position.z = THREE.MathUtils.lerp(carGroup.position.z, -2.2, 0.03);
          camera.position.set(mouseX * 0.2, 1.55, 3.2);
          camera.lookAt(0.8, 1.0, -2.2);
        } else {
          // Inside the dark drive
          carGroup.position.z = -1.5;
          camera.position.set(
            Math.sin(t * 1.8) * 0.04,
            1.25 + Math.cos(t * 3.1) * 0.015,
            -0.5,
          );
          camera.lookAt(0, 1.2, -6.0);
        }
      } else if (isCell) {
        scene.background = new THREE.Color('#080b12');

        // Ringing vibration on phone in Scene 4
        if (cur === 'SCENE_4_CELL_04_AWAKENING') {
          phoneGroup.rotation.z = Math.sin(t * 38.0) * 0.045;
        } else {
          phoneGroup.rotation.z = 0;
        }

        // Light flicker in Scene 5
        if (cur === 'SCENE_5_THE_PHONE') {
          const flicker =
            Math.sin(t * 27.0) > 0.78 && Math.sin(t * 7.3) > 0.2 ? 0.35 : 1.0;
          overheadLight.intensity = 3.8 * flicker;
        } else {
          overheadLight.intensity = 4.2 + Math.sin(t * 2.1) * 0.15;
        }

        // Door opens in Scene 9 & 10
        if (cur === 'SCENE_9_10_THE_DOOR') {
          doorPivot.rotation.y = THREE.MathUtils.lerp(
            doorPivot.rotation.y,
            -0.85,
            0.04,
          );
        } else {
          doorPivot.rotation.y = 0;
        }

        // Camera framing inside Cell 04
        const targetCamX = mouseX * 0.35;
        const targetCamY = 1.52 - mouseY * 0.15;
        const targetCamZ =
          cur === 'SCENE_5_THE_PHONE' || cur === 'SCENE_6_7_THE_CLUES'
            ? 0.45
            : 1.85;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.06);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.06);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.05);
        camera.lookAt(0.05, 1.02, -1.45);
      } else {
        // Scene 11 & 12: Golden Reveal
        const unveiled = blindfoldRemovedRef.current;
        scene.background = new THREE.Color(unveiled ? '#1e1024' : '#040508');
        revealHeartMesh.rotation.y = t * 0.65;
        revealHeartMesh.position.y = 1.85 + Math.sin(t * 1.8) * 0.08;
        goldenSunLight.intensity = unveiled ? 7.5 : 0.4;
        camera.position.set(mouseX * 0.2, 1.65, 2.2);
        camera.lookAt(0, 1.75, -2.2);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setChatScreenshot(reader.result);
        saveChatScreenshot(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const sceneIndex = SCENE_ORDER.indexOf(sceneId);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Live 3D WebGL Spatial Scene Canvas */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Prequel 3D Narrative Viewport"
      />

      {/* Atmospheric Radial Vignette Scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/75" />

      {/* Top Navigation & Chapter Bar */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-6 py-4 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <span className="font-display text-base font-semibold tracking-tight text-amber-200">
            Valentine’s Day 2027 · Prologue
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-300 font-mono-tabular">
            Scene {sceneIndex + 1} of {SCENE_ORDER.length}
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setSceneId('SCENE_1_NIGHT_WALK')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sceneIndex <= 2 ? 'text-amber-300 font-semibold' : ''
            }`}
          >
            01. Feb 13 (10:30 PM)
          </button>
          <button
            type="button"
            onClick={() => setSceneId('SCENE_4_CELL_04_AWAKENING')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sceneIndex >= 3 && sceneIndex <= 5
                ? 'text-amber-300 font-semibold'
                : ''
            }`}
          >
            02. Cell 04: The Awakening
          </button>
          <button
            type="button"
            onClick={() => setSceneId('SCENE_8_MEMORY_1_HAIL_MARY')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sceneIndex >= 6 && sceneIndex <= 8
                ? 'text-amber-300 font-semibold'
                : ''
            }`}
          >
            03. Relationship Clues
          </button>
          <button
            type="button"
            onClick={() => setSceneId('SCENE_11_12_THE_REVEAL')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sceneIndex >= 9 ? 'text-amber-300 font-semibold' : ''
            }`}
          >
            04. The Dream World Reveal
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCompletePrequel}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Enter 3D Dream World
          </button>
          <button
            type="button"
            onClick={onJumpToEpilogue}
            className="px-3 py-1.5 text-xs font-medium text-rose-200 bg-rose-950/70 hover:bg-rose-900/80 border border-rose-400/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Jump to Epilogue
          </button>
        </div>
      </header>

      {/* Main Centered Story Stage */}
      <main className="relative z-10 flex flex-col items-center justify-end h-[calc(100vh-65px)] pb-10 px-6 pointer-events-none">
        <div className="w-full max-w-2xl pointer-events-auto">
          {/* ============================================================== */}
          {/* SCENE 1: FEBRUARY 13, 2027 • 10:30 PM                          */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_1_NIGHT_WALK' && (
            <div className="bg-slate-950/90 border border-white/15 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300/90 mb-2">
                <span>Scene 1</span>
                <span>·</span>
                <span>February 13, 2027</span>
                <span>·</span>
                <span>10:30 PM</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                Walking Home
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                It is an ordinary quiet night on February 13, 2027. You are
                walking home along the familiar street when your phone suddenly
                vibrates in your hand.
              </p>

              {/* Phone Message Bubble */}
              <div className="bg-slate-900/95 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5 text-amber-200 font-medium">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Incoming Message</span>
                  </span>
                  <span className="font-mono-tabular">10:30 PM</span>
                </div>
                <p className="text-base font-medium text-white">
                  “Are you home yet?”
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Something feels slightly unusual... but you keep walking.
                </span>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_2_DARK_CAR')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Continue Walking</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 2: THE DARK CAR                                          */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_2_DARK_CAR' && (
            <div className="bg-slate-950/90 border border-white/15 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300/90 mb-2">
                <span>Scene 2</span>
                <span>·</span>
                <span>10:34 PM</span>
                <span>·</span>
                <span>The Approach</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The Dark Car
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Low headlights sweep across the pavement behind you. A dark car
                slows down beside the curb and comes to a quiet stop.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Everything happens too quickly to process—not violent, not
                brutal, just an overwhelming wave of confusion and suspense as
                the door opens and the night fades into darkness.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  “Wait... what is happening?”
                </span>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_3_THE_DRIVE')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 3: THE DRIVE                                             */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_3_THE_DRIVE' && (
            <div className="bg-slate-950/90 border border-white/15 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300/90 mb-2">
                <span>Scene 3</span>
                <span>·</span>
                <span>In Transit</span>
                <span>·</span>
                <span>Unknown Destination</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The Drive
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                You are inside the dark car. Amber streetlights blur past the
                tinted glass in silence. You still do not know where you are
                being taken—or why.
              </p>

              <div className="bg-slate-900/95 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5 text-amber-200 font-medium">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message Notification</span>
                  </span>
                  <span className="font-mono-tabular">11:12 PM</span>
                </div>
                <p className="text-base font-medium text-white">
                  “Almost there.”
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  The car slows to a stop...
                </span>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_4_CELL_04_AWAKENING')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Open Your Eyes</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 4: CELL 04 — THE AWAKENING                               */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_4_CELL_04_AWAKENING' && (
            <div className="bg-slate-950/90 border border-amber-400/30 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Scene 4</span>
                <span>·</span>
                <span>CELL 04: THE AWAKENING</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The Locked Room
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                You wake up inside a quiet, dimly lit room. A warm tungsten lamp
                hangs above a wooden desk and chair. The heavy steel door on the
                left is locked—and on the desk, a vintage rotary telephone is
                ringing.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <span className="text-xs text-amber-200/90">
                  Move your mouse to look around Cell 04 · Press E to answer the
                  phone
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep(0);
                    setSceneId('SCENE_5_THE_PHONE');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Press E — Answer Rotary Phone</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 5: THE PHONE                                             */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_5_THE_PHONE' && (
            <div className="bg-slate-950/92 border border-amber-400/40 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Scene 5</span>
                <span>·</span>
                <span>Rotary Telephone Connection</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-4">
                {phoneStep === 0 && '“You’re awake.”'}
                {phoneStep === 1 && '“Good.”'}
                {phoneStep >= 2 && '“We need to talk.”'}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                {phoneStep === 0 &&
                  'You lift the heavy receiver to your ear. A calm voice speaks from the other end.'}
                {phoneStep === 1 &&
                  'The overhead lamp flickers briefly, casting long shadows across the wooden desk.'}
                {phoneStep >= 2 &&
                  'The line clicks quiet. Whoever arranged this isn’t trying to frighten you—they want you to look at what they left on the desk.'}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Who is doing this?
                </span>
                {phoneStep < 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep((p) => p + 1);
                      audioRef.current?.playClueInspectCue();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Listen (Press E)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSceneId('SCENE_6_7_THE_CLUES')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Search the Room Clues</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 6 & 7: THE FIRST CLUES & THE PHOTOGRAPH (14 / 02 / 2024) */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_6_7_THE_CLUES' && (
            <div className="bg-slate-950/92 border border-white/15 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <span>Scenes 6 & 7</span>
                <span>·</span>
                <span>Cell 04 Desk Investigation</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The First Clues & The Photograph
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                Under the warm pool of the brass desk lamp lie minimal notes and
                a single photograph. Whoever arranged this room knows things
                only one person could know.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Clue 1: Minimalist Notes */}
                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-amber-200 font-medium mb-2">
                      Clue 01 · Handwritten Cards
                    </div>
                    {inspectedNotes ? (
                      <div className="space-y-1.5 text-sm text-white font-medium">
                        <p>“You’re awake.”</p>
                        <p>“Don’t be afraid.”</p>
                        <p>“Someone who remembers.”</p>
                        <p>“Look around.”</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Four short cards stacked beside the rotary telephone.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedNotes(true);
                      audioRef.current?.playClueInspectCue();
                    }}
                    className="mt-4 px-3.5 py-2 text-xs font-medium text-amber-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    {inspectedNotes ? 'Notes Inspected ✓' : 'Read Desk Notes'}
                  </button>
                </div>

                {/* Clue 2: The Photograph (14 / 02 / 2024) */}
                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-amber-200 font-medium mb-2">
                      Clue 02 · The Photograph
                    </div>
                    {!inspectedPhoto ? (
                      <p className="text-xs text-slate-400">
                        A familiar photograph resting on the wooden desk.
                      </p>
                    ) : !photoFlipped ? (
                      <p className="text-xs text-slate-200">
                        You pick up the photograph. There is something written
                        on the back...
                      </p>
                    ) : (
                      <div className="p-3 bg-amber-950/40 border border-amber-400/30 rounded-lg text-center">
                        <span className="text-xs text-amber-200/80 block mb-1">
                          Written on the back:
                        </span>
                        <span className="font-mono-tabular text-lg font-bold tracking-widest text-amber-200">
                          14 / 02 / 2024
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!inspectedPhoto) {
                        setInspectedPhoto(true);
                      } else {
                        setPhotoFlipped(true);
                      }
                      audioRef.current?.playClueInspectCue();
                    }}
                    className="mt-4 px-3.5 py-2 text-xs font-medium text-amber-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    {!inspectedPhoto
                      ? 'Pick Up Photograph'
                      : !photoFlipped
                        ? 'Turn Over Photograph'
                        : '14 / 02 / 2024 Discovered ✓'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Why this date? Why these memories?
                </span>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_8_MEMORY_1_HAIL_MARY')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Follow the Memories</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 8 — MEMORY 1: PROJECT HAIL MARY                          */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_8_MEMORY_1_HAIL_MARY' && (
            <div className="bg-slate-950/92 border border-amber-300/35 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <Film className="w-3.5 h-3.5" />
                <span>Scene 8 · Memory 1 of 3</span>
                <span>·</span>
                <span>The Cinema Interval</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                Project Hail Mary
              </h1>
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4 mb-5 space-y-2">
                <p className="text-base font-medium text-amber-200">
                  “You remember this day.”
                </p>
                <p className="text-base font-medium text-white">
                  “But you don’t...”
                </p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Only the two of you are in the theatre for{' '}
                <span className="text-white font-medium">
                  Project Hail Mary
                </span>
                . During the interval, he hands you his glasses before stepping
                out to the washroom.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                When he walks back through the quiet rear pathway of the aisle,
                he stops and notices you gently wiping his glasses—and sees you
                smile. Quiet, unscripted, and completely real: that was the
                exact moment he fell in love with you.
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_6_7_THE_CLUES')}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Back to Desk
                </button>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_8_MEMORY_2_PINKY_MOMENT')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Next Memory — The Pinky Moment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 8 — MEMORY 2: THE HAND-HOLDING & PINKY MOMENT            */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_8_MEMORY_2_PINKY_MOMENT' && (
            <div className="bg-slate-950/92 border border-amber-300/35 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <Heart className="w-3.5 h-3.5" />
                <span>Scene 8 · Memory 2 of 3</span>
                <span>·</span>
                <span>The Mall & The Drive</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The Hand-Holding Moment
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                He wants to hold your hand, but he hesitates. Instead of
                directly holding his hand, you reach out and gently hold his
                pinky first.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Later during the drive, he holds your hand while you talk. And
                right before you step out to board the bus, you turn and ask:
              </p>
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-base font-medium text-amber-200">
                  “Do you have any intention of a relationship?”
                </p>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_8_MEMORY_1_HAIL_MARY')}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Previous Memory
                </button>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_8_MEMORY_3_CONFESSION')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Next Memory — The Confession</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 8 — MEMORY 3: THE CONFESSION (REAL CHAT SCREENSHOT)      */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_8_MEMORY_3_CONFESSION' && (
            <div className="bg-slate-950/92 border border-amber-300/35 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Scene 8 · Memory 3 of 3</span>
                  <span>·</span>
                  <span>The Real Chat Confession</span>
                </div>
                <button
                  type="button"
                  onClick={() => chatInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {chatScreenshot
                      ? 'Change Chat Screenshot'
                      : 'Attach Real Chat Screenshot'}
                  </span>
                </button>
                <input
                  ref={chatInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChatImageUpload}
                  className="hidden"
                />
              </div>

              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                The Confession
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Separately at your homes after that day, both of you replay
                everything that happened—until the real words are finally sent,
                marking the true beginning of your relationship.
              </p>

              {chatScreenshot ? (
                <div className="mb-5 rounded-xl overflow-hidden border border-white/15 bg-slate-900 max-h-60 flex items-center justify-center">
                  <img
                    src={chatScreenshot}
                    alt="The Real Confession Chat Screenshot"
                    referrerPolicy="no-referrer"
                    className="max-h-60 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="mb-5 rounded-xl border border-white/10 bg-slate-900/90 p-4 text-center">
                  <Camera className="w-5 h-5 text-amber-300 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-300 font-medium">
                    Real Chat Screenshot Frame
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    No fabricated dialogue is shown here—click “Attach Real Chat
                    Screenshot” above to display your original confession
                    screenshot, or continue to the door.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_8_MEMORY_2_PINKY_MOMENT')}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Previous Memory
                </button>
                <button
                  type="button"
                  onClick={() => setSceneId('SCENE_9_10_THE_DOOR')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Continue — The Mystery Deepens</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 9 & 10: THE MYSTERY DEEPENS & THE DOOR / BLINDFOLD       */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_9_10_THE_DOOR' && (
            <div className="bg-slate-950/92 border border-amber-300/40 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Scenes 9 & 10</span>
                <span>·</span>
                <span>The Door & The Blindfold</span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-3">
                “You wanted to forget. I wanted to remember.”
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                This isn’t random. Someone planned every detail. Someone knows
                you—and knows your story together.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                With a deep metallic click, the heavy steel door of Cell 04
                unlocks and swings open. A quiet silhouette is waiting beyond
                the threshold. Gently, carefully, he places a soft blindfold
                over your eyes and guides you forward toward a second door.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  The cold air of the locked room begins to change...
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBlindfoldRemoved(false);
                    setSceneId('SCENE_11_12_THE_REVEAL');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Step Through the Second Door</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCENE 11 & 12: THE SECOND DOOR & THE DREAM WORLD REVEAL        */}
          {/* ============================================================== */}
          {sceneId === 'SCENE_11_12_THE_REVEAL' && (
            <div className="bg-slate-950/92 border border-rose-400/45 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-rose-300 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Scenes 11 & 12</span>
                <span>·</span>
                <span>Valentine’s Day Reveal</span>
              </div>

              {!blindfoldRemoved ? (
                <>
                  <h1 className="font-display text-2xl font-semibold text-white mb-3">
                    The Second Door Opens
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    The blindfold remains on for one more heartbeat as the
                    second door opens before you. The cold mystery of the locked
                    room gives way to warm golden light, soft music, and the
                    scent of an expansive fantasy world.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-200/90">
                      He gently unties the blindfold...
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBlindfoldRemoved(true);
                        audioRef.current?.playDreamWorldRevealSwell();
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-rose-300 hover:bg-rose-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Remove the Blindfold</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-semibold text-white mb-2">
                    It’s Yeshwanth. “I built an entire world for you.”
                  </h1>
                  <p className="text-sm text-slate-200 leading-relaxed mb-4">
                    The blindfold falls away. Standing right in front of you is
                    your boyfriend, Yeshwanth—and stretching out behind him is a
                    breathtaking private fantasy island built entirely for you.
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    All the mystery and suspense melts into tears of relief,
                    laughter, and a tight, emotional embrace. The whole island—the
                    Dream Castle, the Wizarding School, the Heartline Coaster,
                    the Carnival Midway, the Enchanted Forest, and the Special
                    Gate at the southern tip—is yours to explore.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-rose-300 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Prologue Complete · Heart Island Unlocked</span>
                    </span>
                    <button
                      type="button"
                      onClick={onCompletePrequel}
                      className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-400 rounded-lg shadow-lg transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Step Into Your Dream World</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
