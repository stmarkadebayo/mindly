// A small example journal, so someone trying Mindly for the first time can see Insights, Reflect and Chat at work
// without recording anything. Entries are ordinary entries in the person's own browser (editable, deletable),
// marked `sample` so they can be labelled and removed in one tap.
import * as store from "./store";
import type { Entry } from "./types";

type Seed = { daysAgo: number; hour: number; mood: number; title: string; body: string; prompt?: string };

const SEEDS: Seed[] = [
  { daysAgo: 26, hour: 21, mood: 3, title: "New semester, new timetable",
    body: "Resumption week is done. Eight o'clock lectures three days a week, and thermodynamics is already looking at me like it knows something I don't.\n\nI keep telling myself I'll stay on top of it this time. I'm going to try writing here, or talking, whenever my head gets too full. Let's see if I last." },
  { daysAgo: 23, hour: 22, mood: 2, title: "Call with my sister",
    body: "My sister Bisi called tonight. We ended up arguing about money for mum's treatment. She thinks I'm not doing enough, and I'm a student, what do I have? I snapped at her and said something I shouldn't have.\n\nAfter the call I just sat there feeling guilty. I don't even know if I was angry at her or at the whole situation.",
    prompt: "What's taking up space in your head?" },
  { daysAgo: 20, hour: 18, mood: 4, title: "Football with the guys",
    body: "Played football with Tunde and the guys at the pitch behind the hostel. I haven't felt this light in weeks. We lost, but nobody cared. Dem dey shout like say na World Cup final.\n\nI should do this more often instead of sitting in my room with my phone." },
  { daysAgo: 17, hour: 3, mood: 2, title: "Can't sleep again",
    body: "It's past 3am and I'm awake. Phone in bed again, scrolling, even though I know it makes things worse. The thermo test is on Monday and every time I close my eyes I see formulas.\n\nWahala. Tomorrow I'll be useless in class." },
  { daysAgo: 14, hour: 17, mood: 1, title: "Thermodynamics test",
    body: "The test was today. When I opened the paper my chest went tight and my mind went blank. I couldn't even remember the first law properly. I no fit settle at all.\n\nI wrote what I could and left early because I felt like I couldn't breathe in that hall.",
    prompt: "How are you really feeling today, and why?" },
  { daysAgo: 12, hour: 20, mood: 3, title: "After the test",
    body: "The result is out and it's not as bad as I feared. Not great, but I passed. I think the worst part was the fear, not the paper.\n\nTunde and I went to eat after, and for the first time this week I laughed properly. Ẹ ṣé Ọlọ́run." },
  { daysAgo: 9, hour: 21, mood: 4, title: "Good call with Bisi",
    body: "I called Bisi first this time and apologised for how I spoke. She laughed and said she was also stressed, and that mum is responding better to the treatment. We talked about old times, our childhood in Ibadan, and she did her old impression of Dad.\n\nI feel so much lighter. I should call her more." },
  { daysAgo: 7, hour: 19, mood: 2, title: "Behind on the group project",
    body: "Group project is due Friday and I've been avoiding it. Every time I open the document I find something else to do. I know I'm procrastinating, and the avoiding is making me feel worse than the work itself would.\n\nWhat I need to do:\n☐ Write my section of the report\n☐ Send the slides to Amaka\n☐ Ask the group when we can meet\n☐ Start before dinner, not after" },
  { daysAgo: 4, hour: 2, mood: 3, title: "Slept at 3am again",
    body: "Slept at 3am again. The phone was in bed. I keep promising myself and then doing the same thing.\n\nIdea: charge the phone across the room tonight, so I have to get up to use it. Also no screens after eleven, at least try." },
  { daysAgo: 2, hour: 20, mood: 4, title: "Small wins",
    body: "We submitted the group project and it went fine. I charged my phone across the room and was asleep before midnight, first time in two weeks. Ẹ kú iṣẹ́ to me.\n\nWalked round the campus this evening too. Small wins, but today I'll take them. Ó dára." },
  { daysAgo: 1, hour: 22, mood: 3, title: "Ideas for departmental week",
    body: "Thoughts for departmental week while they're fresh:\n• A study-skills session for first years: how to actually prepare for tests\n• A \"sleep and screens\" talk, I'm the example of what not to do\n• Ask Dr. Okoye if the old lab can host a quiz night\n• Invite Bisi's friend who does design for the posters\n\nI like having something to look forward to." },
];

const DAY = 864e5;

function build(seed: Seed): Entry {
  const when = new Date(Date.now() - seed.daysAgo * DAY);
  when.setHours(seed.hour, 12, 0, 0);
  if (when.getTime() > Date.now()) when.setTime(Date.now() - 60_000);
  const iso = when.toISOString();
  return { id: store.uid(), created: iso, updated: iso, title: seed.title, body: seed.body, prompt: seed.prompt ?? null,
    mood: seed.mood, segments: [], sample: true };
}

/** Add the example entries. Returns how many were added (0 if they are already there). */
export async function addSample(): Promise<number> {
  if ((await store.entries()).some((e) => e.sample)) return 0;
  await store.putEntries(SEEDS.map(build));
  return SEEDS.length;
}

export async function sampleCount(): Promise<number> {
  return (await store.entries()).filter((e) => e.sample).length;
}

/** Remove the example entries (and anything attached to them). The person's own entries are never touched. */
export async function removeSample(): Promise<number> {
  const mine = (await store.entries()).filter((e) => e.sample);
  for (const e of mine) await store.deleteEntry(e.id);
  return mine.length;
}

/** The account given to judges. Signing in as it fills this device's journal with the sample entries, because a journal lives in the browser, not on the server. */
export const DEMO_EMAIL = "demo@mindly.test";
