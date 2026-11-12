import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Footprints,
  Layers,
  MapPin,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Trees,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { StoryAudioSynthesizer } from './storyAudio';
import { PrivateWorldTelemetry } from '../privateWorld/PrivateWorldController';
import { PrivatePathLightingTelemetry } from '../privateWorld/PrivatePathLighting';
import {
  PRIVATE_ISLAND_BOUNDS,
  PRIVATE_WORLD_ANCHOR_LIST,
  RESERVED_GROTTO_VOLUME,
  getPrivateTerrainHeight,
} from '../privateWorld/privateWorldMath';
import { TrailDestinationId } from '../privateWorld/PrivateTrailSignSystem';

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
  onExitInteractionMode?: () => void;
  onReturnToDreamWorld: () => void;
  onReplayFullStory: () => void;
}

export const SequelScene: React.FC<SequelSceneProps> = ({
  telemetry,
  pathTelemetry,
  debugVisible,
  vegetationVisible,
  onToggleDebugVisible,
  onToggleVegetationVisible,
  onToggleTopDownView,
  onTeleportToAnchor,
  onTriggerPrimaryInteraction,
  onExitInteractionMode,
  onReturnToDreamWorld,
  onReplayFullStory,
}) => {
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [showAnchorInspector, setShowAnchorInspector] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
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

  // Update underground Hidden Grotto water & crystal resonance when exploring beneath the cave
  useEffect(() => {
    audioRef.current?.updateGrottoAmbience(
      telemetry.x,
      telemetry.y,
      telemetry.z,
      audioMutedRef.current,
    );
  }, [telemetry.x, telemetry.y, telemetry.z, audioMuted]);

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
      } else if (import.meta.env.DEV && e.code === 'KeyB') {
        e.preventDefault();
        onToggleDebugVisible();
      } else if (import.meta.env.DEV && e.code === 'KeyV') {
        e.preventDefault();
        onToggleVegetationVisible();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleDebugVisible, onToggleTopDownView, onToggleVegetationVisible]);

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    audioMutedRef.current = next;
  };

  const activePrompt = telemetry.activeInteractionPrompt;
  const isTelescopeMode = telemetry.interactionMode === 'TELESCOPE';
  const isSeatedMode =
    telemetry.interactionMode === 'SEATED_LOVESEAT' ||
    telemetry.interactionMode === 'SEATED_POND_BENCH' ||
    telemetry.interactionMode === 'SEATED_GROTTO_ISLAND_BENCH' ||
    telemetry.interactionMode === 'SEATED_GROTTO_OVERLOOK_BENCH';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none font-sans">
      {/* Dedicated Telescope Eyepiece View Overlay (Active only during Stargazing Telescope interaction) */}
      {isTelescopeMode && telemetry.telescopeView && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between p-8">
          {/* Subtle Circular Optical Eyepiece Vignette & Brass Rim */}
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
              {/* Fine Optical Crosshair Reticle */}
              <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
              <div className="absolute inset-y-8 left-1/2 w-px bg-gradient-to-b from-transparent via-amber-200/25 to-transparent" />
              <div className="w-3.5 h-3.5 rounded-full border border-amber-200/45" />
            </div>
          </div>

          {/* Highlighted Constellation Readout & Telescope Exit Control */}
          <div className="pointer-events-auto relative z-30 mb-14 flex flex-col items-center gap-2.5 bg-slate-950/90 border border-amber-300/35 rounded-2xl px-6 py-3.5 text-center shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-amber-200/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {telemetry.telescopeView.highlightStrength > 0.25
                  ? telemetry.telescopeView.constellationName
                  : 'Stargazing Deck · Brass Equatorial Refractor'}
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-md">
              {telemetry.telescopeView.highlightStrength > 0.25
                ? 'Glowing stars joined across the eastern night sky spell “I LOVE YOU” beneath a celestial star-heart — move the mouse to explore the surrounding star field.'
                : 'Move mouse to pan across the eastern night sky and align with the “I LOVE YOU” star constellation.'}
            </p>
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

      {/* Calm Seated Mode Prompt (Stargazing Loveseat, Reflective Pond Bench, or Hidden Grotto Sanctuary) */}
      {isSeatedMode && (
        <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 bg-slate-950/90 border border-sky-300/35 rounded-xl px-5 py-2.5 text-white shadow-2xl backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-sky-200">
              {telemetry.interactionMode === 'SEATED_LOVESEAT'
                ? 'Seated on the Stargazing Loveseat · “I LOVE YOU” Star Constellation Above'
                : telemetry.interactionMode === 'SEATED_POND_BENCH'
                  ? 'Seated Beside the Reflective Pond · Quiet Moonlit Glade'
                  : telemetry.interactionMode === 'SEATED_GROTTO_ISLAND_BENCH'
                    ? 'Seated on the Central Discovery Island · Hidden Grotto Lakeworld'
                    : 'Seated at the Grotto Overlook · Underground Waterfall & Lake'}
            </span>
            <span className="text-xs text-slate-300">
              Drag mouse to look around · Press{' '}
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

      {/* Top-Left Region Discovery & Local Coordinate Telemetry Banner */}
      <div className="pointer-events-auto absolute top-5 left-6 flex flex-col gap-0.5 bg-slate-950/85 border border-sky-300/20 rounded-xl px-4 py-3 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-200/90">
          <Compass className="w-3.5 h-3.5 shrink-0 text-sky-300" />
          <span>Private Romantic World</span>
          <span aria-hidden="true">·</span>
          <span>{telemetry.regionSubtitle}</span>
        </div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-white">
          {telemetry.regionName}
        </h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono-tabular">
          <span className="text-sky-200">
            X {telemetry.x.toFixed(1)}m / Z {telemetry.z.toFixed(1)}m
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-300">
            Elev +{telemetry.terrainElevation.toFixed(2)}m
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {isTelescopeMode
              ? 'Looking Through Telescope'
              : isSeatedMode
                ? 'Seated'
                : telemetry.isTopDownView
                  ? 'Top-Down Debug View'
                  : telemetry.isSprinting
                    ? `Sprinting (${telemetry.speed.toFixed(1)} m/s)`
                    : telemetry.speed > 0.25
                      ? `Walking (${telemetry.speed.toFixed(1)} m/s)`
                      : 'Standing'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-400">
            Island {PRIVATE_ISLAND_BOUNDS.lengthX}m ×{' '}
            {PRIVATE_ISLAND_BOUNDS.widthZ}m
          </span>
        </div>
      </div>

      {/* Top-Right Return & Audio Bar */}
      <div className="pointer-events-auto absolute top-5 right-6 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="px-3 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-xs text-slate-200 flex items-center gap-1.5 shadow-lg transition cursor-pointer"
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

      {/* Dev-Only Anchor, Trail Route Distance & Reactive Pathway Illumination Inspector Panel */}
      {import.meta.env.DEV && showAnchorInspector && (
        <div className="pointer-events-auto absolute top-28 left-6 w-[460px] max-w-[calc(100vw-3rem)] bg-slate-950/92 border border-sky-400/35 rounded-xl p-3.5 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-sky-300">
              <Layers className="w-3.5 h-3.5" />
              <span>Phase 4.3.1 Debug · Trail Navigation &amp; Path Lighting</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnchorInspector(false)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Reactive Pathway Live Telemetry */}
          <div className="mb-2.5 p-2.5 rounded-lg bg-slate-900/90 border border-teal-400/25 space-y-1 font-mono-tabular text-[11px]">
            <div className="font-sans font-semibold text-teal-300 flex items-center justify-between">
              <span>Reactive Pathway Illumination</span>
              <span className="text-emerald-300">
                {pathTelemetry.activeGlowingStones} /{' '}
                {pathTelemetry.totalEmbeddedStones} Glowing
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Current Route:</span>
              <span className="text-sky-200 font-semibold">
                {pathTelemetry.activeRouteId}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Path Proximity / Arc Distance:</span>
              <span>
                {pathTelemetry.nearestPathDist.toFixed(2)}m · s=
                {pathTelemetry.arcDistanceMeters.toFixed(1)}m /{' '}
                {pathTelemetry.routeTotalLengthMeters.toFixed(0)}m
              </span>
            </div>
          </div>

          <div className="space-y-1.5 font-mono-tabular text-[11px]">
            {PRIVATE_WORLD_ANCHOR_LIST.map((anchor) => {
              const actualY = getPrivateTerrainHeight(anchor.x, anchor.z);
              const straightDist = Math.hypot(
                telemetry.x - anchor.x,
                telemetry.z - anchor.z,
              );
              const routeDist =
                telemetry.routeDistances?.[anchor.id as TrailDestinationId];
              return (
                <div
                  key={anchor.id}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/80 border border-white/5"
                >
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-white">
                      {anchor.name}
                    </span>
                    <span className="text-slate-400">
                      ({anchor.x}, {anchor.z}) · Y +{actualY.toFixed(1)}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {routeDist !== undefined ? (
                      <span
                        className="text-amber-300"
                        title="True Trail Route Distance"
                      >
                        Trail {Math.round(routeDist)}m
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {straightDist.toFixed(0)}m
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!audioMutedRef.current) {
                          audioRef.current?.playIntimateMomentChord(0);
                        }
                        onTeleportToAnchor(
                          anchor.x,
                          anchor.z,
                          anchor.defaultFacingYaw,
                        );
                      }}
                      className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/30 font-sans font-semibold cursor-pointer"
                    >
                      Go
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Reserved Underground Grotto Volume: (
              {RESERVED_GROTTO_VOLUME.centerX}, {RESERVED_GROTTO_VOLUME.centerZ}
              )
            </span>
            <span className="font-mono-tabular text-amber-300">
              {RESERVED_GROTTO_VOLUME.maxX - RESERVED_GROTTO_VOLUME.minX}m ×{' '}
              {RESERVED_GROTTO_VOLUME.maxZ - RESERVED_GROTTO_VOLUME.minZ}m
            </span>
          </div>
        </div>
      )}

      {/* Contextual Proximity Interaction Prompt (Shown ONLY when within range of an interactable object) */}
      {activePrompt &&
        telemetry.interactionMode === 'NONE' &&
        !telemetry.isTopDownView && (
          <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/92 border border-amber-300/45 rounded-xl px-4 py-2.5 text-white shadow-[0_0_28px_rgba(251,191,36,0.22)] backdrop-blur-md">
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

      {/* Collapsible Bottom Control Dock (Anchor Fast-Travel & Dev Terrain Debug Tools) */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center w-full max-w-[min(1060px,95vw)]">
        <button
          type="button"
          onClick={() => setHudCollapsed((prev) => !prev)}
          className="mb-1.5 flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-slate-950/85 border border-white/10 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 shadow cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Private World Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        {!hudCollapsed && (
          <div className="w-full bg-slate-950/90 border border-white/12 rounded-2xl px-5 py-3.5 text-white shadow-2xl flex flex-col gap-2.5 backdrop-blur-md">
            {/* Row 1: Locked Location Anchors Quick-Jump */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="flex items-center gap-1 text-xs text-sky-300 font-semibold mr-1 whitespace-nowrap shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>Island Anchors:</span>
                </span>
                {PRIVATE_WORLD_ANCHOR_LIST.map((anchor) => {
                  const isNear =
                    Math.hypot(
                      telemetry.x - anchor.x,
                      telemetry.z - anchor.z,
                    ) < 22 && telemetry.y >= 9.5;
                  return (
                    <button
                      key={anchor.id}
                      type="button"
                      onClick={() => {
                        if (!audioMutedRef.current) {
                          audioRef.current?.playIntimateMomentChord(0);
                        }
                        onTeleportToAnchor(
                          anchor.x,
                          anchor.z,
                          anchor.defaultFacingYaw,
                        );
                      }}
                      title={`${anchor.name} (${anchor.x}, ${anchor.z}) · ${anchor.elevationRangeLabel}`}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isNear
                          ? 'bg-sky-500/30 text-white border-sky-300/60 font-semibold shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                      }`}
                    >
                      {anchor.name}{' '}
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({anchor.x}, {anchor.z})
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (!audioMutedRef.current) {
                      audioRef.current?.playIntimateMomentChord(0);
                    }
                    onTeleportToAnchor(22.0, 126.5, -0.42, 3.95);
                  }}
                  title="Underground Hidden Grotto Lakeworld (22, 127, Elev +3.95m)"
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    telemetry.y < 9.5 && telemetry.z > 115
                      ? 'bg-teal-500/30 text-teal-100 border-teal-300/60 font-semibold shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-teal-200 border-teal-400/25'
                  }`}
                >
                  Hidden Grotto Lake{' '}
                  <span className="text-[10px] text-teal-300/80 font-mono">
                    (22, 127)
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onReplayFullStory}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Replay Full Experience from February 13, 10:30 PM"
              >
                <RotateCcw className="w-3 h-3 text-rose-300" />
                <span>Replay Prologue</span>
              </button>
            </div>

            {/* Row 2: Development-Only Terrain & Reactive Pathway Debug Bar */}
            {import.meta.env.DEV && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-[10px] font-mono uppercase tracking-wider text-sky-300">
                    Phase 4.3.1 Debug (DEV)
                  </span>
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
                  <button
                    type="button"
                    onClick={onToggleDebugVisible}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      debugVisible
                        ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50 font-semibold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      {debugVisible
                        ? 'Path & Boundary Gizmos: ON (B)'
                        : 'Path & Boundary Gizmos: OFF (B)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleVegetationVisible}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      vegetationVisible
                        ? 'bg-teal-500/25 text-teal-200 border-teal-400/50 font-semibold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-white/15'
                    }`}
                  >
                    <Trees className="w-3.5 h-3.5" />
                    <span>
                      {vegetationVisible
                        ? 'Vegetation: ON (V)'
                        : 'Vegetation: OFF (V)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAnchorInspector((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      showAnchorInspector
                        ? 'bg-sky-500/25 text-sky-200 border-sky-400/50 font-semibold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15'
                    }`}
                  >
                    <span>Trail Route &amp; Path Inspector</span>
                  </button>
                </div>

                <span className="text-[11px] text-teal-300/90 font-mono">
                  Active Route: {pathTelemetry.activeRouteId} (
                  {pathTelemetry.activeGlowingStones} glowing)
                </span>
              </div>
            )}

            {/* Row 3: Locomotion & Contextual Interaction Instructions */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-slate-200 font-medium">
                  <Footprints className="w-3.5 h-3.5 text-sky-300" />
                  <span>
                    WASD / Arrows to Walk · Shift to Sprint · Press E near
                    Telescope, Loveseat, Pond, or Gate
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <MousePointerClick className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {telemetry.isTopDownView
                    ? 'Top-Down Survey Camera Active (Press T for 3rd-Person)'
                    : 'Follow wooden trail signs · Drag mouse to rotate camera'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SequelScene;
