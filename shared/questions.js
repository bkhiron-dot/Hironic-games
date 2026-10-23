// Starter questions for the Game Designer and the "Improve my game" wizard.
// This file is plain data: change the wording, add options or whole questions.
//
// Each question:  { id, ask, options: [[value, label], ...], multi?, own? }
//   multi: true  → the player can pick more than one
//   own: true    → also show a "✏️ My own idea" box (on by default)

// "About me" answers on each player's profile.
export const LOVES = [
  ["space", "🚀 Space"], ["animals", "🐾 Animals"], ["dinosaurs", "🦖 Dinosaurs"], ["football", "⚽ Football"],
  ["cars", "🏎️ Cars"], ["building", "🧱 Building"], ["ocean", "🌊 Ocean"], ["robots", "🤖 Robots"],
  ["magic", "🧙 Magic"], ["ninjas", "🥷 Ninjas"], ["food", "🍕 Food"], ["music", "🎵 Music"],
  ["bikes", "🚲 Bike riding"], ["surfing", "🏄 Surfing"], ["skateboarding", "🛹 Skateboarding"],
];
export const GAME_TYPES = [
  ["catching", "🧺 Catching"], ["dodging", "☄️ Dodging"], ["racing", "🏁 Racing"], ["puzzles", "🧩 Puzzles"],
  ["quizzes", "❓ Quizzes"], ["platformers", "🍄 Jumping"], ["building", "🏗️ Building"], ["mazes", "🌀 Mazes"],
];

export const GAME_KINDS = [
  ["racing", "🏁 Racing"], ["dodging", "☄️ Dodging"], ["catching", "🧺 Catching"], ["platformers", "🍄 Jumping"],
  ["mazes", "🌀 Mazes"], ["quizzes", "❓ Quizzes"], ["puzzles", "🧩 Puzzles"], ["new", "✨ Something new"],
];

const HOW_TO_MOVE = {
  id: "controls",
  ask: "How do you move? 🕹️",
  options: [
    ["tap-sides", "👆 Tap the left or right side"],
    ["drag", "✋ Drag my finger"],
    ["buttons", "🎮 Big buttons on the screen"],
  ],
};

const LOOK = {
  id: "look",
  ask: "Where does your game happen? 🎨",
  multi: true,
  options: [
    ["city", "🏙️ A big city"], ["ocean", "🌊 By the ocean"], ["space", "🌌 In space"],
    ["jungle", "🌴 In a jungle"], ["snow", "❄️ In the snow"], ["dojo", "🏯 A ninja dojo"],
  ],
};

