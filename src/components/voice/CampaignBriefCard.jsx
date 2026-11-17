import { fromOldPitch, goalLabel } from '@/lib/campaignBrief';

const Tag = () => <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">from old pitch</span>;

/** The campaign's goal and brief as calls get them (GET /api/campaigns/{id}), marking fields derived from the old pitch. */
export default function CampaignBriefCard({ campaign }) {
  const brief = campaign?.brief;
  if (!brief && !campaign?.goal) return null;
  const sources = campaign.brief_sources || {};
  const rows = [
    ['goal', 'Goal', goalLabel(campaign.goal)],
    ['priority', 'Priority', campaign.priority ?? null],
    ['spoken_name', 'Spoken name', brief?.spoken_name],
    ['call_purpose', 'Call purpose', brief?.call_purpose],
    ['value_proposition', 'Value proposition', brief?.value_proposition],
    ['key_points', 'Key points', brief?.key_points?.join(' · ')],
    ['offer', 'Offer', brief?.offer?.text ? `${brief.offer.text}${brief.offer.enabled ? '' : ' (off)'}` : null],
    ['qualification_overrides', 'Questions', brief?.qualification_overrides?.length
      ? `${brief.qualification_overrides.length} of its own` : "The agent's defaults"],
  ].filter(([, , value]) => value != null && value !== '');
  return (
    <section className="ops-card p-4" data-testid="campaign-brief">
      <h3 className="text-sm font-semibold">Brief</h3>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([key, label, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}{fromOldPitch(sources, key) && <Tag />}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
