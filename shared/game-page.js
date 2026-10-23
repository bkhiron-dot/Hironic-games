// Include on every hand-coded game page (games/<slug>/index.html).
// Points the back button to the right place and shows a banner in test mode.
import { isTestMode } from "./store.js";

const back = document.querySelector(".back-button");
if (isTestMode()) {
  if (back) { back.href = "../../index.html#/test"; back.textContent = "← Back to Test"; }
  const banner = document.createElement("div");
  banner.className = "test-banner";
  banner.textContent = "🧪 TEST MODE – scores aren't saved";
  document.body.append(banner);
}
