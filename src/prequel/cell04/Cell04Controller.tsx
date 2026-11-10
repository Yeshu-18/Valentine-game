import React, { useEffect, useRef, useState } from 'react';
import {
  PhoneCall,
  Lock,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MousePointerClick,
  Compass,
} from 'lucide-react';
import {
  initRoomScene,
  InteractionTarget,
  RoomSceneCallbacks,
  RoomSceneController,
} from './cell04RoomScene';
import { cell04SoundEngine } from './cell04SoundEngine';

export interface Cell04ControllerProps {
  onSwitchToChapter1?: () => void;
  onSwitchToChapter2?: () => void;
  onEnterDreamWorld: () => void;
}

export const Cell04Controller: React.FC<Cell04ControllerProps> = ({
  onSwitchToChapter1,
  onSwitchToChapter2,
  onEnterDreamWorld,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<RoomSceneController | null>(null);

  const [interactionTarget, setInteractionTarget] =
    useState<InteractionTarget>(null);
  const [phoneAnswered, setPhoneAnswered] = useState(false);
  const [showDialogue, setShowDialogue] = useState(false);
  const [doorNotice, setDoorNotice] = useState<string | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.0022);

  const doorTimeoutRef = useRef<number | null>(null);

  const callbacksRef = useRef<RoomSceneCallbacks>({
    onTargetChange: (target) => {
      setInteractionTarget(target);
    },
    onPhoneInteracted: () => {
      setPhoneAnswered(true);
      setShowDialogue(true);
      setDoorNotice(null);
    },
    onDoorInteracted: (answered) => {
      if (doorTimeoutRef.current) {
        window.clearTimeout(doorTimeoutRef.current);
      }
      setDoorNotice(
        answered
          ? 'Heavy steel deadbolt is engaged from the outside. The caller controls the lock.'
          : 'Locked from the outside. The telephone on the desk is ringing.',
      );
      doorTimeoutRef.current = window.setTimeout(() => {
        setDoorNotice(null);
      }, 3600);
    },
    onPointerLockChange: (locked) => {
      setIsPointerLocked(locked);
    },
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const controller = initRoomScene(container, callbacksRef);
    controllerRef.current = controller;

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      if (doorTimeoutRef.current) {
        window.clearTimeout(doorTimeoutRef.current);
      }
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    cell04SoundEngine.setMuted(next);
  };

  const handleReset = () => {
    setPhoneAnswered(false);
    setShowDialogue(false);
    setDoorNotice(null);
    controllerRef.current?.resetPrototype();
  };

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    controllerRef.current?.setLookSensitivity(val);
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

      {/* Top-Left Minimal Spec & Objective Header (Zero Viewport Occlusion) */}
      <div className="pointer-events-none fixed top-5 left-6 z-10 flex flex-col gap-1">
        <div className="flex items-center gap-3 text-xs tracking-wider text-zinc-400">
          <span className="font-semibold text-zinc-100 uppercase tracking-widest">
            Cell 04 &middot; The Awakening
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            Objective:{' '}
            <strong className="font-medium text-amber-400">
              {phoneAnswered
                ? 'Await Caller Instructions'
                : 'Answer the Desk Telephone'}
            </strong>
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          {isPointerLocked
            ? 'WASD to move · Mouse to look · Press E to interact · ESC to release cursor'
            : 'WASD to move · Click or drag view to look around · Press E to interact'}
        </p>
      </div>

      {/* Top-Right Prequel Chapter Switcher & Dream World Shortcut */}
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

      {/* Subtle Center Crosshair Reticle */}
      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
        <div
          className={`transition-transform duration-150 ${
            interactionTarget
              ? 'w-3 h-3 rounded-full border-2 border-amber-400 scale-125'
              : 'w-1.5 h-1.5 rounded-full bg-white/70'
          }`}
        />
      </div>

      {/* Contextual Interaction Prompt ([E] on Phone or Door) */}
      {interactionTarget && (
        <div className="fixed top-[56%] left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-950/90 border border-zinc-700/80 shadow-lg">
          <kbd
            className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500 text-zinc-950"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            E
          </kbd>
          <span className="text-sm font-medium text-zinc-100 whitespace-nowrap">
            {interactionTarget === 'phone'
              ? phoneAnswered
                ? 'Listen to Receiver Again'
                : 'Answer Ringing Telephone'
              : 'Try Steel Door Handle'}
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

      {/* Locked Door Feedback Banner */}
      {doorNotice && (
        <div
          role="status"
          className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-zinc-950/90 border border-red-500/40 text-zinc-200 text-sm shadow-lg"
        >
          <Lock className="w-4 h-4 text-red-400 shrink-0" />
          <span>{doorNotice}</span>
        </div>
      )}

      {/* Suspenseful Telephone Transmission Modal / Overlay */}
      {showDialogue && (
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
              onClick={() => setShowDialogue(false)}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
          <blockquote className="space-y-2 text-xl sm:text-2xl font-semibold leading-snug text-zinc-100 tracking-wide">
            <p>&ldquo;You&apos;re awake.</p>
            <p className="text-amber-400">Good.</p>
            <p className="text-red-400">We need to talk.&rdquo;</p>
          </blockquote>
          <p className="mt-4 pt-3 border-t border-zinc-900 text-xs text-zinc-400">
            The overhead bulb drops to emergency current. The steel door remains
            deadbolted from the outside.
          </p>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
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

            <button
              type="button"
              onClick={() => controllerRef.current?.triggerPhoneDirectly()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Answer Phone (E)</span>
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
    </div>
  );
};

export default Cell04Controller;
