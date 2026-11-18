"""Unit tests for meta.json loading and validation in fit_template.py (V3-07). Pure Python, no Blender.
Run: python -m unittest pack/test_fit_template.py (npm run check runs every pack test)."""
import copy, json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fit_template as ft  # noqa: E402

GOOD = {"id": "plain_shirt", "category": "tops", "layer": "mid", "allowed_bodies": "both",
        "source": {"pack": "shirts02", "asset": "some_shirt"}, "licence": "CC0", "credit": None, "sha256": "a" * 64,
        "delete_group": False, "settle": "none", "contact_groups": ["all"], "clearance_cm": 0.3, "replaces": [],
        "inner_layers": ["tee"], "approved": False, "colour": "plain"}


def bad(**changes):
    m = copy.deepcopy(GOOD)
    for k, v in changes.items():
        if v is KeyError:
            m.pop(k)
        else:
            m[k] = v
    return m


class ValidateMeta(unittest.TestCase):
    def test_good_meta_passes_and_defaults_pack_file(self):
        self.assertEqual(ft.validate_meta(GOOD)["pack_file"], "plain_shirt")
        self.assertEqual(ft.validate_meta({**GOOD, "pack_file": "shirt"})["pack_file"], "shirt")

    def test_missing_licence_fails_clearly(self):
        for m in (bad(licence=KeyError), bad(licence=""), bad(licence=None)):
            with self.assertRaisesRegex(ft.MetaError, "no licence"):
                ft.validate_meta(m)

    def test_other_licences_refused(self):
        for lic in ("CC-BY-NC", "Royalty Free", "GPL"):
            with self.assertRaisesRegex(ft.MetaError, "not allowed"):
                ft.validate_meta(bad(licence=lic))

    def test_build_refuses_cc_by_without_credit_and_accepts_with(self):
        m = {"id": "t", "licence": "CC-BY", "credit": None}
        self.assertIn("no credit", ft.pack_licence_error("CC-BY", m))
        m["credit"] = "Shirt by someone, CC-BY, makehumancommunity.org"
        self.assertIsNone(ft.pack_licence_error("CC-BY", m))
        self.assertIsNone(ft.pack_licence_error("CC0", {"id": "t", "licence": "CC0"}))
        self.assertIn("only", ft.pack_licence_error("CC-BY", {"id": "t", "licence": "CC0"}))
        self.assertIn("only", ft.pack_licence_error("CC-BY-NC", {"id": "t", "licence": "CC-BY-NC", "credit": "x"}))

    def test_cc_by_needs_a_credit(self):
        for credit in (None, "", "   "):
            with self.assertRaisesRegex(ft.MetaError, "CC-BY template needs a credit"):
                ft.validate_meta(bad(licence="CC-BY", credit=credit))
        self.assertEqual(ft.validate_meta(bad(licence="CC-BY", credit="Shirt by someone, CC-BY, makehumancommunity.org"))["licence"], "CC-BY")

    def test_unknown_layer_fails(self):
        with self.assertRaisesRegex(ft.MetaError, "unknown layer 'jacket'"):
            ft.validate_meta(bad(layer="jacket"))

    def test_every_problem_is_named(self):
        with self.assertRaises(ft.MetaError) as e:
            ft.validate_meta(bad(layer="x", allowed_bodies="kids", colour="texture", clearance_cm=0))
        for words in ("unknown layer", "allowed_bodies", "only hair and shoes", "clearance_cm"):
            self.assertIn(words, str(e.exception))

    def test_missing_fields_are_listed(self):
        with self.assertRaisesRegex(ft.MetaError, "missing field 'approved'.*missing field 'colour'"):
            ft.validate_meta(bad(approved=KeyError, colour=KeyError))

    def test_source_sha_settle_and_lists(self):
        for m, words in ((bad(source={"pack": "p"}), "source must be"), (bad(source={"pack": "p", "asset": "a", "url": "u"}), "source must be"),
                         (bad(sha256="abc"), "sha256"), (bad(approved="yes"), "approved must be"),
                         (bad(settle={"frames": 30}), "pinned"), (bad(settle={"pinned": ["body"], "wind": 1}), "unknown keys"),
                         (bad(contact_groups=[]), "contact_groups is empty"), (bad(replaces=["tops"]), "replaces names unknown"),
                         (bad(id="Plain Shirt"), "id 'Plain Shirt'")):
            with self.assertRaisesRegex(ft.MetaError, words):
                ft.validate_meta(m)
        self.assertEqual(ft.validate_meta(bad(settle={"pinned": ["joint-neck"], "frames": 40}))["settle"]["frames"], 40)

    def test_texture_allowed_for_hair_and_shoes(self):
        self.assertEqual(ft.validate_meta(bad(category="shoes", colour="texture"))["colour"], "texture")

    def test_enforced_only_when_approved(self):
        self.assertFalse(ft.enforced(ft.validate_meta(GOOD)))
        self.assertTrue(ft.enforced(ft.validate_meta(bad(approved=True))))


