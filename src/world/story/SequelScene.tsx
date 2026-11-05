import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Flame,
  Heart,
  Sparkles,
  Stars,
  Compass,
  RotateCcw,
  BookOpen,
  HandHeart,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SequelSceneId } from './GameStoryDirector';
import { StoryAudioSynthesizer } from './storyAudio';

export interface SequelSceneProps {
  onReturnToDreamWorld: () => void;
  onReplayFullStory: () => void;
}

interface IntimateMoment {
  id: 'tease' | 'hold_hands' | 'kiss' | 'cuddle_stars';
  label: string;
  subtitle: string;
  harshaLine: string;
  yeshwanthLine: string;
  narration: string;
}

const INTIMATE_MOMENTS: IntimateMoment[] = [
  {
    id: 'tease',
    label: 'Playful Teasing by the Fire',
    subtitle: 'Quiet laughter after the grand journey',
    harshaLine: '"Wait... so the dark car, Cell 04, the rotary phone—all of that was just you being dramatic?!"',
    yeshwanthLine: '"You wouldn\'t have believed me if I just sent a normal calendar invite, Pattuma."',
    narration:
      'She laughs, nudging his shoulder playfully as the hearth fire crackles in rose-gold warmth. All the mystery of February 13th melts into effortless familiarity.',
  },
  {
    id: 'hold_hands',
    label: 'Hold Her Pinky, Then Her Hand',
    subtitle: 'Just like the drive that started it all',
    harshaLine: '"Still reaching for my pinky first?"',
    yeshwanthLine: '"Always. Every single time."',
    narration:
      'He reaches out and catches her pinky finger first, before lacing his fingers warmly through hers. No hesitation left—only certainty.',
  },
  {
    id: 'kiss',
    label: 'A Quiet Kiss Under the Lanterns',
    subtitle: 'Warm, unhurried, and completely theirs',
    harshaLine: '"You really built an entire world..."',
    yeshwanthLine: '"Every stone, every star, every memory—just to see this smile."',
    narration:
      'Under the drifting rose-gold lanterns of the southern cape sanctuary, he leans in closely. Time slows down as they share a tender, lingering kiss.',
  },
  {
    id: 'cuddle_stars',
    label: 'Lie Back & Cuddle Under the Stars',
    subtitle: 'Listening to the ocean beyond the Special Gate',
    harshaLine: '"I don\'t think I ever want to leave this place."',
    yeshwanthLine: '"You never have to. This world is yours whenever you want to come home to it."',
    narration:
      'They lie back together on the velvet starlight day-bed, wrapped in warmth while the aurora ribbons and lanterns drift across the quiet sea.',
  },
];

