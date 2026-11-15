"""Unit tests for pack/fit.py on a small fixed fixture. Run: python -m unittest discover -s pack"""
import json, pathlib, unittest

import fit

HERE = pathlib.Path(__file__).resolve().parent
CFG = json.load(open(HERE / "fit_config.json"))
BODY = {"height_cm": 170, "chest_cm": 100, "waist_cm": 80, "hips_cm": 100, "inside_leg_cm": 80}


class DefaultGarments(unittest.TestCase):
    def test_known_values(self):
        g = fit.default_garments(BODY, CFG)
        self.assertEqual(g["tee"]["chest_circ_cm"], 108.0)
        self.assertNotIn("hem_circ_cm", g["tee"])
        self.assertEqual(g["tee"]["length_cm"], 66.3)
        self.assertEqual(g["trousers"]["waist_circ_cm"], 91.0)  # 80 + 0.4 * (100 - 80) + 3
        self.assertEqual(g["trousers"]["hip_circ_cm"], 103.0)
        self.assertEqual(g["trousers"]["inseam_cm"], 76.0)
        self.assertEqual(g["trousers"]["leg_opening_circ_cm"], 41.2)

    def test_sweatshirt_has_more_room_than_the_tee(self):
        g = fit.default_garments(BODY, CFG)
        self.assertEqual(g["sweatshirt"]["chest_circ_cm"], 110.0)
        self.assertGreater(g["sweatshirt"]["chest_circ_cm"], g["tee"]["chest_circ_cm"])
        self.assertEqual(g["sweatshirt"]["neckline_width_cm"], 18.7)
        self.assertEqual(g["sweatshirt"]["colour_srgb"], CFG["colour_srgb"])

    def test_other_necklines_are_deeper_than_the_crew_neck(self):
        # V1.1-04, depths decided by Joe: V 12 cm and scoop 9 cm below the shoulder-top line, crew 6 cm
        n = fit.default_garments(BODY, CFG)["tee"]["necklines"]
        self.assertEqual(set(n), {"v", "scoop"})
        self.assertEqual(n["v"]["drop_front_cm"], 12)
        self.assertEqual(n["scoop"]["drop_front_cm"], 9)
        self.assertEqual(n["v"]["neckline_width_cm"], 21.2)  # 0.125 * 170 = 21.25, rounded to 1 decimal place
        self.assertEqual(n["scoop"]["neckline_width_cm"], 23.4)  # 1.1 times that

    def test_ease_is_positive(self):
        g = fit.default_garments(BODY, CFG)
        self.assertGreater(g["tee"]["chest_circ_cm"], BODY["chest_cm"])
        self.assertGreater(g["trousers"]["waist_circ_cm"], BODY["waist_cm"])
        self.assertGreater(g["trousers"]["hip_circ_cm"], BODY["hips_cm"])

    def test_inside_leg_falls_back_to_height_fraction(self):
        body = {k: v for k, v in BODY.items() if k != "inside_leg_cm"}
        g = fit.default_garments(body, CFG)
        self.assertEqual(g["trousers"]["inseam_cm"], round(0.45 * 170 - 4, 1))

    def test_neutral_colour_on_both(self):
        g = fit.default_garments(BODY, CFG)
        self.assertEqual(g["tee"]["colour_srgb"], CFG["colour_srgb"])
        self.assertEqual(g["trousers"]["colour_srgb"], CFG["colour_srgb"])

    def test_missing_measurement_is_an_error(self):
        with self.assertRaises(KeyError):
            fit.default_garments({"height_cm": 170}, CFG)


if __name__ == "__main__":
    unittest.main()
