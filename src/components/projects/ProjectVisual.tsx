import type { ProjectImage } from '../../data/projects';
export function ProjectVisual({ title, image, className = '' }: { title: string; image?: ProjectImage; className?: string }) {
  return <div className={`project-visual ${className}`}>
    {image ? <img src={image.src} alt={image.alt} loading="lazy" decoding="async" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"/> : <div className="project-image-placeholder" role="img" aria-label={`Project image for ${title} not provided`}><span className="placeholder-mark" aria-hidden="true">AKP<span> / </span>PROJECT</span><span className="placeholder-caption">IMAGE NOT PROVIDED</span><div className="placeholder-lines" aria-hidden="true"/></div>}
  </div>;
}