class LoadTemplates(unittest.TestCase):
    def write(self, root, cat, tid, meta):
        d = os.path.join(root, cat, tid)
        os.makedirs(d)
        json.dump(meta, open(os.path.join(d, "meta.json"), "w"))
        return d

    def test_folder_must_match_category_and_id(self):
        with tempfile.TemporaryDirectory() as root:
            d = self.write(root, "tops", "other_name", GOOD)
            with self.assertRaisesRegex(ft.MetaError, "<category>/<id>"):
                ft.load_meta(d)

    def test_find_sorts_by_layer_and_filters_by_body(self):
        with tempfile.TemporaryDirectory() as root:
            self.write(root, "tops", "plain_shirt", GOOD)
            self.write(root, "full", "dress", {**GOOD, "id": "dress", "category": "full", "layer": "full", "allowed_bodies": "female"})
            self.write(root, "tops", "vest", {**GOOD, "id": "vest", "layer": "base"})
            metas = ft.find_templates(root)
            self.assertEqual([m["id"] for m in metas], ["vest", "plain_shirt", "dress"])
            self.assertEqual([m["id"] for m in ft.for_body(metas, "male")], ["vest", "plain_shirt"])
            self.assertEqual(len(ft.for_body(metas, "female")), 3)

    def test_two_templates_cannot_write_the_same_file(self):
        with tempfile.TemporaryDirectory() as root:
            self.write(root, "tops", "a", {**GOOD, "id": "a", "pack_file": "shirt"})
            self.write(root, "tops", "b", {**GOOD, "id": "b", "pack_file": "shirt"})
            with self.assertRaisesRegex(ft.MetaError, "both write shirt.glb"):
                ft.find_templates(root)

    def test_outside_source_needs_template_mhclo(self):
        with tempfile.TemporaryDirectory() as root:
            d = self.write(root, "tops", "plain_shirt", {**GOOD, "source": {"url": "https://example.org/shirt"}})
            with self.assertRaisesRegex(ft.MetaError, "author_template"):
                ft.load_meta(d)
            open(os.path.join(d, "template.mhclo"), "w").close()
            self.assertTrue(ft.mhclo_path(ft.load_meta(d), "packs").endswith("template.mhclo"))

    def test_bad_json_is_reported(self):
        with tempfile.TemporaryDirectory() as root:
            d = os.path.join(root, "tops", "plain_shirt")
            os.makedirs(d)
            open(os.path.join(d, "meta.json"), "w").write("{not json")
            with self.assertRaisesRegex(ft.MetaError, "not valid JSON"):
                ft.load_meta(d)

    def test_committed_templates_are_valid(self):
        metas = ft.find_templates()
        dress = next(m for m in metas if m["id"] == "shift_dress")
        self.assertEqual((dress["pack_file"], dress["layer"], dress["licence"], dress["approved"]), ("dress", "full", "CC0", True))
        self.assertTrue(ft.mhclo_path(dress, "X").replace("\\", "/").endswith("X/dress01/clothes/toigo_shift_dress/toigo_shift_dress.mhclo"))
        self.assertIsNone(ft.loose_settings(dress))  # the approved dress is fitted exactly as before
        self.assertEqual(dress.get("inner_push", "shrinkwrap"), "shrinkwrap")


class LooseFields(unittest.TestCase):
    """V3-07b: "loose" and "inner_push" are optional and off by default."""

    def test_off_by_default(self):
        self.assertIsNone(ft.loose_settings(ft.validate_meta(GOOD)))
        self.assertIsNone(ft.loose_settings(ft.validate_meta({**GOOD, "loose": "none"})))

    def test_defaults_filled_in(self):
        lo = ft.loose_settings(ft.validate_meta({**GOOD, "loose": {"hem_to_crotch_cm": -2}}))
        self.assertEqual(lo, {**ft.LOOSE_DEFAULTS, "hem_to_crotch_cm": -2})

    def test_bad_loose_values_refused(self):
        for lo, msg in (("yes", "loose must be"), ({"puff": 1}, "unknown keys"), ({"ease_fraction": 0.5}, "ease_fraction"),
                        ({"drape_taper": -1}, "drape_taper"), ({"smooth_iterations": 2.5}, "whole number"),
                        ({"hem_to_crotch_cm": "low"}, "hem_to_crotch_cm"), ({"fade_cm": True}, "fade_cm"),
                        ({"hem_curve_keep": 1.5}, "hem_curve_keep"), ({"chest_above_armpit_cm": -1}, "chest_above_armpit_cm")):
            with self.assertRaisesRegex(ft.MetaError, msg):
                ft.validate_meta({**GOOD, "loose": lo})

    def test_settle_pinned_by_height(self):
        ok = {**GOOD, "loose": {}, "settle": {"pin_above_armpit_cm": 4}}
        self.assertEqual(ft.validate_meta(ok)["settle"]["pin_above_armpit_cm"], 4)
        with self.assertRaisesRegex(ft.MetaError, "needs loose"):
            ft.validate_meta({**GOOD, "settle": {"pin_above_armpit_cm": 4}})
        with self.assertRaisesRegex(ft.MetaError, "pin_above_armpit_cm must be"):
            ft.validate_meta({**ok, "settle": {"pin_above_armpit_cm": "high"}})

    def test_inner_push(self):
        self.assertEqual(ft.validate_meta({**GOOD, "inner_push": "body_normal"})["inner_push"], "body_normal")
        with self.assertRaisesRegex(ft.MetaError, "inner_push"):
            ft.validate_meta({**GOOD, "inner_push": "magnet"})


