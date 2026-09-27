import { Bot, BrainCircuit, Network } from 'lucide-react';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { Card } from '../../components/ui/Card';
const items = [{ title: 'Portfolio AI', text: 'Concept for an assistant that can help visitors explore portfolio information.', icon: BrainCircuit }, { title: 'RAG', text: 'Exploration of retrieval augmented generation and grounded responses.', icon: Network }, { title: 'AI Agents', text: 'Experiments with agent patterns for useful, bounded tasks.', icon: Bot }];
export default function AILabPage() { return <div className="page-shell container"><SectionHeading level={1} eyebrow="RESEARCH / EXPERIMENTS" title="AI Lab" description="Experiments with LLMs, RAG, AI Agents and intelligent applications."/><div className="engineering-grid">{items.map((x, i) => <Card key={x.title} className="engineering-card lab-page-card"><span className="mono-label">0{i + 1} / CONCEPT</span><x.icon size={21}/><h3>{x.title}</h3><p>{x.text}</p><span className="lab-status">PLANNED</span></Card>)}</div></div>; }

