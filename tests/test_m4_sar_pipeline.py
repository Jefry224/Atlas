"""Numerical and metadata checks for the dependency-free Module 4 SAR publisher."""

import importlib.util
import math
from pathlib import Path
import struct
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'm4_build_sar_maps.py'
SPEC = importlib.util.spec_from_file_location('m4_build_sar_maps', SCRIPT)
SAR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAR)
CANDIDATE_SPEC = importlib.util.spec_from_file_location(
    'm4_build_discovery_sar', SCRIPT.with_name('m4_build_discovery_sar.py'))
CANDIDATE_SAR = importlib.util.module_from_spec(CANDIDATE_SPEC)
CANDIDATE_SPEC.loader.exec_module(CANDIDATE_SAR)


class SarPipelineTests(unittest.TestCase):
    def test_decode_npy_preserves_missing_mask_and_nonpositive_power(self):
        count = SAR.GRID_SIZE ** 2
        header = repr({'descr': '<f4', 'fortran_order': False,
                       'shape': (2, SAR.GRID_SIZE, SAR.GRID_SIZE)}).encode('ascii') + b'\n'
        values = [2.0] * count
        masks = [255.0] * count
        values[1] = -1.0
        masks[2] = 0.0
        data = b'\x93NUMPY\x01\x00' + struct.pack('<H', len(header)) + header
        data += struct.pack('<' + str(2 * count) + 'f', *(values + masks))
        decoded = SAR.decode_npy(data)
        self.assertEqual(decoded[0], 2.0)
        self.assertIsNone(decoded[1])
        self.assertIsNone(decoded[2])
        self.assertEqual(len(decoded), count)
        with self.assertRaises(ValueError):
            SAR.decode_npy(data[:-4])

    def test_pair_selection_keeps_same_platform_and_short_repeat_pass(self):
        def scene(day, platform):
            return {'date': day, 'platform': platform, 'relativeOrbit': 89,
                    'orbitState': 'ascending', 'validFraction': 1.0}
        history = {'series': [scene('2026-10-03', 'sentinel-1d'),
                              scene('2026-10-21', 'sentinel-1c'),
                              scene('2026-11-02', 'sentinel-1c'),
                              scene('2026-11-08', 'sentinel-1d')]}
        before, after = SAR.choose_pair(history)
        self.assertEqual((before['date'], after['date']), ('2026-10-21', '2026-11-02'))

    def test_linear_power_difference_precedes_log_conversion(self):
        n = SAR.GRID_SIZE ** 2
        latest, delta = SAR.surface_layers([1.0] * n, [2.0] * n)
        center = (SAR.GRID_SIZE // 2) * SAR.GRID_SIZE + SAR.GRID_SIZE // 2
        self.assertAlmostEqual(latest[center], 3.01, places=2)
        self.assertAlmostEqual(delta[center], 3.01, places=2)
        self.assertIsNone(delta[0])  # The 5x5 neighborhood is incomplete at a corner.

    def test_bbox_covers_approximately_2400_meter_window(self):
        center = [29.16953, -13.44056]
        west, south, east, north = SAR.bbox_for_center(center)
        self.assertAlmostEqual((south + north) / 2, center[0], places=8)
        self.assertAlmostEqual((west + east) / 2, center[1], places=8)
        lat_distance = math.radians(north - south) * SAR.EARTH_RADIUS_M
        lon_distance = math.radians(east - west) * SAR.EARTH_RADIUS_M * math.cos(math.radians(center[0]))
        self.assertAlmostEqual(lat_distance, 2400, places=4)
        self.assertAlmostEqual(lon_distance, 2400, places=4)

    def test_discovery_catalog_and_scene_pairs_keep_candidate_identity(self):
        catalog = CANDIDATE_SAR.candidates()
        self.assertEqual(len(catalog), 19)
        self.assertEqual(catalog['cand-marius-hills-01'][0], 'marius-hills')
        self.assertEqual(catalog['cand-marius-hills-01'][1]['center'], [38.3558611, -114.4319211])

        def scene(day, platform, orbit, polar='VV'):
            return {'date': day, 'platform': platform, 'relativeOrbit': orbit,
                    'orbitState': 'ascending', 'polarization': polar, 'item': day}
        records = [scene('2026-11-14', 'sentinel-1d', 173),
                   scene('2026-11-08', 'sentinel-1c', 173),
                   scene('2026-11-02', 'sentinel-1d', 90),
                   scene('2026-10-21', 'sentinel-1d', 173)]
        pair = next(CANDIDATE_SAR.comparable_pairs(records))
        self.assertEqual((pair[0]['date'], pair[1]['date']), ('2026-10-21', '2026-11-14'))

    def test_pair_rejects_different_radar_modes_before_computing_change(self):
        common = {'sourcePixelSpacingMeters': 10,
                  'nominalRadarResolutionMeters': {'range': 20, 'azimuth': 22},
                  'instrumentMode': 'IW', 'observationDirection': 'right'}
        changed = {**common, 'instrumentMode': 'EW'}
        fake = [([1.0], 1.0, common, 'https://example.org/old'),
                ([1.0], 1.0, changed, 'https://example.org/new')]
        older = {'date': '2026-10-01', 'item': 'old', 'platform': 'sentinel-1c',
                 'relativeOrbit': 89, 'orbitState': 'ascending'}
        newer = {**older, 'date': '2026-10-13', 'item': 'new'}
        with patch.object(SAR, 'fetch_scene', side_effect=fake):
            with self.assertRaisesRegex(ValueError, 'mode, direction, pixel spacing, or radar resolution'):
                SAR.assemble_pair('sample', {'center': [29.1, -13.4], 'polarization': 'VV'}, older, newer)


if __name__ == '__main__':
    unittest.main()
