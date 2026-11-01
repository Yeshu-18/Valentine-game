/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuroraDialogueLine {
  id: string;
  speaker: 'Yeshwanth' | 'Harsha';
  badge: string;
  text: string;
  typeSpeed?: number;
  isProposal?: boolean;
}

export type AuroraDialogueSequence = AuroraDialogueLine[];

export type DialogueProgressState =
  | 'hidden'
  | 'typing'
  | 'waiting_for_input'
  | 'advancing';

export type DialogueAdvanceSource = 'keyboard_enter' | 'ui_click';

const Y = {
  speaker: 'Yeshwanth' as const,
  badge: 'Yeshwanth ♡',
  typeSpeed: 32,
};

const H = {
  speaker: 'Harsha' as const,
  badge: 'Harsha ♡',
  typeSpeed: 32,
};

/**
 * Canonical Big Castle Entrance Cinematic Dialogue Sequence (Sections 5, 6, 8, 10).
 * Natural romantic conversation between Yeshwanth and Harsha — zero narration of visual events.
 * Every beat pauses and waits for explicit Enter or Continue confirmation.
 */
export const CASTLE_ENTRANCE_DIALOGUE: AuroraDialogueSequence = [
  // Group 1 — Three-Quarter Castle Reveal (Section 5: indices 0..7)
  { id: 'entrance_01', ...Y, text: 'Okay... you can look now.' },
  { id: 'entrance_02', ...H, text: 'Yeshwanth...' },
  { id: 'entrance_03', ...H, text: 'You actually made this?' },
  { id: 'entrance_04', ...Y, text: 'I told you I had something for you.' },
  { id: 'entrance_05', ...H, text: 'I thought you meant something small.' },
  { id: 'entrance_06', ...Y, text: 'This is small.' },
  { id: 'entrance_07', ...H, text: 'THIS is small?' },
  {
    id: 'entrance_08',
    ...Y,
    text: 'Compared to everything I wanted to make for you.',
    isProposal: true,
  },

  // Group 2 — Castle Lighting & HARSHA Heart Reaction (Section 6: indices 8..14)
  { id: 'entrance_09', ...H, text: "It's so pretty..." },
  { id: 'entrance_10', ...Y, text: "I kept thinking about what you'd like." },
  { id: 'entrance_11', ...H, text: 'You even put my name there?' },
  { id: 'entrance_12', ...Y, text: 'Of course.' },
  { id: 'entrance_13', ...H, text: "You're ridiculous." },
  { id: 'entrance_14', ...Y, text: 'You like ridiculous.' },
  { id: 'entrance_15', ...H, text: 'Maybe.' },

  // Group 3 — Entering Big Castle / Doors Open Visually (Section 8: indices 15..18)
  { id: 'entrance_16', ...H, text: "We're going inside too?" },
  {
    id: 'entrance_17',
    ...Y,
    text: "You didn't think I'd build the outside and leave you standing at the door, did you?",
  },
  { id: 'entrance_18', ...H, text: "Honestly... with you, I wasn't sure." },
  { id: 'entrance_19', ...Y, text: 'Come on.' },

  // Group 4 — Big Castle Flower Moment / Left-Side Two-Shot (Section 10: indices 19..28)
  { id: 'entrance_20', ...H, text: "What's that?" },
  { id: 'entrance_21', ...Y, text: 'For you.', isProposal: true },
  { id: 'entrance_22', ...H, text: 'You got me a flower too?' },
  {
    id: 'entrance_23',
    ...Y,
    text: "I couldn't make a whole castle and forget the flower.",
  },
  { id: 'entrance_24', ...H, text: "You're really trying to impress me, huh?" },
  { id: 'entrance_25', ...Y, text: 'Is it working?' },
  { id: 'entrance_26', ...H, text: 'Maybe a little.' },
  { id: 'entrance_27', ...Y, text: "I'll take that." },
  {
    id: 'entrance_28',
    ...Y,
    text: 'I just wanted to make something that makes you feel as special as you are to me.',
    isProposal: true,
  },
  { id: 'entrance_29', ...H, text: 'You already do.', isProposal: true },
];

/**
 * Canonical Little Castle ("Our Little Kingdom") Cinematic Dialogue Sequence (Sections 16, 19, 21, 22, 23, 25, 26, 27, 32).
 * Natural romantic conversation between Yeshwanth and Harsha — zero narration of visual events.
 * Every beat pauses and waits for explicit Enter or Continue confirmation.
 */
