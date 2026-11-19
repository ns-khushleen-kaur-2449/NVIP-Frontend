import { ButtonLink, Panel } from '../../components/primitives';
import { GO_LIVE_STEPS as STEPS, VOICE_STACK as STACK } from '../../config/platform';

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <h1 className="text-4xl font-bold tracking-tight text-center">From demo to live calls</h1>
      <ol className="mt-12 grid gap-5 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Panel className="h-full p-5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--nv-orange)] text-sm font-bold text-[var(--nv-on-orange,#fff)]">{i + 1}</div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-[var(--nv-muted)]">{s.body}</p>
            </Panel>
          </li>
        ))}
      </ol>

      <h2 className="mt-16 text-2xl font-bold">Built on proven infrastructure</h2>
      <p className="mt-2 text-[var(--nv-muted)]">
        You get a login to your NVIP workspace — never raw provider credentials. NVIP manages the voice stack for you.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {STACK.map((s) => (
          <Panel key={s.name} className="p-5">
            <div className="font-semibold">{s.name}</div>
            <div className="text-sm text-[var(--nv-muted)]">{s.role}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-14 text-center">
        <ButtonLink to="/request-demo" size="lg">Book a demo</ButtonLink>
      </div>
    </div>
  );
}
