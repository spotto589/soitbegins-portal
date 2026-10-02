# Web-sized copies of every H0NEYP0T picture (2026-10-03).
# Phoenix art is 3844x2160 and up to 10 MB (one is a PNG); loading those
# through /api/ipfs-image left cards blank while the server pulled the
# whole file from IPFS. The collection only has a few dozen distinct
# pictures (Honeypots and Ashes share theirs), so each one is resized to
# 1600px wide WebP and served straight from the site:
#   assets/honeypot/img/<hash>.webp  +  assets/honeypot/images.json
#   ({ canonical ipfs.io image URL: "/assets/honeypot/img/<hash>.webp" })
# _ledgershop.js uses these and falls back to the IPFS proxy for anything
# newer. Rerun after new mints (needs Pillow; reads snapshot.json, so run
# scripts/honeypot-snapshot.mjs first):   python scripts/honeypot-images.py
import hashlib, io, json, os, sys, time, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SNAPSHOT = os.path.join(ROOT, 'assets', 'honeypot', 'snapshot.json')
OUT_DIR = os.path.join(ROOT, 'assets', 'honeypot', 'img')
MAP_FILE = os.path.join(ROOT, 'assets', 'honeypot', 'images.json')
GATEWAYS = ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://dweb.link/ipfs/']
MAX_WIDTH = 1600
QUALITY = 80

def fetch(url):
    path = url.split('https://ipfs.io/ipfs/', 1)[1] if url.startswith('https://ipfs.io/ipfs/') else None
    targets = [g + path for g in GATEWAYS] if path else [url]
    for attempt in range(3):
        for t in targets:
            try:
                req = urllib.request.Request(t, headers={'User-Agent': 'soitbegins-honeypot-images'})
                with urllib.request.urlopen(req, timeout=120) as r:
                    return r.read()
            except Exception as e:
                last = e
        time.sleep(3 * (attempt + 1))
    raise last

snap = json.load(open(SNAPSHOT, encoding='utf-8'))
images = sorted({m['image'] for m in snap['meta'].values() if m.get('image')})
os.makedirs(OUT_DIR, exist_ok=True)
mapping = json.load(open(MAP_FILE, encoding='utf-8')) if os.path.exists(MAP_FILE) else {}
failed = []
for i, url in enumerate(images, 1):
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + '.webp'
    rel = '/assets/honeypot/img/' + name
    out = os.path.join(OUT_DIR, name)
    if mapping.get(url) == rel and os.path.exists(out):
        continue
    try:
        im = Image.open(io.BytesIO(fetch(url)))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
        im.save(out, 'WEBP', quality=QUALITY, method=6)
        mapping[url] = rel
        print(f'{i}/{len(images)} {im.width}x{im.height} {os.path.getsize(out) // 1024}KB {url[-50:]}')
    except Exception as e:
        failed.append(url)
        print(f'{i}/{len(images)} FAILED {url}: {e}', file=sys.stderr)
json.dump(mapping, open(MAP_FILE, 'w', encoding='utf-8'), indent=0, sort_keys=True)
print(f'{len(mapping)} images mapped, {len(failed)} failed')
