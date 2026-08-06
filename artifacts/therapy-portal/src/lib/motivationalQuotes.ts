export const MOTIVATIONAL_QUOTES = [
  { quote: "Small steps still move you forward.", author: "Ayden's Therapy Services" },
  { quote: "You are allowed to grow at your own pace.", author: "Ayden's Therapy Services" },
  { quote: "Make room for the life you are becoming.", author: "Ayden's Therapy Services" },
  { quote: "Gentleness is a strength, not a setback.", author: "Ayden's Therapy Services" },
  { quote: "You do not have to carry everything at once.", author: "Ayden's Therapy Services" },
  { quote: "Progress can be quiet and still be real.", author: "Ayden's Therapy Services" },
  { quote: "Today is a good day to choose one kind thing for yourself.", author: "Ayden's Therapy Services" },
] as const;

export function getDailyQuote(date = new Date()) {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return MOTIVATIONAL_QUOTES[Math.abs(dayNumber) % MOTIVATIONAL_QUOTES.length];
}