export const SequelScene: React.FC<SequelSceneProps> = ({
  onReturnToDreamWorld,
  onReplayFullStory,
}) => {
  const [scene, setScene] = useState<SequelSceneId>('SEQUEL_1_THRESHOLD');
  const [experiencedMoments, setExperiencedMoments] = useState<Record<string, boolean>>({});
  const [activeMoment, setActiveMoment] = useState<IntimateMoment>(INTIMATE_MOMENTS[0]);
  const [audioMuted, setAudioMuted] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SequelSceneId>(scene);
  const momentIdRef = useRef<string>(activeMoment.id);
  const audioRef = useRef<StoryAudioSynthesizer | null>(null);
  const audioMutedRef = useRef(false);

  useEffect(() => {
    const synth = new StoryAudioSynthesizer();
    audioRef.current = synth;
    synth.playSpecialGatePortalChime();
    return () => {
      synth.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    momentIdRef.current = activeMoment.id;
  }, [activeMoment]);

  // Keyboard shortcut (Space / Enter / E) for smooth progression
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space') {
        if (scene === 'SEQUEL_1_THRESHOLD') {
          e.preventDefault();
          if (!audioMutedRef.current) audioRef.current?.playIntimateMomentChord(0);
          setScene('SEQUEL_2_STARLIGHT_HEARTH');
        } else if (scene === 'SEQUEL_2_STARLIGHT_HEARTH') {
          e.preventDefault();
          if (!audioMutedRef.current) audioRef.current?.playIntimateMomentChord(1);
          setScene('SEQUEL_3_PLAYFUL_CLOSENESS');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scene]);

  // Build 3D Three.js Starlight Sanctuary Environment
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x0c0614);
    threeScene.fog = new THREE.FogExp2(0x12081e, 0.028);

    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      140
    );
    camera.position.set(0, 2.7, 7.6);
    camera.lookAt(0, 1.5, 0);

    // Ambient & Sanctuary Lights
    const ambient = new THREE.AmbientLight(0x3a2249, 1.15);
    threeScene.add(ambient);

    const moonLight = new THREE.DirectionalLight(0xc4b5fd, 1.1);
    moonLight.position.set(-8, 16, -12);
    threeScene.add(moonLight);

    const hearthFireLight = new THREE.PointLight(0xff8c42, 3.4, 16, 1.5);
    hearthFireLight.position.set(-2.9, 1.4, -1.6);
    hearthFireLight.castShadow = true;
    threeScene.add(hearthFireLight);

    const roseSanctuaryGlow = new THREE.PointLight(0xf472b6, 2.2, 18, 1.4);
    roseSanctuaryGlow.position.set(1.8, 2.6, -0.5);
    threeScene.add(roseSanctuaryGlow);

    // Moonlit Ocean Plane surrounding the Private Sanctuary
    const waterGeo = new THREE.PlaneGeometry(160, 160);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x130924,
      roughness: 0.18,
      metalness: 0.75,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    threeScene.add(water);

    // Circular Rose-Marble Sanctuary Terrace
    const terraceGroup = new THREE.Group();
    threeScene.add(terraceGroup);

    const platformGeo = new THREE.CylinderGeometry(6.8, 7.4, 0.5, 48);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x2a1836,
      roughness: 0.42,
      metalness: 0.2,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.15;
    platform.receiveShadow = true;
    terraceGroup.add(platform);

    const goldRimGeo = new THREE.TorusGeometry(6.78, 0.07, 16, 64);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.85,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
    });
    const goldRim = new THREE.Mesh(goldRimGeo, goldMat);
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = 0.11;
    terraceGroup.add(goldRim);

    // Twin Inward-Curving Horn Arch Silhouette of The Special Gate at the Rear
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, -5.8);
    terraceGroup.add(gateGroup);

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314,
      roughness: 0.38,
      metalness: 0.78,
    });

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 4.8, 16), bronzeMat);
      pillar.position.set(side * 2.4, 2.4, 0);
      gateGroup.add(pillar);

      const hornArch = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.16, 14, 32, Math.PI * 0.52),
        goldMat
      );
      hornArch.position.set(side * 0.1, 4.6, 0);
      hornArch.rotation.z = side === -1 ? -0.15 : Math.PI * 0.48;
      gateGroup.add(hornArch);
    }

    // Glowing Crimson Heart Crest atop the Special Gate
    const heartCrest = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.8,
        roughness: 0.15,
      })
    );
    heartCrest.position.set(0, 5.8, 0);
    gateGroup.add(heartCrest);

    // Warm Stone Hearth Fireplace on the Left
    const hearthGroup = new THREE.Group();
    hearthGroup.position.set(-2.9, 0.1, -1.6);
    hearthGroup.rotation.y = 0.48;
    terraceGroup.add(hearthGroup);

    const hearthBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x3b273d, roughness: 0.75 })
    );
    hearthBase.position.y = 0.95;
    hearthGroup.add(hearthBase);

    const emberCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xf97316,
        emissiveIntensity: 2.6,
      })
    );
    emberCore.scale.set(1.3, 0.9, 0.7);
    emberCore.position.set(0, 0.55, 0.35);
    hearthGroup.add(emberCore);

    // Plush Velvet Starlight Day-Bed / Lounge on the Right-Center
    const loungeGroup = new THREE.Group();
    loungeGroup.position.set(1.15, 0.1, -0.7);
    loungeGroup.rotation.y = -0.26;
    terraceGroup.add(loungeGroup);

    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x831843,
      roughness: 0.62,
      metalness: 0.08,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0xbe185d,
      roughness: 0.55,
    });

    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.42, 1.95), velvetMat);
    bedBase.position.y = 0.21;
    bedBase.castShadow = true;
    loungeGroup.add(bedBase);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.85, 0.38), cushionMat);
    backrest.position.set(0, 0.64, -0.78);
    loungeGroup.add(backrest);

    // Two Stylized Silhouettes (Yeshwanth & Harsha) on the Starlight Lounge
    const coupleGroup = new THREE.Group();
    coupleGroup.position.set(0, 0.52, -0.12);
    loungeGroup.add(coupleGroup);

    const yeshTorso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.21, 0.52, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    yeshTorso.position.set(-0.26, 0.36, 0);
    coupleGroup.add(yeshTorso);

    const yeshHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 })
    );
    yeshHead.position.set(-0.24, 0.86, 0);
    coupleGroup.add(yeshHead);

    const harshaTorso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.19, 0.48, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.45 })
    );
    harshaTorso.position.set(0.22, 0.33, 0.04);
    harshaTorso.rotation.z = 0.14;
    coupleGroup.add(harshaTorso);

    const harshaHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 })
    );
    harshaHead.position.set(0.14, 0.81, 0.04);
    coupleGroup.add(harshaHead);

    // Floating Rose-Gold Lanterns
    const lanterns: { mesh: THREE.Mesh; baseY: number; speed: number; phase: number }[] = [];
    const lanternGeo = new THREE.CylinderGeometry(0.14, 0.11, 0.34, 12);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    });

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = 3.6 + (i % 3) * 1.9;
      const baseY = 1.6 + (i % 5) * 0.95;
      const mesh = new THREE.Mesh(lanternGeo, lanternMat);
      mesh.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius - 1.2);
      threeScene.add(mesh);
      lanterns.push({ mesh, baseY, speed: 0.7 + (i % 4) * 0.25, phase: i * 0.8 });
    }

    // Starfield
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 55;
      starPositions[i * 3] = Math.cos(theta) * r;
      starPositions[i * 3 + 1] = 6 + Math.random() * 34;
      starPositions[i * 3 + 2] = Math.sin(theta) * r - 12;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.22,
      transparent: true,
      opacity: 0.85,
    });
    const stars = new THREE.Points(starGeo, starMat);
    threeScene.add(stars);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Flicker hearth fire warmly
      hearthFireLight.intensity = 3.2 + Math.sin(t * 7.5) * 0.35 + Math.cos(t * 13.1) * 0.2;
      emberCore.scale.y = 0.85 + Math.sin(t * 9.0) * 0.12;
      heartCrest.rotation.y = t * 0.6;

      // Float lanterns gently
      for (const l of lanterns) {
        l.mesh.position.y = l.baseY + Math.sin(t * l.speed + l.phase) * 0.28;
        l.mesh.rotation.y = t * 0.3 + l.phase;
      }

      // Subtle couple pose adjustments based on intimate moment
      const currentMoment = momentIdRef.current;
      const targetLean = currentMoment === 'kiss' || currentMoment === 'cuddle_stars' ? 0.08 : 0.18;
      harshaHead.position.x = THREE.MathUtils.lerp(harshaHead.position.x, targetLean, 0.05);
      yeshHead.position.x = THREE.MathUtils.lerp(
        yeshHead.position.x,
        currentMoment === 'kiss' ? -0.11 : -0.22,
        0.05
      );

      // Smooth camera framing per sequel beat
      const currentScene = sceneRef.current;
      let targetCamX = Math.sin(t * 0.18) * 0.65;
      let targetCamY = 2.55;
      let targetCamZ = 7.4;
      let lookX = 0;
      let lookY = 1.45;
      let lookZ = -1.2;

      if (currentScene === 'SEQUEL_1_THRESHOLD') {
        targetCamX = Math.sin(t * 0.15) * 0.9;
        targetCamY = 2.9;
        targetCamZ = 8.2;
        lookY = 2.1;
        lookZ = -3.2;
      } else if (currentScene === 'SEQUEL_2_STARLIGHT_HEARTH') {
        targetCamX = -0.8 + Math.sin(t * 0.2) * 0.35;
        targetCamY = 2.1;
        targetCamZ = 4.9;
        lookX = -0.6;
        lookY = 1.25;
        lookZ = -1.1;
      } else if (currentScene === 'SEQUEL_3_PLAYFUL_CLOSENESS') {
        targetCamX = 0.85 + Math.sin(t * 0.22) * 0.28;
        targetCamY = 1.95;
        targetCamZ = 3.85;
        lookX = 0.95;
        lookY = 1.15;
        lookZ = -0.7;
      } else if (currentScene === 'SEQUEL_4_PRIVATE_LETTER') {
        targetCamX = 0.35;
        targetCamY = 2.25;
        targetCamZ = 4.4;
        lookX = 0.4;
        lookY = 1.5;
        lookZ = -1.0;
      } else if (currentScene === 'SEQUEL_5_VALENTINE_FINALE') {
        targetCamX = Math.sin(t * 0.16) * 1.4;
        targetCamY = 3.35;
        targetCamZ = 6.8;
        lookX = 0;
        lookY = 2.1;
        lookZ = -2.0;
      }

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.035);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.035);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.035);
      camera.lookAt(lookX, lookY, lookZ);

      renderer.render(threeScene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      platformGeo.dispose();
      platformMat.dispose();
      goldRimGeo.dispose();
      goldMat.dispose();
      bronzeMat.dispose();
      velvetMat.dispose();
      cushionMat.dispose();
      lanternGeo.dispose();
      lanternMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSelectMoment = (moment: IntimateMoment, index: number) => {
    setActiveMoment(moment);
    setExperiencedMoments((prev) => ({ ...prev, [moment.id]: true }));
    if (!audioMutedRef.current) {
      audioRef.current?.playIntimateMomentChord(index);
    }
  };

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    audioMutedRef.current = next;
  };

  const completedCount = Object.keys(experiencedMoments).length;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0c0614] text-rose-50 select-none font-sans">
      {/* Live 3D Three.js Sanctuary Viewport */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Soft Radial Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090410]/90 via-transparent to-[#090410]/65" />

      {/* Top Navigation & Chapter Header */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-rose-300/15 bg-[#12071d]/65 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
            <Heart className="w-4 h-4 fill-rose-400/40" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-rose-300/80 font-medium">
              Part VI · Beyond The Special Gate
            </div>
            <div className="text-base font-serif tracking-wide text-rose-100">
              The Private Romantic World — Yeshwanth &amp; Harsha
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMute}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-rose-200 flex items-center gap-1.5 transition"
            title={audioMuted ? 'Unmute Sanctuary Audio' : 'Mute Sanctuary Audio'}
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{audioMuted ? 'Muted' : 'Audio'}</span>
          </button>

          <button
            onClick={onReturnToDreamWorld}
            className="px-3.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-300/30 text-xs text-rose-100 flex items-center gap-1.5 transition"
          >
            <Compass className="w-3.5 h-3.5 text-rose-300" />
            <span>Return to Heart Island</span>
          </button>
        </div>
      </div>

      {/* Main Story Stage Content */}
      <div className="relative z-20 flex flex-col justify-end h-[calc(100vh-68px)] p-6 md:p-10 max-w-4xl mx-auto">
        {/* STAGE 1: CROSSING THE SPECIAL GATE THRESHOLD */}
        {scene === 'SEQUEL_1_THRESHOLD' && (
          <div className="bg-[#160a24]/85 border border-rose-300/25 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-300/90 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Southernmost Cape · Coordinate (0, -112)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-rose-50 mb-3">
              Behind the Special Gate
            </h1>
            <p className="text-sm md:text-base text-rose-100/90 leading-relaxed mb-4">
              The wrought-iron filigree doors of the Special Gate close softly behind you. Outside lies
              the grand fantasy of the Dream Castle, the Wizarding School, the Carnival, and the Sky
              Coaster—but here, on this quiet starlit terrace above the sea, the world belongs only to
              the two of you.
            </p>
            <blockquote className="border-l-2 border-amber-400/70 pl-4 py-1 my-4 italic text-amber-100/95 font-serif text-base">
              &ldquo;The Dream World was built to amaze you. This private sanctuary was built to hold
              you.&rdquo;
            </blockquote>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
              <span className="text-xs text-rose-300/75">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-rose-100">E</kbd> or{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-rose-100">Space</kbd> to step
                inside
              </span>
              <button
                onClick={() => {
                  if (!audioMutedRef.current) audioRef.current?.playIntimateMomentChord(0);
                  setScene('SEQUEL_2_STARLIGHT_HEARTH');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-rose-500/25 transition"
              >
                Step Into the Sanctuary &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: THE STARLIGHT HEARTH */}
        {scene === 'SEQUEL_2_STARLIGHT_HEARTH' && (
          <div className="bg-[#160a24]/85 border border-rose-300/25 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-300/90 mb-2">
              <Flame className="w-3.5 h-3.5" />
              <span>The Starlight Hearth</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif text-rose-50 mb-3">
              Where the Mystery Becomes Warmth
            </h2>
            <p className="text-sm md:text-base text-rose-100/90 leading-relaxed mb-4">
              A stone hearth crackles with amber embers beside a plush velvet day-bed overlooking the
              moonlit water. Twenty-four rose-gold lanterns drift lazily in the night breeze.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4 text-sm">
              <div className="p-3.5 rounded-xl bg-white/5 border border-rose-300/15">
                <div className="text-xs uppercase tracking-wider text-rose-300 mb-1">Harsha</div>
                <p className="text-rose-50 italic font-serif">
                  &ldquo;From a locked room with a ringing rotary phone... to an entire island with a
                  castle, an underwater reef, an aurora cave, and now this?&rdquo;
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/5 border border-amber-300/15">
                <div className="text-xs uppercase tracking-wider text-amber-300 mb-1">Yeshwanth</div>
                <p className="text-amber-50 italic font-serif">
                  &ldquo;Come sit with me by the fire, Pattuma. There are no more clues to solve—just us.&rdquo;
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
              <button
                onClick={() => setScene('SEQUEL_1_THRESHOLD')}
                className="text-xs text-rose-300/80 hover:text-rose-100 transition"
              >
                &larr; Back to Threshold
              </button>
              <button
                onClick={() => {
                  if (!audioMutedRef.current) audioRef.current?.playIntimateMomentChord(1);
                  setScene('SEQUEL_3_PLAYFUL_CLOSENESS');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-rose-500/25 transition"
              >
                Sit Together on the Starlight Lounge &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: PLAYFUL CLOSENESS & ROMANTIC MOMENTS */}
        {scene === 'SEQUEL_3_PLAYFUL_CLOSENESS' && (
          <div className="bg-[#160a24]/88 border border-rose-300/25 backdrop-blur-xl rounded-2xl p-6 md:p-7 shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-rose-300">
                <HandHeart className="w-4 h-4 text-rose-400" />
                <span>Private Sanctuary Moments · Choose How to Spend the Night</span>
              </div>
              <span className="text-xs text-amber-300/90 font-medium">
                {completedCount} / {INTIMATE_MOMENTS.length} Moments Shared
              </span>
            </div>

            {/* Interactive Moment Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              {INTIMATE_MOMENTS.map((m, idx) => {
                const isSelected = activeMoment.id === m.id;
                const isDone = !!experiencedMoments[m.id];
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMoment(m, idx)}
                    className={`text-left p-3 rounded-xl border transition ${
                      isSelected
                        ? 'bg-rose-500/25 border-rose-300/60 shadow-md shadow-rose-500/10'
                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-rose-50">{m.label}</span>
                      {isDone && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-300/30">
                          Shared ♥
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-rose-200/70 mt-0.5">{m.subtitle}</div>
                  </button>
                );
              })}
            </div>

            {/* Active Moment Dialogue & Narration */}
            <div className="p-4 rounded-xl bg-[#0e0518]/80 border border-rose-300/20 space-y-2.5 mb-5">
              <p className="text-xs md:text-sm text-rose-100/90 leading-relaxed">
                {activeMoment.narration}
              </p>
              <div className="pt-2 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs md:text-sm">
                <div>
                  <span className="text-rose-300 font-medium">Harsha: </span>
                  <span className="italic font-serif text-rose-50">{activeMoment.harshaLine}</span>
                </div>
                <div>
                  <span className="text-amber-300 font-medium">Yeshwanth: </span>
                  <span className="italic font-serif text-amber-50">{activeMoment.yeshwanthLine}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => setScene('SEQUEL_2_STARLIGHT_HEARTH')}
                className="text-xs text-rose-300/80 hover:text-rose-100 transition"
              >
                &larr; Back to Hearth
              </button>
              <button
                onClick={() => {
                  if (!audioMutedRef.current) audioRef.current?.playDreamWorldRevealSwell();
                  setScene('SEQUEL_4_PRIVATE_LETTER');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-rose-500/25 transition"
              >
                Read Yeshwanth&apos;s Valentine Note &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: THE PRIVATE VALENTINE LETTER */}
        {scene === 'SEQUEL_4_PRIVATE_LETTER' && (
          <div className="bg-[#160a24]/90 border border-amber-300/35 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-300 mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>February 14, 2027 · From Yeshwanth to Harsha</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif text-amber-100 mb-4">
              &ldquo;I Built an Entire World for You.&rdquo;
            </h2>
            <div className="space-y-3 text-sm md:text-base text-rose-100/95 font-serif leading-relaxed border-l-2 border-rose-400/50 pl-4 py-1">
              <p>My Pattuma,</p>
              <p>
                From the evening at <em>Project Hail Mary</em> when I walked back down the aisle and
                caught you wiping my glasses with that quiet smile... to the moment you held my pinky
                first when I hesitated to hold your hand... to the night we finally confessed what we
                both already knew.
              </p>
              <p>
                Every corner of this island—the Castle, the Great Hall, the Ancient Forest, the
                Heartline Sky Coaster, the Underwater Reef, the Aurora Grotto, and this quiet cape
                beyond the Special Gate—exists because loving you made me want to build a place where
                our memories live forever.
              </p>
              <p className="text-amber-200 font-semibold">
                Happy Valentine&apos;s Day, my world. 🫶🏻
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
              <button
                onClick={() => setScene('SEQUEL_3_PLAYFUL_CLOSENESS')}
                className="text-xs text-rose-300/80 hover:text-rose-100 transition"
              >
                &larr; Return to Sanctuary Moments
              </button>
              <button
                onClick={() => {
                  if (!audioMutedRef.current) audioRef.current?.playDreamWorldRevealSwell();
                  setScene('SEQUEL_5_VALENTINE_FINALE');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/25 transition"
              >
                Complete Valentine&apos;s Finale &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STAGE 5: FINAL VALENTINE ENDING */}
        {scene === 'SEQUEL_5_VALENTINE_FINALE' && (
          <div className="bg-[#160a24]/90 border border-rose-300/35 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-300/40 text-rose-300 mb-3">
              <Stars className="w-6 h-6" />
            </div>
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300/90 mb-1">
              Valentine&apos;s Day 2027 · Complete Experience
            </div>
            <h2 className="text-2xl md:text-4xl font-serif text-rose-50 mb-3">
              Happy Valentine&apos;s Day, Harsha ♥
            </h2>
            <p className="text-sm md:text-base text-rose-100/85 max-w-xl mx-auto leading-relaxed mb-6">
              The stars above the southern cape shine over Heart Island. You can stay here in the
              Private Sanctuary as long as you wish, return to explore the 3D Dream World freely, or
              relive the story from February 13th at 10:30 PM.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setScene('SEQUEL_3_PLAYFUL_CLOSENESS')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs md:text-sm text-rose-100 flex items-center gap-2 transition"
              >
                <Moon className="w-4 h-4 text-amber-300" />
                <span>Stay in the Private Sanctuary</span>
              </button>

              <button
                onClick={onReturnToDreamWorld}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-semibold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-rose-500/25 transition"
              >
                <Compass className="w-4 h-4" />
                <span>Explore the 3D Dream World</span>
              </button>

              <button
                onClick={onReplayFullStory}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-rose-300/25 text-xs md:text-sm text-rose-200 flex items-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4 text-rose-300" />
                <span>Replay From Prologue (Feb 13, 10:30 PM)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SequelScene;
