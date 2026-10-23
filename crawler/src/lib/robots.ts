// robots.txt の最小実装：自分向けのグループ（なければ *）の Allow/Disallow を最長一致で判定する
type Rule = { allow: boolean; path: string };

export type Robots = { isAllowed: (url: string) => boolean };

export function parseRobots(text: string, botName: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    const val = (m[2] ?? "").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(val.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      if (val) current.rules.push({ allow: key === "allow", path: val });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && botName.toLowerCase().includes(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  const toRe = (p: string) =>
    new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  return {
    isAllowed(url: string) {
      const u = new URL(url);
      const target = u.pathname + u.search;
      let best: Rule | null = null;
      for (const r of rules) {
        if (toRe(r.path).test(target) && (!best || r.path.length > best.path.length)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}
