# Last Seen on Mars

**NASA Space Apps Challenge 2026: "Abandoned but not Forgotten"** · Team Git dwellers

A space map where kids chat with the machines NASA left behind on the Moon, on Mars and out past the planets. Tap a glowing signal, the camera flies to that world, and the machine says hello in its own voice. Every answer it gives is a real fact from NASA.

## The 8 machines

| Machine | Where | Status |
|---|---|---|
| Opportunity (rover) | Mars, Meridiani Planum | Silent since 2018 |
| Spirit (rover) | Mars, Gusev Crater | Silent since 2010 |
| Ingenuity (helicopter) | Mars, Jezero Crater | Grounded since 2024 |
| InSight (lander) | Mars, Elysium Planitia | Silent since 2022 |
| Apollo 11 laser mirror | Moon, Sea of Tranquility | **Still working** |
| Apollo 17 Moon buggy | Moon, Taurus-Littrow | Parked since 1972 |
| Surveyor 3 | Moon, Ocean of Storms | Silent since 1967 |
| Voyager 1 | Interstellar space | **Still working** |

## What you can do

The site is a scrolling story. As you scroll, a 3D camera travels from Mars to the Moon, out to Voyager 1 and back, one machine per chapter, in the order they arrived (1967 to 2021). The sky changes colour with each world: Martian daytime butterscotch, lunar silver, the violet of deep space.

- **Real 3D worlds** (Three.js) with real surface maps: NASA's Viking colour mosaic of Mars, a lunar map, and NASA's Blue Marble Earth with a glossy ocean and moving clouds. Every machine is pinned at its **real landing site** (latitude and longitude).
- **Each chapter**: the year, big animated numbers, the machine's photo and its first words.
- **Talk to it**: a chat card opens. Tap a suggested question or type your own; answers come only from NASA facts.
- **Real NASA recordings**: InSight's Mars wind and a marsquake, Ingenuity's rotors heard by Perseverance, "The Eagle has landed", and Voyager 1's plasma sounds.
- **Seen from orbit**: the NASA orbit photo of each landing site.
- **Voyager 1 live distance**: ticks up in real time. On 18 Nov 2026 it becomes the first spacecraft one light-day from Earth.
- **Live Mars clock**: each Mars chapter shows the local solar time right now at that machine's landing site (Mars Sol Date formula from Allison and McEwen, 2000, as used by NASA's Mars24).
- **Why they went quiet**: a dust storm simulator. Drag the dust (tau) from a normal day (0.5) to 10 June 2018 (10.8) and watch the real 3D Mars go dark while Opportunity's solar power falls from about 645 to 22 watt-hours, below what it needs to survive. The two endpoints are Opportunity's real readings; values in between follow a curve through them.
- **Planned vs. actually lived**: one chart comparing each machine's planned mission length with how long it really worked (Opportunity 57x, Ingenuity 72 flights instead of 5, Voyager 1 still going after 49 years).
- **Signal lab**: send a message to the Moon, Mars or Voyager 1. The distance to Mars is calculated live from JPL's planetary orbital elements, so the light-travel time and the reply time are real for today.
- **Mission log** talk to all 8 machines to unlock a certificate with your name.

The machines' feelings are imagined for the story. The facts are real.

## NASA data used

- [NASA Image and Video Library](https://images.nasa.gov) and [NASA/JPL Photojournal](https://photojournal.jpl.nasa.gov): photos of each machine
- [HiRISE (Mars Reconnaissance Orbiter)](https://hirise.lpl.arizona.edu): orbit photos of Opportunity (PIA22549), Spirit (PIA12205), Ingenuity (PIA25174) and InSight (PIA26515)
- [NASA Sounds from Beyond](https://www.nasa.gov/sounds-from-beyond/) and [NASA Historical Sounds](https://www.nasa.gov/historical-sounds/): InSight, Ingenuity and Apollo 11 recordings; Voyager 1 plasma sounds ([PIA17045](https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space))
- [LROC (Lunar Reconnaissance Orbiter Camera)](https://www.lroc.asu.edu): orbit photos of the Apollo 11 (PIA12925), Apollo 17 (PIA12920) and Surveyor 3 / Apollo 12 (PIA12903) sites
- NASA mission pages for every fact: [Opportunity](https://science.nasa.gov/mission/mer-opportunity/), [Spirit](https://science.nasa.gov/mission/mer-spirit/), [Ingenuity](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-helicopter/), [InSight](https://science.nasa.gov/mission/insight/), [Apollo 17](https://www.nasa.gov/mission/apollo-17/), [Surveyor 3](https://science.nasa.gov/mission/surveyor-3/), [Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/)

Each machine's facts, photo credits and source links are in [`src/machines.js`](src/machines.js).

## How it works

Plain HTML, CSS and JavaScript, built with [Vite](https://vite.dev). No framework, no backend.

- `src/machines.js`: every machine's facts, suggested questions, replies and photo credits. Machines only ever say what is written here.
- `src/main.js`: the SVG space map, the camera, and the chat. Typed questions are matched to keywords. If nothing matches, the machine says it doesn't know, in character.
- `public/portraits/` and `public/photos/`: the NASA images. `public/audio/`: the NASA sounds. Run `bash get-nasa-photos.sh` to download all of them.
- `src/scene.js`: the 3D scene (Three.js) and the real landing-site coordinates.
- `public/textures/`: planet maps. Mars: NASA/JPL/USGS Viking MDIM 2.1 colour mosaic (public domain, via the wakusei-planets package). Earth: NASA Blue Marble with water and topography masks (via three-globe). Moon: lunar surface and bump maps (via globe.gl examples).
- `src/sound.js`: the soundscape (Web Audio API) and the machines' voices (Web Speech API).

## Run it

```bash
npm install
bash get-nasa-photos.sh
npm run dev
```

## AI tools used

Claude (Anthropic) helped with code and design. All facts were checked against the NASA pages linked above.
