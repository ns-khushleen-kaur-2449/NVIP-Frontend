import { Link } from 'react-router-dom';
import { ArrowRight, DatabaseZap, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { CATEGORIES } from '@/config/agents';

/** Benefits, each drawn from the agents' configured behaviour and guardrails (config/agents.js). */
const BENEFITS = [
  {
    icon: DatabaseZap,
    title: 'Your records stay yours',
    body: 'Agents look up and update your CRM, ATS or property system. It stays the system of record.',
  },
  {
    icon: UserRoundCheck,
    title: 'People stay in the loop',
    body: 'Agents hand high-intent, pricing and legal conversations to a person on your team.',
  },
  {
    icon: ShieldCheck,
    title: 'Guardrails you can see',
    body: 'Consent checks, do-not-call lists and calling windows are fixed per agent and shown to admins, not left to a prompt.',
  },
];

function Fact({ term, children }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-[var(--nv-muted)]">{term}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Use cases by team, built from the live agent list. Agent names are links here, not headings. */
export default function UseCases({ agents }) {
  if (!agents?.length) return null;
  const groups = CATEGORIES.filter((c) => c.id !== 'all')
    .map((c) => ({ ...c, agents: agents.filter((a) => a.category === c.id) }))
    .filter((g) => g.agents.length > 0);

  return (
    <section aria-labelledby="usecases-title" className="bg-[var(--nv-surface-2)]">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <h2 id="usecases-title" className="nvp-h2">Built for the teams that live on the phone</h2>
          <p className="nvp-lede mt-5 text-[var(--nv-muted)]">
            Sales, recruitment, support and property teams each get an agent that works inside the systems they already run.
          </p>
          <ul className="mt-10 space-y-7">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--nv-surface)] text-[var(--nv-ink)] shadow-[var(--nvp-shadow-card)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">{b.title}</p>
                    <p className="mt-1 leading-relaxed text-[var(--nv-muted)]">{b.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <ul className="divide-y divide-[var(--nv-line)] overflow-hidden rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] shadow-[var(--nvp-shadow-card)] lg:col-span-7">
          {groups.map((g) => {
            const Icon = g.icon;
            return (
              <li key={g.id} className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--nv-surface-2)] text-[var(--nv-ink)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-xl font-bold tracking-[-0.015em]">{g.label}</h3>
                </div>
                <ul className="mt-6 space-y-6">
                  {g.agents.map((a) => (
                    <li key={a.type}>
                      <Link
                        to={`/marketplace/${a.slug}`}
                        className="group inline-flex items-center gap-1.5 rounded-sm text-[1.05rem] font-semibold transition-colors hover:text-[var(--nv-orange-ink)]"
                      >
                        {a.name}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                      </Link>
                      <p className="mt-1 text-[var(--nv-muted)]">For {a.primaryUsers.charAt(0).toLowerCase() + a.primaryUsers.slice(1)}.</p>
                      <p className="mt-2 text-[0.95rem]">
                        <span className="text-[var(--nv-muted)]">Captures </span>
                        {a.captures.join(', ').toLowerCase()}
                      </p>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.95rem]">
                        <Fact term="Books">{a.booking}</Fact>
                        {a.systemOfRecord && <Fact term="Works in">{a.systemOfRecord}</Fact>}
                      </dl>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
