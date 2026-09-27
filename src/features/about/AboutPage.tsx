import { SectionHeading } from '../../components/ui/SectionHeading';
import portfolioData from '../../data/portfolioData.json';

const focusAreas = [
  'Full Stack Engineering',
  'Backend & APIs',
  'AI / LLM Applications',
  'AI Agents / RAG'
];

export default function AboutPage() {
  const { about } = portfolioData;

  return (
    <div className="page-shell container about-page">
      <div className="about-hero">
        <div className="about-copy">
          <SectionHeading
            level={1}
            eyebrow="ABOUT / ENGINEERING PROFILE"
            title="Aman builds full stack products, backend systems, and AI-powered experiences."
            description={about.summary}
          />

          <p className="about-intro">{about.intro}</p>

          <div className="about-roles" aria-label="Aman role list">
            {about.roles.map((role) => (
              <span key={role} className="about-role">{role}</span>
            ))}
          </div>
        </div>

        <aside className="about-profile" aria-label="Engineering focus areas">
          <div className="about-profile-panel">
            <span className="mono-label">ENGINEERING FOCUS</span>
            <ul className="about-focus-list">
              {focusAreas.map((area, index) => (
                <li key={area} className="about-focus-item">
                  <span className="about-focus-index">0{index + 1}</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="about-principles" aria-label="Engineering approach">
        <span className="mono-label">01 / APPROACH</span>
        <div className="about-principles-copy">
          <p>Start with the problem.</p>
          <p>Build with intent.</p>
          <p>Keep improving.</p>
        </div>
      </div>
    </div>
  );
} 

