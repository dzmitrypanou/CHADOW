#!/usr/bin/env python3
import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "css" / "vendor" / "fontawesome.min.css"
text = path.read_text(encoding="utf-8")
text = text.replace(
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/",
    "/css/vendor/webfonts/",
)
text = text.replace("font-display:block", "font-display:swap")
text = re.sub(
    r',url\(/css/vendor/webfonts/[^)]+\.ttf\) format\("truetype"\)',
    "",
    text,
)
path.write_text(text, encoding="utf-8")
print(f"Patched {path} ({path.stat().st_size} bytes)")
