// Photos sit inside an entry's text on a line of their own, as [[img:<id>]]. Everything that reads the text as words strips them.
export const IMG = /^\[\[img:([\w-]+)\]\]$/;
export const imgToken = (id: string) => `[[img:${id}]]`;
export const plain = (body: string) => body.split("\n").filter((l) => !IMG.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();

export type Part = { img: string } | { text: string };

/** Text runs and photos, always starting and ending with a text run so there is somewhere to type. */
export function parse(body: string): Part[] {
  const parts: Part[] = [];
  let run: string[] = [];
  for (const line of body.split("\n")) {
    const m = IMG.exec(line);
    if (!m) { run.push(line); continue; }
    parts.push({ text: run.join("\n") }, { img: m[1] });
    run = [];
  }
  parts.push({ text: run.join("\n") });
  return parts;
}
export const join = (parts: Part[]) => parts.map((p) => ("img" in p ? imgToken(p.img) : p.text)).join("\n");

/** A few words of an entry for the list: formatting marks and photos removed, cut at a word with "…". */
export function excerpt(body: string, max = 80): string {
  const t = plain(body)
    .replace(/^#{1,2} /gm, "")
    .replace(/^(?:[☐☑•★]|\d+\.) /gm, "")
    .replace(/(\*\*|_)(.+?)\1/g, "$2")
    .replace(/^[—\s]+$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).replace(/[\s,.;:—-]+$/, "") + "…";
}
