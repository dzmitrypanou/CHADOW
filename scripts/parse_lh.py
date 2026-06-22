import json
import sys
from pathlib import Path

d = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else r"d:\chadow.ru\tmp-lh.json").read_text(encoding="utf-8"))
cat = d["categories"]["performance"]
print("Score:", int(cat["score"] * 100))
aud = d["audits"]
for k in [
    "first-contentful-paint",
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "speed-index",
    "interactive",
    "max-potential-fid",
]:
    a = aud.get(k, {})
    print(f"{k}: {a.get('displayValue', '?')} (ms={a.get('numericValue', '?')})")

print("\n--- Opportunities ---")
ops = []
for k, v in aud.items():
    if v.get("score") is not None and v["score"] < 1 and v.get("numericValue", 0) > 50:
        ops.append((v.get("numericValue", 0), v.get("title", k), v.get("displayValue", ""), k))
ops.sort(reverse=True)
for n, t, dv, k in ops[:20]:
    print(f"  {t}: {dv}")

print("\n--- LCP element ---")
lcp = aud.get("largest-contentful-paint-element", {})
for item in lcp.get("details", {}).get("items", [])[:3]:
    print(" ", item)

print("\n--- Network summary ---")
for item in aud.get("network-requests", {}).get("details", {}).get("items", []):
    url = item.get("url", "")
    if any(x in url for x in ["style.css", "landing", "fontawesome", "fonts", "flag-icons", "logo", ".js", ".woff"]):
        print(f"  {item.get('transferSize',0)/1024:.1f}KB {item.get('resourceType')} {url[:100]}")

print("\n--- Unused CSS ---")
uc = aud.get("unused-css-rules", {})
for item in uc.get("details", {}).get("items", [])[:8]:
    print(f"  wasted {item.get('wastedBytes',0)/1024:.1f}KB total {item.get('totalBytes',0)/1024:.1f}KB {item.get('url','')[:80]}")

print("\n--- Render blocking ---")
rb = aud.get("render-blocking-insight", aud.get("render-blocking-resources", {}))
for item in rb.get("details", {}).get("items", [])[:10]:
    print(f"  {item.get('url','')[:100]}")
