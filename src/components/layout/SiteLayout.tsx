import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
export function SiteLayout({ children }: { children: ReactNode }) { return <><a className="skip-link" href="#main-content">Skip to content</a><Navbar /><main id="main-content" style={{ scrollMarginTop: 0 }}>{children}</main><Footer /></>; }
