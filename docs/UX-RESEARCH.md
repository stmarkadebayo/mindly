# UX research: the four core flows

Transcription, entry, reflection, insight. Desk research done on 3 Nov 2026 from public sources. The evidence is thin in places, and each
point says how strong its source is. Treat it as a list of hypotheses to test with real users, not as settled fact.

## What the research says

### Transcription
- Keep a stop control visible at all times, keep the text after stopping, and keep it editable. Never send or save-over it automatically.
  ([SAP Joule dictation guidance](https://www.sap.com/design-system/fiori-design-ios/v26-4/joule/patterns/joule-dictation): vendor design system)
- Cancelling must not silently destroy work. A user of Cursor's live dictation lost typed text when cancel rolled the box back, and asked for
  separate Stop and Submit actions. ([forum thread](https://forum.cursor.com/t/feedback-bugs-with-new-audio-transcription/171400): one user's report)
- Per-word confidence is the standard way to direct review: show low-confidence words faded, underlined or red, and let a tap offer fixes.
  Scores are the model's own guess, so word them as "check this", never "this is wrong".
  ([Soniox docs](https://docs.soniox.com/speech-to-text/core-concepts/confidence-scores), [Limecraft](https://support.limecraft.com/support/solutions/articles/48001224344), [CoLoop](https://coloop-knowledge-base.help.usepylon.com/articles/4559730024-how-do-i-fix-errors-in-my-transcript): vendor docs)

### Entry
- Day One is praised for reliability and a writing experience reviewers call unmatched; its AI is a side feature. Reviews are mostly rival
  blogs, so this is directional only. ([review roundup](https://www.rosebud.app/blog/best-journaling-apps-for-adults))
- Core journaling must keep working with the AI off: recording, browsing, editing and export must not depend on the model.
  ([Moëll and Aronsson, Frontiers in AI 2025](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1567580/full): peer reviewed)
- Show the AI's summary and let the person edit it, and let them add their own reflection, so the record stays theirs.
  ([MindfulDiary, CHI 2024](https://arxiv.org/html/2310.05231v2): peer reviewed, 28 patients over four weeks)

### Reflection (the chat)
- Structure the conversation in stages (rapport, exploration, wrap-up, sensitive topic) with short prompts for each. Mix open questions
  (feelings) and closed ones (specifics), and ask follow-ups that probe causes. Keep the person in control of when to continue or stop.
  ([MindfulDiary](https://arxiv.org/html/2310.05231v2))
- Build in a safety stage: respond with empathy, probe risk carefully, and point to help when risk is high. (same source)
- Be open about what the AI is and is not, and where its answers come from. Show uncertainty. Keep a persistent note that it is not a
  clinician. ([Moëll and Aronsson](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1567580/full))
- Headspace's Ebb was built around narrow use cases and a warm, consistent identity to earn trust (a practitioner talk, not research).
  ([dscout](https://dscout.com/guides-and-resources/headspace-building-ebb-priyanka-marawar))

### Insight
- Few, clearly labelled views beat dense dashboards. Users find mood apps impersonal and cluttered, and are very sensitive about privacy.
  ([IJDesign study](https://ijdesign.org/index.php/IJDesign/article/view/6149), [case study](https://medium.com/master-thesis-fine/designing-for-emotion-b7f258bb3b8c))
- Let the person see the raw entries behind a pattern, and show uncertainty so a correlation is not presented as a fact.
  ([arXiv 2202.03721](https://arxiv.org/abs/2202.03721))
- Help people find patterns but do not shortcut their own reflection, and avoid unsolicited advice about changing their life.
  ([IJDesign](https://ijdesign.org/index.php/IJDesign/article/view/6149))
- Insights that are easy to read can still feel obvious: participants recognised themselves, but learned less than expected.
  ([Univ. of Twente thesis](https://essay.utwente.nl/essays/74465): a student thesis)

### Habit and retention (supporting)
- Streaks appear after the first entry in successful apps, and the Stoic journal lets people switch them off. Reminders should reduce friction
  and not feel guilt-driven. ([teardowns](https://screensdesign.com/showcase/journal-mental-health-stoic), [review](https://macmyths.com/10-best-journal-apps-for-iphone))
- One vendor reports day-7 retention rising from 23% to 41% after asking a single question on day 1 instead of a tour. Self-reported and not
  a journaling app, so test it before relying on it. ([Product Hunt post](https://www.producthunt.com/p/murror/the-onboarding-trick-that-doubled-our-day-7-retention))

## Where Mindly stands today
Already in line: the journal and editor work offline and without the AI; recordings are kept and retried; transcripts are editable and never auto-sent;
a safety card appears for crisis language; insights link back to the entries behind them; reminders never carry journal content.

## Recommendations, in priority order
Status as of 3 Nov 2026.

1. **Flag shaky speech and let the person fix it in one tap.** *Done.* Hard-to-hear passages are highlighted in the entry; tapping one asks
   "Is this right?" (Looks right / Fix it).
2. **Make Cancel recoverable.** *Done.* Discarding a recording is immediate, with an 8-second Undo.
3. **Make Insights less obvious and less prescriptive.** *Done.* The reading now asks for specific cross-entry patterns and changes over time,
   ends with a question instead of advice, shows how many entries each observation comes from, and has a "Not quite right" control that
   hides the observation and tells the next reading not to repeat it.
4. **Give Reflect structure.** *Done.* Starters drawn from recent entries, past conversations on the page, one question at a time (open early,
   specific later), a gentle offer to save a journal note, and a visible "AI, not a therapist" line.
5. **Let people edit and add to what the AI wrote.** *Paused (decided 3 Nov 2026).* Idea: an explicit "In your words" space under the written
   page, so the AI's text reads as a draft and the person's own additions are clearly theirs. Pick it up later.
6. **Streak settings.** Offer a switch to hide the streak, and ask one question on day 1 instead of a longer tour.
7. **Run five short tests** with Nigerian students and young professionals (voice entry, a spoken list, a Pidgin entry, one Reflect chat,
   reading Insights) before building more.

## Gaps in this research
No published studies were found on voice journaling specifically, on Nigerian English or Pidgin speech UX, or on what users want from streaks.
Most journaling-app opinion comes from vendor blogs. The speech findings come from vendor documentation. Real users are the missing evidence.
