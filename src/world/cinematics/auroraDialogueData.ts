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
  typeSpeed: 28,
};

/**
 * Canonical Castle Entrance Cinematic Dialogue Sequence.
 * Every beat pauses and waits for explicit Enter or Continue confirmation.
 */
export const CASTLE_ENTRANCE_DIALOGUE: AuroraDialogueSequence = [
  {
    id: 'entrance_01',
    speaker: 'Yeshwanth',
    badge: 'Grand Castle Entrance ✧',
    text: 'Harsha arrives before the Grand Palace of Heart Island...',
    typeSpeed: 32,
  },
  {
    id: 'entrance_02',
    speaker: 'Yeshwanth',
    badge: 'Heart Trees Awaken ✧',
    text: 'The twin Heart Trees awaken in warm blossom light, drifting petals around Harsha...',
    typeSpeed: 32,
  },
  {
    id: 'entrance_03',
    speaker: 'Yeshwanth',
    badge: 'Palace Illumination ✧',
    text: 'Every arched crystal window and golden heart crest across the Dream Castle illuminates...',
    typeSpeed: 32,
  },
  {
    id: 'entrance_04',
    speaker: 'Yeshwanth',
    badge: 'Grand Palace Doors ✧',
    text: 'The Grand Palace Doors swing open, revealing the Chandelier Hall within...',
    typeSpeed: 32,
  },
  {
    id: 'entrance_05',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'Welcome to your Dream Castle, Harsha... Every flower and heart here was made for you.',
    typeSpeed: 28,
  },
  {
    id: 'entrance_06',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'This rose—and my heart—are yours forever. I love you, Harsha. ♥',
    typeSpeed: 28,
    isProposal: true,
  },
  {
    id: 'entrance_07',
    speaker: 'Yeshwanth',
    badge: 'Dream Castle of Heart Island ♥',
    text: 'Yeshwanth & Harsha — Welcome to the Dream Castle of Heart Island ♥',
    typeSpeed: 30,
    isProposal: true,
  },
];

/**
 * Canonical Little Castle ("Our Little Kingdom") Cinematic Dialogue Sequence.
 * Every beat pauses and waits for explicit Enter or Continue confirmation.
 */
export const LITTLE_CASTLE_DIALOGUE: AuroraDialogueSequence = [
  {
    id: 'little_castle_01',
    speaker: 'Yeshwanth',
    badge: 'Our Little Kingdom ✧',
    text: 'OUR LITTLE KINGDOM — Two Connected Towers & the Small Ornate Golden Gate.',
    typeSpeed: 32,
  },
  {
    id: 'little_castle_02',
    speaker: 'Yeshwanth',
    badge: 'Our Little Kingdom ✧',
    text: 'Stepping through the Ornate Golden Gate into Our Little Kingdom…',
    typeSpeed: 32,
  },
  {
    id: 'little_castle_03',
    speaker: 'Yeshwanth',
    badge: 'The Little Kingdom Awakens ✧',
    text: 'The Little Kingdom awakens as you arrive — flowers bloom near your feet and two streams meet in a glowing crystal heart.',
    typeSpeed: 32,
  },
  {
    id: 'little_castle_04',
    speaker: 'Yeshwanth',
    badge: 'Two Worlds Become One ✧',
    text: 'The two connected towers illuminate, and the entrance rose gently dissolves into glowing petals as you reach the Queen’s Courtyard.',
    typeSpeed: 32,
  },
  {
    id: 'little_castle_05',
    speaker: 'Yeshwanth',
    badge: 'The Queen’s Courtyard ✧',
    text: 'The courtyard grows quiet as the circular heart frame glows, and a royal crown slowly rises from the crystal pedestal.',
    typeSpeed: 30,
    isProposal: true,
  },
  {
    id: 'little_castle_06',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'Yeshwanth turns toward Harsha, places his hand over his heart, and looks from the crown back to you — "This is your kingdom."',
    typeSpeed: 30,
    isProposal: true,
  },
  {
    id: 'little_castle_07',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'MY QUEEN',
    typeSpeed: 26,
    isProposal: true,
  },
  {
    id: 'little_castle_08',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'You are the queen of my life.',
    typeSpeed: 28,
    isProposal: true,
  },
  {
    id: 'little_castle_09',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'And I am so grateful that I get to have you in mine.',
    typeSpeed: 28,
    isProposal: true,
  },
  {
    id: 'little_castle_10',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'Thank you for making my world more beautiful.',
    typeSpeed: 28,
    isProposal: true,
  },
  {
    id: 'little_castle_11',
    speaker: 'Yeshwanth',
    badge: 'Yeshwanth ♡',
    text: 'I LOVE YOU, HARSHA ❤️',
    typeSpeed: 26,
    isProposal: true,
  },
  {
    id: 'little_castle_12',
    speaker: 'Yeshwanth',
    badge: 'Our Little Kingdom ❤️',
    text: 'Every tower, bridge, fountain, and lantern illuminates — a little kingdom shaped like a heart, built just for you.',
    typeSpeed: 30,
    isProposal: true,
  },
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
