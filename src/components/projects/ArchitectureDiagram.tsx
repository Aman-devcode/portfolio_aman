import type { ProjectArchitecture, ProjectImage } from '../../data/projects';
type Props = { architecture?: ProjectArchitecture; image?: ProjectImage };
export function ArchitectureDiagram({ architecture, image }: Props) {
  if (!architecture?.nodes.length && !image) return <div className="architecture-empty"><span className="mono-label">ARCHITECTURE</span><p>Not provided</p><small>Architecture details will be added after the implementation is documented.</small></div>;
  const nodeById = new Map(architecture?.nodes.map(node => [node.id, node]) ?? []);
  return <div className="architecture-content">
    {image && <figure className="architecture-image"><img src={image.src} alt={image.alt} loading="lazy" decoding="async"/><figcaption>{image.alt}</figcaption></figure>}
    {architecture?.nodes.length ? <figure className="architecture-diagram"><ol>{architecture.nodes.map((node, index) => {
      const next = architecture.nodes[index + 1];
      const connection = next ? architecture.connections.find(edge => edge.from === node.id && edge.to === next.id) : undefined;
      return <li key={node.id}><div className="architecture-node"><span className="architecture-node-index">{String(index + 1).padStart(2, '0')}</span><strong>{node.label}</strong>{node.detail && <small>{node.detail}</small>}</div>{next && (connection ? <div className="architecture-connector" aria-label={`Connects ${nodeById.get(connection.from)?.label} to ${nodeById.get(connection.to)?.label}`}><span aria-hidden="true"/>{connection.label && <small>{connection.label}</small>}</div> : <div className="architecture-gap" aria-hidden="true"/>)}</li>;
    })}</ol><figcaption>Documented application architecture</figcaption></figure> : null}
  </div>;
}
