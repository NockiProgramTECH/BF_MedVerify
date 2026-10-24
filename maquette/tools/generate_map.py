"""Génère les SVG de la carte stylisée du Burkina Faso (maquette BF-MedVerify).

Le tracé du pays vient d'un GeoJSON public (johan/world.geo.json) ; il est
simplement projeté. Les volumes sont fictifs et servent uniquement la maquette.

Usage : python3 tools/generate_map.py
"""
import json
from pathlib import Path

GEO = Path('/tmp/world.geo.json-master/countries.geo.json')

# ville, région, lon, lat, vérifications/jour, pharmacies, couverture %, dx, dy, anchor, volume affiché
VILLES = [
    ('Ouagadougou', 'Centre', -1.5333, 12.3667, 4520, 108, 96, 22, 4, 'start', True),
    ('Bobo-Dioulasso', 'Hauts-Bassins', -4.30, 11.1833, 1980, 62, 91, 20, 4, 'start', True),
    ('Koudougou', 'Centre-Ouest', -2.3667, 12.25, 940, 34, 88, -11, -10, 'end', True),
    ('Dédougou', 'Boucle du Mouhoun', -3.4667, 12.4667, 760, 30, 84, -13, 4, 'end', True),
    ('Kaya', 'Centre-Nord', -1.0833, 13.0833, 720, 26, 79, 15, 4, 'start', True),
    ("Fada N'Gourma", 'Est', 0.3667, 12.0667, 640, 24, 76, 15, 4, 'start', True),
    ('Banfora', 'Cascades', -4.7667, 10.6333, 560, 22, 82, 14, 4, 'start', True),
    ('Tenkodogo', 'Centre-Est', -0.3667, 11.7833, 520, 20, 74, 14, 6, 'start', False),
    ('Ouahigouya', 'Nord', -2.4333, 13.5833, 480, 18, 71, -14, 4, 'end', False),
    ('Ziniaré', 'Plateau-Central', -1.30, 12.5833, 420, 14, 68, 16, -8, 'start', False),
    ('Manga', 'Centre-Sud', -1.0667, 11.6667, 380, 12, 62, 13, 16, 'start', False),
    ('Dori', 'Sahel', -0.0333, 14.0333, 300, 8, 54, 14, 4, 'start', False),
    ('Gaoua', 'Sud-Ouest', -3.1833, 10.3333, 260, 6, 49, -12, 14, 'end', False),
]
TOTAL = sum(v[4] for v in VILLES)


def ring():
    data = json.loads(GEO.read_text())
    feat = next(f for f in data['features'] if f['properties'].get('name') == 'Burkina Faso')
    return feat['geometry']['coordinates'][0]


def make(width=720, height=560, pad=54, mini=False):
    pts = ring()
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    minlon, maxlon = min(lons), max(lons)
    minlat, maxlat = min(lats), max(lats)
    s = min((width - 2 * pad) / (maxlon - minlon), (height - 2 * pad) / (maxlat - minlat))
    ox = (width - (maxlon - minlon) * s) / 2
    oy = (height - (maxlat - minlat) * s) / 2

    def proj(lon, lat):
        return ox + (lon - minlon) * s, oy + (maxlat - lat) * s

    d = 'M' + ' L'.join('%.1f,%.1f' % proj(*p) for p in pts) + ' Z'
    uid = 'mini' if mini else 'full'

    out = []
    out.append('<svg xmlns="http://www.w3.org/2000/svg" class="bf-map" viewBox="0 0 %d %d" role="img" '
               'aria-label="Carte stylisée du Burkina Faso avec les volumes de vérifications par ville">'
               % (width, height))
    out.append('<rect width="%d" height="%d" fill="#f2ede2"/>' % (width, height))
    out.append('<defs><pattern id="mapDots-%s" width="20" height="20" patternUnits="userSpaceOnUse">'
               '<circle cx="2" cy="2" r="1.2" fill="#ded6c6"/></pattern></defs>' % uid)
    out.append('<rect x="%d" y="%d" width="%d" height="%d" fill="url(#mapDots-%s)" opacity=".55"/>'
               % (pad * 0.4, pad * 0.35, width - pad * 0.8, height - pad * 0.7, uid))
    out.append('<path d="%s" fill="#cfe1d0" stroke="#0e5535" stroke-width="2" stroke-linejoin="round"/>' % d)

    maxv = max(v[4] for v in VILLES)
    for nom, region, lon, lat, vol, ph, cov, dx, dy, anchor, showvol in VILLES:
        x, y = proj(lon, lat)
        r = 5 + (vol / maxv) ** 0.6 * 19
        if mini:
            out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#0e5535"/>' % (x, y, 3 + (vol / maxv) ** 0.6 * 7))
            continue
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#0e5535" opacity=".13"/>' % (x, y, r))
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#0e5535" opacity=".26"/>' % (x, y, r * 0.58))
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#0e5535"><title>%s : %s vérifications/j, '
                   '%s pharmacies, %s %% actives</title></circle>' % (x, y, max(2.4, r * 0.3), nom, vol, ph, cov))
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="#0e5535" stroke-width="1" '
                   'opacity=".38"/>' % (x, y, r))

    if not mini:
        for nom, region, lon, lat, vol, ph, cov, dx, dy, anchor, showvol in VILLES:
            x, y = proj(lon, lat)
            big = vol > 900
            out.append('<text x="%.1f" y="%.1f" text-anchor="%s" font-family="ui-sans-serif,system-ui,sans-serif" '
                       'font-size="%s" font-weight="%s" fill="#14241b">%s</text>'
                       % (x + dx, y + dy, anchor, 10.5 if big else 9, '700' if big else '500', nom))
            if showvol:
                out.append('<text x="%.1f" y="%.1f" text-anchor="%s" font-family="ui-monospace,monospace" '
                           'font-size="8" fill="#5b6a5f">%s / jour</text>'
                           % (x + dx, y + dy + 11, anchor, ('{:,}'.format(vol)).replace(',', ' ')))

        out.append('<g transform="translate(26 24)"><circle cx="7" cy="7" r="8" fill="#0e5535" opacity=".15"/>'
                   '<circle cx="7" cy="7" r="3.2" fill="#0e5535"/>'
                   '<text x="21" y="11" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" '
                   'fill="#5b6a5f">Volume de vérifications par jour</text></g>')
        out.append('<g transform="translate(26 44)"><circle cx="7" cy="7" r="9" fill="none" stroke="#c9bfac" '
                   'stroke-dasharray="3 3"/>'
                   '<text x="21" y="11" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" '
                   'fill="#5b6a5f">Territoire national — tracé simplifié</text></g>')
    out.append('</svg>')
    return '\n'.join(out)


def make_mini():
    return make(width=520, height=400, pad=36, mini=True)


if __name__ == '__main__':
    base = Path(__file__).resolve().parent.parent
    (base / 'assets' / 'img' / 'carte-burkina.svg').write_text(make(), encoding='utf-8')
    (base / 'assets' / 'img' / 'carte-mini.svg').write_text(make_mini(), encoding='utf-8')
    print('cartes générées — total vérifications/jour :', TOTAL)