class LooseGeometry(unittest.TestCase):
    """The pure-Python pieces of the loose fit, on made-up shapes."""

    def test_split_by_gap_separates_arms(self):
        xs = [-0.30, -0.29, -0.12, -0.11, -0.10, 0.29, 0.30]
        runs = ft.split_by_gap(xs, 0.02)
        self.assertEqual([sorted(xs[i] for i in r) for r in runs], [[-0.30, -0.29], [-0.12, -0.11, -0.10], [0.29, 0.30]])

    def test_hull_bridges_a_hollow(self):
        # two "cups" with a hollow between: the hull's radius straight ahead is the cups' reach, not the hollow's
        pts = [(-0.1, 0.0), (0.1, 0.0), (-0.05, 0.12), (0.05, 0.12), (0.0, 0.08), (0.0, -0.1)]
        hull = ft.convex_hull(pts)
        self.assertNotIn((0.0, 0.08), hull)
        r, per = ft.hull_radii(hull, (0.0, 0.0), 72)
        self.assertAlmostEqual(r[18], 0.12, places=3)  # bin 18 points along +y
        self.assertGreater(per, 0.5)

    def test_hull_radii_of_a_square(self):
        r, per = ft.hull_radii([(-1, -1), (1, -1), (1, 1), (-1, 1)], (0, 0), 8)
        self.assertAlmostEqual(per, 8.0)
        self.assertAlmostEqual(r[0], 1.0, places=2)
        self.assertAlmostEqual(r[1], 2 ** 0.5, places=2)

    def test_envelope_hangs_from_a_fuller_band_above(self):
        zs = [0.0, 0.1, 0.2]
        radii = [[0.10, 0.10], [0.10, 0.10], [0.20, 0.10]]  # the top band sticks out in direction 0
        env = ft.drape_envelope(zs, radii, [0.0, 0.0, 0.0], 0.0, 0.5)
        self.assertAlmostEqual(env[2][0], 0.20)
        self.assertAlmostEqual(env[1][0], 0.15)  # stepped in by 0.5 per metre of drop
        self.assertAlmostEqual(env[0][0], 0.10)  # back to the body's own surface
        self.assertAlmostEqual(env[1][1], 0.10)

    def test_envelope_adds_ease_from_the_perimeter(self):
        import math
        env = ft.drape_envelope([0.0], [[0.1]], [2 * math.pi], 0.05, 0.0)
        self.assertAlmostEqual(env[0][0], 0.15)

    def test_smooth_up_spreads_and_never_lowers(self):
        g = [[0.0] * 4 for _ in range(3)]
        g[1][0] = 1.0
        s = ft.smooth_up(g, 3)
        self.assertEqual(s[1][0], 1.0)
        self.assertGreater(s[1][3], 0.0)  # wraps round the body
        self.assertTrue(all(s[k][b] >= g[k][b] for k in range(3) for b in range(4)))

    def test_torso_bands_finds_the_armpit_and_leaves_the_arms(self):
        import math
        BV = []
        for zi in range(40, 160):  # a torso ring 15 cm round the centre line, every 1 cm
            z = zi / 100
            BV += [(0.15 * math.cos(a / 12 * math.pi), 0.15 * math.sin(a / 12 * math.pi), z) for a in range(24)]
            if z < 1.20:  # arms hanging apart from the torso below the armpit
                BV += [(s * 0.30 + 0.03 * math.cos(a), 0.03 * math.sin(a), z) for s in (-1, 1) for a in range(8)]
            else:  # above it they join the shoulders
                BV += [(s * x / 100, 0.0, z) for s in (-1, 1) for x in range(15, 34, 3)]
        bands, armpit = ft.torso_bands(BV, 0.80, 0.0, above=0.05)
        self.assertAlmostEqual(armpit, 1.19, delta=0.02)
        inside = {i for b in bands.values() for i in b}
        self.assertTrue(all(abs(BV[i][0]) <= 0.151 for i in inside))  # no arm or shoulder vertex, also in the chest bands above
        self.assertGreater(max(BV[i][2] for i in inside), armpit + 0.03)

    def test_hem_lower_keeps_shape(self):
        self.assertAlmostEqual(ft.hem_lower(0.80, 1.00, 0.80, 0.70), 0.70)
        self.assertAlmostEqual(ft.hem_lower(0.90, 1.00, 0.80, 0.70), 0.85)
        self.assertEqual(ft.hem_lower(1.10, 1.00, 0.80, 0.70), 1.10)  # above the stretch: unchanged
        self.assertEqual(ft.hem_lower(0.80, 1.00, 0.80, 0.85), 0.80)  # already low enough


if __name__ == "__main__":
    unittest.main()
