"""Generate SVG art for @amjadiqbal/tanstack-table-url-state."""
import sys, os

OUT = sys.argv[1]
SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "Menlo, 'SF Mono', Consolas, monospace"

DARK = dict(bg1="#0B1220", bg2="#111C33", text="#F8FAFC", accent="#38BDF8", sub="#7DD3FC",
            muted="#94A3B8", chip="#16213A", chipstroke="#24324F", chiptext="#CBD5E1",
            foot="#64748B", panel="#0F172A", panelstroke="#24324F", row="#16213A",
            head="#1E293B", cell="#CBD5E1", green="#34D399")
LIGHT = dict(bg1="#F8FAFC", bg2="#E8EEF6", text="#0F172A", accent="#0284C7", sub="#0369A1",
             muted="#475569", chip="#FFFFFF", chipstroke="#CBD5E1", chiptext="#334155",
             foot="#64748B", panel="#FFFFFF", panelstroke="#CBD5E1", row="#F1F5F9",
             head="#E2E8F0", cell="#334155", green="#059669")


def icon_body():
    """512x512 icon: URL bar <-> sortable table, with an export badge."""
    return """
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#132844"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#ibg)"/>
  <!-- URL bar -->
  <rect x="56" y="58" width="400" height="80" rx="40" fill="#1E293B" stroke="#38BDF8" stroke-width="6"/>
  <text x="104" y="114" font-family="{SANS}" font-size="52" font-weight="800" fill="#38BDF8" text-anchor="middle">?</text>
  <rect x="140" y="88" width="92" height="20" rx="10" fill="#38BDF8"/>
  <rect x="244" y="88" width="64" height="20" rx="10" fill="#475569"/>
  <rect x="320" y="88" width="96" height="20" rx="10" fill="#7DD3FC"/>
  <!-- two-way sync arrows -->
  <g stroke="#38BDF8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M196 158 V214"/><path d="M176 194 L196 214 L216 194"/>
    <path d="M316 214 V158"/><path d="M296 178 L316 158 L336 178"/>
  </g>
  <!-- table -->
  <rect x="64" y="234" width="384" height="222" rx="30" fill="#1E293B"/>
  <path d="M64 264 a30 30 0 0 1 30 -30 h324 a30 30 0 0 1 30 30 v26 h-384 z" fill="#334155"/>
  <rect x="92" y="254" width="88" height="16" rx="8" fill="#F8FAFC"/>
  <path d="M192 254 l10 14 l10 -14 z" fill="#38BDF8"/>
  <rect x="236" y="254" width="72" height="16" rx="8" fill="#94A3B8"/>
  <rect x="340" y="254" width="72" height="16" rx="8" fill="#94A3B8"/>
  <rect x="64" y="304" width="384" height="44" fill="#0C4A6E"/>
  <g fill="#94A3B8">
    <rect x="92" y="318" width="112" height="14" rx="7" fill="#E0F2FE"/>
    <rect x="236" y="318" width="64" height="14" rx="7" fill="#BAE6FD"/>
    <rect x="340" y="318" width="52" height="14" rx="7" fill="#BAE6FD"/>
    <rect x="92" y="364" width="96" height="14" rx="7"/>
    <rect x="236" y="364" width="80" height="14" rx="7"/>
    <rect x="340" y="364" width="44" height="14" rx="7"/>
    <rect x="92" y="406" width="124" height="14" rx="7"/>
    <rect x="236" y="406" width="56" height="14" rx="7"/>
  </g>
  <!-- export badge -->
  <circle cx="404" cy="420" r="58" fill="#0F172A"/>
  <circle cx="404" cy="420" r="46" fill="#34D399"/>
  <g stroke="#0F172A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M404 396 V436"/><path d="M388 422 L404 438 L420 422"/><path d="M384 448 H424"/>
  </g>
""".replace("{SANS}", SANS)


def icon_svg():
    return f'<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">{icon_body()}</svg>\n'


