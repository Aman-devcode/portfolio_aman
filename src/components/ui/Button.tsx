import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; to?: string; children: ReactNode; arrow?: boolean };
export function Button({ variant = 'secondary', to, children, arrow = false, className = '', ...props }: Props) {
  const classes = `button button-${variant} ${className}`;
  const content = <>{children}{arrow && <ArrowUpRight size={16} aria-hidden="true" />}</>;
  return to ? <Link className={classes} to={to}>{content}</Link> : <button className={classes} {...props}>{content}</button>;
}
export function TextLink({ to, children }: Pick<LinkProps, 'to' | 'children'>) { return <Link className="text-link" to={to}>{children}<ArrowUpRight size={15} aria-hidden="true" /></Link>; }
