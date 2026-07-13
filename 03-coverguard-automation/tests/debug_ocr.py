"""Debug OCR detection on failing covers."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
import numpy as np

files = [
    ('img/image (29) (2).png', '9789898652616'),
    ('img/image (35) (2).png', '9789373145068'),
    ('img/9789373147499_shabd.png', '9789373147499'),
]

for fname, isbn in files:
    img = np.array(Image.open(fname).convert('RGB'))
    h, w = img.shape[:2]
    front = img[:, w//2:, :]
    fh, fw = front.shape[:2]

    from core.preprocessor import compute_dpi
    from core.geometry_engine import compute_safe_zones
    dpi = compute_dpi(front)
    zones = compute_safe_zones(front, dpi)
    badge_top = fh - zones.badge_zone_px
    near_top = badge_top - zones.near_miss_px

    print(f'\n=== {fname} ===')
    print(f'  {fw}x{fh}px | DPI={dpi:.1f} | badge_top={badge_top}px | near_top={near_top}px')

    from core.ocr_engine import detect_text
    blocks, engine = detect_text(front)
    print(f'  OCR: {len(blocks)} blocks via {engine}')
    for b in sorted(blocks, key=lambda x: x.bbox[1], reverse=True)[:15]:
        pct = (1 - b.bbox[3]/fh) * 100
        flags = []
        if b.bbox[3] >= badge_top: flags.append('IN_BADGE')
        if b.bbox[3] >= near_top: flags.append('IN_NEAR')
        print(f'    y2={b.bbox[3]:4d} ({pct:4.1f}% above bot) [{",".join(flags) or "OK"}] "{b.text[:50]}"')
