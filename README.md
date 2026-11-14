# Last Seen on Mars

**Eight machines we left on other worlds. Most went silent long ago. Two still answer.**

An interactive 3D story about the hardware NASA left behind on the Moon, on Mars and in interstellar space, and the science each machine made possible. Built for the **NASA Space Apps Challenge 2026**, challenge *"Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars"*.

**Live site:** 

---

## The idea

Kids know "a rover went to Mars". Few know that Opportunity was built for 90 days and drove for almost 15 years, that a mirror left by Apollo 11 is still used by scientists today, or that Voyager 1 is about to become the first object ever to be a full light-day from Earth.

The facts exist, but they're spread across NASA pages written for adults. **Last Seen on Mars** turns them into one journey you scroll through, where every machine can talk back.

## What you can do

### Travel through a real 3D solar neighbourhood
Scrolling moves a camera from Mars to the Moon, out to Voyager 1 and back, one chapter per machine, in the order they arrived (1967 to 2021). The planets use real surface maps, and **every machine is pinned at its real landing site** (latitude and longitude). As each chapter opens, the planet turns so that site rotates into daylight.

### Talk to the machines
Each machine answers questions in the first person, using **only facts from its NASA fact sheet**. Tap a suggested question or type your own. If it doesn't know, it says so.

### Hear real NASA recordings
- Martian wind and a magnitude 3.7 marsquake, recorded by **InSight**
- **Ingenuity**'s rotors, heard by Perseverance's microphone
- "The Eagle has landed", Apollo 11, July 1969
- The plasma "sound" of interstellar space, recorded by **Voyager 1**

### See where they are now
"Seen from orbit" opens the real orbital photo of each landing site, taken by NASA's Mars Reconnaissance Orbiter (HiRISE) and Lunar Reconnaissance Orbiter (LROC).

### Why they went quiet: dust storm simulator
Drag the dust in the Martian sky from a clear day to 10 June 2018, and watch the real 3D Mars go dark while Opportunity's solar power falls from about **645 to 22 watt-hours**, below what it needed to survive. "Play the June 2018 storm" replays it automatically.

### Planned vs. actually lived
How long NASA planned each mission to last, and how long the machine really worked:

| Machine | Planned | Actually lived |
|---|---|---|
| Opportunity | 90 Martian days | about 14 years (57× longer) |
| Spirit | 90 Martian days | about 6 years (25×) |
| Ingenuity | 30 Martian days, 5 flights | about 2.7 years, 72 flights |
| InSight | 1 Mars year | about 4 years (2×) |
| Voyager 1 | 5 years | 49 years and counting |
| Apollo 11 laser mirror | no end date | still in use |

### Live science, calculated in your browser
- **Local Mars time** at each Mars landing site, right now (the Mars Sol Date method used by NASA's Mars24).
- **Voyager 1's live distance** from Earth, ticking upward. It crosses one light-day on 18 November 2026.
- **Signal lab:** send a message to the Moon, Mars or Voyager 1. Today's Earth–Mars distance is computed from JPL's planetary orbital elements, so the light-travel time and the time a reply would come back are real.

### Mission log
Talk to all eight machines to unlock a certificate with your name on it.

## The eight machines

| Year | Machine | Where | Status |
|---|---|---|---|
| 1967 | Surveyor 3 | Ocean of Storms, Moon | Silent since May 1967 |
| 1969 | Apollo 11 laser mirror | Sea of Tranquility, Moon | **Still in use** |
| 1972 | Apollo 17 lunar rover | Taurus-Littrow, Moon | Parked since December 1972 |
| 1977 | Voyager 1 | Interstellar space | **Still sending data** |
| 2004 | Spirit | Gusev Crater, Mars | Silent since March 2010 |
| 2004 | Opportunity | Meridiani Planum, Mars | Silent since June 2018 |
| 2018 | InSight | Elysium Planitia, Mars | Silent since December 2022 |
| 2021 | Ingenuity | Jezero Crater, Mars | Grounded since January 2024 |

## NASA data and resources used

- **NASA Image and Video Library** and **NASA/JPL Photojournal**: photos of each machine
- **HiRISE (Mars Reconnaissance Orbiter)**: orbital photos of the Opportunity (PIA22549), Spirit (PIA12205), Ingenuity (PIA25174) and InSight (PIA26515) sites
- **LROC (Lunar Reconnaissance Orbiter Camera)**: orbital photos of the Apollo 11 (PIA12925), Apollo 17 (PIA12920) and Surveyor 3 / Apollo 12 (PIA12903) sites
- **NASA Sounds from Beyond** and **NASA Historical Sounds**: InSight, Ingenuity and Apollo 11 recordings; Voyager 1 plasma sounds (PIA17045)
- **Planet maps**: NASA/JPL/USGS Viking MDIM 2.1 colour mosaic (Mars), NASA Blue Marble (Earth), lunar surface maps
- **JPL "Keplerian Elements for Approximate Positions of the Major Planets"**: live Earth–Mars distance
- **NASA mission pages** (Opportunity, Spirit, Ingenuity, InSight, Apollo 11, Apollo 17, Surveyor 3, Voyager 1): every fact the machines say
- Dust storm readings: NASA JPL mission status reports and The Planetary Society

Every image and sound credit is shown in the app next to the item and links to its NASA source.

## Keeping it true

1. A machine only says what is in its fact sheet in `src/machines.js`, and each fact sheet links to its NASA source.
2. Personality is imagined (feelings, jokes). Facts are not changed. The site says this on the page.
3. Where a value is modelled rather than measured (the dust simulator between its two real readings), the page says so.

## How it's built

Plain HTML, CSS and JavaScript with [Vite](https://vite.dev). There's no framework and no backend; everything runs in the browser.

| File | What it does |
|---|---|
| `src/scene.js` | The 3D scene in [Three.js](https://threejs.org): planets, real landing-site coordinates, the Voyager 1 model, camera flights, the dust storm lighting |
| `src/main.js` | Story chapters, chat, recordings, Mars clocks, Signal lab, dust simulator, lifespan chart, certificate |
| `src/machines.js` | The eight fact sheets: facts, questions, replies, photo and sound credits |
| `src/sound.js` | The ambient soundscape and radio effects (Web Audio API) |
| `src/style.css` | The design |
| `public/` | NASA photos, sounds and planet maps |

Libraries: Three.js (3D), Lenis (smooth scrolling), Instrument Serif and Inter (fonts, via Fontsource).

## Run it locally

```bash
git clone https://github.com/sharanyashetty013-droid/last-seen-on-mars.git
cd last-seen-on-mars
npm install
npm run dev
```

The NASA photos and sounds are included. `bash get-nasa-photos.sh` re-downloads them from NASA if needed.

## AI tools used

Claude (Anthropic) was used as a coding and design assistant. All facts were checked against the NASA sources listed above.

## Team

**Git dwellers**: Sharanya L Shetty, NMAMIT, Karkala, India

---

*NASA does not endorse this project. NASA photos, sounds and data are public domain; credits appear in the app.*
