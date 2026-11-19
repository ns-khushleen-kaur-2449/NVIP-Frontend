import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, Check, DatabaseZap, Mail, Pause, Play, PhoneIncoming, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GuardrailChips } from '@/components/primitives';

const EASE_OUT = [0.16, 1, 0.3, 1];

/*
 * A SAMPLE conversation (labelled as such on the page) for the Inbound Voice SDR. Each caller line that answers
 * a qualifying question fills one of the agent's capture fields (agent.captures, by index), so the panel always
 * shows the agent's real field names.
 */
const SCRIPT = [
  { who: 'agent', text: "Thanks for calling. I'm the AI assistant for the sales team. What can I help you with today?" },
  { who: 'caller', text: "We're looking at voice agents to handle our inbound sales calls.", fills: { field: 0, value: 'Inbound call handling' } },
  { who: 'agent', text: 'Happy to help. Roughly how large is your company?' },
  { who: 'caller', text: 'About 200 people, with four of us on sales.', fills: { field: 1, value: '~200 people, 4 in sales' } },
  { who: 'agent', text: 'Is there budget set aside for this yet?' },
  { who: 'caller', text: "Yes, it's approved for this quarter.", fills: { field: 2, value: 'Approved this quarter' } },
  { who: 'agent', text: 'And when would you like to be live?' },
  { who: 'caller', text: 'Within the next six weeks.', fills: { field: 3, value: 'Within 6 weeks' } },
  { who: 'agent', text: 'I can book a demo with the team. I have Thursday at 10:30 or Friday at 2:00. Which suits you?' },
  { who: 'caller', text: 'Thursday at 10:30 works.' },
  { who: 'agent', text: "You're booked for Thursday at 10:30. A calendar invite is on its way to your inbox." },
];

/** What happens when the call ends, tied to the agent's configured tools (agent.tools, by index). */
const OUTCOMES = [
  { icon: CalendarCheck, title: 'Demo booked · Thu 10:30', tool: 1 },
  { icon: DatabaseZap, title: 'CRM record created', tool: 0 },
  { icon: Mail, title: 'Confirmation email sent', tool: 2 },
];

const SECONDS_PER_LINE = 6.5;
const clock = (lines) => {
  const s = Math.round(lines * SECONDS_PER_LINE);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function MiniOrb({ className }) {
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 rounded-full', className)}
      style={{ background: 'radial-gradient(circle at 40% 36%, #FFDCC0 0%, #FE7725 52%, #8C2908 100%)' }}
    />
  );
}

function Bubble({ line, agentName, captureLabel, reduce }) {
  const agent = line.who === 'agent';
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className={cn('flex gap-3', agent ? 'justify-start' : 'justify-end')}
    >
      {agent && <MiniOrb className="mt-6 h-7 w-7" />}
      <div className={cn('max-w-[85%] sm:max-w-[78%]', !agent && 'text-right')}>
        <p className="mb-1.5 text-xs font-medium text-[var(--nv-muted)]">{agent ? agentName : 'Caller'}</p>
        <p
          className={cn(
            'inline-block rounded-2xl px-4 py-3 text-left text-[0.95rem] leading-relaxed',
            agent
              ? 'rounded-tl-md bg-[var(--nv-surface-2)] text-[var(--nv-ink)]'
              : 'rounded-tr-md bg-[var(--nv-orange)] text-[var(--nv-on-orange)]',
          )}
        >
          {line.text}
        </p>
        {captureLabel && (
          <p className="mt-1.5 flex items-center justify-end gap-1 text-xs font-semibold text-[var(--nv-orange-ink)]">
            <Check className="h-3.5 w-3.5" aria-hidden /> {captureLabel} captured
          </p>
        )}
      </div>
    </motion.li>
  );
}

function Typing({ who }) {
  return (
    <li className={cn('flex', who === 'agent' ? 'justify-start pl-10' : 'justify-end')} aria-hidden>
      <span className="inline-flex items-center gap-1 rounded-2xl bg-[var(--nv-surface-2)] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[var(--nv-muted)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </span>
    </li>
  );
}

function ControlButton({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--nv-line)] px-3 text-sm font-semibold text-[var(--nv-ink)] transition-colors hover:bg-[var(--nv-surface-2)]"
    >
      <Icon className="h-4 w-4" aria-hidden /> {children}
    </button>
  );
}

/**
 * Signature section: a sample inbound call plays when it scrolls into view and fills the capture panel,
 * ending in the agent's real outcomes. Reduced motion (or no IntersectionObserver) shows the whole call at once.
 */
