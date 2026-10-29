# Models

Mindly uses two open-weight models. Nothing in the challenge brief requires us to host them ourselves: it asks that an open-weight model is a meaningful part of the product, that we explain the choice, and that we check and comply with its licence. We call both through hosted, OpenAI-compatible endpoints (Groq, OpenRouter) and can self-host by changing two URLs.

## Chosen

| Role | Model | Licence | Why |
|---|---|---|---|
| Speech to text | Whisper large-v3-turbo (hosted on Groq); Whisper small via faster-whisper as a CPU fallback | MIT | Strongest openly licensed speech model that is also served very fast ($0.04 per hour of audio; about a second for a one-minute note), and runs on an ordinary CPU if we self-host |
| Writing, Reflect, Chat | Google Gemma 4 26B-A4B-it | Apache 2.0, with Google's Gemma 4 terms linked from the model card | Tool calling, multilingual, about 4B active parameters per token so it is fast and costs roughly $0.00006 per written page and $0.0001 per chat reply |

## Compared

- **Language model:** a larger or DeepSeek-class model was not cheaper for this task. Entries are short, so the cost is dominated by per-request overhead, where an A4B mixture-of-experts model wins. Gemma also follows the "write faithfully, don't add or advise" rule well in our tests, including with Nigerian Pidgin.
- **Speech:** Whisper's hosted turbo variant gives the best latency for a hosted open model. Local Whisper small is the privacy and cost fallback but takes roughly 15 to 30 seconds per minute of audio on a CPU.
- **Speech output (TTS):** not used. Mindly replies in text.

## Languages

| Language | Speech in | Chat replies |
|---|---|---|
| English, Nigerian English | Good | Good |
| Pidgin | Short phrases transcribe reasonably; longer speech comes out as approximate English | Natural in our tests |
| Yoruba, Hausa | Experimental in Whisper | Plausible; needs review by native speakers |
| Igbo | Not supported by Whisper | Plausible; needs review by native speakers |

Next step for speech: a Nigerian code-switching model such as yecsASR (Yoruba and English), or fine-tuning Whisper on Nigerian speech.

## Licence compliance

- Whisper (MIT): no usage restrictions beyond the licence text. The model card advises against transcribing people without their consent, so Mindly is built for the user's own voice. Onboarding asks users to confirm this and the Terms page states it.
- Gemma 4 (Apache 2.0): checked on the model card on 29 October 2026. The card links Google's Gemma 4 licence page; the team should read it once before launch. Users agree in onboarding and in the Terms to use the models within their licences.
- OpenRouter requests are restricted to providers that don't collect or train on prompts.
