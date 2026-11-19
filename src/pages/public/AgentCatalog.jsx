import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AGENT_TYPES } from '../../config/agents';
import { marketplaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import LandingHero from '../../components/landing/LandingHero';
import AgentShowcase from '../../components/landing/AgentShowcase';
import CallDemo from '../../components/landing/CallDemo';
import GoLiveSection from '../../components/landing/GoLiveSection';
import UseCases from '../../components/landing/UseCases';
import NetsmartzBand from '../../components/landing/NetsmartzBand';
import PricingFaq from '../../components/landing/PricingFaq';
import ClosingCta from '../../components/landing/ClosingCta';

/**
 * Public landing page (`/`): the NVIP agent catalog, after the approved mockup.
 * Every agent fact on the page comes from marketplaceApi.listAgents(); platform facts from config/platform.js.
 * reducedMotion="user" turns framer-motion transforms off for visitors who ask for reduced motion.
 */
export default function AgentCatalog() {
  const query = useNvipQuery(() => marketplaceApi.listAgents(), []);
  const agents = query.data;
  const sdr = agents?.find((a) => a.type === AGENT_TYPES.SDR);

  // Header and hero links such as /#integrations and /#agents land on their section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  return (
    <MotionConfig reducedMotion="user">
      <LandingHero />
      <AgentShowcase query={query} />
      <CallDemo agent={sdr} />
      <UseCases agents={agents} />
      <GoLiveSection />
      <NetsmartzBand />
      <PricingFaq agents={agents} />
      <ClosingCta />
    </MotionConfig>
  );
}
