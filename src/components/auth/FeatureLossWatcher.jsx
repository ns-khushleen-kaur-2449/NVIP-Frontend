// F-02: when a refreshed /api/auth/me switches off a feature the open page needs, go to the page's legacy equivalent
// (query kept, as ModeRedirect does) or else the dashboard, with a short notice instead of leaving a broken page. Mounted once inside the router and the AuthProvider; renders nothing.

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { keepQuery } from '@/components/auth/ModeRoutes';
import { FEATURE_LOSS_HOME, featureLossNotice, featureLossTarget, lostPageFeatures } from '@/lib/featureLoss';

export default function FeatureLossWatcher() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // The user and page as of the last render: the page the user was on when the features changed, even if a guard
  // below has already started its own redirect.
  const seen = useRef({ user, location });

  useEffect(() => {
    const { user: previous, location: where } = seen.current;
    seen.current = { user, location };
    if (previous === user) return;
    const lost = lostPageFeatures(where.pathname, previous, user);
    if (!lost.length) return;
    const target = featureLossTarget(where.pathname);
    navigate(target === FEATURE_LOSS_HOME ? target : keepQuery(target, where), { replace: true });
    toast.info(featureLossNotice(lost));
  }, [user, location, navigate]);

  return null;
}
