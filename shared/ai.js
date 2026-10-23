// Live AI follow-up questions from Claude.
//
// Where Claude comes from:
//   • Test dashboard on claude.ai: the page's built-in "ask Claude" capability,
//     which runs on the viewing grown-up's own Claude account.
//   • Phase 2 (family site): a call to the family backend, which holds the API
//     key so it never reaches a browser. Not built yet.
//   • Anywhere else (e.g. a local test server): no AI, and the designer simply
//     skips the follow-up step.
//
// Claude only ever returns multiple-choice questions here – never open chat.

let samplePromise = null;
function getSample() {
  samplePromise ??= window.claude?.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);
  return samplePromise;
}

/** True when live follow-up questions can be asked on this device. */
export async function aiAvailable() {
  return Boolean(await getSample());
}

/**
 * Ask Claude for 2–3 follow-up questions.
 *   mode "design": a new game idea; mode "refine": feedback after testing.
 * Resolves to questions in the same shape as shared/questions.js, or rejects
 * with { code } (e.g. "unavailable", "not_granted", "rate_limited").
 */
export async function aiFollowUps({ mode, player, title, kind, answers }) {
  const sample = await getSample();
  if (!sample) throw { code: "unavailable" };

  const answerLines = answers.map((a) => `- ${a.ask} → ${a.text}`).join("\n");
  const prompt = `You help children design simple browser games in a family game studio.
The player is ${player.name}, aged ${player.age ?? "7-12"}. They love: ${player.loves || "lots of things"}.
${mode === "refine"
    ? `They just tested their game "${title}" and gave this feedback:`
    : `They are designing a new ${kind} game called "${title}". Their answers so far:`}
${answerLines}

Write 2 or 3 short, fun follow-up questions that help turn this into a clear plan for ${mode === "refine" ? "the next version" : "version 1"} of the game.
Rules:
- Words a ${player.age ?? 7}-year-old can read. Max 12 words per question, 8 words per option.
- Each question has exactly 3 options, each starting with one emoji.
- Ask about things not already answered. Keep version 1 small and buildable.
- Cartoon-level fun only: no violence, weapons, scary or grown-up themes, no personal information.
Reply with only JSON like:
[{"ask": "How many laps is the race? 🏁", "options": ["1️⃣ Just one lap", "3️⃣ Three laps", "♾️ Keep going forever"]}]`;

  try {
    const result = await sample.json(prompt, { modelTier: "quick" });
    return cleanQuestions(result);
  } catch (e) {
    throw { code: e?.code ?? "upstream_error" };
  }
}

// Claude's reply is checked and trimmed before it is shown to a child.
function cleanQuestions(raw) {
  if (!Array.isArray(raw)) throw { code: "invalid_json" };
  const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const questions = raw.slice(0, 3).map((q, i) => ({
    id: `ai${i + 1}`,
    ask: clip(q?.ask, 120),
    fromClaude: true,
    options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4)
      .map((o, j) => [`ai${i + 1}-${j}`, clip(o, 60)])
      .filter(([, label]) => label),
  })).filter((q) => q.ask && q.options.length >= 2);
  if (!questions.length) throw { code: "invalid_json" };
  return questions;
}
