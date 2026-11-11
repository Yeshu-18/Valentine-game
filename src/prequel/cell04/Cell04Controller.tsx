import React, { useEffect, useRef, useState } from 'react';
import {
  PhoneCall,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MousePointerClick,
  Compass,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  X,
  Upload,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  FinaleVisualState,
  initRoomScene,
  RoomSceneCallbacks,
  RoomSceneController,
} from './cell04RoomScene';
import {
  Cell04NarrativeState,
  TargetedInteractable,
} from './cell04InteractionSystem';
import { cell04SoundEngine } from './cell04SoundEngine';
import {
  loadSavedChatScreenshot,
  saveChatScreenshot,
} from '../../world/story/GameStoryDirector';

export interface Cell04ControllerProps {
  onSwitchToChapter1?: () => void;
  onSwitchToChapter2?: () => void;
  onEnterDreamWorld: () => void;
}

const INITIAL_NARRATIVE_STATE: Cell04NarrativeState = {
  phoneAnswered: false,
  photographInspected: false,
  memoryHailMaryDiscovered: false,
  memoryPinkyDiscovered: false,
  memoryConfessionDiscovered: false,
  doorUnlocked: false,
  doorOpened: false,
  activeInspection: null,
};

/**
 * Romantic Visual VFX Canvas + Animated Hands Component for Memory II: The Pinky Moment.
 * Renders floating rose-gold/amber bokeh particles, warm contact glow, and animated hands
 * transitioning from the hesitant pinky catch (Beat 0) to warmly laced fingers (Beat 1)
 * and the bus-stop question (Beat 2).
 */
