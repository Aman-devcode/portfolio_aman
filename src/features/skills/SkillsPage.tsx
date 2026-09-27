import { SectionHeading } from '../../components/ui/SectionHeading';
import { skillGroups as groups } from '../../data/skills';

export default function SkillsPage() {
  return (
    <div className="page-shell container skills-page">
      <header className="skills-header">
        <SectionHeading
          level={1}
          eyebrow="SKILLS / TECH STACK"
          title="Engineering capabilities across product, backend, data and AI."
          description="A working stack aligned to full stack product delivery, dependable backend systems and practical AI implementation."
        />
      </header>

      <div className="skills-matrix" aria-label="Engineering capability matrix">
        {groups.map((group, index) => (
          <article key={group.title} className="skill-capability">
            <div className="skill-capability-header">
              <span className="mono-label">0{index + 1}</span>
              <span className="skill-capability-label">{group.title}</span>
            </div>

            <div className="skill-capability-body">
              <h3>{group.title}</h3>
              <ul className="skill-tag-list" aria-label={`${group.title} technologies`}>
                {group.items.map((item) => (
                  <li key={item} className="skill-tag">{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
} 