def chips(x, y, labels, c, size=15, h=32, gap=10, cw=8.6):
    out, cx = [], x
    for lab in labels:
        w = round(len(lab) * cw + 36)
        out.append(f'<g transform="translate({cx},{y})"><rect width="{w}" height="{h}" rx="{h/2}" fill="{c["chip"]}" stroke="{c["chipstroke"]}"/>'
                   f'<text x="{w/2}" y="{h*0.66:.1f}" text-anchor="middle">{lab}</text></g>')
        cx += w + gap
    return (f'<g font-family="{SANS}" font-size="{size}" font-weight="600" fill="{c["chiptext"]}">' + "".join(out) + "</g>")


def demo(x, y, w, c, url, rows, scale=1.0, export=True):
    """Browser URL bar above a small sorted table."""
    s = scale
    rh, bar = 34 * s, 40 * s
    cols = [0.0, 0.46, 0.74]
    g = [f'<g font-family="{SANS}">']
    g.append(f'<rect x="{x}" y="{y}" width="{w}" height="{bar}" rx="{bar/2}" fill="{c["panel"]}" stroke="{c["accent"]}" stroke-width="2"/>')
    g.append(f'<text x="{x+18*s}" y="{y+bar*0.64:.1f}" font-family="{MONO}" font-size="{14*s:.1f}" fill="{c["muted"]}">{url[0]}'
             f'<tspan fill="{c["accent"]}" font-weight="700">{url[1]}</tspan></text>')
    ty = y + bar + 22 * s
    g.append(f'<g stroke="{c["accent"]}" stroke-width="{3*s:.1f}" stroke-linecap="round" fill="none">'
             f'<path d="M{x+w*0.3} {y+bar+4*s} v{14*s}"/><path d="M{x+w*0.3-6*s} {y+bar+12*s} l{6*s} {6*s} l{6*s} {-6*s}"/>'
             f'<path d="M{x+w*0.7} {ty-4*s} v{-14*s}"/><path d="M{x+w*0.7-6*s} {ty-12*s} l{6*s} {-6*s} l{6*s} {6*s}"/></g>')
    th = rh * (len(rows) + 1)
    g.append(f'<rect x="{x}" y="{ty}" width="{w}" height="{th}" rx="{12*s}" fill="{c["panel"]}" stroke="{c["panelstroke"]}"/>')
    g.append(f'<path d="M{x} {ty+12*s} a{12*s} {12*s} 0 0 1 {12*s} {-12*s} h{w-24*s} a{12*s} {12*s} 0 0 1 {12*s} {12*s} v{rh-12*s} h{-w} z" fill="{c["head"]}"/>')
    for i, row in enumerate(rows):
        ry = ty + rh * (i + 1)
        if i % 2 == 1:
            g.append(f'<rect x="{x+1}" y="{ry}" width="{w-2}" height="{rh}" fill="{c["row"]}"/>')
        for j, val in enumerate(row):
            anchor, cxp = ("end", x + w - 16 * s) if j == 2 else ("start", x + 16 * s + cols[j] * w)
            g.append(f'<text x="{cxp:.1f}" y="{ry+rh*0.64:.1f}" font-size="{14*s:.1f}" fill="{c["cell"]}" text-anchor="{anchor}"'
                     f'{" font-family=" + chr(34) + MONO + chr(34) if j == 2 else ""}>{val}</text>')
    hdr = ["Customer", "Status", "Total"]
    for j, val in enumerate(hdr):
        anchor, cxp = ("end", x + w - 30 * s) if j == 2 else ("start", x + 16 * s + cols[j] * w)
        g.append(f'<text x="{cxp:.1f}" y="{ty+rh*0.64:.1f}" font-size="{13*s:.1f}" font-weight="700" fill="{c["text"]}" text-anchor="{anchor}">{val}</text>')
    ax = x + w - 24 * s
    g.append(f'<path d="M{ax} {ty+rh*0.38:.1f} l{5*s} {7*s} l{5*s} {-7*s} z" fill="{c["accent"]}"/>')
    if export:
        ey = ty + th + 12 * s
        ew = 118 * s
        g.append(f'<rect x="{x+w-ew}" y="{ey}" width="{ew}" height="{28*s}" rx="{14*s}" fill="none" stroke="{c["green"]}" stroke-width="2"/>'
                 f'<text x="{x+w-ew/2}" y="{ey+19*s:.1f}" text-anchor="middle" font-size="{13*s:.1f}" font-weight="700" fill="{c["green"]}">↓ Export CSV</text>')
    g.append("</g>")
    return "".join(g)


