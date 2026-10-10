// Recorded swap-agent output for the example scripts: which substitutes it
// chose and how it rewrote each line. Stored by name and type, not Qloo data;
// at runtime each substitute is looked up and checked against the room again,
// and dropped if it no longer lands.
export interface RecordedSwap {
  name: string;
  type: string;
  // Tells apart same-named entries (several films called "Hamilton").
  year?: number;
  rewrite: string;
  why: string;
}

export const RECORDED_SWAPS: Record<string, Record<string, { swaps: RecordedSwap[]; note: string }>> = {
  "04-lecture": {
    "Regis Philbin": {
      swaps: [
        {
          name: "Steve Harvey",
          type: "urn:entity:person",
          rewrite: "Steve Harvey asks a contestant a question with four options.",
          why: "He hosts Family Feud, so he is the familiar game-show host this room actually knows today.",
        },
        {
          name: "Ryan Seacrest",
          type: "urn:entity:person",
          rewrite: "Ryan Seacrest asks a contestant a question with four options.",
          why: "He hosts Wheel of Fortune now, a current network game-show host the room knows.",
        },
      ],
      note: "Steve Harvey is the clearest fit; Ryan Seacrest works but ranks low in Ann Arbor. Howie Mandel would fit too, but the script already uses him.",
    },
    "Who Wants to Be a Millionaire": {
      swaps: [],
      note: "Qloo surfaced no multiple-choice quiz with a 50:50-style lifeline for this room (its game shows are reality or improv formats, and Kahoot and Trivia Crack are not in the graph), so keep Millionaire and briefly explain the four options and the lifeline.",
    },
    "Deal or No Deal": {
      swaps: [],
      note: "Every take-it-or-gamble game show checked (The Chase, Jeopardy!, Shark Tank, Beast Games, Squid Game: The Challenge) skews older or is no better known to this room than Deal or No Deal, and the shows this room does like (The Voice, Survivor) don't do the take-the-offer job, so keep the original.",
    },
  },
  "05-presidential-roast": {
    "Harriet Tubman": {
      swaps: [
        {
          name: "Hamilton",
          type: "urn:entity:movie",
          year: 2020,
          rewrite: "Earn me some serious Hamiltons.",
          why: "The same cash slang built on the face of a banknote (the $10 bill), and this room knows Hamilton from the musical.",
        },
      ],
      note: "Measured through the Hamilton musical film, which is how this crowd knows the name; the line loses the newly-announced-$20 angle, which has faded anyway.",
    },
  },
  "06-one-liners": {
    "Jeopardy!": {
      swaps: [],
      note: "The joke needs a quiz show where people win money for answers, and none that fit (Millionaire, Family Feud, Are You Smarter Than a 5th Grader?) lands better with this crowd; the shows they do like are talent contests that would break the joke.",
    },
  },
  "02-keynote": {
    "Pret A Manger": {
      swaps: [
        {
          name: "In-N-Out Burger",
          type: "urn:entity:brand",
          rewrite:
            "The question is whether we'll build something people actually love, the way people loved the first iPod, the way people loved Breaking Bad, the way people still love a well-made burger from In-N-Out.",
          why: "A cheap, much-loved, made-to-order chain that deflates the grand examples the same way, and it ranks near the top in San Francisco. \"Sandwich\" becomes \"burger\" so the line stays true.",
        },
      ],
      note: "The sandwich chains that do Pret's job (Panera, Subway, Jersey Mike's) score no better than Pret with this room; In-N-Out is the one humble favorite that does.",
    },
    "Microsoft Office": {
      swaps: [],
      note: "Qloo has no entry for a comparably primitive early assistant (Siri, Cortana, Alexa and AIM aren't in the graph), and the similar brands it finds are hardware and luxury labels that can't play a clumsy pretend-AI, so the Clippy line is best kept as is.",
    },
  },
};
