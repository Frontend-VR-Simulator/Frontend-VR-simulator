import { useEffect, useState } from "react";

const LANDING_ANCHORS = ["features", "roles", "recordings", "how-it-works"];

function parse(hash) {
  const fragment = decodeURIComponent(hash.replace(/^#\/?/, ""));
  if (LANDING_ANCHORS.some((anchor) => fragment.startsWith(anchor))) return { parts: ["landing"], query: new URLSearchParams(), anchor: true };
  const [clean, search = ""] = fragment.split("?");
  return { parts: clean ? clean.split("/") : [], query: new URLSearchParams(search), anchor: false };
}

// Hash routes as in the design: #/landing, #/login, #/session/<id>, #/<workspace>/<page>?query
export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parse(window.location.hash);
      setRoute(next);
      if (!next.anchor) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function goto(route) {
  window.location.hash = `#/${route}`;
}
