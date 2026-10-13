import HydrationMarker from "@/components/HydrationMarker";

// Server-rendered HTML is clickable before its JavaScript has loaded, and a click then goes nowhere:
// a button has no handler yet and a form submits natively (a GET to the same URL, with the typed
// fields - a password included - in the address). Until HydrationMarker flags the page as hydrated,
// buttons are dimmed and inert, and a submit or button click is swallowed in the capture phase by a
// tiny inline script that runs at parse time, before React is there. Links are left alone: they work
// without JavaScript. Rendered by the staff, login and guest-account layouts; the public site does
// not use it.
const CSS =
  "html:not([data-hydrated]) button:not([data-hydration-exempt]),html:not([data-hydrated]) input[type=submit],html:not([data-hydrated]) input[type=button]{pointer-events:none;opacity:.55;cursor:progress}";

const SCRIPT =
  'function g(e){if(!document.documentElement.hasAttribute("data-hydrated")){if(e.type==="submit"||e.target.closest&&e.target.closest("button:not([data-hydration-exempt]),input[type=submit],input[type=button]")){e.preventDefault();e.stopPropagation()}}}' +
  'document.addEventListener("submit",g,true);document.addEventListener("click",g,true);';

export default function HydrationGate() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <HydrationMarker />
    </>
  );
}
