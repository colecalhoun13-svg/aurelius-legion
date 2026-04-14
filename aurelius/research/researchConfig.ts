// research/researchConfig.ts
/**
 * Research Config — Aurelius OS v3.4
 * Controls cost-aware research behavior.
 */

export const ResearchConfig = {
  // Turn Perplexity on/off globally
  enablePerplexity: true,

  // Topics where Perplexity is worth the cost
  highValueTopics: [
    "business",
    "strategy",
    "finance",
    "wealth",
    "investment",
    "ai",
    "artificial intelligence",
    "machine learning",
    "performance science",
    "athlete performance",
    "training",
    "strength",
    "speed",
    "power"
  ],

  // Whether weekly loop should always use Perplexity
  weeklyUsesPerplexity: true,

  // Whether daily loop should use Perplexity by default
  dailyUsesPerplexity: false
};

export function isHighValueTopic(topic: string): boolean {
  const lower = topic.toLowerCase();
  return ResearchConfig.highValueTopics.some((t) => lower.includes(t));
}
