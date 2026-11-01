import { useState } from 'react';
import { ChevronDown, Mail, MessageCircle, Phone, Search } from 'lucide-react';
import clsx from 'clsx';
import { FAQ_SECTIONS, SUPPORT, type LegalDoc } from '@sabjiilelo/shared';

/** FAQs + contact options. Shared by the customer account area and the staff portal. */
export function HelpContent() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(FAQ_SECTIONS[0]!.items[0]!.q);
  const needle = q.trim().toLowerCase();
  const sections = FAQ_SECTIONS.map((s) => ({ ...s, items: s.items.filter((f) => !needle || (f.q + f.a).toLowerCase().includes(needle)) })).filter((s) => s.items.length);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-dark-green p-6 text-white">
        <img src="/icons/phone.webp" alt="" className="absolute -right-4 -top-2 h-32 w-32 opacity-90" />
        <h2 className="text-2xl font-bold text-white">How can we help?</h2>
        <p className="mt-1 text-sm text-white/80">{SUPPORT.hours}</p>
        <div className="relative mt-4 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input h-11 rounded-2xl pl-10" placeholder="Search questions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Phone, title: 'Call us', text: SUPPORT.phone, href: SUPPORT.phoneHref, tone: 'bg-light-green text-primary' },
          { icon: MessageCircle, title: 'WhatsApp', text: 'Chat with our team', href: `https://wa.me/${SUPPORT.whatsapp}`, tone: 'bg-[#25d366]/15 text-[#128c4a]' },
          { icon: Mail, title: 'Email', text: SUPPORT.email, href: `mailto:${SUPPORT.email}`, tone: 'bg-accent/15 text-[#c25a14]' },
        ].map(({ icon: Icon, ...c }) => (
          <a key={c.title} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-primary/30">
            <span className={clsx('flex h-11 w-11 items-center justify-center rounded-2xl', c.tone)}>
              <Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{c.title}</span>
              <span className="block truncate text-xs text-muted">{c.text}</span>
            </span>
          </a>
        ))}
      </div>

      {sections.length === 0 && <p className="text-center text-sm text-muted">No answers match "{q}". Reach out to us above.</p>}
      {sections.map((s) => (
        <div key={s.title}>
          <h3 className="mb-2 flex items-center gap-2 text-base">
            <span>{s.icon}</span> {s.title}
          </h3>
          <div className="card divide-y divide-line/70 overflow-hidden">
            {s.items.map((f) => {
              const isOpen = open === f.q || !!needle;
              return (
                <div key={f.q}>
                  <button onClick={() => setOpen(isOpen && !needle ? null : f.q)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink hover:bg-cream/60">
                    {f.q}
                    <ChevronDown size={18} className={clsx('shrink-0 text-muted transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && <p className="fade-up px-4 pb-4 text-sm text-body/80">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LegalContent({ doc }: { doc: LegalDoc }) {
  return (
    <article className="card p-6 sm:p-8">
      <h1 className="text-2xl">{doc.title}</h1>
      <p className="mt-1 text-xs text-muted">Last updated {doc.updated}</p>
      <div className="mt-6 space-y-5">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-base">{s.heading}</h2>
            <p className="mt-1 text-sm leading-relaxed text-body/85">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