export const LITTLE_CASTLE_DIALOGUE: AuroraDialogueSequence = [
  // Group 1 — Little Castle Gate Approach (Section 16: indices 0..5)
  { id: 'little_castle_01', ...Y, text: 'Ready?' },
  { id: 'little_castle_02', ...H, text: 'For what?' },
  { id: 'little_castle_03', ...Y, text: 'Come inside.' },
  { id: 'little_castle_04', ...H, text: "You're being suspicious." },
  { id: 'little_castle_05', ...Y, text: "I'm always suspicious." },
  { id: 'little_castle_06', ...H, text: "That's exactly what worries me." },

  // Group 2 — First Conversation Inside (Section 19: indices 6..14)
  { id: 'little_castle_07', ...H, text: 'Wait...' },
  { id: 'little_castle_08', ...H, text: 'You actually made a tiny castle?' },
  { id: 'little_castle_09', ...Y, text: 'Yeah.' },
  { id: 'little_castle_10', ...H, text: 'For us?' },
  { id: 'little_castle_11', ...Y, text: 'For us.', isProposal: true },
  { id: 'little_castle_12', ...H, text: "It's so cute." },
  { id: 'little_castle_13', ...Y, text: "I knew you'd say that." },
  { id: 'little_castle_14', ...H, text: 'Because you know me.' },
  { id: 'little_castle_15', ...Y, text: 'I try.' },

  // Group 3 — Tower Conversation (Section 21: indices 15..25)
  { id: 'little_castle_16', ...H, text: 'I love the two towers.' },
  { id: 'little_castle_17', ...Y, text: 'I knew you would.' },
  { id: 'little_castle_18', ...H, text: 'Why two?' },
  { id: 'little_castle_19', ...Y, text: 'One for you.' },
  { id: 'little_castle_20', ...Y, text: 'One for me.' },
  { id: 'little_castle_21', ...H, text: "And they're connected." },
  { id: 'little_castle_22', ...Y, text: 'Yeah.' },
  { id: 'little_castle_23', ...H, text: 'You planned that too?' },
  { id: 'little_castle_24', ...Y, text: 'Maybe.' },
  { id: 'little_castle_25', ...H, text: "You're impossible." },
  { id: 'little_castle_26', ...Y, text: 'You still came inside.' },

  // Group 4 — Personal Moment / Subtle Left-Side Shift (Section 22: indices 26..31)
  { id: 'little_castle_27', ...H, text: 'You really made all this just for me?' },
  { id: 'little_castle_28', ...Y, text: 'For you...', isProposal: true },
  { id: 'little_castle_29', ...Y, text: '...and for us.', isProposal: true },
  { id: 'little_castle_30', ...H, text: "That's actually really sweet." },
  { id: 'little_castle_31', ...Y, text: "Don't tell anyone." },
  { id: 'little_castle_32', ...H, text: 'Too late.' },

  // Group 5 — Crown Reveal Conversation (Section 23: indices 32..39)
  { id: 'little_castle_33', ...H, text: "Yeshwanth... What's that?" },
  { id: 'little_castle_34', ...Y, text: 'I think you know.' },
  { id: 'little_castle_35', ...H, text: "You're really making me wear that?" },
  { id: 'little_castle_36', ...Y, text: 'Absolutely.' },
  { id: 'little_castle_37', ...H, text: 'Why?' },
  { id: 'little_castle_38', ...Y, text: 'Because it suits you.', isProposal: true },
  { id: 'little_castle_39', ...H, text: "You haven't even seen me wearing it." },
  { id: 'little_castle_40', ...Y, text: "I don't need to.", isProposal: true },

  // Group 6 — After Crown / Left-Side Two-Shot (Section 25: indices 40..49)
  { id: 'little_castle_41', ...H, text: 'Well?' },
  { id: 'little_castle_42', ...Y, text: 'Okay.' },
  { id: 'little_castle_43', ...H, text: 'Okay what?' },
  { id: 'little_castle_44', ...Y, text: 'Now it looks right.', isProposal: true },
  { id: 'little_castle_45', ...H, text: 'What does?' },
  { id: 'little_castle_46', ...Y, text: 'The castle.', isProposal: true },
  { id: 'little_castle_47', ...H, text: 'You really planned that line.' },
  { id: 'little_castle_48', ...Y, text: 'Maybe.' },
  { id: 'little_castle_49', ...H, text: "You're such a fool." },
  { id: 'little_castle_50', ...Y, text: 'Your fool.', isProposal: true },

  // Group 7 — Throne / Wider Three-Quarter Shot (Section 26: indices 50..54)
  { id: 'little_castle_51', ...Y, text: 'There.' },
  { id: 'little_castle_52', ...H, text: 'What?' },
  { id: 'little_castle_53', ...Y, text: "Now you're officially the boss." },
  { id: 'little_castle_54', ...H, text: 'I thought I already was.' },
  { id: 'little_castle_55', ...Y, text: 'Fair point.' },

  // Group 8 — Intimate Little Castle Moment / Side Shot (Section 27: indices 55..59)
  { id: 'little_castle_56', ...H, text: 'You know... I really like this.' },
  { id: 'little_castle_57', ...Y, text: 'The castle?' },
  { id: 'little_castle_58', ...H, text: 'Us.', isProposal: true },
  { id: 'little_castle_59', ...Y, text: 'Yeah.', isProposal: true },
  { id: 'little_castle_60', ...Y, text: 'Me too.', isProposal: true },

  // Group 9 — Final Zoom-Out & Fireworks Reaction (Section 32: indices 60..65)
  { id: 'little_castle_61', ...H, text: 'Yeshwanth...' },
  { id: 'little_castle_62', ...Y, text: 'Look up.' },
  { id: 'little_castle_63', ...H, text: 'You really did all this...' },
  { id: 'little_castle_64', ...Y, text: 'For you.', isProposal: true },
  { id: 'little_castle_65', ...H, text: 'I love you.', isProposal: true },
  { id: 'little_castle_66', ...Y, text: 'I love you too, Harsha.', isProposal: true },
];

