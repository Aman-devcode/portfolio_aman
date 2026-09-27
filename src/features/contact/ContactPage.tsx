import { ArrowUpRight, Code2, BriefcaseBusiness, Mail, MessageSquare } from 'lucide-react';
import { SectionHeading } from '../../components/ui/SectionHeading';

const contacts = [
  { title: 'Email', detail: 'amanbr32060389@gmail.com', href: 'mailto:amanbr32060389@gmail.com', icon: Mail, external: false },
  { title: 'GitHub', detail: 'github.com/Aman-devcode', href: 'https://github.com/Aman-devcode', icon: Code2, external: true },
  { title: 'LinkedIn', detail: 'linkedin.com/in/amankumarpandit', href: 'https://www.linkedin.com/in/amankumarpandit/', icon: BriefcaseBusiness, external: true },
];

const inquiryTypes = [
  'Full Stack Web Application',
  'Backend / API Development',
  'AI / LLM Integration',
  'AI Agent Development',
  'Existing Project Enhancement',
];

export default function ContactPage() {
  return <div className="page-shell container">
    <SectionHeading level={1} eyebrow="CONTACT" title="Let’s build something." description="Have a project in mind? Start a conversation through the verified channels below."/>

    <div className="contact-cta-panel">
      <div className="contact-cta-copy">
        <span className="eyebrow">START A CONVERSATION</span>
        <h2>Have a project in mind?</h2>
        <p>Tell Aman what you are building, what needs to be solved, or where you need engineering support.</p>
      </div>
      <a className="button button-primary contact-cta-button" href="mailto:amanbr32060389@gmail.com?subject=Project%20Inquiry%20for%20Aman%20Kumar%20Pandit">
        <MessageSquare size={16} aria-hidden="true"/>
        Start a Conversation
        <ArrowUpRight size={15} aria-hidden="true"/>
      </a>
    </div>

    <div className="contact-inquiry">
      <span className="eyebrow">WHAT I CAN HELP WITH</span>
      <div className="contact-inquiry-list">
        {inquiryTypes.map(item => <span key={item}>{item}</span>)}
      </div>
    </div>

    <div className="contact-list">
      {contacts.map(c => {
        const content = <>
          <c.icon size={19} aria-hidden="true"/>
          <span><strong>{c.title}</strong><small>{c.detail}</small></span>
          <ArrowUpRight size={18} aria-hidden="true"/>
        </>;
        return <a
          key={c.title}
          className="contact-row"
          href={c.href}
          {...(c.external ? { target: '_blank', rel: 'noreferrer' } : {})}
        >{content}</a>;
      })}
    </div>
  </div>;
}
