// Recorded gut calls for the example scripts in their default rooms, made by
// the gut prompt (src/lib/analysis/gut.ts) on claude-opus-5-5 before any Qloo
// data was looked at. Keyed by sample, then room preset, then reference name.
import type { RawGutCall } from "@/lib/analysis/gut";

export const RECORDED_GUT: Record<string, Record<string, Record<string, Omit<RawGutCall, "id">>>> = {
  "01-dating-set": {
    "college": {
      "Hinge": {
        "verdict": "lands",
        "room_vs_average": 45,
        "biggest_fans": "25_to_29",
        "reason": "Undergrads know and use dating apps; Hinge is core young-adult territory."
      },
      "Bumble": {
        "verdict": "lands",
        "room_vs_average": 35,
        "biggest_fans": "25_to_29",
        "reason": "Well-known dating app among students, slightly older-skewing than Hinge."
      },
      "Friends": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Streaming kept Friends alive; Gen Z knows Ross and Rachel well."
      },
      "Williamsburg": {
        "verdict": "risky",
        "room_vs_average": 10,
        "biggest_fans": "25_to_29",
        "reason": "Hipster Brooklyn shorthand known to some; non-New Yorkers may miss it."
      },
      "Peloton": {
        "verdict": "risky",
        "room_vs_average": -20,
        "biggest_fans": "35_to_44",
        "reason": "Known brand, but pricey home fitness is a thirties-plus thing."
      },
      "Olive Garden": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "45_to_54",
        "reason": "Everyone knows breadsticks; students like it, slogan slightly less familiar."
      },
      "The Sopranos": {
        "verdict": "risky",
        "room_vs_average": -15,
        "biggest_fans": "35_to_44",
        "reason": "Meme revival reached some young guys, but core fans are older."
      },
      "Bad Bunny": {
        "verdict": "lands",
        "room_vs_average": 80,
        "biggest_fans": "24_and_younger",
        "reason": "Biggest artist for this age group; they'll instantly catch the wrong song."
      },
      "Luis Fonsi": {
        "verdict": "risky",
        "room_vs_average": 0,
        "biggest_fans": "25_to_29",
        "reason": "Everyone knows Despacito; fewer know the artist's name to get the correction."
      },
      "Taylor Swift": {
        "verdict": "lands",
        "room_vs_average": 50,
        "biggest_fans": "24_and_younger",
        "reason": "Swifties are heavily concentrated in this room; Eras Tour is theirs."
      },
      "Harry Styles": {
        "verdict": "lands",
        "room_vs_average": 60,
        "biggest_fans": "24_and_younger",
        "reason": "One Direction and Harry are this generation's pop royalty."
      },
      "Avengers: Infinity War": {
        "verdict": "lands",
        "room_vs_average": 30,
        "biggest_fans": "24_and_younger",
        "reason": "Thanos snap is a universal meme for the Marvel-raised generation."
      },
      "Blockbuster": {
        "verdict": "risky",
        "room_vs_average": -40,
        "biggest_fans": "35_to_44",
        "reason": "They know it as a meme, but never paid late fees."
      },
      "Tower Records": {
        "verdict": "dead",
        "room_vs_average": -70,
        "biggest_fans": "45_to_54",
        "reason": "Closed before most were born; few undergrads know the name."
      },
      "Cracker Barrel": {
        "verdict": "risky",
        "room_vs_average": -30,
        "biggest_fans": "55_and_older",
        "reason": "Known as a road-trip old-people spot; not their thing."
      },
      "Tupperware": {
        "verdict": "risky",
        "room_vs_average": -30,
        "biggest_fans": "55_and_older",
        "reason": "Generic word they know, but brand feels like their grandma's."
      },
      "Costco": {
        "verdict": "lands",
        "room_vs_average": -10,
        "biggest_fans": "35_to_44",
        "reason": "Students love the hot dog combo; membership as registry still reads."
      }
    }
  },
  "02-keynote": {
    "corporate": {
      "BlackBerry": {
        "verdict": "lands",
        "room_vs_average": 20,
        "biggest_fans": "45_to_54",
        "reason": "Corporate 35-54 crowd lived on BlackBerrys; instant nostalgic recognition."
      },
      "Microsoft Office": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "45_to_54",
        "reason": "Everyone in an office knows Office; Clippy is shared workplace nostalgia."
      },
      "Spotify": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "24_and_younger",
        "reason": "Ubiquitous; Wrapped-style stats are widely known, skews younger than this room."
      },
      "The Killers": {
        "verdict": "lands",
        "room_vs_average": 20,
        "biggest_fans": "30_to_34",
        "reason": "Mr. Brightside is the millennial anthem; room's core age bracket owns it."
      },
      "Duolingo": {
        "verdict": "lands",
        "room_vs_average": 0,
        "biggest_fans": "24_and_younger",
        "reason": "Guilt-tripping owl meme is broadly known; older slice may miss it."
      },
      "Netflix": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Universal; everyone has seen the 'Are you still watching?' prompt."
      },
      "Apple": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "24_and_younger",
        "reason": "First iPod is a beloved touchstone for this professional, iPhone-heavy room."
      },
      "Breaking Bad": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "35_to_44",
        "reason": "Peak-TV favorite of exactly this room's largest age group."
      },
      "Pret A Manger": {
        "verdict": "risky",
        "room_vs_average": 25,
        "biggest_fans": "25_to_29",
        "reason": "Limited US footprint; business travelers know it, many attendees won't."
      },
      "Steve Jobs": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "35_to_44",
        "reason": "Keynote-loving corporate crowd knows the Stanford quote by heart."
      },
      "Jony Ive": {
        "verdict": "risky",
        "room_vs_average": 20,
        "biggest_fans": "35_to_44",
        "reason": "Tech and design people know him; much of the room won't."
      }
    }
  },
  "03-best-man": {
    "wedding": {
      "Pokémon": {
        "verdict": "lands",
        "room_vs_average": 20,
        "biggest_fans": "25_to_29",
        "reason": "Millennial childhood staple; the big 25-34 block grew up with it."
      },
      "Spotify": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "24_and_younger",
        "reason": "Universal streaming app; younger-skewed room uses it daily."
      },
      "Ed Sheeran": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "25_to_29",
        "reason": "Wedding-playlist staple; \"Perfect\" is known across generations."
      },
      "Chipotle": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "25_to_29",
        "reason": "Millennial lunch default; extra-guac joke is widely shared."
      },
      "Paris": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Universal romantic cliché; everyone gets the proposal setup."
      },
      "Eiffel Tower": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Iconic proposal landmark; instantly understood by every age."
      },
      "Hallmark Channel": {
        "verdict": "risky",
        "room_vs_average": -20,
        "biggest_fans": "55_and_older",
        "reason": "Everyone knows the trope, but only older relatives actually watch."
      },
      "The Office": {
        "verdict": "lands",
        "room_vs_average": 25,
        "biggest_fans": "25_to_29",
        "reason": "Endlessly rewatched by millennials; core of this room adores it."
      },
      "Fortnite": {
        "verdict": "risky",
        "room_vs_average": 5,
        "biggest_fans": "24_and_younger",
        "reason": "Name recognized, but mostly a younger crowd's game; older half indifferent."
      },
      "Coldplay": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "30_to_34",
        "reason": "\"Fix You\" crying is relatable for 30s crowd; broadly known."
      },
      "LeBron James": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Household name; superstar-vs-amateur contrast works for everyone."
      },
      "YMCA": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "55_and_older",
        "reason": "Everyone knows \"the Y\" pickup game; humble gym image is universal."
      },
      "Taco Bell": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "24_and_younger",
        "reason": "2 a.m. Taco Bell is a shared young-adult ritual."
      }
    }
  },
  "04-lecture": {
    "college": {
      "Google": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "25_to_29",
        "reason": "Universal default tool; students use it constantly, the contrast works instantly."
      },
      "Ask Jeeves": {
        "verdict": "dead",
        "room_vs_average": -70,
        "biggest_fans": "35_to_44",
        "reason": "Faded before these students were born; at best a vague meme name."
      },
      "TRL": {
        "verdict": "dead",
        "room_vs_average": -75,
        "biggest_fans": "35_to_44",
        "reason": "Peaked around 2000, ended 2008; undergrads never watched it."
      },
      "Who Wants to Be a Millionaire": {
        "verdict": "risky",
        "room_vs_average": -35,
        "biggest_fans": "55_and_older",
        "reason": "Format known through memes and lifelines, but not their show."
      },
      "Regis Philbin": {
        "verdict": "dead",
        "room_vs_average": -80,
        "biggest_fans": "55_and_older",
        "reason": "Older TV host, died 2020; most undergrads can't place him."
      },
      "Deal or No Deal": {
        "verdict": "risky",
        "room_vs_average": -20,
        "biggest_fans": "35_to_44",
        "reason": "Childhood background TV and memes; format familiar, little real affection."
      },
      "Howie Mandel": {
        "verdict": "risky",
        "room_vs_average": -25,
        "biggest_fans": "45_to_54",
        "reason": "Some know him from America's Got Talent; not a youth figure."
      },
      "Las Vegas": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "25_to_29",
        "reason": "Everyone gets Vegas equals gambling; many are too young to go."
      },
      "Bellagio": {
        "verdict": "risky",
        "room_vs_average": -30,
        "biggest_fans": "35_to_44",
        "reason": "Fountains vaguely known via Ocean's Eleven; many won't picture it."
      },
      "Canvas": {
        "verdict": "lands",
        "room_vs_average": 300,
        "biggest_fans": "24_and_younger",
        "reason": "Every undergrad lives in Canvas daily; instant shared groan."
      },
      "ChatGPT": {
        "verdict": "lands",
        "room_vs_average": 60,
        "biggest_fans": "24_and_younger",
        "reason": "Students use it heavily for homework; the cheating jab hits home."
      }
    }
  },
  "05-presidential-roast": {
    "college": {
      "Goldman Sachs": {
        "verdict": "risky",
        "room_vs_average": -10,
        "biggest_fans": "25_to_29",
        "reason": "Known by name, but Wall Street is mostly business-major territory here."
      },
      "Harriet Tubman": {
        "verdict": "lands",
        "room_vs_average": 10,
        "biggest_fans": "24_and_younger",
        "reason": "Fresh from school history lessons; young progressive crowd admires her."
      },
      "Savannah Guthrie": {
        "verdict": "risky",
        "room_vs_average": -45,
        "biggest_fans": "55_and_older",
        "reason": "Morning TV host; undergrads barely watch network TV."
      },
      "Today": {
        "verdict": "risky",
        "room_vs_average": -40,
        "biggest_fans": "55_and_older",
        "reason": "Known brand, but network morning shows are their parents' thing."
      },
      "Norah O'Donnell": {
        "verdict": "dead",
        "room_vs_average": -65,
        "biggest_fans": "55_and_older",
        "reason": "Network news anchor few college students could name."
      },
      "CBS This Morning": {
        "verdict": "dead",
        "room_vs_average": -65,
        "biggest_fans": "55_and_older",
        "reason": "Renamed, older-skewing morning show; off this room's radar."
      },
      "Jake Tapper": {
        "verdict": "risky",
        "room_vs_average": -40,
        "biggest_fans": "55_and_older",
        "reason": "Politics-junkie students know him; most of the room doesn't."
      },
      "CNN": {
        "verdict": "risky",
        "room_vs_average": -25,
        "biggest_fans": "55_and_older",
        "reason": "Everyone knows CNN, but cable news viewership skews old."
      },
      "Rachel McAdams": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Mean Girls and The Notebook keep her beloved by young women."
      },
      "Mark Ruffalo": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "25_to_29",
        "reason": "The Hulk; MCU made him familiar and liked by young adults."
      },
      "Liev Schreiber": {
        "verdict": "dead",
        "room_vs_average": -45,
        "biggest_fans": "45_to_54",
        "reason": "Ray Donovan star; most undergrads couldn't place his face."
      },
      "Spotlight": {
        "verdict": "risky",
        "room_vs_average": -30,
        "biggest_fans": "55_and_older",
        "reason": "2015 prestige drama from their childhood; some film students know it."
      },
      "Star Wars": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "35_to_44",
        "reason": "Universal pop culture; the sequels and Disney+ kept it alive for them."
      },
      "BuzzFeed": {
        "verdict": "risky",
        "room_vs_average": 0,
        "biggest_fans": "30_to_34",
        "reason": "Faded millennial brand; they know quizzes and Unsolved, not the newsroom."
      },
      "The Washington Post": {
        "verdict": "risky",
        "room_vs_average": -25,
        "biggest_fans": "55_and_older",
        "reason": "Known legacy paper, but students rarely read or subscribe."
      },
      "Kendall Jenner": {
        "verdict": "lands",
        "room_vs_average": 30,
        "biggest_fans": "24_and_younger",
        "reason": "Kardashian-Jenner fame and Instagram dominance hit this age group squarely."
      },
      "Twitter": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Now X, but they know it and still use it for buzz."
      },
      "Facebook": {
        "verdict": "risky",
        "room_vs_average": -45,
        "biggest_fans": "55_and_older",
        "reason": "They know it but see it as their aunt's platform."
      }
    }
  },
  "06-one-liners": {
    "college": {
      "Star Wars": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "35_to_44",
        "reason": "Universally known; Yoda speech is meme-familiar, though millennials love it more."
      },
      "Microsoft Office": {
        "verdict": "lands",
        "room_vs_average": 0,
        "biggest_fans": "45_to_54",
        "reason": "Students live in Word for essays; everyone gets the pun."
      },
      "Game of Thrones": {
        "verdict": "risky",
        "room_vs_average": -15,
        "biggest_fans": "30_to_34",
        "reason": "Ended when they were young teens; known by name, not watched widely."
      },
      "Twitter": {
        "verdict": "risky",
        "room_vs_average": -10,
        "biggest_fans": "25_to_29",
        "reason": "Known, but they're on TikTok and Instagram; 140-character limit feels ancient."
      },
      "Arnold Schwarzenegger": {
        "verdict": "risky",
        "room_vs_average": -30,
        "biggest_fans": "45_to_54",
        "reason": "Recognizable name and accent, but his heyday predates them entirely."
      },
      "Microsoft Windows": {
        "verdict": "risky",
        "room_vs_average": -10,
        "biggest_fans": "45_to_54",
        "reason": "Everyone uses Windows, but Vista's reputation is before their time."
      },
      "Rick Astley": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "45_to_54",
        "reason": "Rickroll is internet canon for this crowd, even if the music isn't."
      },
      "Pixar": {
        "verdict": "lands",
        "room_vs_average": 20,
        "biggest_fans": "24_and_younger",
        "reason": "Grew up on Pixar; strong nostalgic affection in this room."
      },
      "Up": {
        "verdict": "lands",
        "room_vs_average": 15,
        "biggest_fans": "25_to_29",
        "reason": "A childhood staple; the opening montage is famously beloved."
      },
      "50 Cent": {
        "verdict": "risky",
        "room_vs_average": -15,
        "biggest_fans": "35_to_44",
        "reason": "Known via memes and birthday song, but his peak was 2003."
      },
      "Nickelback": {
        "verdict": "risky",
        "room_vs_average": -25,
        "biggest_fans": "35_to_44",
        "reason": "They know the 'photograph' meme; the hate-joke is a millennial bit."
      },
      "Breaking Bad": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "25_to_29",
        "reason": "Still huge on streaming and memes; pizza-on-roof scene is iconic."
      },
      "Jeopardy!": {
        "verdict": "risky",
        "room_vs_average": -40,
        "biggest_fans": "55_and_older",
        "reason": "They know the format, but it's their grandparents' show."
      },
      "Lego": {
        "verdict": "lands",
        "room_vs_average": 5,
        "biggest_fans": "24_and_younger",
        "reason": "Universal childhood toy; stepping-on-Lego pain is a shared meme."
      },
      "Tetris": {
        "verdict": "lands",
        "room_vs_average": -5,
        "biggest_fans": "35_to_44",
        "reason": "Everyone knows Tetris; the tetanus pun reads instantly."
      },
      "Terminator 2: Judgment Day": {
        "verdict": "risky",
        "room_vs_average": -35,
        "biggest_fans": "45_to_54",
        "reason": "Catchphrase survives by osmosis, but few have actually watched the film."
      }
    }
  }
};
