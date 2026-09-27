import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { SoundToggle } from '../../features/audio/SoundToggle';

const nav = [{ label: 'About', to: '/about' }, { label: 'Projects', to: '/projects' }, { label: 'Skills', to: '/skills' }, { label: 'AI Lab', to: '/ai-lab' }, { label: 'Engineering', to: '/#engineering' }, { label: 'Contact', to: '/contact' }];

export function Navbar() {
  const [open, setOpen] = useState(false);
const [light, setLight] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => toggleRef.current?.focus());
  };

  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);
  useEffect(() => {
  const savedTheme = localStorage.getItem('theme');
  const isLight = savedTheme === 'light';

  setLight(isLight);
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
}, []);


  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const toggleTheme = () => {
  setLight((current) => {
    const next = !current;

    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    localStorage.setItem('theme', next ? 'light' : 'dark');

    return next;
  });
};
  return <header className="site-header"><nav className="nav-shell container" aria-label="Main navigation">
    <Link to="/" className="brand" aria-label="Aman Kumar Pandit home">AMAN<span>.</span></Link>
    <div className="desktop-nav">{nav.map(item => <NavLink key={item.label} to={item.to} className={({ isActive }) => `nav-link ${isActive && item.to !== '/#engineering' ? 'active' : ''}`}>{item.label}</NavLink>)}</div>
    <div className="nav-actions"><a className="resume-link" href="/resume.pdf" target="_blank" rel="noopener noreferrer">Resume <span aria-hidden="true">↗</span></a><SoundToggle/><button className="theme-button" onClick={toggleTheme} aria-label={`Switch to ${light ? 'dark' : 'light'} theme`}>{light ? <Moon size={17} /> : <Sun size={17} />}</button><button ref={toggleRef} className="menu-button" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="mobile-navigation">{open ? <X /> : <Menu />}</button></div>
    <div id="mobile-navigation" className="mobile-nav" hidden={!open}>{nav.map((item, index) => <NavLink key={item.label} ref={index === 0 ? firstLinkRef : undefined} to={item.to} onClick={() => close(true)} className={({ isActive }) => isActive ? 'active' : ''}>{item.label}<span aria-hidden="true">↗</span></NavLink>)}<a href="/resume.pdf" target="_blank" rel="noopener noreferrer" onClick={() => close(true)}>Resume<span aria-hidden="true">↗</span></a><div className="mobile-sound"><span>Sound</span><SoundToggle/></div></div>
  </nav></header>;
}



