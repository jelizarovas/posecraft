"""Run with the same Python environment as tools/bake-porch-face.py."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from porch_sprite_views import turn_limb


class FingerOcclusion(unittest.TestCase):
    def test_opposite_edges_show_opposite_fingers(self):
        paint = np.zeros((1, 31, 4))
        paint[:, 2:9] = [1, 0, 0, 1]
        paint[:, 22:29] = [0, 1, 0, 1]
        for angle, expected in [(90, [1, 0, 0, 1]), (-90, [0, 1, 0, 1])]:
            with self.subTest(angle=angle):
                np.testing.assert_allclose(turn_limb(paint, angle, .5)[0, 15], expected)


if __name__ == '__main__':
    unittest.main()