/**
 * Canonical Dialogue Progression Controller (Pass A Contract).
 * Enforces:
 * - CINEMATIC STATE -> SHOW DIALOGUE -> TYPE TEXT ('typing') -> WAIT ('waiting_for_input')
 * - First Enter/Click while 'typing': immediately reveals full text and transitions to 'waiting_for_input'.
 * - Second Enter/Click while 'waiting_for_input': validates transition guard and advances cinematic state.
 */
export class DialogueProgressionController {
  private state: DialogueProgressState = 'hidden';
  private activeLine: AuroraDialogueLine | null = null;
  private isAdvancing = false;
  private revealFullSignal = 0;
  private lastActionTimestampMs = 0;

  private logDev(message: string): void {
    if (import.meta.env.DEV) {
      console.debug(`[DIALOGUE]\n${message}`);
    }
  }

  public getState(): DialogueProgressState {
    return this.state;
  }

  public getActiveLine(): AuroraDialogueLine | null {
    return this.activeLine;
  }

  public getRevealFullSignal(): number {
    return this.revealFullSignal;
  }

  public syncActiveDialogue(line: AuroraDialogueLine | null): void {
    if (!line) {
      if (this.activeLine !== null || this.state !== 'hidden') {
        this.activeLine = null;
        this.state = 'hidden';
        this.isAdvancing = false;
      }
      return;
    }

    if (!this.activeLine || this.activeLine.id !== line.id) {
      this.activeLine = line;
      this.state = 'typing';
      this.isAdvancing = false;
      this.logDev(`state: typing\nid: ${line.id}`);
    }
  }

  public markTypingCompleted(dialogueId: string): void {
    // Guard against stale callbacks from previous dialogue lines (Section 15)
    if (!this.activeLine || this.activeLine.id !== dialogueId) {
      return;
    }
    if (this.state === 'typing') {
      this.state = 'waiting_for_input';
      this.logDev(`state: waiting_for_input\nid: ${dialogueId}`);
    }
  }

  public requestDialogueAdvance(
    source: DialogueAdvanceSource,
    advanceStoryCallback: () => void,
    getUpdatedDialogueCallback: () => AuroraDialogueLine | null,
  ): boolean {
    if (!this.activeLine || this.state === 'hidden') {
      return false;
    }

    // Prevent double advance or same-frame race conditions (Section 14)
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.isAdvancing || now - this.lastActionTimestampMs < 65) {
      return false;
    }
    this.lastActionTimestampMs = now;

    this.logDev(`advance requested\nsource: ${source}`);

    // First Enter / Click while typing: immediately reveal full text and enter waiting_for_input
    if (this.state === 'typing') {
      this.revealFullSignal += 1;
      this.state = 'waiting_for_input';
      this.logDev(`state: waiting_for_input\nid: ${this.activeLine.id}`);
      return true;
    }

    // Second Enter / Click while waiting_for_input: advance cinematic state
    if (this.state === 'waiting_for_input') {
      this.isAdvancing = true;
      this.state = 'advancing';
      const fromId = this.activeLine.id;

      try {
        advanceStoryCallback();
        const nextLine = getUpdatedDialogueCallback();
        this.logDev(`advancing\nfrom: ${fromId}\nto: ${nextLine?.id ?? 'complete'}`);
        this.syncActiveDialogue(nextLine);
      } finally {
        this.isAdvancing = false;
      }
      return true;
    }

