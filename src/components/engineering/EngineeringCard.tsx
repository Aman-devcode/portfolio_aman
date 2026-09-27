import { Card } from '../ui/Card';
import type { EngineeringTopic } from '../../data/engineering';

export function EngineeringCard({ topic, index }: { topic: EngineeringTopic; index: number }) {
  return (
    <Card className="engineering-card engineering-step">
      <div className="engineering-step-top">
        <span className="engineering-index">0{index + 1}</span>
        <span className="engineering-step-kicker">workflow</span>
      </div>

      <div className="engineering-step-body">
        <h3>{topic.title}</h3>
        <p>{topic.description}</p>
      </div>

      <ul className="engineering-tech-list" aria-label={`${topic.title} technologies`}>
        {topic.technologies.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
    </Card>
  );
}
