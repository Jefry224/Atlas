"""Shared, dependency-free terrain metrics for A.R.E.S. Twin grids (see docs/contracts.md §2).

Earth and planetary pipelines MUST use these functions so metrics are comparable.
Grid convention: row-major, row 0 = north, column 0 = west, spacing in metres.
"""
import math


def percentile(values, p):
    """Linear-interpolated percentile, p in [0, 100]."""
    data = sorted(v for v in values if v is not None and math.isfinite(v))
    if not data:
        return None
    k = (len(data) - 1) * p / 100
    lo, hi = math.floor(k), math.ceil(k)
    return data[lo] + (data[hi] - data[lo]) * (k - lo)


def slopes_deg(elevation, n, spacing):
    """Slope (degrees) at interior nodes by central differences."""
    out = []
    for r in range(1, n - 1):
        for c in range(1, n - 1):
            dzdx = (elevation[r * n + c + 1] - elevation[r * n + c - 1]) / (2 * spacing)
            dzdy = (elevation[(r + 1) * n + c] - elevation[(r - 1) * n + c]) / (2 * spacing)
            out.append(math.degrees(math.atan(math.hypot(dzdx, dzdy))))
    return out


def tri_mean(elevation, n):
    """Mean Terrain Ruggedness Index (Riley 1999): mean abs diff to 8 neighbours, metres."""
    vals = []
    for r in range(1, n - 1):
        for c in range(1, n - 1):
            z = elevation[r * n + c]
            s = sum(abs(elevation[(r + dr) * n + c + dc] - z)
                    for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc)
            vals.append(s / 8)
    return sum(vals) / len(vals) if vals else None


def compute_metrics(elevation, n, spacing, native_resolution_m=None, roughness=None):
    if len(elevation) != n * n or not all(math.isfinite(v) for v in elevation):
        raise ValueError('elevation must be n*n finite values')
    s = slopes_deg(elevation, n, spacing)
    r = lambda v: None if v is None else round(v, 2)
    return {
        'slopeP50Deg': r(percentile(s, 50)),
        'slopeP90Deg': r(percentile(s, 90)),
        'reliefP95P5M': r(percentile(elevation, 95) - percentile(elevation, 5)),
        'triMeanM': r(tri_mean(elevation, n)),
        'comparable': native_resolution_m is None or native_resolution_m <= 2 * spacing,
        'roughness': roughness,
    }


# Same weights and floors as SIMILARITY_COMPONENTS in similarity.mjs (tests/analog-match.test.mjs checks parity).
SIMILARITY_COMPONENTS = (('slopeP50Deg', 0.30, 0.1), ('slopeP90Deg', 0.25, 0.1),
                         ('reliefP95P5M', 0.20, 1.0), ('triMeanM', 0.15, 0.05))


def ratio_score(a, b, floor=0.0):
    x, y = max(abs(a), floor), max(abs(b), floor)
    if x == 0 and y == 0:
        return 100.0
    if x == 0 or y == 0:
        return 0.0
    return 100.0 * math.exp(-abs(math.log(x / y)))


def js_round(v, digits=0):
    """JavaScript Math.round (halves towards +inf), to match similarity.mjs to the decimal."""
    f = 10 ** digits
    return math.floor(v * f + 0.5) / f


def geometric_index(me, mt):
    """0-100 geometric index of similarity.mjs without roughness (Earth dB and Moon CPR never share a unit)."""
    total = sum(w for _, w, _ in SIMILARITY_COMPONENTS)
    acc = 0.0
    for key, weight, floor in SIMILARITY_COMPONENTS:
        acc += (weight / total) * js_round(ratio_score(me[key], mt[key], floor), 1)
    return int(js_round(acc))


def bilinear_resample(src, src_n, dst_n):
    """Resample a square src_n×src_n grid covering the same extent to dst_n×dst_n."""
    out = []
    scale = (src_n - 1) / (dst_n - 1)
    for r in range(dst_n):
        for c in range(dst_n):
            y, x = r * scale, c * scale
            r0, c0 = min(int(y), src_n - 2), min(int(x), src_n - 2)
            ty, tx = y - r0, x - c0
            a, b = src[r0 * src_n + c0], src[r0 * src_n + c0 + 1]
            d, e = src[(r0 + 1) * src_n + c0], src[(r0 + 1) * src_n + c0 + 1]
            out.append((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty)
    return out


if __name__ == '__main__':
    # Self-check: a 10° plane must give ~10° slopes and zero TRI-ish curvature contribution.
    n, sp = 65, 37.5
    plane = [math.tan(math.radians(10)) * c * sp for r in range(n) for c in range(n)]
    m = compute_metrics(plane, n, sp, 30)
    assert abs(m['slopeP50Deg'] - 10) < 0.01 and abs(m['slopeP90Deg'] - 10) < 0.01, m
    assert bilinear_resample(plane, n, n)[100] == plane[100]
    print('terrain_metrics OK', m)