const PinkyMomentHandsVfx: React.FC<{ beat: 0 | 1 | 2 }> = ({ beat }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const particles = Array.from({ length: 38 }, (_, i) => ({
      x: Math.random() * 560,
      y: Math.random() * 280,
      r: 1.4 + (i % 4) * 1.1,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.28 - Math.random() * 0.45,
      alpha: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      warmHue: i % 3 === 0 ? '#fb7185' : i % 3 === 1 ? '#fbbf24' : '#fda4af',
    }));

    const startTime = performance.now();

    const render = (now: number) => {
      const t = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Central romantic radial aura where the two hands meet
      const centerX = canvas.width * 0.5;
      const centerY = canvas.height * 0.46;
      const pulse = 1 + Math.sin(t * 2.6) * 0.08;
      const baseRadius = (beat === 1 ? 135 : beat === 0 ? 105 : 115) * pulse;

      const aura = ctx.createRadialGradient(
        centerX,
        centerY,
        6,
        centerX,
        centerY,
        baseRadius,
      );
      if (beat === 0) {
        aura.addColorStop(0, 'rgba(251, 191, 36, 0.36)');
        aura.addColorStop(0.45, 'rgba(244, 114, 182, 0.18)');
        aura.addColorStop(1, 'rgba(15, 12, 18, 0)');
      } else if (beat === 1) {
        aura.addColorStop(0, 'rgba(251, 113, 133, 0.45)');
        aura.addColorStop(0.5, 'rgba(245, 158, 11, 0.22)');
        aura.addColorStop(1, 'rgba(15, 12, 18, 0)');
      } else {
        aura.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
        aura.addColorStop(0.55, 'rgba(56, 189, 248, 0.14)');
        aura.addColorStop(1, 'rgba(15, 12, 18, 0)');
      }
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Shimmering contact ring on pinky touch / clasped hands
      const ringRadius =
        beat === 0
          ? 18 + ((t * 18) % 36)
          : beat === 1
            ? 24 + ((t * 14) % 44)
            : 20 + ((t * 12) % 32);
      const ringProgress =
        beat === 0
          ? ((t * 18) % 36) / 36
          : beat === 1
            ? ((t * 14) % 44) / 44
            : ((t * 12) % 32) / 32;
      ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - ringProgress) * 0.42})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Floating romantic bokeh & light motes
      for (const p of particles) {
        p.x += p.vx + Math.sin(t * 1.4 + p.phase) * 0.18;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = centerX + (Math.random() - 0.5) * 260;
        }
        const twinkle =
          p.alpha * (0.65 + 0.35 * Math.sin(t * 3.1 + p.phase));
        ctx.save();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = p.warmHue;
        ctx.shadowColor = p.warmHue;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [beat]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Live Romantic Particle & Bokeh VFX Canvas */}
      <canvas
        ref={canvasRef}
        width={560}
        height={280}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      <style>{`
        @keyframes pinkyReachLeft {
          0%, 100% { transform: translateX(0px) translateY(0px) rotate(0deg); }
          50% { transform: translateX(4px) translateY(-2px) rotate(1.5deg); }
        }
        @keyframes pinkyReachRight {
          0% { transform: translateX(18px) translateY(6px) rotate(-4deg); }
          45%, 100% { transform: translateX(0px) translateY(0px) rotate(0deg); }
        }
        @keyframes handsClaspPulse {
          0%, 100% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.035) translateY(-2px); }
        }
      `}</style>

      {/* Foreground Animated Hands VFX + Narrative Stage */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
        {beat === 0 && (
          <>
            <span className="text-[11px] uppercase tracking-[0.28em] text-amber-300/90 font-medium">
              I &middot; The Mall &middot; First Reach
            </span>

            {/* Animated Two Hands: Her pinky hooking around his hesitant pinky */}
            <svg
              viewBox="0 0 360 150"
              className="w-72 sm:w-80 h-32 drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]"
            >
              <defs>
                <linearGradient id="hisHandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d69e72" />
                  <stop offset="100%" stopColor="#9c6644" />
                </linearGradient>
                <linearGradient id="herHandGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#eab68c" />
                  <stop offset="100%" stopColor="#b57c56" />
                </linearGradient>
                <radialGradient id="pinkySpark" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#fb7185" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* His Left Hand (entering from left, fingers slightly relaxed, pinky extended right) */}
              <g style={{ animation: 'pinkyReachLeft 4s ease-in-out infinite' }}>
                {/* Wrist & Palm */}
                <path
                  d="M 15 110 C 48 98, 82 88, 112 82 C 132 78, 146 66, 142 52 C 138 38, 114 40, 92 48 L 15 76 Z"
                  fill="url(#hisHandGrad)"
                  stroke="#fcd34d"
                  strokeWidth="1.2"
                  strokeOpacity="0.55"
                />
                {/* Curled Index, Middle, Ring Fingers */}
                <path
                  d="M 118 44 C 134 36, 148 40, 146 52"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                <path
                  d="M 124 54 C 142 46, 154 50, 152 62"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                {/* His Extended Pinky Finger reaching toward center (180, 74) */}
                <path
                  d="M 128 74 C 148 72, 168 68, 184 74 C 188 76, 187 84, 180 85 C 164 86, 144 84, 122 84"
                  fill="url(#hisHandGrad)"
                  stroke="#fde68a"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>

              {/* Her Right Hand (entering from right, her pinky hooking gently around his pinky) */}
              <g style={{ animation: 'pinkyReachRight 3.6s ease-out infinite' }}>
                {/* Subtle gold bangle on her wrist */}
                <ellipse
                  cx="312"
                  cy="88"
                  rx="6"
                  ry="20"
                  transform="rotate(-18 312 88)"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="3"
                />
                {/* Her Wrist & Palm */}
                <path
                  d="M 345 106 C 310 94, 276 84, 246 78 C 226 74, 214 62, 218 48 C 222 36, 246 38, 268 46 L 345 72 Z"
                  fill="url(#herHandGrad)"
                  stroke="#fda4af"
                  strokeWidth="1.2"
                  strokeOpacity="0.65"
                />
                {/* Her Gently Curled Fingers */}
                <path
                  d="M 240 42 C 224 34, 212 38, 214 50"
                  fill="none"
                  stroke="#fda4af"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                {/* Her Pinky Finger Hooking Interlocked with His Pinky at (180, 76) */}
                <path
                  d="M 232 72 C 212 70, 192 64, 176 72 C 171 75, 173 84, 181 84 C 198 84, 216 82, 238 82"
                  fill="url(#herHandGrad)"
                  stroke="#fef08a"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>

              {/* Glowing Romantic Spark where their two pinkies lock together */}
              <circle cx="180" cy="77" r="24" fill="url(#pinkySpark)" />
              <circle cx="180" cy="77" r="4.5" fill="#fef9c3" />
            </svg>

            <p className="text-sm sm:text-base text-amber-100/95 tracking-wide font-medium">
              First time holding your hands, that THAYAKKAM BAYAM ellame... I LOVED IT, I loved every minute spent with you di 🫶🏻
            </p>
          </>
        )}

        {beat === 1 && (
          <>
            <span className="text-[11px] uppercase tracking-[0.28em] text-rose-300/90 font-medium">
              II &middot; The Car Journey &middot; Laced Fingers
            </span>

            {/* Animated Two Hands Clasped Together Warmly (Fingers Interlaced) */}
            <svg
              viewBox="0 0 360 150"
              className="w-72 sm:w-80 h-32 drop-shadow-[0_0_24px_rgba(251,113,133,0.45)]"
            >
              <defs>
                <linearGradient id="claspLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d69e72" />
                  <stop offset="100%" stopColor="#9c6644" />
                </linearGradient>
                <linearGradient id="claspRight" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#eab68c" />
                  <stop offset="100%" stopColor="#b57c56" />
                </linearGradient>
                <radialGradient id="claspGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fda4af" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="180" cy="76" r="56" fill="url(#claspGlow)" />

              <g style={{ animation: 'handsClaspPulse 3.2s ease-in-out infinite', transformOrigin: '180px 76px' }}>
                {/* His Forearm & Hand Enclosing Hers */}
                <path
                  d="M 20 112 C 68 96, 114 86, 152 82 C 176 80, 198 66, 196 52 C 194 40, 168 38, 138 46 L 20 74 Z"
                  fill="url(#claspLeft)"
                  stroke="#fde68a"
                  strokeWidth="1.5"
                />
                {/* Her Forearm & Hand Resting in His */}
                <path
                  d="M 340 108 C 292 92, 246 82, 204 78 C 178 76, 158 64, 162 50 C 166 38, 192 38, 222 46 L 340 72 Z"
                  fill="url(#claspRight)"
                  stroke="#fda4af"
                  strokeWidth="1.5"
                />
                {/* Her Gold Bangle */}
                <ellipse
                  cx="296"
                  cy="83"
                  rx="6"
                  ry="20"
                  transform="rotate(-15 296 83)"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="3"
                />
                {/* Interlaced Knuckles & Fingers Highlight */}
                <ellipse cx="172" cy="54" rx="11" ry="6" transform="rotate(-12 172 54)" fill="#eab68c" stroke="#fef08a" strokeWidth="1.2" />
                <ellipse cx="180" cy="64" rx="12" ry="6" transform="rotate(-10 180 64)" fill="#d69e72" stroke="#fef08a" strokeWidth="1.2" />
                <ellipse cx="186" cy="74" rx="11" ry="6" transform="rotate(-8 186 74)" fill="#eab68c" stroke="#fef08a" strokeWidth="1.2" />
                <ellipse cx="189" cy="84" rx="10" ry="5.5" transform="rotate(-6 189 84)" fill="#d69e72" stroke="#fef08a" strokeWidth="1.2" />
              </g>
            </svg>

            <p className="text-sm sm:text-base text-rose-100/95 tracking-wide font-medium">
              Aprm, in car..... mmsjdhflashjfjah... uk ik... You holding my hands tighttttly. Would never forget that day 🫠
            </p>
          </>
        )}

        {beat === 2 && (
          <div className="flex flex-col items-center gap-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-amber-300/90 font-medium">
              III &middot; The Bus Stop
            </span>
            <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-wide max-w-md leading-snug drop-shadow">
              &ldquo;Unakku relationship la irukka ok va ippo ?... Fraudu...&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const Cell04Controller: React.FC<Cell04ControllerProps> = ({
  onSwitchToChapter1,
  onSwitchToChapter2,
  onEnterDreamWorld,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<RoomSceneController | null>(null);

  const [target, setTarget] = useState<TargetedInteractable | null>(null);
  const [narrativeState, setNarrativeState] = useState<Cell04NarrativeState>(
    INITIAL_NARRATIVE_STATE,
  );
  const [showPhoneDialogue, setShowPhoneDialogue] = useState(false);
  const [transientBanner, setTransientBanner] = useState<{
    text: string;
    tone: 'locked' | 'unlocked' | 'note';
  } | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.0022);

  // First-Person Awakening Eye-Blink Sequence State (triggers on mount & room reset)
  const [wakeBlinkKey, setWakeBlinkKey] = useState(0);
  const [wakeBlinkActive, setWakeBlinkActive] = useState(true);

  // Photograph 3D Inspection State (Starts 100% flat & centered: rotX = 0, rotY = 0)
  const [photoRotY, setPhotoRotY] = useState(0);
  const [photoRotX, setPhotoRotX] = useState(0);
  const [photoZoom, setPhotoZoom] = useState(1.0);
  const isDraggingPhotoRef = useRef(false);
  const lastPhotoMouseRef = useRef({ x: 0, y: 0 });

  // Memory Visual Beat States
  const [hailMaryBeat, setHailMaryBeat] = useState<0 | 1>(0);
  const [pinkyBeat, setPinkyBeat] = useState<0 | 1 | 2>(0);
  const [chatScreenshotUrl, setChatScreenshotUrl] = useState<string | null>(
    () => loadSavedChatScreenshot(),
  );

  // Step 8 Finale (Mysterious Figure & Blindfold Transition)
  const [finaleState, setFinaleState] = useState<FinaleVisualState>({
    active: false,
    blindfoldProgress: 0,
    warmRevealProgress: 0,
  });

  const bannerTimeoutRef = useRef<number | null>(null);
  const prevUnlockedRef = useRef(false);

  // Manage Awakening Eyelid Blink duration (2.75 seconds)
  useEffect(() => {
    setWakeBlinkActive(true);
    const timer = window.setTimeout(() => {
      setWakeBlinkActive(false);
    }, 2750);
    return () => window.clearTimeout(timer);
  }, [wakeBlinkKey]);

  const showTimedBanner = (
    text: string,
    tone: 'locked' | 'unlocked' | 'note',
    ms = 3200,
  ) => {
    if (bannerTimeoutRef.current) {
      window.clearTimeout(bannerTimeoutRef.current);
    }
    setTransientBanner({ text, tone });
    bannerTimeoutRef.current = window.setTimeout(() => {
      setTransientBanner(null);
    }, ms);
  };

  const callbacksRef = useRef<RoomSceneCallbacks>({
    onTargetChange: (nextTarget) => {
      setTarget(nextTarget);
    },
    onNarrativeStateChange: (nextState) => {
      setNarrativeState(nextState);
      if (nextState.doorUnlocked && !prevUnlockedRef.current) {
        prevUnlockedRef.current = true;
        showTimedBanner(
          'A heavy mechanical bolt retracts inside the steel door.',
          'unlocked',
          4000,
        );
      }
      if (!nextState.doorUnlocked) {
        prevUnlockedRef.current = false;
      }
    },
    onPhoneInteracted: () => {
      setShowPhoneDialogue(true);
      setTransientBanner(null);
    },
    onDoorLockedAttempt: () => {
      showTimedBanner('Locked from the outside.', 'locked', 2600);
    },
    onPropNote: (note) => {
      showTimedBanner(note, 'note', 2600);
    },
    onFinaleUpdate: (finale) => {
      setFinaleState(finale);
    },
    onFinaleComplete: () => {
      onEnterDreamWorld();
    },
    onPointerLockChange: (locked) => {
      setIsPointerLocked(locked);
    },
  });

  useEffect(() => {
    callbacksRef.current.onFinaleComplete = () => {
      onEnterDreamWorld();
    };
  }, [onEnterDreamWorld]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const controller = initRoomScene(container, callbacksRef);
    controllerRef.current = controller;

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !narrativeState.activeInspection) {
        setDockCollapsed((prev) => !prev);
      }
      if (
        e.code === 'KeyR' &&
        narrativeState.activeInspection === 'photograph'
      ) {
        setPhotoRotX(0);
        setPhotoRotY(0);
        setPhotoZoom(1.0);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  // Reset inspection sub-state whenever a new inspection opens
  useEffect(() => {
    if (narrativeState.activeInspection === 'photograph') {
      setPhotoRotX(0);
      setPhotoRotY(0);
      setPhotoZoom(1.0);
    } else if (narrativeState.activeInspection === 'memory_hail_mary') {
      setHailMaryBeat(0);
    } else if (narrativeState.activeInspection === 'memory_pinky') {
      setPinkyBeat(0);
    }
  }, [narrativeState.activeInspection]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    cell04SoundEngine.setMuted(next);
  };

  const handleReset = () => {
    setShowPhoneDialogue(false);
    setTransientBanner(null);
    prevUnlockedRef.current = false;
    setWakeBlinkKey((k) => k + 1);
    controllerRef.current?.resetPrototype();
  };

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    controllerRef.current?.setLookSensitivity(val);
  };

  const handleCloseInspection = () => {
    controllerRef.current?.cancelInspection();
  };

  // Photograph Mouse Rotation & Zoom Handlers
  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    isDraggingPhotoRef.current = true;
    lastPhotoMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePhotoMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPhotoRef.current) return;
    const dx = e.clientX - lastPhotoMouseRef.current.x;
    const dy = e.clientY - lastPhotoMouseRef.current.y;
    lastPhotoMouseRef.current = { x: e.clientX, y: e.clientY };
    setPhotoRotY((prev) => prev + dx * 0.65);
    setPhotoRotX((prev) => Math.max(-65, Math.min(65, prev - dy * 0.45)));
  };

  const handlePhotoMouseUp = () => {
    isDraggingPhotoRef.current = false;
  };

  const handlePhotoWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setPhotoZoom((prev) =>
      Math.max(0.75, Math.min(2.2, Number((prev + delta).toFixed(2)))),
    );
  };

  const handleChatScreenshotUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveChatScreenshot(reader.result);
        setChatScreenshotUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#090a0d] text-zinc-100 select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Dedicated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-crosshair"
        aria-label="Cell 04 — 3D Locked Room Viewport"
      />

      {/* ================================================================= */}
      {/* AWAKENING EYE-BLINK TRANSITION OVERLAY (Imitating Eyes Opening)   */}
      {/* ================================================================= */}
      {wakeBlinkActive && (
        <div
          key={wakeBlinkKey}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          aria-hidden="true"
        >
          <style>{`
            @keyframes cell04TopEyelid {
              0%   { transform: translateY(0%); }
              26%  { transform: translateY(-34%); }
              46%  { transform: translateY(-2%); }
              100% { transform: translateY(-108%); }
            }
            @keyframes cell04BottomEyelid {
              0%   { transform: translateY(0%); }
              26%  { transform: translateY(34%); }
              46%  { transform: translateY(2%); }
              100% { transform: translateY(108%); }
            }
            @keyframes cell04WakeBlur {
              0%   { opacity: 1; backdrop-filter: blur(14px); }
              30%  { opacity: 0.88; backdrop-filter: blur(8px); }
              48%  { opacity: 0.96; backdrop-filter: blur(12px); }
              85%  { opacity: 0.25; backdrop-filter: blur(2px); }
              100% { opacity: 0; backdrop-filter: blur(0px); }
            }
          `}</style>
          {/* Optical grogginess blur & peripheral vignette */}
          <div
            className="absolute inset-0 bg-black/35"
            style={{
              animation:
                'cell04WakeBlur 2.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          />
          {/* Upper Eyelid with curved organic feather edge */}
          <div
            className="absolute top-0 left-[-10%] right-[-10%] h-[58%] bg-[#040507] rounded-b-[45%] shadow-[0_28px_60px_#000]"
            style={{
              animation:
                'cell04TopEyelid 2.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          />
          {/* Lower Eyelid with curved organic feather edge */}
          <div
            className="absolute bottom-0 left-[-10%] right-[-10%] h-[58%] bg-[#040507] rounded-t-[45%] shadow-[0_-28px_60px_#000]"
            style={{
              animation:
                'cell04BottomEyelid 2.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          />
        </div>
      )}

      {/* Minimal Scene Header (Zero Quest Markers, Zero Progress Counters, Zero Viewport Occlusion) */}
      {!finaleState.active && (
        <div className="pointer-events-none fixed top-5 left-6 z-10 flex flex-col gap-1">
          <div className="flex items-center gap-3 text-xs tracking-wider text-zinc-400">
            <span className="font-semibold text-zinc-100 uppercase tracking-widest">
              Cell 04 &middot; The Awakening
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {isPointerLocked
              ? 'WASD to move · Mouse to look · E to interact · ESC to release cursor'
              : 'WASD to move · Click or drag view to look · E to interact'}
          </p>
        </div>
      )}

      {/* Developer Testing Switcher (Top-Right) */}
      {!finaleState.active && (
        <div className="pointer-events-auto fixed top-4 right-5 z-30 flex flex-wrap items-center justify-end gap-2">
          {onSwitchToChapter1 && (
            <button
              type="button"
              onClick={onSwitchToChapter1}
              className="px-3 py-1.5 rounded-lg bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 text-xs text-zinc-300 transition cursor-pointer whitespace-nowrap"
            >
              &larr; Ch 1: Ordinary Night
            </button>
          )}
          {onSwitchToChapter2 && (
            <button
              type="button"
              onClick={onSwitchToChapter2}
              className="px-3 py-1.5 rounded-lg bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 text-xs text-zinc-300 transition cursor-pointer whitespace-nowrap"
            >
              Ch 2: Unknown Journey
            </button>
          )}
          <button
            type="button"
            onClick={onEnterDreamWorld}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Skip to 3D Dream World &rarr;</span>
          </button>
        </div>
      )}

      {/* Subtle Center Crosshair Reticle */}
      {!narrativeState.activeInspection && !finaleState.active && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div
            className={`transition-transform duration-150 ${
              target
                ? 'w-3 h-3 rounded-full border-2 border-amber-400 scale-125'
                : 'w-1.5 h-1.5 rounded-full bg-white/70'
            }`}
          />
        </div>
      )}

      {/* Contextual Interaction Prompt ([E] on Targeted Object — Always Re-Inspectable) */}
      {target && !narrativeState.activeInspection && !finaleState.active && (
        <div className="fixed top-[56%] left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-950/90 border border-zinc-700/80 shadow-lg">
          <kbd
            className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500 text-zinc-950"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            E
          </kbd>
          <span className="text-sm font-medium text-zinc-100 whitespace-nowrap">
            {target.prompt}
          </span>
          <button
            type="button"
            onClick={() => controllerRef.current?.triggerInteract()}
            className="ml-1 px-2.5 py-1 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Interact
          </button>
        </div>
      )}

      {/* Subtle Contextual Feedback Banner */}
      {transientBanner && !finaleState.active && (
        <div
          role="status"
          className={`pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-zinc-950/90 border text-sm shadow-lg ${
            transientBanner.tone === 'unlocked'
              ? 'border-emerald-500/40 text-emerald-200'
              : transientBanner.tone === 'locked'
                ? 'border-red-500/40 text-zinc-200'
                : 'border-zinc-700/80 text-zinc-200'
          }`}
        >
          {transientBanner.tone === 'unlocked' ? (
            <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : transientBanner.tone === 'locked' ? (
            <Lock className="w-4 h-4 text-red-400 shrink-0" />
          ) : null}
          <span>{transientBanner.text}</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: TELEPHONE DIALOGUE OVERLAY (Exact Established Dialogue)   */}
      {/* ================================================================= */}
      {showPhoneDialogue && !finaleState.active && (
        <div
          role="dialog"
          aria-labelledby="caller-transmission-heading"
          className="fixed top-20 right-6 z-20 w-80 sm:w-96 p-6 rounded-xl bg-zinc-950/95 border border-red-500/40 shadow-2xl"
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-red-400 font-medium tracking-wider uppercase">
              <PhoneCall className="w-3.5 h-3.5" />
              <span id="caller-transmission-heading">
                Incoming Line &middot; Connected
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPhoneDialogue(false)}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>
          <blockquote className="space-y-2 text-xl sm:text-2xl font-semibold leading-snug text-zinc-100 tracking-wide">
            <p>&ldquo;You&apos;re awake.</p>
            <p className="text-amber-400">Good.</p>
            <p className="text-red-400">We need to talk.&rdquo;</p>
          </blockquote>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: DEDICATED PHOTOGRAPH INSPECTION VIEW (14 / 02 / 2024)     */}
      {/* Properly Aligned 4:5 Portrait Card, Centered Date, Rotate & Zoom  */}
      {/* ================================================================= */}
      {narrativeState.activeInspection === 'photograph' && (
        <div
          role="dialog"
          aria-label="Photograph Inspection"
          onMouseMove={handlePhotoMouseMove}
          onMouseUp={handlePhotoMouseUp}
          onMouseLeave={handlePhotoMouseUp}
          onWheel={handlePhotoWheel}
          className="fixed inset-0 z-40 flex flex-col items-center justify-between p-6 bg-black/80 backdrop-blur-sm"
        >
          {/* Top Bar */}
          <div className="w-full max-w-2xl flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Photograph Inspection &middot; Drag to Rotate &middot; Scroll to
              Zoom
            </span>
            <button
              type="button"
              onClick={handleCloseInspection}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Put Down (ESC)</span>
            </button>
          </div>

          {/* Interactive 3D Rotatable Photograph Card (Exact 4:5 Portrait Alignment, Zero Overflow) */}
          <div
            onMouseDown={handlePhotoMouseDown}
            className="relative flex-1 w-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
            style={{ perspective: '1200px' }}
          >
            <div
              className="relative w-[320px] h-[400px] sm:w-[340px] sm:h-[425px] transition-transform duration-75"
              style={{
                transformStyle: 'preserve-3d',
                transform: `scale(${photoZoom}) rotateX(${photoRotX}deg) rotateY(${photoRotY}deg)`,
              }}
            >
              {/* SIDE A (0 deg): Back of the Photograph with Perfectly Centered Date 14 / 02 / 2024 */}
              <div
                className="absolute inset-0 rounded-sm bg-[#ebe3d5] border-2 border-[#cfc2ad] shadow-2xl p-5 flex items-center justify-center text-zinc-900 overflow-hidden"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="relative w-full h-full border border-stone-400/60 flex flex-col items-center justify-center px-6 text-center overflow-hidden">
                  {/* Corner registration crop marks */}
                  <span className="absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 border-stone-500/50" />
                  <span className="absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 border-stone-500/50" />
                  <span className="absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 border-stone-500/50" />
                  <span className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 border-stone-500/50" />

                  <p
                    className="text-2xl sm:text-[26px] font-bold tracking-[0.08em] text-stone-900 whitespace-nowrap select-all"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    14 / 02 / 2024
                  </p>
                  <div className="w-36 h-[1.5px] bg-stone-500/45 my-3.5" />
                  <span
                    className="absolute bottom-8 left-7 right-7 text-center text-[9px] tracking-[0.14em] uppercase text-stone-500 whitespace-nowrap"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Archival Silver Print &middot; Reverse
                  </span>
                </div>
              </div>

              {/* SIDE B (180 deg): Front of the Photograph with Aligned Frame & Centered Date */}
              <div
                className="absolute inset-0 rounded-sm bg-[#f4efe4] border-2 border-[#dcd2c0] shadow-2xl p-4 flex flex-col justify-between items-center overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="relative w-full flex-1 bg-zinc-900 overflow-hidden border border-stone-300 flex items-center justify-center">
                  <img
                    src="/assets/harsha/photo-treasured.jpg"
                    alt="Keepsake Photograph"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-full pt-3 pb-1 flex items-center justify-center">
                  <span
                    className="text-base font-bold tracking-[0.12em] text-stone-800 whitespace-nowrap"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    14 / 02 / 2024
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Inspection Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl">
            <button
              type="button"
              onClick={() =>
                setPhotoRotY((prev) =>
                  Math.abs(prev % 360) < 90 ? 180 : 0,
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Turn Over (Front / Back)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPhotoZoom((z) =>
                  Math.max(0.75, Number((z - 0.2).toFixed(2))),
                )
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>Zoom Out</span>
            </button>

            <span
              className="text-xs text-zinc-400 px-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {Math.round(photoZoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() =>
                setPhotoZoom((z) =>
                  Math.min(2.2, Number((z + 0.2).toFixed(2))),
                )
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Zoom In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPhotoRotX(0);
                setPhotoRotY(0);
                setPhotoZoom(1.0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Orientation (R)</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 5A: MEMORY I — PROJECT HAIL MARY (Realistic Eyeglasses VFX)  */}
      {/* Established lines only: "You remember this day." / "But you don't..." */}
      {/* ================================================================= */}
      {narrativeState.activeInspection === 'memory_hail_mary' && (
        <div
          role="dialog"
          aria-label="Memory I — Project Hail Mary"
          className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden">
            {/* Visual Cinema Vignette Canvas */}
            <div className="relative h-76 w-full bg-gradient-to-b from-[#0c1220] via-[#131824] to-[#090b10] flex flex-col items-center justify-center p-6 overflow-hidden">
              <style>{`
                @keyframes lensWipeSweep {
                  0%   { transform: translateX(-45px); opacity: 0.2; }
                  50%  { transform: translateX(45px); opacity: 0.9; }
                  100% { transform: translateX(-45px); opacity: 0.2; }
                }
              `}</style>

              {/* Soft cinema screen glow */}
              <div className="w-64 h-16 rounded-sm bg-gradient-to-b from-amber-200/20 to-sky-400/10 border border-white/10 shadow-[0_0_50px_rgba(245,158,11,0.18)] flex items-center justify-center mb-4">
                <span className="text-[11px] uppercase tracking-[0.28em] text-amber-200/85 font-medium">
                  Project Hail Mary &middot; Interval
                </span>
              </div>

              {/* Realistic Optical Eyeglasses Illustration with Browline, Nose Pads, Hinges, Temples & Refractive Lenses */}
              <div className="flex flex-col items-center gap-3 text-center">
                <svg
                  viewBox="0 0 320 120"
                  className="w-64 sm:w-72 h-24 drop-shadow-[0_10px_22px_rgba(0,0,0,0.75)]"
                >
                  <defs>
                    <linearGradient id="goldTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="50%" stopColor="#d4af37" />
                      <stop offset="100%" stopColor="#926f1b" />
                    </linearGradient>
                    <linearGradient id="tortoiseBrow" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#1e130c" />
                      <stop offset="50%" stopColor="#3b2314" />
                      <stop offset="100%" stopColor="#1a110b" />
                    </linearGradient>
                    <radialGradient id="meniscusLensLeft" cx="38%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="rgba(186, 230, 253, 0.32)" />
                      <stop offset="55%" stopColor="rgba(56, 189, 248, 0.12)" />
                      <stop offset="100%" stopColor="rgba(15, 23, 42, 0.28)" />
                    </radialGradient>
                    <radialGradient id="meniscusLensRight" cx="38%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="rgba(253, 230, 138, 0.28)" />
                      <stop offset="55%" stopColor="rgba(56, 189, 248, 0.14)" />
                      <stop offset="100%" stopColor="rgba(15, 23, 42, 0.28)" />
                    </radialGradient>
                  </defs>

                  {/* Perspective Hinged Temple Arms with Curved Ear Hooks */}
                  <path
                    d="M 38 52 L 62 24 C 68 18, 78 18, 84 26 L 88 32"
                    fill="none"
                    stroke="url(#goldTitanium)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 282 52 L 258 24 C 252 18, 242 18, 236 26 L 232 32"
                    fill="none"
                    stroke="url(#goldTitanium)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />

                  {/* Translucent Silicone Nose Pads & Pad Arms */}
                  <path
                    d="M 136 58 Q 144 62 145 70"
                    fill="none"
                    stroke="url(#goldTitanium)"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="146"
                    cy="72"
                    rx="3.5"
                    ry="6.5"
                    transform="rotate(-18 146 72)"
                    fill="rgba(241, 245, 249, 0.65)"
                    stroke="rgba(148, 163, 184, 0.6)"
                    strokeWidth="0.8"
                  />
                  <path
                    d="M 184 58 Q 176 62 175 70"
                    fill="none"
                    stroke="url(#goldTitanium)"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="174"
                    cy="72"
                    rx="3.5"
                    ry="6.5"
                    transform="rotate(18 174 72)"
                    fill="rgba(241, 245, 249, 0.65)"
                    stroke="rgba(148, 163, 184, 0.6)"
                    strokeWidth="0.8"
                  />

                  {/* Curved Anatomical Nose Bridge */}
                  <path
                    d="M 134 52 Q 160 40 186 52"
                    fill="none"
                    stroke="url(#goldTitanium)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />

                  {/* Left Optical Lens & Rim */}
                  <rect
                    x="44"
                    y="34"
                    width="90"
                    height="62"
                    rx="28"
                    ry="26"
                    fill="url(#meniscusLensLeft)"
                    stroke="url(#goldTitanium)"
                    strokeWidth="3"
                  />
                  {/* Left Clubmaster Acetate Upper Browline */}
                  <path
                    d="M 42 54 C 42 35, 62 32, 89 32 C 116 32, 136 35, 136 54"
                    fill="none"
                    stroke="url(#tortoiseBrow)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />

                  {/* Right Optical Lens & Rim */}
                  <rect
                    x="186"
                    y="34"
                    width="90"
                    height="62"
                    rx="28"
                    ry="26"
                    fill="url(#meniscusLensRight)"
                    stroke="url(#goldTitanium)"
                    strokeWidth="3"
                  />
                  {/* Right Clubmaster Acetate Upper Browline */}
                  <path
                    d="M 184 54 C 184 35, 204 32, 231 32 C 258 32, 278 35, 278 54"
                    fill="none"
                    stroke="url(#tortoiseBrow)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />

                  {/* Metallic Hinge Endpieces & Rivets */}
                  <rect x="36" y="48" width="8" height="6" rx="1.5" fill="url(#goldTitanium)" />
                  <rect x="276" y="48" width="8" height="6" rx="1.5" fill="url(#goldTitanium)" />

                  {/* Anti-Reflective Optical Specular Glint */}
                  <g
                    style={
                      hailMaryBeat === 1
                        ? { animation: 'lensWipeSweep 2.6s ease-in-out infinite' }
                        : undefined
                    }
                  >
                    <path
                      d="M 64 44 L 88 84 M 76 42 L 98 78"
                      stroke="rgba(255, 255, 255, 0.48)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 206 44 L 230 84 M 218 42 L 240 78"
                      stroke={
                        hailMaryBeat === 1
                          ? 'rgba(253, 230, 138, 0.72)'
                          : 'rgba(255, 255, 255, 0.48)'
                      }
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>
                </svg>

                {hailMaryBeat === 0 ? (
                  <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-wide">
                    &ldquo;You remember this day babe 🌚... Wiping my glasses, how cuteee 😭 &rdquo;
                  </p>
                ) : (
                  <p className="text-xl sm:text-2xl font-semibold text-amber-300 tracking-wide">
                    &ldquo;The day that turned my life into a beautiful one 😘... Thank youuuu&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-t border-zinc-800/80">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHailMaryBeat(0)}
                  className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
                    hailMaryBeat === 0 ? 'bg-amber-400' : 'bg-zinc-700'
                  }`}
                  aria-label="Beat 1"
                />
                <button
                  type="button"
                  onClick={() => setHailMaryBeat(1)}
                  className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
                    hailMaryBeat === 1 ? 'bg-amber-400' : 'bg-zinc-700'
                  }`}
                  aria-label="Beat 2"
                />
              </div>

              <div className="flex items-center gap-2.5">
                {hailMaryBeat === 0 ? (
                  <button
                    type="button"
                    onClick={() => setHailMaryBeat(1)}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseInspection}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    <span>Return to Room (ESC)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 5B: MEMORY II — THE PINKY MOMENT (Romantic Hands-Holding VFX)*/}
      {/* Established line only: "Do you have any intention of a relationship?" */}
      {/* ================================================================= */}
      {narrativeState.activeInspection === 'memory_pinky' && (
        <div
          role="dialog"
          aria-label="Memory II — The Pinky Moment"
          className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden">
            <div className="relative h-76 w-full bg-gradient-to-b from-[#161018] via-[#1f131b] to-[#090b10] flex items-center justify-center">
              <PinkyMomentHandsVfx beat={pinkyBeat} />
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-t border-zinc-800/80">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPinkyBeat(idx as 0 | 1 | 2)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
                      pinkyBeat === idx ? 'bg-amber-400' : 'bg-zinc-700'
                    }`}
                    aria-label={`Stage ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {pinkyBeat > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPinkyBeat((prev) => (prev - 1) as 0 | 1 | 2)
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}
                {pinkyBeat < 2 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPinkyBeat((prev) => (prev + 1) as 0 | 1 | 2)
                    }
                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseInspection}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    <span>Return to Room (ESC)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 5C: MEMORY III — THE CONFESSION (Authentic Screenshot Slot)  */}
      {/* ================================================================= */}
      {narrativeState.activeInspection === 'memory_confession' && (
        <div
          role="dialog"
          aria-label="Memory III — The Confession"
          className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-zinc-950 border border-sky-500/30 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-sky-300">
                Late Night at Home &middot; The Confession
              </span>
              <button
                type="button"
                onClick={handleCloseInspection}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ESC</span>
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center min-h-72 bg-gradient-to-b from-[#0b101b] to-[#090b10]">
              {chatScreenshotUrl ? (
                <div className="relative max-h-80 w-full flex flex-col items-center">
                  <img
                    src={chatScreenshotUrl}
                    alt="Authentic Confession Screenshot"
                    className="max-h-72 w-auto rounded-xl border border-white/15 shadow-xl object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center max-w-sm gap-4 py-6">
                  <div className="w-28 h-44 rounded-2xl border-2 border-sky-400/40 bg-zinc-900/90 flex flex-col items-center justify-center p-4 shadow-[0_0_40px_rgba(56,189,248,0.15)]">
                    <span className="text-[11px] uppercase tracking-widest text-sky-300/90 font-medium">
                      Authentic Chat Screenshot
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Attach Authentic Screenshot</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleChatScreenshotUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-4 bg-zinc-950 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleCloseInspection}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Return to Room (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 8 & 9: BLINDFOLD & WARM SECOND-DOOR REVEAL TRANSITION        */}
      {/* ================================================================= */}
      {finaleState.active && finaleState.blindfoldProgress > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute top-0 left-0 right-0 bg-[#050608] transition-none"
            style={{
              height: `${Math.min(55, finaleState.blindfoldProgress * 55)}%`,
              opacity: Math.min(1, finaleState.blindfoldProgress * 1.15),
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#050608] transition-none"
            style={{
              height: `${Math.min(55, finaleState.blindfoldProgress * 55)}%`,
              opacity: Math.min(1, finaleState.blindfoldProgress * 1.15),
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                finaleState.warmRevealProgress > 0.01
                  ? `radial-gradient(circle at center, rgba(251, 191, 36, ${
                      finaleState.warmRevealProgress * 0.92
                    }), rgba(244, 114, 182, ${
                      finaleState.warmRevealProgress * 0.65
                    }), rgba(9, 10, 13, 0.98))`
                  : `rgba(5, 6, 8, ${finaleState.blindfoldProgress})`,
            }}
          />
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      {!narrativeState.activeInspection && !finaleState.active && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(920px,94vw)]">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-950/90 border border-b-0 border-zinc-800 rounded-t-lg hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? (
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

          {!dockCollapsed && (
            <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl">
              <button
                type="button"
                onClick={() => controllerRef.current?.requestPointerLock()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isPointerLocked ? 'Mouse Look Active' : 'Lock Mouse Look'}
                </span>
              </button>

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                <label
                  htmlFor="sensitivity-slider"
                  className="text-xs text-zinc-400 whitespace-nowrap shrink-0"
                >
                  Sensitivity
                </label>
                <input
                  id="sensitivity-slider"
                  type="range"
                  min="0.0008"
                  max="0.005"
                  step="0.0002"
                  value={sensitivity}
                  onChange={(e) =>
                    handleSensitivityChange(parseFloat(e.target.value))
                  }
                  className="w-20 accent-amber-400 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    <span>Audio Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Audio On</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Room</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Cell04Controller;