ROWS3 = [("Acme Ltd", "paid", "$4,210"), ("Northwind", "paid", "$2,980"), ("Globex", "paid", "$1,145")]


def banner(c, name):
    return f'''<svg width="1200" height="300" viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c["bg1"]}"/><stop offset="1" stop-color="{c["bg2"]}"/></linearGradient></defs>
  <rect width="1200" height="300" fill="url(#bg)"/>
  <g transform="translate(60,75) scale({150/512:.5f})">{icon_body()}</g>
  <text x="238" y="98" font-family="{MONO}" font-size="16" font-weight="600" fill="{c["accent"]}">for TanStack Table v9</text>
  <text x="235" y="160" font-family="{SANS}" font-size="64" font-weight="700" fill="{c["text"]}">Table URL State</text>
  <text x="238" y="198" font-family="{SANS}" font-size="22" font-weight="500" fill="{c["sub"]}">Sorting, filters &amp; pages in the URL. CSV/XLSX export.</text>
  {chips(238, 220, ["two-way sync", "Router adapter", "CSV · XLSX"], c)}
  {demo(860, 40, 300, c, ("/orders", "?sort=-total&amp;page=3"), ROWS3, 0.92, export=False)}
  <text x="1160" y="275" text-anchor="end" font-family="{SANS}" font-size="15" fill="{c["foot"]}">{name}</text>
</svg>
'''


def social(c, name):
    rows = [("Acme Ltd", "paid", "$4,210.00"), ("Northwind", "paid", "$2,980.50"),
            ("Globex", "paid", "$1,145.00"), ("Initech", "paid", "$860.25")]
    return f'''<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c["bg1"]}"/><stop offset="1" stop-color="{c["bg2"]}"/></linearGradient></defs>
  <rect width="1280" height="640" fill="url(#bg)"/>
  <g transform="translate(80,96) scale({176/512:.5f})">{icon_body()}</g>
  <text x="292" y="128" font-family="{MONO}" font-size="20" font-weight="600" fill="{c["accent"]}">{name}</text>
  <text x="288" y="208" font-family="{SANS}" font-size="78" font-weight="700" fill="{c["text"]}">Table URL State</text>
  <text x="292" y="256" font-family="{SANS}" font-size="28" font-weight="500" fill="{c["sub"]}">URL state and CSV/XLSX export for TanStack Table v9</text>
  {chips(80, 320, ["sorting", "column filters", "global filter", "pagination"], c, size=18, h=40, gap=12, cw=10.2)}
  {chips(80, 372, ["column visibility", "Router adapter", "React"], c, size=18, h=40, gap=12, cw=10.2)}
  {chips(80, 424, ["URLSearchParams fallback"], c, size=18, h=40, gap=12, cw=10.2)}
  {demo(760, 316, 440, c, ("/orders", "?sort=-total&amp;f.status=paid&amp;page=3"), rows, 1.0)}
  <text x="80" y="590" font-family="{SANS}" font-size="20" fill="{c["foot"]}">Free and open source · MIT · by Amjad</text>
</svg>
'''


NAME = "@amjadiqbal/tanstack-table-url-state"
files = {
    "icon.svg": icon_svg(),
    "banner-dark.svg": banner(DARK, NAME),
    "banner-light.svg": banner(LIGHT, NAME),
    "social-preview.svg": social(DARK, NAME),
}
for fn, s in files.items():
    with open(os.path.join(OUT, fn), "w") as f:
        f.write(s)
print("wrote", ", ".join(files))
