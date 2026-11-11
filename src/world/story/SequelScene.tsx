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

export interface SequelSceneProps {
  telemetry: PrivateWorldTelemetry;
  pathTelemetry: PrivatePathLightingTelemetry;
  debugVisible: boolean;
  vegetationVisible: boolean;
  onToggleDebugVisible: () => void;
  onToggleVegetationVisible: () => void;
  onToggleTopDownView: () => void;
  onTeleportToAnchor: (x: number, z: number, yawRadians?: number) => void;
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

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none font-sans">
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
            {telemetry.isTopDownView
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

      {/* Dev-Only Anchor, Boundary & Reactive Pathway Illumination Inspector Panel */}
      {import.meta.env.DEV && showAnchorInspector && (
        <div className="pointer-events-auto absolute top-28 left-6 w-[445px] max-w-[calc(100vw-3rem)] bg-slate-950/92 border border-sky-400/35 rounded-xl p-3.5 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-sky-300">
              <Layers className="w-3.5 h-3.5" />
              <span>Phase 4.2 Debug · Anchors &amp; Reactive Path Lighting</span>
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
            <div className="flex items-center justify-between text-slate-300">
              <span>Forward Illumination Wave Lead:</span>
              <span className="text-teal-300">
                +{pathTelemetry.waveLeadMeters.toFixed(1)}m ahead
              </span>
            </div>
          </div>

          <div className="space-y-1.5 font-mono-tabular text-[11px]">
            {PRIVATE_WORLD_ANCHOR_LIST.map((anchor) => {
              const actualY = getPrivateTerrainHeight(anchor.x, anchor.z);
              const dist = Math.hypot(
                telemetry.x - anchor.x,
                telemetry.z - anchor.z,
              );
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
                      Target ({anchor.x}, {anchor.z}) ·{' '}
                      {anchor.elevationRangeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300">
                      Y +{actualY.toFixed(2)}m
                    </span>
                    <span className="text-slate-400">{dist.toFixed(0)}m</span>
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

      {/* Arrival Shore Special Gate Proximity Prompt: [E] Return to Heart Island */}
      {telemetry.nearReturnGate && !telemetry.isTopDownView && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/95 border border-rose-400/60 rounded-xl px-4 py-2.5 text-white shadow-[0_0_28px_rgba(244,63,94,0.35)]">
          <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-rose-200">
              The Special Gate Arrival Threshold · Southern Shore
            </span>
            <span className="text-xs text-slate-200">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-white/15 font-mono text-amber-200">
                [E]
              </kbd>{' '}
              Step Through the Special Gate Back to Heart Island
            </span>
          </div>
          <button
            type="button"
            onClick={onReturnToDreamWorld}
            className="ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            [E] Return to Heart Island
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
                    ) < 22;
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
                    Phase 4.2 Debug (DEV)
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
                    <span>Path Wave &amp; Anchor Inspector</span>
                  </button>
                </div>

                <span className="text-[11px] text-teal-300/90 font-mono">
                  Active Route: {pathTelemetry.activeRouteId} (
                  {pathTelemetry.activeGlowingStones} glowing)
                </span>
              </div>
            )}

            {/* Row 3: Locomotion & Camera Instructions */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-slate-200 font-medium">
                  <Footprints className="w-3.5 h-3.5 text-sky-300" />
                  <span>
                    WASD / Arrows to Walk · Hold Shift to Sprint · Press E at
                    Arrival Shore Gate to Return to Heart Island
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <MousePointerClick className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {telemetry.isTopDownView
                    ? 'Top-Down Survey Camera Active (Press T for 3rd-Person)'
                    : 'Click or drag mouse to rotate camera · Scroll to zoom'}
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
