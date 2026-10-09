// Example scripts for the demo's "try an example" and the extraction eval.
// 01-04 are original writing for this project. 05 is an excerpt of a
// President's remarks (a U.S. Government work, public domain), with stage
// directions removed. 06 is a set of anonymous one-liners that circulate
// freely online.
export interface SampleScript {
  id: string;
  title: string;
  format: string;
  presetId: string;
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

First date, she picks the restaurant: a place in Williamsburg where the menu is a QR code and the chairs are made out of old Peloton bikes. I wanted to go to Olive Garden. You know why? Because when you're here, you're family. Nobody at that place in Williamsburg was family. They were barely employees.

She asks what I'm into. I panic and say, "I'm really into The Sopranos." She says, "Is that a podcast?" I said no, it's a show about a man with crippling anxiety who's in therapy because his mom doesn't love him. She said, "Oh. So it's a podcast."

I tried to be cool. I said I love Bad Bunny. She said, "Name one song." I said "Despacito." That's not him. That's not even the right decade of my shame.

Then she tells me she's a Swiftie. And I'm thinking, okay, I can do this. My niece made me watch the Eras Tour movie in a theater for three hours. So I say, "My favorite era is the one where she dated the guy from One Direction." She just stood up. Didn't say a word. Left like Thanos snapped her out of the restaurant.

Second date, different woman, she's my age. Thank God. We spent two hours talking about Blockbuster late fees. It was the most romantic night of my life. We held hands and grieved Tower Records. She said, "Remember when you had to rewind the tapes?" and I said, "Be kind, rewind," and she said that's the hottest thing a man has ever said to her.

We're getting married. The reception is at a Cracker Barrel. The registry is just Tupperware and a Costco membership.
`,
  },
  {
    id: "02-keynote",
    title: "Software people actually love",
    format: "Conference keynote",
    presetId: "corporate",
    cities: ["San Francisco, CA"],
    text: `Good morning! I know some of you came here straight from the airport, and some of you came straight from the hotel bar, and I respect both journeys.

When I started in this industry, the cutting-edge device was a BlackBerry, and we thought Clippy was the future of artificial intelligence. "It looks like you're writing a letter!" Yes, Clippy. It's my resignation letter.

Today our phones know us better than our families do. Spotify knows I've played "Mr. Brightside" four hundred times this year. The Duolingo owl knows I abandoned Spanish on day eleven, and it texts me like a disappointed parent. And Netflix keeps asking, "Are you still watching?", which is the most personal question anyone has asked me since 2019.

So the question for the next decade isn't whether software will understand us. It will. The question is whether we'll build something people actually love, the way people loved the first iPod, the way people loved Breaking Bad, the way people still love a well-made sandwich from Pret.

Steve Jobs said, "Stay hungry, stay foolish." I've got foolish covered. I'm working on hungry. Let's build something today that Jony Ive would be jealous of and that your grandmother could use without calling you.

Let's get started.
`,
  },
  {
    id: "03-best-man",
    title: "Mike and Jess",
    format: "Best man toast",
    presetId: "wedding",
    cities: ["Columbus, OH"],
    text: `For those who don't know me, I'm Danny, Mike's best friend since third grade, when we bonded over Pokémon cards and a shared fear of Mrs. Patterson.

Mike has always been a romantic. In college he made Jess a mixtape. It was a Spotify playlist, but he called it a mixtape, and it had Ed Sheeran on it six times. Six! Jess, if you ever wondered whether he was serious, that's a man who heard "Perfect" on repeat and thought, yes, this is my strategy.

Their first date was at Chipotle. Mike paid extra for guac. If you know Mike, you know that's basically a proposal.

He planned the real proposal in Paris, under the Eiffel Tower, like a Hallmark movie. It rained. He slipped. Jess said yes while he was lying in a puddle, which is the most honest picture of marriage I've ever seen.

Jess, you're getting a man who can quote every episode of The Office, who still thinks Fortnite counts as cardio, and who will drive four hours to see Coldplay and cry during "Fix You" every single time. Mike, you're marrying someone way out of your league, like LeBron showing up to pickup at the Y.

So please raise your glasses. To Mike and Jess: may your love be like Taco Bell at 2 a.m. Unexpected, a little reckless, and somehow exactly what you needed.
`,
  },
  {
    id: "04-lecture",
    title: "Probability, day one",
    format: "Lecture opener",
    presetId: "college",
    cities: ["Ann Arbor, MI"],
    text: `Alright everyone, settle in. Today we're talking about probability, and I want to start with a story.

Back when I was your age, we didn't have Google. We had Ask Jeeves, and Jeeves did not know the answer. If you wanted to settle an argument about who sang a song, you called the radio station or you waited for the next episode of TRL.

Think about Who Wants to Be a Millionaire. Regis Philbin asks a contestant a question with four options. She has no idea. She uses her 50:50 lifeline. What's the probability she guesses right now? One half. That's the whole lecture. You can go home.

No? Okay, let's make it harder. Remember Deal or No Deal? Howie Mandel, twenty-six briefcases, and a mysterious banker on the phone. Should you take the deal? That depends on expected value, which is the most important idea in this course, and also the reason Las Vegas can afford the fountains at the Bellagio.

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
