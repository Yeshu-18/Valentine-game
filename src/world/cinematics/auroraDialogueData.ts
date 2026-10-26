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

const Y = {
  speaker: 'Yeshwanth' as const,
  badge: 'Yeshwanth ♡',
  typeSpeed: 23,
};

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
