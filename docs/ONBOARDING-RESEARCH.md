# Onboarding: research and recommendations

Goal: a new person reaches "my words became a page" fast, comes back the next day, and later chooses to pay.

Caveat: most sources are vendor blogs and teardowns. Numbers are directional. The only way to know is to measure our own funnel (see the end).

## What the research says

1. **Time to first value is the number that matters, not screen count.** Aim for the core value within about a minute. Pick one activation action (for us: the first recorded entry) and measure it. Common mistakes: front-loading information and asking for account creation before value. [Eleken](https://www.eleken.co/blog-posts/mobile-app-onboarding-best-practices), [Appalize](https://www.appalize.com/blog/app-marketing/mobile-app-onboarding-best-practices-that-reduce-churn), [Innertrends](https://www.innertrends.com/blog/onboarding-is-it-a-good-idea-to-get-to-first-value-a-s-a-p)
2. **Track step drop-off.** Suggested targets from one guide: onboarding completion 60%+, first core action completed 50%+. Also day-1 and day-7 return. [Appalize](https://www.appalize.com/blog/app-marketing/mobile-app-onboarding-best-practices-that-reduce-churn)
3. **Paywall timing in journal apps.** Daylio puts a soft paywall with a 7-day trial at the end of onboarding. A teardown warns that a paywall before the first entry adds friction. [Daylio teardown](https://screensdesign.com/showcase/daylio-journal-daily-diary)
4. **Habit before payment.** A developer post (one anecdote) reports wellness apps convert trials well (35%) but retain at first renewal poorly (30%), and argues the paywall belongs after the habit forms. [DEV Community](https://dev.to/eventideapp/i-shipped-my-app-to-production-an-hour-before-upload-i-realized-i-was-wrong-about-my-own-paywall-2adm)
5. **Personalised onboarding lifted revenue.** Applica's redesign of Five Minute Journal's onboarding reportedly raised ARPU by 20%. [RevenueCat](https://www.revenuecat.com/blog/growth/five-minute-journal-onboarding-redesign-arpu)
6. **Make the trial a choice.** Rizz App found many users cancelled early because they never actively chose the trial. A two-step paywall raised trial conversion 10%. [Superwall](https://superwall.com/case-studies/rizz-god)
7. **Permission priming.** A short pre-permission screen turns a one-shot system prompt into a two-step exchange. We found no controlled microphone study, only vendor claims. Asking at the moment the person taps record is the strongest case. [Appcues](https://appcues.com/blog/mobile-permission-priming), [Google Meet](https://web.dev/case-studies/google-meet-permissions-best-practices)

## Where we are now

Landing, sign-up, name, goals, short privacy step (just shortened; full text moved to Terms), then the orb: "say a few words", which becomes the first entry. After that the person lands on the entry.

Done in this round: privacy step shortened to three facts and one consent line, mic reason shown on the orb step, goals step kept.

## Recommendations (to make people stay, then pay)

**A. Make minute one end in a reward**
1. After the first entry, show the first level ("Blank Page → First Lines") and what the page looks like, once, in one line. The point system is already there; this is the moment to introduce it.
2. Offer exactly one next step: "Come back tomorrow, or set a reminder." Not three.
3. Do not mention price during onboarding. The trial card already appears once a day for 5 seconds; leave it.

**B. Build the habit in days 1 to 7**
4. Ask for a daily reminder time right after the first entry, not before it (the person now knows what the reminder is for). Default to evening.
5. Day 2 and day 3 should each have one small, named reason to return: a time-of-day prompt, a streak of 2, a first reflection. Do not show every feature at once.
6. Show a "first week" strip (7 dots) on Today until it is complete. It makes the goal small and visible. Hide it afterwards.

**C. Ask for money after value, as a choice**
7. Keep the 30-day trial without a card. Raise the plan only at moments of felt value: after the first insights reading, after the third reflection, or when the free daily speech limit is hit. These are the moments the product already knows about.
8. When a limit is hit, say what they keep (every page, all reflections) and what Pro adds (unlimited speech). Never lock existing entries.
9. A two-step upgrade (plans page, then confirm) so that starting is a decision, not an accident.

**D. Reduce risk of drop-off**
10. If the mic is denied, offer typing the first entry instead of ending the flow.
11. Make the Skip on the orb step lead to a first page with a prompt ready, so skipping does not leave an empty Today.

## What to measure

Record these events (counts only, no content): sign-up started, each step reached, mic allowed or denied, first entry saved, first entry within 24 hours of sign-up, day-1 return, day-7 return, upgrade page viewed, checkout started, paid. Review weekly with the first 50 users before changing the flow again.

## What to leave alone

- No sign-up-free trial of voice (decided).
- No more onboarding steps. Every addition should replace something.
- No tour or tooltips.