export const STARTER_QUESTIONS = {
  racing: [
    {
      id: "driver",
      ask: "Who drives the race car? 🏎️",
      options: [["ninja", "🥷 A ninja driver"], ["superhero", "🦸 A superhero driver"], ["football", "⚽ A football with wheels!"]],
    },
    {
      id: "win",
      ask: "How do you win? 🏆",
      multi: true,
      options: [
        ["finish", "🏁 Reach the finish line before the clock runs out"],
        ["overtake", "🏎️ Zoom past as many cars as you can"],
        ["collect", "🍕 Grab pizzas on the track for points"],
      ],
    },
    {
      id: "obstacles",
      ask: "What gets in your way? 😬",
      multi: true,
      options: [
        ["cars", "🚙 Other racing cars"],
        ["oil", "🛢️ Oil puddles and 🚧 cones"],
        ["puddles", "🌊 Big puddles that make you slow and wobbly"],
      ],
    },
    {
      id: "controls",
      ask: "How do you steer? 🕹️",
      options: [["tap-sides", "👆 Tap the left or right side of the screen"], ["drag", "✋ Drag my finger to move the car"]],
    },
  ],
  dodging: [
    { id: "hero", ask: "Who are you? 🦸", options: [["ninja", "🥷 A ninja"], ["shark", "🦈 A shark"], ["rocket", "🚀 A rocket"], ["skater", "🛹 A skateboarder"]] },
    { id: "dodge", ask: "What do you dodge? ☄️", multi: true, options: [["rocks", "🪨 Falling rocks"], ["balls", "⚽ Flying footballs"], ["waves", "🌊 Giant waves"], ["lasers", "🔴 Laser beams"]] },
    { id: "bonus", ask: "What can you grab for bonus points? ⭐", options: [["coins", "🪙 Coins"], ["pizza", "🍕 Pizza"], ["stars", "⭐ Stars"]] },
    HOW_TO_MOVE,
  ],
  catching: [
    { id: "hero", ask: "Who does the catching? 🧺", options: [["goalie", "🧤 A goalkeeper"], ["ninja", "🥷 A ninja"], ["chef", "👨‍🍳 A chef"]] },
    { id: "catch", ask: "What do you catch? 🎯", multi: true, options: [["balls", "⚽ Footballs"], ["food", "🍕 Food"], ["fish", "🐟 Fish"], ["stars", "⭐ Stars"]] },
    { id: "avoid", ask: "What must you NOT catch? 💣", options: [["bombs", "💣 Bombs"], ["socks", "🧦 Smelly socks"], ["none", "😇 Nothing – just catch!"]] },
    HOW_TO_MOVE,
  ],
  platformers: [
    { id: "hero", ask: "Who jumps around? 🍄", options: [["ninja", "🥷 A ninja"], ["skater", "🛹 A skateboarder"], ["frog", "🐸 A frog"], ["robot", "🤖 A robot"]] },
    { id: "goal", ask: "What are you trying to do? 🏆", options: [["flag", "🚩 Reach the flag at the end"], ["collect", "🪙 Collect all the coins"], ["rescue", "🐶 Rescue a lost puppy"]] },
    { id: "danger", ask: "What's dangerous? 😬", multi: true, options: [["gaps", "🕳️ Big gaps"], ["spikes", "🌵 Spiky cactus"], ["baddies", "👾 Silly baddies"]] },
    LOOK,
  ],
  mazes: [
    { id: "hero", ask: "Who is lost in the maze? 🌀", options: [["ninja", "🥷 A ninja"], ["mouse", "🐭 A mouse"], ["diver", "🤿 A diver"]] },
    { id: "goal", ask: "What's at the end? 🏆", options: [["treasure", "💎 Treasure"], ["cheese", "🧀 Cheese"], ["trophy", "🏆 A trophy"]] },
    { id: "danger", ask: "What chases you? 👻", options: [["ghost", "👻 A friendly ghost"], ["crab", "🦀 A grumpy crab"], ["nothing", "😌 Nothing – just find the way"]] },
    HOW_TO_MOVE,
  ],
  quizzes: [
    { id: "topic", ask: "What is the quiz about? ❓", multi: true, options: [["animals", "🐾 Animals"], ["football", "⚽ Football"], ["maths", "➕ Maths"], ["ocean", "🌊 The ocean"], ["space", "🚀 Space"]] },
    { id: "style", ask: "How do you answer? 👆", options: [["tap", "👆 Tap one of 3 answers"], ["truefalse", "✅❌ True or false"], ["race", "⏱️ Answer before the timer runs out"]] },
    { id: "reward", ask: "What happens when you're right? 🎉", options: [["stars", "⭐ You win a star"], ["confetti", "🎊 Confetti!"], ["level", "⬆️ Next level"]] },
  ],
  puzzles: [
    { id: "type", ask: "What kind of puzzle? 🧩", options: [["match", "🍬 Match 3 in a row"], ["slide", "🔀 Slide the pieces"], ["memory", "🃏 Find the matching pairs"]] },
    { id: "theme", ask: "What are the pieces? 🎨", options: [["food", "🍕 Food"], ["animals", "🐾 Animals"], ["sport", "⚽ Sports balls"]] },
    { id: "timer", ask: "Is there a timer? ⏱️", options: [["yes", "⏱️ Yes, beat the clock!"], ["no", "😌 No, take your time"]] },
  ],
  new: [
    { id: "hero", ask: "Who are you in the game? 🦸", options: [["ninja", "🥷 A ninja"], ["animal", "🐾 An animal"], ["athlete", "⚽ A sports star"], ["robot", "🤖 A robot"]] },
    { id: "goal", ask: "How do you win or get points? 🏆", options: [["collect", "🪙 Collect things"], ["race", "🏁 Be the fastest"], ["survive", "💪 Last as long as you can"]] },
    { id: "tricky", ask: "What makes it tricky? 😬", options: [["faster", "⚡ It gets faster"], ["baddies", "👾 Silly baddies"], ["timer", "⏱️ A timer"]] },
    HOW_TO_MOVE,
  ],
};

export const starterQuestionsFor = (kind) => STARTER_QUESTIONS[kind] ?? STARTER_QUESTIONS.new;

// Asked after a player has tested their own game, to plan the next version.
export const REFINE_QUESTIONS = [
  { id: "fun", ask: "Was it fun? 😃", own: false, options: [["super", "😍 Super fun!"], ["ok", "🙂 It's OK"], ["notyet", "😕 Not yet"]] },
  { id: "difficulty", ask: "How hard was it? 💪", own: false, options: [["easy", "🐢 Too easy"], ["right", "👌 Just right"], ["hard", "🔥 Too hard"]] },
  {
    id: "change",
    ask: "What should we change next? 🔧",
    multi: true,
    options: [
      ["character", "🦸 New character"], ["level", "🗺️ New level"], ["powerup", "⚡ Power-up"],
      ["sound", "🔊 Better sounds"], ["look", "🎨 New look"], ["bug", "🐞 Something's broken"],
    ],
  },
];
