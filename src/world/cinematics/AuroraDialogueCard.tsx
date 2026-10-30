/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Heart, Sparkles, CornerDownLeft } from 'lucide-react';
import { AuroraDialogueLine } from './auroraDialogueData';

interface AuroraDialogueCardProps {
  dialogue: AuroraDialogueLine | null;
  revealFullSignal?: number;
  onTypingComplete?: (dialogueId: string) => void;
  onAdvance?: () => void;
  onSkip?: () => void;
}

export const AuroraDialogueCard: React.FC<AuroraDialogueCardProps> = ({
  dialogue,
  revealFullSignal = 0,
  onTypingComplete,
  onAdvance,
  onSkip,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const typingIntervalRef = useRef<number | null>(null);
  const visibleTimerRef = useRef<number | null>(null);
  const activeDialogueIdRef = useRef<string | null>(null);
  const onTypingCompleteRef = useRef(onTypingComplete);
  onTypingCompleteRef.current = onTypingComplete;
  const lastProcessedRevealSignalRef = useRef<number>(revealFullSignal);

  const clearTypingTimers = () => {
    if (typingIntervalRef.current !== null) {
      window.clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (visibleTimerRef.current !== null) {
      window.clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearTypingTimers();

    if (!dialogue) {
      activeDialogueIdRef.current = null;
      setDisplayedText('');
      setIsTyping(false);
      setIsVisible(false);
      return;
    }

    const targetId = dialogue.id;
    activeDialogueIdRef.current = targetId;
    setDisplayedText('');
    setIsTyping(true);
    setIsVisible(false);

    const fullText = dialogue.text;
    const speed = dialogue.typeSpeed ?? 38;
    const charDelay = Math.max(14, 1000 / speed);
    let charIndex = 0;

    visibleTimerRef.current = window.setTimeout(() => {
      if (activeDialogueIdRef.current === targetId) {
        setIsVisible(true);
      }
    }, 16);

    typingIntervalRef.current = window.setInterval(() => {
      if (activeDialogueIdRef.current !== targetId) {
        clearTypingTimers();
        return;
      }
      charIndex += 1;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        if (typingIntervalRef.current !== null) {
          window.clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setIsTyping(false);
        onTypingCompleteRef.current?.(targetId);
      }
    }, charDelay);

    return () => {
      clearTypingTimers();
    };
  }, [dialogue]);

  useEffect(() => {
    if (revealFullSignal === lastProcessedRevealSignalRef.current) {
      return;
    }
    lastProcessedRevealSignalRef.current = revealFullSignal;
    if (!dialogue) return;

    if (typingIntervalRef.current !== null) {
      window.clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setDisplayedText(dialogue.text);
    setIsTyping(false);
    setIsVisible(true);
    onTypingCompleteRef.current?.(dialogue.id);
  }, [revealFullSignal, dialogue]);

  if (!dialogue) return null;

  const isProposal = dialogue.isProposal === true;

  const handleAdvanceAction = () => {
    if (onAdvance) {
      onAdvance();
    } else {
      window.dispatchEvent(new CustomEvent('aurora-dialogue-advance'));
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 sm:bottom-8 z-40 flex justify-center px-3">
      {/* Sleek horizontal cinematic dialogue strip: ~30-32vw on desktop, translucent glass, zero screen obstruction */}
      <div
        className={`pointer-events-auto relative w-[92vw] sm:w-[50vw] lg:w-[32vw] max-w-[480px] overflow-hidden rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md transition-all duration-250 ease-out shadow-2xl ${
          isProposal
            ? 'border-rose-200/35 bg-slate-950/45 shadow-[0_8px_32px_rgba(244,114,182,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]'
            : 'border-amber-200/30 bg-slate-950/45 shadow-[0_8px_30px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.16)]'
        } ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-98'}`}
      >
        {/* Subtle top crystal hairline */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />

        {/* Horizontal Cinematic Layout: [Character Badge] [Text Stream] [Continue Button] */}
        <div className="relative flex items-center justify-between gap-3">
          {/* Left: Speaker Badge Pill */}
          <div
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isProposal
                ? 'border-rose-200/35 bg-rose-400/15 text-rose-100'
                : 'border-amber-200/30 bg-amber-400/10 text-amber-100'
            }`}
          >
            {isProposal ? (
              <Heart className="h-3 w-3 fill-rose-300/85 text-rose-200 shrink-0" />
            ) : (
              <Sparkles className="h-3 w-3 text-amber-200 shrink-0" />
            )}
            <span className="text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap">
              {dialogue.badge}
            </span>
          </div>

          {/* Middle: Horizontal Dialogue Text with soft romantic shadow */}
          <div className="min-w-0 flex-1 px-1">
            <p
              className={`font-serif text-xs sm:text-[13px] leading-snug tracking-wide line-clamp-3 ${
                isProposal
                  ? 'font-medium text-rose-50 drop-shadow-[0_1px_6px_rgba(244,114,182,0.25)]'
                  : 'font-normal text-white/95 drop-shadow-[0_1px_5px_rgba(0,0,0,0.4)]'
              }`}
            >
              <span className="text-white/35">“</span>
              {displayedText}
              <span className="text-white/35">”</span>
              {isTyping && (
                <span
                  className={`ml-0.5 inline-block h-3 w-px translate-y-[1px] animate-pulse ${
                    isProposal ? 'bg-rose-200' : 'bg-amber-200'
                  }`}
                />
              )}
            </p>
          </div>

          {/* Right: Compact Enter/Click Continue Pill */}
          <div className="shrink-0 flex items-center gap-1.5">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                title="Skip Cinematic (Esc)"
                className="hidden sm:inline-flex items-center px-1.5 py-1 rounded text-[9px] uppercase tracking-wider text-white/50 hover:text-white/80 transition-colors cursor-pointer"
              >
                Esc
              </button>
            )}
            <button
              type="button"
              onClick={handleAdvanceAction}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
                isProposal
                  ? 'border-rose-200/40 bg-rose-500/25 hover:bg-rose-500/35 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'border-amber-200/35 bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
              }`}
            >
              <span>{isTyping ? 'Reveal' : 'Next'}</span>
              <CornerDownLeft className="h-2.5 w-2.5 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
