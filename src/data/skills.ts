import portfolioData from './portfolioData.json';
export type SkillGroup = { title: string; items: string[] };
export const skillGroups: SkillGroup[] = portfolioData.skills as SkillGroup[];
