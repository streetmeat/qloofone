QlooPhone Taste Matchmaker – PRD

Goal: Deliver a dial‑in demo where hackathon judges call a number, share any two favorite things supported by the Qloo api (movies, music, books, TV shows, etc.), and instantly receive perfect recommendations that bridge both tastes, powered by Qloo Taste AI + GPT‑4o. This suggestion can be a combination of available entities and other avaiable customizable recommendations available through the Qloo API.

1 · Problem & North‑Star Outcome

Problem  The endless debate - people spend countless minutes scrolling Netflix, arguing about podcasts, or trying to find something everyone will enjoy. Whether it's date night paralysis, group indecision, or you're aruging with yourself, people shouldn't waste time with "what should we watch/do/try?" Judges need lightning‑fast proof that Qloo's taste graph solves this universal frustration via a simple phone call.

North‑Star "Wow"  A user/judge dials in, says "I love Taylor Swift and my friend loves heavy metal", and within ~6 s hears: "Got it! You'd both enjoy Paramore - they have Taylor's catchy melodies with rock energy your friend craves. Perfect bridge between your tastes!"


2 · Target User & Use Case

Aspect

Decision

Persona

Hackathon judges (demonstrating universal preference bridging)

Caller Input

Two preferences of any type (movies, music, TV shows, books, brands, places, podcasts, games)

Output Template

One perfect compromise recommendation with explanation of taste connections

Voice Persona

Enthusiastic taste matchmaker who "gets it" - quick, natural, nostalgic, slightly reminiscent of Moviefone

Privacy Angle

Qloofone & Qloo API works on taste signals only; no PII stored, no app, cookies, or data collection of any sort. 

3 · Core Experience Flow

Greeting – "Hi! I'm QlooPhone. Tell me two of your favorite things - like movies, music, TV shows, books, restaurants, games, or brands - and I'll find something amazing that connects them both. What are your two favorites?"

Quick acknowledgment – "Got it!" / "Ooh, nice!" / "Love it!" (immediate feedback while processing)

Entity resolve – (GPT extracts types → qloo.search for both entity IDs)

Smart recommendation – (qloo.recommendations with entity IDs, sequel filtering, matching output type)

Narrative response – "Perfect! You'd both love 'Best in Show' - it has The Office's workplace comedy with dog references throughout. Great for both of you!" (TTS)

Optional Loop – "Want another suggestion?" → repeat from 2

4 · Functional Requirements

#

Requirement

Notes

FR‑1

Resolve any 2 cultural items to Qloo entity IDs via search.

Support 13 entity types: artist, movie, tv_show, book, brand, person, place, podcast, video_game, destination, album, locality, restaurant

FR‑2

Smart type detection and matching for recommendations.

If different types → find bridging type; if same type → use that type

FR‑3

Get combined recommendation using both entity IDs with sequel filtering.

Get combined recommendations using the Qloo API with sequel filtering (see API_DOCUMENTATION.md)

FR‑4

Spoken reply ≤ 15 s with taste bridge explanation, quick acknowledgments fill silence.

Immediate "Got it!" then explain specific elements that connect both preferences

FR‑5

Basic error handling:• unclear entity → "Which [item] do you mean?"• no result → "Let's try different favorites"

Keep it conversational and helpful

FR‑6

Landing page with animated scenarios showing the "endless debate" problem.

Simple design with Qloo branding, phone number, cycling examples of decision paralysis

5 · Non‑Functional Requirements

NFR

Target

Latency budget

< 6 s from final utterance to first TTS byte

Call length cap

2 min (simpler interaction = lower cost)

Scalability

Handle ≤ 10 concurrent calls

Deployability

One‑click deploy; .env for keys; README

Logging

Log: entities mentioned, types detected, entity IDs, recommendation, latency

6 · Implementation Status ✅

✅ Forked OpenAI × Twilio realtime demo (Node/Next).

✅ Added Qloo functions: search_entity, get_recommendation with sequel filtering.

✅ Optimized prompt - removed "cultural", added quick acknowledgments, natural flow.

⏳ Landing page complete - animated scenarios, Qloo branding, "end the endless debate", need to polish branding and layout

⏳ Record demo video once Twilio billing clears.

7 · Example Interactions

Example 1 (Movies):
Caller: "I love Star Wars and my girlfriend loves Pride and Prejudice"
QlooPhone: "Great combo! You'd both enjoy 'The Princess Bride' - it has the adventure and sword fighting you love with the romance and wit she enjoys. Perfect date night!"

Example 2 (Music):
Caller: "I'm into Drake and she loves Taylor Swift"
QlooPhone: "Nice mix! Check out The Weeknd - he's got Drake's Toronto R&B vibe with Taylor's pop sensibility and emotional storytelling. Try 'Blinding Lights' to start!"

Example 3 (Mixed Types):
Caller: "I love The Office and he's obsessed with Nike shoes"
QlooPhone: "Interesting combo! You'd both love 'Sneakerheads' on Netflix - it's got The Office's workplace comedy style but set in sneaker culture. Perfect bridge between your interests!"

Example 4 (Places):
Caller: "She loves Paris and I'm all about Tokyo"
QlooPhone: "Great taste in cities! You'd both fall in love with Montreal - it has Paris's European charm and café culture with Tokyo's incredible food scene and modern design. Perfect compromise destination!"

Example 5 (Books to Movies):
Caller: "I read Harry Potter and she watches Marvel movies"
QlooPhone: "Fantasy meets superheroes! Try 'Doctor Strange' - it's got Harry Potter's magic and mysticism wrapped in Marvel's action. Benedict Cumberbatch even gives off Dumbledore vibes!"

8 · Competitive Advantages

- Solves universal "can't decide" problem everyone faces daily
- Demonstrates both technical capability along with a branded polished service.
- Demonstrates cross-domain intelligence (the holy grail of recommendations)
- Natural conversation with instant acknowledgments (no awkward silence)
- Smart sequel filtering prevents obvious/lazy recommendations
- Landing page instantly communicates value with relatable scenarios
- Voice interface more memorable than web/app only

9 · Technical Innovations

- Sequel detection algorithm filters out lazy recommendations
- Dual API approach (v2/insights primary, recommendations fallback)
- Quick acknowledgment system eliminates processing silence
- Entity name caching for better sequel detection
- Comprehensive error handling for edge cases
- 13 entity types verified: 11 work for recommendations, all 13 work for search

10 · Entity Type Support

Confirmed Working Entity Types (13 total):

Search Support (All 13 work):
- urn:entity:artist - Music artists/bands
- urn:entity:movie - Films/movies  
- urn:entity:tv_show - TV series
- urn:entity:book - Books
- urn:entity:brand - Companies/brands
- urn:entity:person - Actors/directors/celebrities
- urn:entity:place - Venues/locations
- urn:entity:podcast - Podcasts
- urn:entity:video_game - Video games
- urn:entity:destination - Travel destinations
- urn:entity:album - Music albums
- urn:entity:locality - Cities/neighborhoods
- urn:entity:restaurant - Restaurants (maps to place)

Recommendation Support (11 work):
- All types except: album, locality (return 400 errors)

Note: Some entities return with different type values than queried (e.g., "person" may return as "actor", "restaurant" maps to "place")

Last updated: 2025‑07‑28