import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Opens every new page at the top. React Router keeps the scroll position between pages, so a link clicked halfway
 * down the home page used to open the next page halfway down too.
 * - Back / forward (POP) is left alone, so the browser returns you to where you were.
 * - A link with a #section (/#agents, /pricing#outbound-lead-gen) is left to the page, which scrolls to that section.
 * - Only a change of page counts: switching a ?tab= on the same page keeps your place.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return;
    window.scrollTo(0, 0);
    // The signed-in layout scrolls inside its own content column rather than the window.
    document.querySelectorAll('.app-shell-row .overflow-y-auto, .app-shell .overflow-auto').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname, hash, navigationType]);

  return null;
}
