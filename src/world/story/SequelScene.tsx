import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Footprints,
  Heart,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { StoryAudioSynthesizer } from './storyAudio';
import { PrivateWorldTelemetry } from '../privateWorld/PrivateWorldController';
import { PrivatePathLightingTelemetry } from '../privateWorld/PrivatePathLighting';
import { STARGAZING_SKY_SEQUENCE } from '../privateWorld/PrivateWorldInteractionSystem';

export interface SequelSceneProps {
  telemetry: PrivateWorldTelemetry;
  pathTelemetry: PrivatePathLightingTelemetry;
  debugVisible: boolean;
  vegetationVisible: boolean;
  onToggleDebugVisible: () => void;
  onToggleVegetationVisible: () => void;
  onToggleTopDownView: () => void;
  onTeleportToAnchor: (
    x: number,
    z: number,
    yawRadians?: number,
    forcedElevationY?: number,
  ) => void;
  onTriggerPrimaryInteraction?: () => void;
  onAdvanceProposalSequence?: () => void;
  onTriggerWeddingCelebration?: () => void;
  onExitInteractionMode?: () => void;
  onReturnToDreamWorld: () => void;
  onReplayFullStory: () => void;
}

export const SequelScene: React.FC<SequelSceneProps> = ({
  telemetry,
  onToggleTopDownView,
  onTeleportToAnchor,
  onTriggerPrimaryInteraction,
  onAdvanceProposalSequence,
  onTriggerWeddingCelebration,
  onExitInteractionMode,
  onReturnToDreamWorld,
  onReplayFullStory,
}) => {
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<StoryAudioSynthesizer | null>(null);
  const audioMutedRef = useRef(false);
  const lastPlayedMsgIdxRef = useRef<number>(-1);
  const lastPhaseRef = useRef<string>('IDLE');
  const hasPlayedFanfareRef = useRef(false);

  useEffect(() => {
    const synth = new StoryAudioSynthesizer();
    audioRef.current = synth;
    synth.playSpecialGatePortalChime();
    return () => {
      synth.dispose();
      audioRef.current = null;
    };
  }, []);

  const proposalState = telemetry.proposalState;
  const isCelebrationActive = (proposalState?.celebrationProgress ?? 0) > 0.08;

  // Play gentle musical cues when the proposal sequence advances and fanfare when wedding celebration starts
  useEffect(() => {
    if (!proposalState) return;
    if (proposalState.phase === 'MIST_GATHER') {
      hasPlayedFanfareRef.current = false;
    }
    if (audioMutedRef.current) return;

    if (proposalState.phase !== lastPhaseRef.current) {
      lastPhaseRef.current = proposalState.phase;
      if (proposalState.phase === 'MIST_GATHER') {
        audioRef.current?.playIntimateMomentChord(0);
      } else if (proposalState.phase === 'CONSTELLATION_REVEAL') {
        audioRef.current?.playSpecialGatePortalChime();
      } else if (proposalState.phase === 'FINAL_HOLD') {
        if (!hasPlayedFanfareRef.current) {
          hasPlayedFanfareRef.current = true;
          audioRef.current?.playWeddingCelebrationFanfare();
        }
      }
    }
    if (
      (proposalState.celebrationProgress ?? 0) > 0.05 &&
      !hasPlayedFanfareRef.current
    ) {
      hasPlayedFanfareRef.current = true;
      audioRef.current?.playWeddingCelebrationFanfare();
    }
    if (
      proposalState.phase === 'MESSAGE' &&
      proposalState.messageIndex !== lastPlayedMsgIdxRef.current
    ) {
      lastPlayedMsgIdxRef.current = proposalState.messageIndex;
      audioRef.current?.playIntimateMomentChord(
        proposalState.messageIndex % 4,
      );
    }
  }, [proposalState]);

  // Periodic festive firework burst audio while the celebration is active
  useEffect(() => {
    if (!isCelebrationActive) return;
    let shellCounter = 0;
    const intervalId = window.setInterval(() => {
      if (!audioMutedRef.current) {
        audioRef.current?.playFireworkBurstCue(shellCounter++);
      }
    }, 2100);
    return () => window.clearInterval(intervalId);
  }, [isCelebrationActive]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'KeyH') {
        e.preventDefault();
        setHudCollapsed((prev) => !prev);
      } else if (import.meta.env.DEV && e.code === 'KeyT') {
        e.preventDefault();
        onToggleTopDownView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleTopDownView]);

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    audioMutedRef.current = next;
  };

  const activePrompt = telemetry.activeInteractionPrompt;
  const isTelescopeMode = telemetry.interactionMode === 'TELESCOPE';
  const isSeatedMode = telemetry.interactionMode === 'SEATED_LOVESEAT';
  const isProposalMode = telemetry.interactionMode === 'PROPOSAL_SEQUENCE';
  const discoveredMask = telemetry.discoveredLettersMask ?? 0;
  const connectedCount = telemetry.connectedSkyNodesCount;

  const renderConstellationLettersBar = () => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STARGAZING_SKY_SEQUENCE.map((node, idx) => {
        const isLit = (discoveredMask & (1 << idx)) !== 0;
        const addWordGap = idx === 0 || idx === 4;
        return (
          <React.Fragment key={node.index}>
            <span
              title={
                isLit
                  ? `${node.text} — ${node.subtitle}`
                  : `Star Letter ${node.index} (Undiscovered)`
              }
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-display text-xs font-bold border transition-colors ${
                isLit
                  ? 'bg-amber-400/25 border-amber-300/70 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                  : 'bg-slate-900/90 border-white/15 text-transparent'
              }`}
            >
              {isLit ? node.letter : ''}
            </span>
            {addWordGap && (
              <span
                aria-hidden="true"
                className="mx-1 text-slate-600 font-bold select-none"
              >
                ·
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none font-sans">
      {/* Dedicated Telescope Eyepiece View Overlay */}
      {isTelescopeMode && telemetry.telescopeView && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(4, 10, 22, 0.0) 31%, rgba(6, 14, 28, 0.45) 42%, rgba(2, 6, 14, 0.94) 56%)',
            }}
          />
          <div className="relative flex-1 w-full flex items-center justify-center">
            <div className="relative w-[min(64vh,64vw)] h-[min(64vh,64vw)] rounded-full border border-amber-300/35 shadow-[0_0_60px_rgba(56,189,248,0.12)] flex items-center justify-center">
              <div className="w-[96%] h-[96%] rounded-full border border-sky-200/15" />
              <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
              <div className="absolute inset-y-8 left-1/2 w-px bg-gradient-to-b from-transparent via-amber-200/25 to-transparent" />
              <div className="w-3.5 h-3.5 rounded-full border border-amber-200/45" />
            </div>
          </div>

          <div className="pointer-events-auto relative z-30 mb-14 flex flex-col items-center gap-2.5 bg-slate-950/92 border border-amber-300/35 rounded-2xl px-6 py-3.5 text-center shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-amber-200/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {telemetry.telescopeView.constellationName} · Connected{' '}
                {connectedCount} / 8 Star Letters
              </span>
            </div>
            {renderConstellationLettersBar()}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onExitInteractionMode}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/45 text-xs font-semibold text-amber-100 flex items-center gap-1.5 transition cursor-pointer"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/15 font-mono text-[11px] text-amber-200">
                  Esc
                </kbd>
                <span>Exit telescope</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4.6B: Personal Proposal Message & Kneeling Mist Figure Sequence Overlay */}
      {isProposalMode && proposalState && (
        <div
          className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-3 transition-all ${
            hudCollapsed ? 'bottom-4' : 'bottom-14'
          }`}
        >
          {proposalState.phase === 'MIST_GATHER' && (
            <div className="bg-gradient-to-b from-pink-500/85 via-pink-600/88 to-rose-700/90 border border-pink-200/70 rounded-xl px-3.5 py-2 text-center shadow-[0_4px_20px_rgba(244,114,182,0.35)]">
              <p className="font-serif italic text-xs text-pink-50 tracking-wide">
                A soft silver-blue mist gathers upon the Proposal Stage before
                you...
              </p>
            </div>
          )}

          {proposalState.phase === 'MESSAGE' && (
            <div
              key={proposalState.messageIndex}
              className="bg-gradient-to-b from-pink-500/85 via-pink-600/88 to-rose-700/90 border border-pink-200/75 rounded-xl px-4 py-2 text-center shadow-[0_4px_22px_rgba(244,114,182,0.4)] transition-opacity duration-500"
            >
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-pink-100/95 mb-0.5">
                <Heart className="w-2.5 h-2.5 text-pink-100 fill-pink-200/50" />
                <span>Proposal Garden</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {proposalState.messageIndex + 1} /{' '}
                  {proposalState.totalMessages}
                </span>
              </div>

              <p className="font-serif text-xs md:text-sm leading-snug text-white font-medium tracking-wide">
                “{proposalState.currentMessageText}”
              </p>

              <div className="mt-1.5 pt-1 border-t border-pink-200/30 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onExitInteractionMode}
                  className="px-1.5 py-0.5 rounded text-[10px] text-pink-100/90 hover:text-white transition-colors cursor-pointer"
                >
                  <kbd className="px-1 py-0.5 bg-rose-900/70 rounded border border-pink-200/40 font-mono text-[9px] text-pink-100 mr-1">
                    Esc
                  </kbd>
                  Close
                </button>

                <button
                  type="button"
                  onClick={onAdvanceProposalSequence}
                  className="px-2.5 py-0.5 rounded-lg bg-white/25 hover:bg-white/35 border border-pink-100/70 text-[11px] font-semibold text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <span>
                    {proposalState.messageIndex + 1 <
                    proposalState.totalMessages
                      ? 'Next'
                      : 'Complete Message'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-pink-100" />
                  <kbd className="ml-0.5 px-1 py-0.5 bg-rose-900/75 rounded border border-pink-100/45 font-mono text-[9px] text-pink-50">
                    Enter
                  </kbd>
                </button>
              </div>
            </div>
          )}

          {proposalState.phase === 'FIGURE_DISSOLVE' && (
            <div className="bg-gradient-to-b from-pink-500/85 via-pink-600/88 to-rose-700/90 border border-pink-200/70 rounded-xl px-3.5 py-2 text-center shadow-[0_4px_20px_rgba(244,114,182,0.35)]">
              <p className="font-serif italic text-xs text-pink-50">
                The mist figure dissolves gently into starlight, rising toward
                the night sky...
              </p>
            </div>
          )}

          {proposalState.phase === 'CONSTELLATION_REVEAL' && (
            <div className="bg-gradient-to-b from-pink-500/85 via-pink-600/88 to-rose-700/90 border border-pink-200/70 rounded-xl px-3.5 py-2 text-center shadow-[0_4px_20px_rgba(244,114,182,0.35)]">
              <p className="font-serif text-xs text-pink-50">
                Look up above the ocean horizon — the stars are aligning for
                you...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Seated Stargazing Loveseat Prompt */}
      {isSeatedMode && (
        <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 bg-slate-950/92 border border-sky-300/35 rounded-xl px-5 py-2.5 text-white shadow-2xl">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-sky-200">
              Seated on the Stargazing Loveseat · Watching the MANDU Star
              Constellation
            </span>
            <span className="text-xs text-slate-300">
              Drag mouse to pan across the stars · Press{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-[11px] text-amber-200">
                E
              </kbd>{' '}
              or{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-[11px] text-amber-200">
                Esc
              </kbd>{' '}
              to stand up
            </span>
          </div>
          <button
            type="button"
            onClick={onExitInteractionMode}
            className="ml-1 px-3 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-300/45 text-xs font-semibold text-sky-100 transition cursor-pointer"
          >
            Stand up
          </button>
        </div>
      )}

      {/* Top-Left Stargazing Sanctuary & Proposal Garden Banner */}
      <div className="pointer-events-auto absolute top-5 left-6 flex flex-col gap-1.5 bg-slate-950/90 border border-sky-300/20 rounded-xl px-4 py-3 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-200/90">
          <Compass className="w-3.5 h-3.5 shrink-0 text-sky-300" />
          <span>Private Stargazing World</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-200 font-semibold">
            {isTelescopeMode
              ? `Telescope View (${connectedCount}/8 Letters)`
              : proposalState?.phase === 'FINAL_HOLD'
                ? "HAPPY VALENTINE'S DAY, MY LOVE · Fireworks & Wedding Celebration"
                : telemetry.regionSubtitle}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-semibold tracking-tight text-white">
            {telemetry.regionName}
          </h1>
        </div>
        {isTelescopeMode && renderConstellationLettersBar()}
      </div>

      {/* Top-Right Return & Audio Bar */}
      <div className="pointer-events-auto absolute top-5 right-6 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs text-slate-200 flex items-center gap-1.5 shadow-lg transition cursor-pointer"
          title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {audioMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-sky-300" />
          )}
          <span>{audioMuted ? 'Muted' : 'Audio'}</span>
        </button>

        <button
          type="button"
          onClick={onReturnToDreamWorld}
          className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-300/40 text-xs font-semibold text-rose-100 flex items-center gap-1.5 shadow-lg transition cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-rose-300" />
          <span>Return to Heart Island</span>
        </button>
      </div>

      {/* Contextual Proximity Interaction Prompt */}
      {activePrompt &&
        telemetry.interactionMode === 'NONE' &&
        !telemetry.isTopDownView && (
          <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/95 border border-amber-300/45 rounded-xl px-4 py-2.5 text-white shadow-[0_0_28px_rgba(251,191,36,0.22)]">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <button
              type="button"
              onClick={
                activePrompt.id === 'arrival-return-gate'
                  ? onReturnToDreamWorld
                  : onTriggerPrimaryInteraction
              }
              className="flex items-center gap-2.5 text-sm font-medium text-slate-100 hover:text-amber-200 transition cursor-pointer"
            >
              <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-amber-300/40 font-mono text-xs font-bold text-amber-200 shadow-sm">
                {activePrompt.keyLabel}
              </kbd>
              <span>{activePrompt.actionLabel}</span>
            </button>
          </div>
        )}

      {/* Collapsible Bottom Stargazing & Proposal Garden Controls Bar */}
      <div
        className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 flex flex-col items-center w-full max-w-[min(860px,95vw)] ${
          isProposalMode ? 'bottom-2.5' : 'bottom-5'
        }`}
      >
        {!isProposalMode && (
          <button
            type="button"
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="mb-1.5 flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-slate-950/90 border border-white/10 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 shadow cursor-pointer"
          >
            {hudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Stargazing Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        )}

        {!hudCollapsed && (
          <div
            className={`w-full bg-slate-950/92 border border-white/12 rounded-2xl text-white shadow-2xl flex flex-col gap-2 ${
              isProposalMode ? 'px-4 py-1.5' : 'px-5 py-3'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (!audioMutedRef.current) {
                      audioRef.current?.playIntimateMomentChord(0);
                    }
                    onTeleportToAnchor(-1.8, -1.2, Math.PI / 2);
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 border border-sky-300/50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Stargazing Deck
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!audioMutedRef.current) {
                      audioRef.current?.playIntimateMomentChord(2);
                    }
                    onTeleportToAnchor(19.2, 15.6, 0.72);
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 border border-amber-300/50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Heart className="w-3 h-3 text-amber-300" />
                  <span>Proposal Garden</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTeleportToAnchor(19.6, 15.8, 0.72);
                    onTriggerWeddingCelebration?.();
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-rose-500/25 hover:bg-rose-500/35 text-rose-100 border border-rose-300/50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>
                    {isCelebrationActive
                      ? 'Replay Wedding Ceremony'
                      : 'Celebrate Wedding Finale'}
                  </span>
                </button>
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    onClick={onToggleTopDownView}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      telemetry.isTopDownView
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/15'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {telemetry.isTopDownView
                        ? 'Top-Down View: ON (T)'
                        : 'Top-Down View: OFF (T)'}
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onReplayFullStory}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-rose-300" />
                <span>Replay Prologue</span>
              </button>
            </div>

            {!isProposalMode && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                  <Footprints className="w-3.5 h-3.5 text-sky-300" />
                  <span>
                    WASD / Arrows to Walk · Mouse to Orbit & Zoom Camera Freely
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MousePointerClick className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>
                    Press E at the Telescope, Loveseat, or Proposal Stage
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SequelScene;
