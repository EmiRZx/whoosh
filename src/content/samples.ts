// Example scripts for the demo's "try an example". 01-04 and 07 are original
// writing for this project. 05 is an excerpt of a President's remarks (a U.S.
// Government work, public domain), with stage directions removed. 06 is a set
// of anonymous one-liners that circulate freely online.
// The extraction eval keeps its own copy of the texts its gold set was
// written for (evals/extraction/texts.json).
export interface SampleScript {
  id: string;
  title: string;
  format: string;
  presetId: string;
  // A performer whose fans are the room, instead of the preset.
  performer?: { id: string; name: string };
  cities: string[];
  text: string;
}

export const SAMPLES: SampleScript[] = [
  {
    id: "01-dating-set",
    title: "Back on the apps at 38",
    format: "Stand-up set",
    presetId: "college",
    cities: ["Austin, TX", "Birmingham, AL"],
    text: `I'm 38 and I'm back on the dating apps. Hinge, Bumble, all of them. My profile says I'm "a Ross looking for a Rachel." Nobody under 30 knows what that means. A 24-year-old matched with me and asked if Ross was a discount store. Which, honestly, is also accurate.

First date, she picks the restaurant: a place where the menu is a QR code and the chairs are made out of old Peloton bikes. I wanted to go to Olive Garden. You know why? Because when you're here, you're family. Nobody at that place was family. They were barely employees.

She asks what I'm into. I panic and say, "I'm really into The Sopranos." She says, "Is that a podcast?" I said no, it's a show about a man with crippling anxiety who's in therapy because his mom doesn't love him. She said, "Oh. So it's a podcast."

So I try to be cool. I tell her my first concert was 98 Degrees, my second was O-Town, and I once waited three hours in the rain to meet Carrot Top. She looked at me like I'd described a war. I said my first crush was Zack Morris. She said, "Is he on Love Island?"

Then she tells me she's a Swiftie. And I'm thinking, okay, I can do this. My niece made me watch the Eras Tour movie in a theater for three hours. So I say, "My favorite era is the one where she dated the guy from One Direction." She just stood up. Didn't say a word. Left like Thanos snapped her out of the restaurant.

Second date, different woman, she's my age. Thank God. We spent two hours talking about Blockbuster late fees and the Sbarro at the mall. It was the most romantic night of my life. We held hands and grieved Tower Records. She said, "Remember when you had to rewind the tapes?" and I said, "Be kind, rewind," and she said that's the hottest thing a man has ever said to her. We fell asleep at four in the afternoon watching Judge Judy, like a real couple.

We're getting married. The reception is at a Cracker Barrel. The registry is just Tupperware and a Costco membership. And for the honeymoon we're driving to a Whataburger at 2 a.m. in matching Ed Hardy, because some of us never grew up, and we're not about to start now.
`,
  },
  {
    id: "07-cedric-opener",
    title: "Opening for Cedric",
    format: "Opening set",
    presetId: "general",
    performer: { id: "3B124908-B8E6-4CF2-8D3E-2E024CD78BBE", name: "Cedric the Entertainer" },
    cities: ["St. Louis, MO", "Atlanta, GA"],
    text: `How y'all doing tonight? I'm Jordan. I'm twenty-six, which means I'm the only person in this building who had to Google who I'm opening for. Don't worry, I know now. My uncle sat me down and made me watch The Original Kings of Comedy, then Barbershop, then every episode of Martin, and when it was over he said, "Now you're allowed to be here."

I said, "Cool. Can I DoorDash a snack?" He said, "We don't DoorDash in this family. We go to Waffle House like Americans."

My generation is different. We don't have uncles. We have Kai Cenat. I got my financial advice from TikTok. I get my emotional support from a forty-ounce Stanley cup. My last girlfriend and I broke up over a Crumbl cookie, and if you've had one, you know I was right.

My mom is trying to keep up. She downloaded Duolingo to learn Spanish, and now the owl sends her threatening messages at two in the morning, and she answers them. She asked me what Twitch is. I said it's a website where you watch other people play video games. She said, "So it's like when your daddy watches Family Feud and yells at Steve Harvey." And honestly? Yes. That's exactly what it is.

I went to Erewhon once. It's a grocery store in LA where a smoothie costs nineteen dollars. Nineteen dollars! For that money I could feed a family of four at Cracker Barrel and still buy a rocking chair on the way out.

And my ex made me watch Love Island with her every night. Every night! Hot people on an island, yelling at each other about who took whose cereal. I said, "Baby, I can get that at a cookout, and the food is better."

Shout out to St. Louis, by the way. My Uber driver played Nelly the whole way here and charged me extra for the emotional damage. Y'all have been beautiful. Please welcome one of the Original Kings of Comedy, the man himself, Cedric the Entertainer!
`,
  },
  {
    id: "02-keynote",
    title: "Software people actually love",
    format: "Conference keynote",
    presetId: "corporate",
    cities: ["San Francisco, CA", "New York City, NY"],
    text: `Good morning! I know some of you came here straight from the airport, and some of you came straight from the hotel bar, and I respect both journeys.

When I started in this industry, the cutting-edge device was a BlackBerry, our chat app was AOL, and I bought my first webcam at a RadioShack. Today I have Slack on my laptop, Microsoft Teams on my other laptop, and a Notion page explaining which one we actually use.

Our phones know us better than our families do. Spotify knows I've played "Mr. Brightside" four hundred times this year. The Duolingo owl knows I abandoned Spanish on day eleven, and it texts me like a disappointed parent. And Netflix keeps asking, "Are you still watching?", which is the most personal question anyone has asked me since 2019.

My team is younger than me, so now I learn things in meetings. Last week I found out that Kai Cenat is not a cereal, that Love Island is a show and not a vacation package, and that our designer's water bottle is a Stanley, it cost more than my first car, and if I touch it I'm fired.

This industry moves in cycles. We did WeWork, and we all learned what "community-adjusted EBITDA" means. We did Clubhouse for about six weeks in 2021. We will do it again. Silicon Valley, the show, was a documentary. Succession is a training video.

So the question for the next decade isn't whether software will understand us. It will. The question is whether we'll build something people actually love, the way people loved the first iPod, the way people still love an oat latte from Blue Bottle, the way people love a pair of Allbirds right up until they see their dad wearing them.

Steve Jobs said, "Stay hungry, stay foolish." I've got foolish covered. I'm working on hungry. Let's get started.
`,
  },
  {
    id: "03-best-man",
    title: "Mike and Jess",
    format: "Best man toast",
    presetId: "wedding",
    cities: ["Columbus, OH", "Pittsburgh, PA"],
    text: `For those who don't know me, I'm Danny, Mike's best friend since third grade, when we bonded over Pokémon cards and a shared fear of Mrs. Patterson.

Mike is from Pittsburgh. Jess is from Columbus. For a while we weren't sure this could work. Mike thinks Sheetz is fine dining. Jess thinks Skyline Chili is a food group. Mike bleeds black and gold for the Steelers, and Jess grew up with a dad who still says the Browns are one year away. They've been one year away since I was born.

Mike has always been a romantic. In college he made Jess a mixtape. It was a Spotify playlist, but he called it a mixtape, and it had Ed Sheeran on it six times. Six! Jess, if you ever wondered whether he was serious, that's a man who heard "Perfect" on repeat and thought, yes, this is my strategy.

Their first date was at Chipotle. Mike paid extra for guac. If you know Mike, you know that's basically a proposal. Their second date was at Hooters, which Mike still calls "ironic." Jess went home and watched The Notebook alone, and for reasons none of us will ever understand, she called him back.

He planned the real proposal in Paris, under the Eiffel Tower, like a Hallmark movie. It rained. He slipped. Jess said yes while he was lying in a puddle, which is the most honest picture of marriage I've ever seen.

Jess, you're getting a man who can quote every episode of The Office, who owns more Ed Hardy than any grown adult should, and who still yells at Family Feud like Steve Harvey can hear him. Mike, you're marrying a woman who reads Zillow listings for fun and once drove forty minutes for a pint of Graeter's. You are way out of your league, buddy.

So please raise your glasses. To Mike and Jess: may your love be like Eat'n Park at 2 a.m. Warm, a little reckless, and somehow exactly what you needed.
`,
  },
  {
    id: "04-lecture",
    title: "Probability, day one",
    format: "Lecture opener",
    presetId: "college",
    cities: ["Ann Arbor, MI"],
    text: `Alright everyone, settle in. Today we're talking about probability, and I'm going to teach it the way I learned it: from game shows.

Back when I was your age, we didn't have Google. We had Ask Jeeves, and Jeeves did not know the answer. So we learned about chance from daytime TV.

Start with The Price Is Right. Bob Barker hands you a Plinko chip, you drop it from the top, and it bounces off a dozen pegs on the way down. Where does it land? Usually somewhere in the middle. That's a bell curve. You just learned half a semester of statistics from a man who also reminded you to spay and neuter your pets.

Then there's Let's Make a Deal. Monty Hall shows you three doors. Behind one is a car, behind the other two are goats. You pick a door, Monty opens one of the others, and there's a goat. Should you switch? Yes. Always switch. It doubles your odds, and people with PhDs once wrote angry letters to a magazine insisting it doesn't. They were wrong. It will be on the midterm.

Wheel of Fortune? Vanna White turning letters is just conditional probability with better lighting. On Who Wants to Be a Millionaire, Regis Philbin asks a question with four options, you use your 50:50 lifeline, and now it's a coin flip. And on Deal or No Deal, Howie Mandel gives you twenty-six briefcases and a banker on the phone. Should you take the deal? That depends on expected value, which is the most important idea in this course, and also the reason Las Vegas can afford the fountains at the Bellagio and DraftKings can afford every ad you've ever skipped.

If you're thinking, "I'll just be like Ken Jennings on Jeopardy and memorize everything," the math says you won't. The math also says the Detroit Lions will break your heart in January, and the math has been right a lot.

Your homework is on Canvas. And no, ChatGPT can't do it for you. Well, it can, but it'll be confidently wrong, like my fantasy football picks every season.
`,
  },
  {
    id: "05-presidential-roast",
    title: "The 2016 Correspondents' Dinner",
    format: "Presidential roast",
    presetId: "college",
    cities: ["Washington, DC"],
    text: `Anyway, here we are. My eighth and final appearance at this unique event. And I am excited. If this material works well, I'm going to use it at Goldman Sachs next year. Earn me some serious Tubmans. That's right.

My brilliant and beautiful wife Michelle is here tonight. She looks so happy to be here. That's called practice. It's like learning to do 3-minute planks. She makes it look easy now.

I won't lie: Look, this is a tough transition. It's hard. Key staff are now starting to leave the White House. Even reporters have left me. Savannah Guthrie, she's left the White House Press Corps to host the "Today" show. Norah O'Donnell left the briefing room to host "CBS This Morning." Jake Tapper left journalism to join CNN.

I also would like to acknowledge some of the award-winning reporters that we have with us here tonight: Rachel McAdams, Mark Ruffalo, Liev Schreiber. Thank you all for everything that you've done. I'm just joking. As you know, "Spotlight" is a film, a movie about investigative journalists with the resources and the autonomy to chase down the truth and hold the powerful accountable. Best fantasy film since "Star Wars." Look, that was maybe a cheap shot.

I understand the news business is tough these days, it keeps changing all the time. Every year at this dinner, somebody makes a joke about BuzzFeed, for example, changing the media landscape. And every year, the Washington Post laughs a little bit less hard.

Kendall Jenner is also here. And we had a chance to meet her backstage. She seems like a very nice young woman. I'm not exactly sure what she does, but I am told that my Twitter mentions are about to go through the roof.

Look, I've said how much I admire Hillary's toughness, her smarts and her policy chops, her experience. You've got to admit it, though, Hillary trying to appeal to young voters is a little bit like your relative who just signed up for Facebook. "Dear America, did you get my poke?" "Is it appearing on your wall?" "I'm not sure I am using this right. Love, Aunt Hillary." It's not entirely persuasive.
`,
  },
  {
    id: "06-one-liners",
    title: "Internet one-liners, circa 2015",
    format: "Folk jokes",
    presetId: "college",
    cities: [],
    text: `Why did the Star Wars movies come out in the order 4, 5, 6, 1, 2, 3? Because in charge of scheduling, Yoda was.

To whoever stole my copy of Microsoft Office: I will find you. You have my Word.

What's the difference between Game of Thrones and Twitter? With Twitter you only get 140 characters.

Arnold Schwarzenegger was asked if he wanted to upgrade to Windows 10. He said, "I still love Vista, baby."

Rick Astley will let you borrow any movie from his Pixar collection, except one. He's never gonna give you Up.

What concert costs 45 cents? 50 Cent featuring Nickelback.

Walter White bought a pizza for his son. "Thanks, Dad, how much do I owe you?" "It's on the house."

If you watch Jeopardy backwards, it's about rich people paying money for answers to questions.

I stepped on a rusty Lego the other day. I'm worried I might have contracted Tetris.
`,
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id);
