export const MOTIVATIONAL_QUOTES = [
  { quote: "Small steps still move you forward.", author: "Aydens Wellness Services" },
  { quote: "You are allowed to grow at your own pace.", author: "Aydens Wellness Services" },
  { quote: "Make room for the life you are becoming.", author: "Aydens Wellness Services" },
  { quote: "Gentleness is a strength, not a setback.", author: "Aydens Wellness Services" },
  { quote: "You do not have to carry everything at once.", author: "Aydens Wellness Services" },
  { quote: "Progress can be quiet and still be real.", author: "Aydens Wellness Services" },
  { quote: "Today is a good day to choose one kind thing for yourself.", author: "Aydens Wellness Services" },
  { quote: "Give yourself permission to begin again.", author: "Aydens Wellness Services" },
  { quote: "Rest is part of the rhythm, not a break from it.", author: "Aydens Wellness Services" },
  { quote: "You can be a work in progress and still be proud.", author: "Aydens Wellness Services" },
  { quote: "One honest step is still a step forward.", author: "Aydens Wellness Services" },
  { quote: "You deserve patience from yourself, too.", author: "Aydens Wellness Services" },
  { quote: "A slower pace can still lead somewhere beautiful.", author: "Aydens Wellness Services" },
  { quote: "Let today be about what is possible, not what was missed.", author: "Aydens Wellness Services" },
  { quote: "You do not need every answer to take the next step.", author: "Aydens Wellness Services" },
  { quote: "Your effort counts, even when the results take time.", author: "Aydens Wellness Services" },
  { quote: "There is strength in asking for the support you need.", author: "Aydens Wellness Services" },
  { quote: "You are allowed to protect your peace.", author: "Aydens Wellness Services" },
  { quote: "Small moments of care add up.", author: "Aydens Wellness Services" },
  { quote: "You can hold hope and uncertainty at the same time.", author: "Aydens Wellness Services" },
  { quote: "Your story is allowed to change.", author: "Aydens Wellness Services" },
  { quote: "You can choose progress without choosing perfection.", author: "Aydens Wellness Services" },
  { quote: "Today does not have to be perfect to be meaningful.", author: "Aydens Wellness Services" },
  { quote: "Notice how far you have come, not only how far you have to go.", author: "Aydens Wellness Services" },
  { quote: "A reset is not a failure; it is a new starting point.", author: "Aydens Wellness Services" },
  { quote: "Keep what helps. Release what no longer does.", author: "Aydens Wellness Services" },
  { quote: "Your needs are worth making room for.", author: "Aydens Wellness Services" },
  { quote: "There is no prize for being hard on yourself.", author: "Aydens Wellness Services" },
  { quote: "The next chapter can start with one small decision.", author: "Aydens Wellness Services" },
  { quote: "You can meet yourself with compassion today.", author: "Aydens Wellness Services" },
  { quote: "A little clarity can come from simply slowing down.", author: "Aydens Wellness Services" },
  { quote: "You are more than the hardest thing you are facing.", author: "Aydens Wellness Services" },
  { quote: "Protect the habits that help you feel like yourself.", author: "Aydens Wellness Services" },
  { quote: "You can make space for joy without earning it first.", author: "Aydens Wellness Services" },
  { quote: "Some days are for building; some are for breathing.", author: "Aydens Wellness Services" },
  { quote: "Your boundaries can be kind and still be firm.", author: "Aydens Wellness Services" },
  { quote: "You are allowed to change your mind and choose what fits now.", author: "Aydens Wellness Services" },
  { quote: "Consistency can look quiet.", author: "Aydens Wellness Services" },
  { quote: "A hopeful day can begin with a manageable one.", author: "Aydens Wellness Services" },
  { quote: "You do not have to prove that you deserve care.", author: "Aydens Wellness Services" },
  { quote: "Make room for small wins.", author: "Aydens Wellness Services" },
  { quote: "You can take your time and still take yourself seriously.", author: "Aydens Wellness Services" },
  { quote: "Your energy is worth spending intentionally.", author: "Aydens Wellness Services" },
  { quote: "There is wisdom in knowing when to pause.", author: "Aydens Wellness Services" },
  { quote: "You can start with what you have today.", author: "Aydens Wellness Services" },
  { quote: "You are not behind; you are moving through your own season.", author: "Aydens Wellness Services" },
  { quote: "Let one good choice make the next one easier.", author: "Aydens Wellness Services" },
  { quote: "Clarity often arrives one honest moment at a time.", author: "Aydens Wellness Services" },
  { quote: "You can care deeply without carrying everything.", author: "Aydens Wellness Services" },
  { quote: "Your progress does not become less real because it is quiet.", author: "Aydens Wellness Services" },
  { quote: "Give yourself credit for showing up.", author: "Aydens Wellness Services" },
  { quote: "You can rebuild without becoming who you were before.", author: "Aydens Wellness Services" },
  { quote: "A calm mind can still hold big dreams.", author: "Aydens Wellness Services" },
  { quote: "You are allowed to make today gentler.", author: "Aydens Wellness Services" },
  { quote: "Keep choosing what helps you thrive.", author: "Aydens Wellness Services" },
  { quote: "The goal is not to rush the process; it is to stay present for it.", author: "Aydens Wellness Services" },
  { quote: "You can make a meaningful day out of ordinary moments.", author: "Aydens Wellness Services" },
  { quote: "Your future self will thank you for the care you choose today.", author: "Aydens Wellness Services" },
  { quote: "Let today be enough for today.", author: "Aydens Wellness Services" },
  { quote: "You can reset without starting from zero.", author: "Aydens Wellness Services" },
  { quote: "There is room for softness in a strong life.", author: "Aydens Wellness Services" },
  { quote: "You are allowed to celebrate how you are growing.", author: "Aydens Wellness Services" },
  { quote: "One steady choice can change the shape of a whole week.", author: "Aydens Wellness Services" },
  { quote: "Keep going in the way that keeps you well.", author: "Aydens Wellness Services" },
] as const;

const STAFF_QUOTE_PAGES = [
  "home",
  "welcome",
  "bookings",
  "clients",
  "wellness",
  "analytics",
  "activity",
  "announcements",
  "support",
  "team",
  "team-chat",
  "messages",
  "client-templates",
  "rollout",
  "notifications",
  "feedback",
  "security",
  "homepage-preview",
  "practice-control",
  "homepage-controls",
  "staff-directory",
  "founder-dashboard",
  "search",
  "system-health",
  "settings",
  "employees",
] as const;

function getDailyIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function getDailyQuote(pageKeyOrDate: string | Date = "global", maybeDate = new Date()) {
  const pageKey = pageKeyOrDate instanceof Date ? "global" : pageKeyOrDate;
  const date = pageKeyOrDate instanceof Date ? pageKeyOrDate : maybeDate;
  const dayNumber = getDailyIndex(date);
  const pageIndex = Math.max(0, STAFF_QUOTE_PAGES.indexOf(pageKey as typeof STAFF_QUOTE_PAGES[number]));
  const quoteIndex = Math.abs((dayNumber * 7 + pageIndex) % MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[quoteIndex];
}

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 21) return "Good evening";
  return "Good night";
}