export default function CallDemo({ agent }) {
  const reduce = useReducedMotion();
  const total = SCRIPT.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [typing, setTyping] = useState(false);
  const sectionRef = useRef(null);
  const listRef = useRef(null);

  // Start when the section is in view; without motion, show the finished call.
  // `hasAgent`: the section only mounts once the agent list has loaded, so observe again then.
  const hasAgent = Boolean(agent);
  useEffect(() => {
    if (!hasAgent) return undefined;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setStep(total);
      return undefined;
    }
    const el = sectionRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPlaying(true);
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [hasAgent, reduce, total]);

  // Advance one line at a time: a typing beat, then the line.
  useEffect(() => {
    if (!playing) return undefined;
    if (step >= total) {
      setPlaying(false);
      setTyping(false);
      return undefined;
    }
    const line = SCRIPT[step];
    setTyping(true);
    const wait = (line.who === 'agent' ? 700 : 500) + Math.min(line.text.length * 15, 1100);
    const t = setTimeout(() => {
      setTyping(false);
      setStep((s) => s + 1);
    }, wait);
    return () => clearTimeout(t);
  }, [playing, step, total]);

  // Keep the latest line in view inside the transcript (never scrolls the page).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }, [step, typing, reduce]);

  if (!agent) return null;

  const done = step >= total;
  const shown = SCRIPT.slice(0, step);
  const captured = {};
  shown.forEach((l) => { if (l.fills) captured[l.fills.field] = l.fills.value; });
  const filled = Object.keys(captured).length;

  const replay = () => { setStep(0); setTyping(false); setPlaying(true); };
  const toggle = () => (done ? replay() : setPlaying((p) => !p));
  const showAll = () => { setPlaying(false); setTyping(false); setStep(total); };

  return (
    <section ref={sectionRef} className="nvp-band relative overflow-hidden" aria-labelledby="demo-title">
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:col-span-5">
          <h2 id="demo-title" className="nvp-h2">Watch a call become a booked demo</h2>
          <p className="nvp-lede mt-5 text-[var(--nv-muted)]">
            The {agent.name} qualifies the caller, captures what your team needs, and books a slot from a live calendar.
          </p>

          <div className="mt-10 rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--nv-line)] px-5 py-3.5">
              <p className="text-sm font-semibold">Captured for your CRM</p>
              <p className="text-xs tabular-nums text-[var(--nv-muted)]">{filled} of {agent.captures.length}</p>
            </div>
            <dl className="divide-y divide-[var(--nv-line)]">
              {agent.captures.map((label, i) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-[var(--nv-muted)]">{label}</dt>
                  <dd className="text-right text-sm">
                    {captured[i] ? (
                      <motion.span
                        key={captured[i]}
                        initial={reduce ? false : { opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="inline-flex items-center gap-1.5 font-semibold"
                      >
                        <Check className="h-4 w-4 text-[var(--nv-orange-ink)]" aria-hidden /> {captured[i]}
                      </motion.span>
                    ) : (
                      <span className="text-[var(--nv-muted)] opacity-70">Listening…</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <ul className="mt-6 space-y-3" aria-label="When the call ends">
            {OUTCOMES.map((o) => {
              const Icon = o.icon;
              return (
                <li
                  key={o.title}
                  className={cn('flex items-center gap-3 transition-opacity duration-500', done ? 'opacity-100' : 'opacity-40')}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-500',
                      done ? 'bg-[var(--nv-orange)] text-[var(--nv-on-orange)]' : 'bg-[var(--nv-surface-2)] text-[var(--nv-muted)]',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-[var(--nv-muted)]">{agent.tools[o.tool]}</span>
                  </span>
                  <span className="sr-only">{done ? '(done)' : '(pending)'}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold">Fixed guardrails</p>
            <GuardrailChips guardrails={agent.guardrails} />
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.85)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--nv-line)] px-5 py-4">
              <MiniOrb className="h-10 w-10" />
              <div className="min-w-0 leading-tight">
                <p className="font-semibold">{agent.name}</p>
                <p className="mt-0.5 text-xs text-[var(--nv-muted)]">
                  <span className="font-semibold text-[var(--nv-orange-ink)]">Sample call</span> · illustrative ·{' '}
                  <span className="tabular-nums">{clock(step)}</span>
                </p>
              </div>
              <span aria-hidden className="nvp-bars ml-1 flex h-4 items-center gap-[3px]" data-idle={!playing}>
                {[0, 1, 2, 3].map((i) => <span key={i} className="block h-full w-[3px] rounded-full bg-[var(--nv-orange)]" />)}
              </span>
              <div className="ml-auto flex gap-2">
                {!reduce && (
                  <ControlButton onClick={toggle} icon={done ? RotateCcw : playing ? Pause : Play}>
                    {done ? 'Replay' : playing ? 'Pause' : step === 0 ? 'Play' : 'Resume'}
                  </ControlButton>
                )}
                {!done && <ControlButton onClick={showAll} icon={Check}>Show all</ControlButton>}
              </div>
            </div>

            <ol
              ref={listRef}
              aria-label="Sample call transcript"
              className="h-[460px] space-y-5 overflow-y-auto overscroll-contain px-5 py-6 sm:h-[520px] sm:px-6"
            >
              {step === 0 && !typing && (
                <li className="grid h-full place-items-center text-center">
                  <span>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--nv-orange-soft)] text-[var(--nv-orange-ink)]">
                      <PhoneIncoming className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="mt-3 block text-sm text-[var(--nv-muted)]">Incoming call…</span>
                  </span>
                </li>
              )}
              {shown.map((line, i) => (
                <Bubble
                  key={i}
                  line={line}
                  agentName={agent.shortName ? `${agent.shortName} agent` : agent.name}
                  captureLabel={line.fills ? agent.captures[line.fills.field] : null}
                  reduce={reduce}
                />
              ))}
              <AnimatePresence>{typing && !done && <Typing key={`t${step}`} who={SCRIPT[step].who} />}</AnimatePresence>
              {done && (
                <motion.li
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT }}
                  className="flex justify-center pt-2"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--nv-orange)] px-4 py-2 text-sm font-semibold text-[var(--nv-on-orange)]">
                    <CalendarCheck className="h-4 w-4" aria-hidden /> Call ended · demo booked for Thu 10:30
                  </span>
                </motion.li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