    return false;
  }
}

/**
 * Every item is one Enter-controlled dialogue beat.
 * Nothing advances automatically.
 */
export const AURORA_CINEMATIC_DIALOGUE: Record<string, AuroraDialogueSequence> = {
  INVITE: [
    { ...Y, id: 'INVITE_01', text: 'Come.' },
    { ...Y, id: 'INVITE_02', text: 'Sit with me, Harsha.' },
    { ...Y, id: 'INVITE_03', text: 'Just stay here with me for a while.' },
    { ...Y, id: 'INVITE_04', text: "You don't have to say anything." },
    { ...Y, id: 'INVITE_05', text: 'Just enjoy the moment.' },
  ],

  BEAUTIFUL: [
    { ...Y, id: 'BEAUTIFUL_01', text: 'Look up.' },
    { ...Y, id: 'BEAUTIFUL_02', text: 'Do you know why I brought you here?' },
    { ...Y, id: 'BEAUTIFUL_03', text: 'I know you like Aurora lights.' },
    { ...Y, id: 'BEAUTIFUL_04', text: "I know you've always wanted to see the real Northern Lights." },
    { ...Y, id: 'BEAUTIFUL_05', text: 'And right now...' },
    { ...Y, id: 'BEAUTIFUL_06', text: "I can't take you there." },
    { ...Y, id: 'BEAUTIFUL_07', text: 'I wish I could.' },
  ],

  WANTED_TO_SEE: [
    { ...Y, id: 'WANTED_01', text: 'But I still wanted you to see something.' },
    { ...Y, id: 'WANTED_02', text: 'So I made this.' },
    { ...Y, id: 'WANTED_03', text: 'Just for you.' },
    { ...Y, id: 'WANTED_04', text: "It isn't the real Northern Lights." },
    { ...Y, id: 'WANTED_05', text: 'I know that.' },
    { ...Y, id: 'WANTED_06', text: 'But...' },
    { ...Y, id: 'WANTED_07', text: 'This is the best I can do right now.' },
    { ...Y, id: 'WANTED_08', text: "So don't think about that." },
    { ...Y, id: 'WANTED_09', text: 'Just look at it.' },
    { ...Y, id: 'WANTED_10', text: 'Look at the sky.' },
    { ...Y, id: 'WANTED_11', text: 'Look at the water.' },
    { ...Y, id: 'WANTED_12', text: 'And enjoy this.' },
    { ...Y, id: 'WANTED_13', text: 'This moment is yours.' },
  ],

  SOMETHING_TO_TELL: [
    { ...Y, id: 'TELL_01', text: "I've always wanted to give you things you'd remember." },
    { ...Y, id: 'TELL_02', text: 'Not just expensive things.' },
    { ...Y, id: 'TELL_03', text: 'Not just things I could buy.' },
    { ...Y, id: 'TELL_04', text: 'I wanted to give you moments.' },
    { ...Y, id: 'TELL_05', text: 'Places.' },
    { ...Y, id: 'TELL_06', text: 'Little memories.' },
    { ...Y, id: 'TELL_07', text: 'Things that make you stop and smile later.' },
    { ...Y, id: 'TELL_08', text: 'And think...' },
    { ...Y, id: 'TELL_09', text: 'Yeah... he really made this for me.' },
    { ...Y, id: 'TELL_10', text: 'Do you remember Hail Mary?' },
    { ...Y, id: 'TELL_11', text: 'Unexpected beautiful twist of our lives' },
    { ...Y, id: 'TELL_12', text: 'Nothing special was supposed to happen.' },
    { ...Y, id: 'TELL_13', text: 'But holding your hand.' },
    { ...Y, id: 'TELL_14', text: 'And then...' },
    { ...Y, id: 'TELL_15', text: 'that little pinky moment.' },
    { ...Y, id: 'TELL_16', text: "Everything I completely felt safe around you and I wanted it for my entire life" },
    { ...Y, id: 'TELL_17', text: "Your warmness" },
    { ...Y, id: 'TELL_18', text: 'Your cute possessiveness' },
    { ...Y, id: 'TELL_19', text: 'You caring for me' },
    { ...Y, id: 'TELL_20', text: 'The way you hold my hand.' },
    { ...Y, id: 'TELL_21', text: 'The random conversations.' },
    { ...Y, id: 'TELL_22', text: 'The silly things we laugh about.' },
    { ...Y, id: 'TELL_23', text: 'The times we just sit together.' },
    { ...Y, id: 'TELL_24', text: "The times we just adore each other" },
    { ...Y, id: 'TELL_25', text: 'I like those moments.' },
    { ...Y, id: 'TELL_26', text: 'More than you realize.' },
    { ...Y, id: 'TELL_27', text: "There's something else I wanted to tell you." },
    { ...Y, id: 'TELL_28', text: 'I love how you understand me.' },
    { ...Y, id: 'TELL_29', text: "Sometimes I don't even have to explain myself." },
    { ...Y, id: 'TELL_30', text: 'You just understand.' },
    { ...Y, id: 'TELL_31', text: 'I love how much you care.' },
    { ...Y, id: 'TELL_32', text: "Even when you pretend you're not being caring." },
    { ...Y, id: 'TELL_33', text: 'And I love your playful side.' },
    { ...Y, id: 'TELL_34', text: 'You can make something completely ordinary feel fun.' },
    { ...Y, id: 'TELL_35', text: 'And then...' },
    { ...Y, id: 'TELL_36', text: "there's the way you scold me." },
    { ...Y, id: 'TELL_37', text: 'Sometimes you really do sound like my mother.' },
    { ...Y, id: 'TELL_38', text: 'But I know why you do it.' },
    { ...Y, id: 'TELL_39', text: 'Because you care about me.' },
    { ...Y, id: 'TELL_40', text: 'And honestly...' },
    { ...Y, id: 'TELL_41', text: "I wouldn't change that about you." },
  ],

  PROPOSAL: [
    { ...Y, id: 'PROPOSAL_01', text: "I didn't make this world because I wanted to show you how much I can build.", isProposal: true },
    { ...Y, id: 'PROPOSAL_02', text: 'I made it because I wanted you to have somewhere that feels like yours.', isProposal: true },
    { ...Y, id: 'PROPOSAL_03', text: 'Somewhere you can play.', isProposal: true },
    { ...Y, id: 'PROPOSAL_04', text: 'Explore.', isProposal: true },
    { ...Y, id: 'PROPOSAL_05', text: 'Laugh.', isProposal: true },
    { ...Y, id: 'PROPOSAL_06', text: 'And just forget everything else for a while.', isProposal: true },
    { ...Y, id: 'PROPOSAL_07', text: 'And when you find something beautiful here...', isProposal: true },
    { ...Y, id: 'PROPOSAL_08', text: 'I want you to remember that I was thinking about you when I made it.', isProposal: true },
    { ...Y, id: 'PROPOSAL_09', text: 'Harsha...', isProposal: true },
    { ...Y, id: 'PROPOSAL_10', text: 'I could have just taken you somewhere beautiful.', isProposal: true },
    { ...Y, id: 'PROPOSAL_11', text: 'I could have shown you the real Northern Lights someday.', isProposal: true },
    { ...Y, id: 'PROPOSAL_12', text: 'And I still want to do that with you.', isProposal: true },
    { ...Y, id: 'PROPOSAL_13', text: 'But until then...', isProposal: true },
    { ...Y, id: 'PROPOSAL_14', text: 'I wanted to give you this.', isProposal: true },
    { ...Y, id: 'PROPOSAL_15', text: 'A little piece of the world I imagined for you.', isProposal: true },
    { ...Y, id: 'PROPOSAL_16', text: "Because that's what you are to me.", isProposal: true },
    { ...Y, id: 'PROPOSAL_17', text: 'Someone I want to make memories with.', isProposal: true },
    { ...Y, id: 'PROPOSAL_18', text: 'Not just the big ones.', isProposal: true },
    { ...Y, id: 'PROPOSAL_19', text: 'The stupid ones.', isProposal: true },
    { ...Y, id: 'PROPOSAL_20', text: 'The funny ones.', isProposal: true },
    { ...Y, id: 'PROPOSAL_21', text: 'The completely ordinary ones.', isProposal: true },
    { ...Y, id: 'PROPOSAL_22', text: 'All of them.', isProposal: true },
    { ...Y, id: 'PROPOSAL_23', text: 'I love you, Harsha.', isProposal: true },
    { ...Y, id: 'PROPOSAL_24', text: "I don't know what the future is going to look like.", isProposal: true },
    { ...Y, id: 'PROPOSAL_25', text: 'But I know who I want beside me while I find out.', isProposal: true },
    { ...Y, id: 'PROPOSAL_26', text: 'You.', isProposal: true },
    { ...Y, id: 'PROPOSAL_27', text: 'So...', isProposal: true },
    { ...Y, id: 'PROPOSAL_28', text: 'Will you keep choosing me?', isProposal: true },
  ],

  RETURN: [
    { ...Y, id: 'RETURN_01', text: 'Come.' },
    { ...Y, id: 'RETURN_02', text: "Let's go back." },
  ],
};
