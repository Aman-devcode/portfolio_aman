import { Link } from 'react-router-dom';
export default function NotFoundPage() { return <div className="page-shell container not-found"><span className="eyebrow">ERROR / 404</span><h1>This page isn’t here.</h1><p>The address may have changed or the page is still being built.</p><Link className="button button-primary" to="/">Back to home</Link></div>; }
