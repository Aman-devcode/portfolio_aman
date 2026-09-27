import portfolioData from './portfolioData.json';
export type EngineeringTopic = { slug: string; title: string; description: string; technologies: string[] };
export const engineeringTopics: EngineeringTopic[] = portfolioData.engineering as EngineeringTopic[];
