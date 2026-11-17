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

    def test_shirt_is_the_tee_fit_with_a_collar_and_three_sleeve_lengths(self):
        # V3-03: same chest ease and length as the tee (the shell cannot go looser, and a longer tail is unstable), sleeves short < mid, long set by the wrist
        g = fit.default_garments(BODY, CFG)
        s, t = g["shirt"], g["tee"]
        self.assertEqual(s["chest_circ_cm"], t["chest_circ_cm"])
        self.assertEqual(s["length_cm"], t["length_cm"])  # 0.39 * 170
        self.assertLess(s["sleeve_short_cm"], s["sleeve_mid_cm"])
        self.assertEqual((s["sleeve_short_cm"], s["sleeve_mid_cm"]), (20.4, 23.8))
        self.assertEqual(s["cuff_above_wrist_cm"], 1.0)
        self.assertEqual(s["neckline_width_cm"], t["neckline_width_cm"])  # the collar stands on an opening as wide as the tee's (narrower ones broke the shell)
        d = s["detail"]
        self.assertGreater(d["tip_drop_cm"], d["back_drop_cm"])  # points at the front, a lower flap there than round the back
        self.assertGreater(d["placket_height_cm"], 0)
        self.assertEqual(s["colour_srgb"], CFG["colour_srgb"])

    def test_shorts_are_above_the_knee(self):
        # V1.1-05, length decided by Joe: 23 cm inseam, opening a little wider than the trousers at that height
        s = fit.default_garments(BODY, CFG)["shorts"]
        self.assertEqual(s["inseam_cm"], 23)
        self.assertGreater(s["leg_opening_extra_cm"], 0)
        self.assertLess(s["inseam_cm"], fit.default_garments(BODY, CFG)["trousers"]["inseam_cm"])
        self.assertEqual(s["colour_srgb"], CFG["colour_srgb"])

    def test_tights_hug_the_skin_and_end_at_the_ankle(self):
        # V2-04: as close as the hard checks allow (they need 0.2 cm clearance), hem at the ankle, not the knee
        t = fit.default_garments(BODY, CFG)["tights"]
        self.assertGreaterEqual(t["gap_cm"], 0.2)
        self.assertLess(t["gap_cm"], 0.3)
        self.assertLess(t["hem_above_floor_cm"], 15)
        self.assertEqual(t["colour_srgb"], CFG["colour_srgb"])

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


class PerPersonFit(unittest.TestCase):
    """V2-03: a person's overrides from fit_people.json laid over the shared config."""

    def test_empty_override_is_the_shared_fit(self):
        self.assertEqual(fit.merge(CFG, {}), CFG)

    def test_override_changes_only_its_own_key(self):
        cfg = fit.merge(CFG, {"tee": {"chest_ease_cm": 12}, "_note": "ignored"})
        self.assertEqual(cfg["tee"]["chest_ease_cm"], 12)
        self.assertEqual(cfg["tee"]["necklines"], CFG["tee"]["necklines"])
        self.assertEqual(cfg["trousers"], CFG["trousers"])
        self.assertNotIn("_note", {k: v for k, v in cfg.items() if k not in CFG})
        self.assertEqual(CFG["tee"]["chest_ease_cm"], 8, "the shared config must not be changed by a merge")

    def test_people_file_is_valid(self):
        people = json.load(open(HERE / "fit_people.json"))
        for name, over in people.items():
            if not name.startswith("_"):
                fit.default_garments(BODY, fit.merge(CFG, over))


if __name__ == "__main__":
    unittest.main()
