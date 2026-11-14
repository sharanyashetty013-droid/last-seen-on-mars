#!/usr/bin/env bash
# Downloads the 16 NASA images the app uses into public/portraits and public/photos.
# Run it from the project folder in Git Bash:   bash get-nasa-photos.sh
# All images are NASA public-domain images. Credits are shown in the app.

cd "$(dirname "$0")" || exit 1
mkdir -p public/portraits public/photos

ok=0
failed=()

# fetch <save-as> <nasa id> [more ids/urls...]
fetch() {
  local dest="$1"; shift
  if [ -s "$dest" ] && [ "$(stat -c%s "$dest" 2>/dev/null || wc -c <"$dest")" -gt 20000 ]; then
    echo "  already have $dest"; ok=$((ok+1)); return
  fi
  for id in "$@"; do
    local urls=()
    if [[ "$id" == http* ]]; then
      urls=("$id")
    else
      urls=(
        "https://images-assets.nasa.gov/image/$id/$id~large.jpg"
        "https://images-assets.nasa.gov/image/$id/$id~medium.jpg"
        "https://photojournal.jpl.nasa.gov/jpeg/$id.jpg"
        "https://images-assets.nasa.gov/image/$id/$id~orig.jpg"
      )
    fi
    for u in "${urls[@]}"; do
      if curl -sfL --max-time 120 -o "$dest.tmp" "$u"; then
        # Keep it only if it's a real JPEG and not tiny.
        if [ "$(head -c 2 "$dest.tmp" | od -An -tx1 | tr -d ' \n')" = "ffd8" ] && [ "$(wc -c <"$dest.tmp")" -gt 20000 ]; then
          mv "$dest.tmp" "$dest"
          echo "  got $dest   <- $u"
          ok=$((ok+1)); return
        fi
      fi
    done
  done
  rm -f "$dest.tmp"
  echo "  COULD NOT GET $dest"
  failed+=("$dest")
}

echo "Machine photos (chat banners):"
fetch public/portraits/opportunity.jpg PIA17759
fetch public/portraits/spirit.jpg      PIA03610 PIA03275
fetch public/portraits/ingenuity.jpg   PIA24547
fetch public/portraits/insight.jpg     PIA25287
fetch public/portraits/mirror.jpg      as11-40-5952 AS11-40-5952
fetch public/portraits/lrv.jpg         as17-147-22526 AS17-147-22526
fetch public/portraits/surveyor3.jpg   as12-48-7134 AS12-48-7134 as12-48-7133
fetch public/portraits/voyager1.jpg    PIA17046

echo "Orbit photos (Where am I?):"
fetch public/photos/opportunity.jpg PIA22549
fetch public/photos/spirit.jpg      PIA12205
fetch public/photos/ingenuity.jpg   PIA25174
fetch public/photos/insight.jpg     PIA26515
fetch public/photos/mirror.jpg      PIA12925
fetch public/photos/lrv.jpg         PIA12920
fetch public/photos/surveyor3.jpg   PIA12903
fetch public/photos/voyager1.jpg    PIA23645

echo
echo "Done: $ok of 16 images."
if [ ${#failed[@]} -gt 0 ]; then
  echo "Missing (download these by hand from the link in src/machines.js, save with exactly this name):"
  printf '  %s\n' "${failed[@]}"
fi

# ---------- Real NASA sounds for the voice notes ----------
mkdir -p public/audio
getsound() {
  local dest="$1"; shift
  if [ -s "$dest" ]; then echo "  already have $dest"; return; fi
  for u in "$@"; do
    if curl -sfL -A "Mozilla/5.0" --max-time 180 -o "$dest" "$u" && [ "$(wc -c <"$dest")" -gt 20000 ]; then
      echo "  got $dest"; return
    fi
  done
  rm -f "$dest"; echo "  COULD NOT GET $dest (that voice note just won't show)"
}
echo
echo "NASA sounds (voice notes):"
getsound public/audio/insight-wind.wav  "https://www.nasa.gov/wp-content/uploads/2015/01/08-Brian-Cook_raw_velocity_0.6_normalisedx1_2octavesUp_03.wav" "https://www.nasa.gov/wp-content/uploads/2015/01/07-Mars_sound1a_20s_x100.wav"
getsound public/audio/insight-quake.wav "https://www.nasa.gov/wp-content/uploads/2015/01/Quake-Sol-173.wav"
getsound public/audio/ingenuity.wav     "https://www.nasa.gov/wp-content/uploads/2024/05/jpl-20210506-listen-to-nasas-ingenuity-helicopter-as-it-flies-on-mars.wav"
getsound public/audio/mirror.mp3        "https://www.nasa.gov/wp-content/uploads/2015/01/569462main_eagle_has_landed.mp3"
getsound public/audio/voyager1.webm     "https://commons.wikimedia.org/wiki/Special:FilePath/Voyager_Captures_Sounds_of_Interstellar_Space.webm"
echo "Sounds done."

echo "All done."
