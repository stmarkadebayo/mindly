# Mood chart: research and recommendations

The chart: "Mood, last two weeks" on Insights. One dot per day, coloured by the mood picked after recording, joined by a line.

## What the research says

1. **Show what was recorded, not what was assumed.** Most chart tools join the points that exist and hide the gaps. Datawrapper's guidance is to keep gaps visible, mark every real reading with a symbol, and use dashed segments for values that were not collected. [Datawrapper: patchy data](https://www.datawrapper.de/academy/patchy-data)
2. **Never fill a missing day with zero.** The line then drops to the floor each time someone skips a day, which reads as a bad day. Mood is an ordinal scale and zero is not a rating. (Our inference; the failure is described in a [forum thread](https://forum.opensearch.org/t/can-we-change-default-behavior-of-line-chart-when-theres-missing-data-points/19486).)
3. **Dots suit sparse, irregular data.** With a few points, dots stress the individual readings. Past a few dozen they merge into a band. Two weeks (14 points) is a good size. [Dot-line chart guidance](https://www.pageon.ai/blog/how-to-create-a-line-chart-with-only-dots)
4. **Line charts are the best-liked form for a time series, but depend on the task.** In a controlled comparison of emotion time series, the line chart won on performance and preference. The authors stress that this depends on the task. [Haifa study](https://cris.haifa.ac.il/en/publications/a-comparative-evaluation-of-techniques-for-time-series-visualizat/)
5. **Calendars are good for patterns, bad for exact values.** An eight-week field study found calendar views helped people see repeating patterns and anomalies, but unlabelled values made precise reading hard. [On-calendar field study](https://arxiv.org/pdf/1706.01123)
6. **People want to compare and to understand "is it getting better?".** Users of mood apps wanted to compare today with earlier entries, yet found it hard to tell whether their mood was improving. [Mobile personal data visualisation review](https://arxiv.org/pdf/2203.01374)
7. **Reflection needs exploration.** People gain different insights as they explore their own data, and most tracking tools stop at simple feedback. [Microsoft Research](https://www.microsoft.com/en-us/research/publication/understanding-self-reflection-people-reflect/)

Gap: no study we found isolates a calendar against a line graph for mood and reflection. Treat the choice below as a reasoned bet, and test it.

## What is wrong with the current chart

- The line is thick and dark. It is the loudest thing, yet the dots are the data.
- The line crosses missed days (between Wed and Thu) as if the mood moved smoothly.
- The vertical axis has gridlines but no labels, so a reader cannot say what "high" means.
- Weekday initials repeat (T, T, S, S, M) and give no date.
- A column for "today" has no dot and no marker, so it looks like something failed to load.
- Nothing is tappable. The chart shows a pattern but does not lead to the entry behind it.
- There is no sentence. People struggle to read a trend, so the chart should say it.

## Recommendations

1. **Thin the line, enlarge the meaning of the dots.** Line at about 1.5px in a muted tone. Dots keep the mood colour.
2. **Break the line at missed days.** Draw a faint dashed segment, or no segment. Never a solid one across a gap. Never zero.
3. **Label the vertical axis with the moods.** Use the same words or faces as the mood picker, at the gridlines. Keep it to three labels (high, middle, low).
4. **Fix the horizontal axis.** Show the date number under each dot (or every second day), with the weekday for the first and today. Mark today with a ring.
5. **Add a one-line reading above the chart.** For example "Mostly calm this fortnight. Best day: Friday." Generated from the data, no AI call needed.
6. **Make dots tappable.** Tap a dot to see that day's mood, a short title and a link to the entry. This is the exploration the research says matters.
7. **Do not rely on colour alone.** Position on the vertical axis already carries the value. Keep colour as support, and make sure the contrast holds on both themes.
8. **Keep the calendar (month page) as the second view.** Chart for the trend, calendar for the pattern. Do not add a third.

## Order of work

- Small, do now: 1, 2, 3, 4 (CSS and the chart component only).
- Next: 5 (a small pure function) and 6 (a popover reusing the existing journal link).
- Later, after user tests: whether a weekly average line or a wider range (30 days) helps. Do not add either before people ask.

## How to check it works

Ask five people, with no hint, to answer from the chart alone: "Which day was your best?", "Did you skip any days?", "Is your month getting better or worse?". If any of them needs the legend or guesses, the chart has failed that question.
