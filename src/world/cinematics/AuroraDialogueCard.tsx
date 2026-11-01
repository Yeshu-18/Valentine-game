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
  const isHarsha = dialogue.speaker === 'Harsha';

  const handleAdvanceAction = () => {
    if (onAdvance) {
      onAdvance();
    } else {
      window.dispatchEvent(new CustomEvent('aurora-dialogue-advance'));
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 sm:bottom-5 z-40 flex justify-center px-3 sm:px-6">
      {/* Wide, compact, horizontal cinematic dialogue box (~52-56% desktop width, 84-90% mobile width, auto height, zero clipping) */}
      <div
        className={`pointer-events-auto relative w-[90vw] sm:w-[84vw] md:w-[56vw] lg:w-[52vw] max-w-3xl h-auto rounded-2xl border px-4 py-2.5 sm:px-5 sm:py-3 backdrop-blur-md transition-all duration-200 ease-out shadow-2xl ${
          isProposal || isHarsha
            ? 'border-rose-200/40 bg-slate-950/65 shadow-[0_8px_32px_rgba(244,114,182,0.20),inset_0_1px_0_rgba(255,255,255,0.18)]'
            : 'border-amber-200/35 bg-slate-950/65 shadow-[0_8px_30px_rgba(15,23,42,0.5),inset_0_1px_0_rgba(255,255,255,0.16)]'
        } ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-98'}`}
      >
        {/* Subtle top crystal hairline */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

        {/* Vertical Flex Layout: [Top: Speaker Badge + Skip] -> [Middle: Full Unclipped Dialogue Text] -> [Bottom: Right-Aligned Continue Button] */}
        <div className="relative flex flex-col gap-1 sm:gap-1.5">
          {/* Top Row: Speaker Name Badge & Optional Skip */}
          <div className="flex items-center justify-between gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${
                isHarsha
                  ? 'border-rose-200/45 bg-rose-400/18 text-rose-100'
                  : 'border-amber-200/40 bg-amber-400/15 text-amber-100'
              }`}
            >
              {isHarsha || isProposal ? (
                <Heart className="h-3 w-3 fill-rose-300/85 text-rose-200 shrink-0" />
              ) : (
                <Sparkles className="h-3 w-3 text-amber-200 shrink-0" />
              )}
              <span className="text-[11px] font-semibold tracking-wider uppercase">
                {dialogue.speaker}
              </span>
            </div>

            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                title="Skip Cinematic (Esc)"
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-white/55 hover:text-white/90 transition-colors cursor-pointer"
              >
                Esc · Skip
              </button>
            )}
          </div>

          {/* Middle Row: Full Dialogue Text (No line-clamp, no overflow-hidden, natural wrapping) */}
          <div className="w-full py-0.5">
            <p
              className={`font-serif text-sm sm:text-[15px] leading-relaxed tracking-wide whitespace-normal break-words ${
                isProposal
                  ? 'font-medium text-rose-50 drop-shadow-[0_1px_6px_rgba(244,114,182,0.28)]'
                  : 'font-normal text-white/95 drop-shadow-[0_1px_5px_rgba(0,0,0,0.45)]'
              }`}
            >
              <span className="text-white/45">“</span>
              {displayedText}
              <span className="text-white/45">”</span>
              {isTyping && (
                <span
                  className={`ml-0.5 inline-block h-3.5 w-px translate-y-[2px] animate-pulse ${
                    isHarsha || isProposal ? 'bg-rose-200' : 'bg-amber-200'
                  }`}
                />
              )}
            </p>
          </div>

          {/* Bottom Row: Right-Aligned [ENTER] / Continue Action Button */}
          <div className="flex items-center justify-end pt-0.5">
            <button
              type="button"
              onClick={handleAdvanceAction}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
                isHarsha || isProposal
                  ? 'border-rose-200/45 bg-rose-500/30 hover:bg-rose-500/45 text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'border-amber-200/40 bg-amber-400/25 hover:bg-amber-400/40 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
              }`}
            >
              <span>{isTyping ? 'Reveal [Enter]' : 'Continue [Enter]'}</span>
              <CornerDownLeft className="h-3 w-3 opacity-85" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
