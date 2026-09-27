import { Link } from 'react-router-dom';

export function Footer() {
  return <footer className="footer">
    <div className="container footer-inner">
      <div><Link className="brand" to="/">AMAN<span>.</span></Link><p>Aman Kumar Pandit<br />Full Stack Developer</p></div>
      <div className="footer-links">
        <Link to="/about">About</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/contact">Contact</Link>
      </div>
      <small>© {new Date().getFullYear()} Aman Kumar Pandit</small>
    </div>
  </footer>;
}
