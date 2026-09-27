export function TechBadge({ name }: { name: string }) { return <span className="tech-badge">{name}</span>; }
export function TechBadgeList({ technologies }: { technologies: string[] }) { return <div className="tech-badge-list">{technologies.map(name => <TechBadge key={name} name={name}/>)}</div>; }
