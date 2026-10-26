/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { AuroraDialogueLine } from './auroraDialogueData';

interface AuroraDialogueCardProps {
  dialogue: AuroraDialogueLine | null;
  onAdvance?: () => void;
  onSkip?: () => void;
}

export const AuroraDialogueCard: React.FC<AuroraDialogueCardProps> = ({
  dialogue,
  onAdvance,
  onSkip,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!dialogue) {
      setDisplayedText('');
      setIsTyping(false);
      setIsVisible(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    setIsVisible(false);

    const fullText = dialogue.text;
    const speed = dialogue.typeSpeed ?? 42;
    const charDelay = Math.max(12, 1000 / speed);
    let charIndex = 0;

    const visibleTimer = window.setTimeout(() => setIsVisible(true), 20);
    const interval = window.setInterval(() => {
      charIndex += 1;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        window.clearInterval(interval);
        setIsTyping(false);
      }
    }, charDelay);

    return () => {
      window.clearTimeout(visibleTimer);
      window.clearInterval(interval);
    };
  }, [dialogue]);

  if (!dialogue) return null;

  const isProposal = dialogue.isProposal === true;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-9 z-40 flex justify-center px-4 sm:bottom-11 sm:px-6">
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-[28px] border px-6 py-5 sm:px-8 sm:py-6 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-500 ease-out ${
          isProposal
            ? 'border-rose-200/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(196,181,253,0.08),rgba(244,114,182,0.10),rgba(15,23,42,0.28))] shadow-[0_12px_60px_rgba(244,114,182,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]'
            : 'border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(125,211,252,0.06),rgba(196,181,253,0.07),rgba(15,23,42,0.24))] shadow-[0_12px_55px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.16)]'
        } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
      >
        <div
          className={`pointer-events-none absolute -inset-20 blur-3xl opacity-20 ${
            isProposal
              ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(244,114,182,0.55),transparent_55%)]'
              : 'bg-[radial-gradient(circle_at_20%_0%,rgba(45,212,191,0.45),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(167,139,250,0.38),transparent_50%)]'
          }`}
        />

        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />

        <div className="relative flex flex-col items-center text-center">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-xl ${
              isProposal
                ? 'border-rose-200/25 bg-rose-300/[0.08] text-rose-100'
                : 'border-cyan-100/20 bg-white/[0.07] text-cyan-50'
            }`}
          >
            {isProposal ? (
              <Heart className="h-3.5 w-3.5 fill-rose-300/80 text-rose-200 drop-shadow-[0_0_7px_rgba(251,113,133,0.7)]" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-cyan-100 drop-shadow-[0_0_7px_rgba(103,232,249,0.7)]" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-[0.22em]">
              {dialogue.badge}
            </span>
          </div>

          <p
            className={`max-w-xl font-serif leading-[1.65] tracking-wide transition-all duration-300 ${
              isProposal
                ? 'text-[1.08rem] font-medium text-rose-50 drop-shadow-[0_1px_12px_rgba(244,114,182,0.20)] sm:text-xl'
                : 'text-base font-normal text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.28)] sm:text-lg'
            }`}
          >
            <span className="text-white/30">“</span>
            {displayedText}
            <span className="text-white/30">”</span>
            {isTyping && (
              <span
                className={`ml-1 inline-block h-4 w-px translate-y-[2px] animate-pulse ${
                  isProposal ? 'bg-rose-200/80' : 'bg-cyan-100/80'
                }`}
              />
            )}
          </p>

          <div
            className={`mt-4 h-px rounded-full transition-all duration-700 ${
              isProposal
                ? 'w-28 bg-gradient-to-r from-transparent via-rose-200/55 to-transparent'
                : 'w-20 bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent'
            }`}
          />

          <div className="pointer-events-auto mt-4 flex items-center gap-4">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="flex items-center gap-1.5 opacity-55 hover:opacity-90 transition-opacity cursor-pointer"
              >
                <span className="rounded-md border border-white/15 bg-white/[0.05] px-2 py-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.16em] text-white/65">
                  Esc
                </span>
                <span className="font-sans text-[9px] uppercase tracking-[0.14em] text-white/40">
                  Skip
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (onAdvance) {
                  onAdvance();
                } else {
                  window.dispatchEvent(new CustomEvent('aurora-dialogue-advance'));
                }
              }}
              className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span className="rounded-md border border-white/20 bg-white/[0.07] px-2 py-1 font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                Enter
              </span>
              <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/55">
                Continue
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
