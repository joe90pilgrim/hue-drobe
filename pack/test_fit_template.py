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
                         (bad(settle={"frames": 30}), "needs pin"), (bad(settle={"pin": {}, "wind": 1}), "unknown keys"),
                         (bad(contact_groups=[]), "contact_groups is empty"), (bad(replaces=["tops"]), "replaces names unknown"),
                         (bad(id="Plain Shirt"), "id 'Plain Shirt'")):
            with self.assertRaisesRegex(ft.MetaError, words):
                ft.validate_meta(m)
        self.assertEqual(ft.validate_meta(bad(settle={"pin": {}, "frames": 40}))["settle"]["frames"], 40)

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

    def test_a_male_and_a_female_template_may_share_a_file_but_not_with_both(self):
        """V5-01: Joe's and B's Oxfords are two templates that write oxfords.glb, never for the same body."""
        with tempfile.TemporaryDirectory() as root:
            self.write(root, "shoes", "oxfords_male", {**GOOD, "id": "oxfords_male", "category": "shoes", "pack_file": "oxfords", "allowed_bodies": "male"})
            self.write(root, "shoes", "oxfords_female", {**GOOD, "id": "oxfords_female", "category": "shoes", "pack_file": "oxfords", "allowed_bodies": "female"})
            self.assertEqual(len(ft.find_templates(root)), 2)
            self.write(root, "shoes", "oxfords_any", {**GOOD, "id": "oxfords_any", "category": "shoes", "pack_file": "oxfords", "allowed_bodies": "both"})
            with self.assertRaisesRegex(ft.MetaError, "both write oxfords.glb"):
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
        self.assertIsNone(ft.settle_settings(dress))  # the approved dress is fitted exactly as before
        self.assertFalse(ft.hides_inner(dress))
        for hat in ("newsboy_cap", "slouchy_beanie"):  # V5-02: each hat is worn over the hair and hides the hair it covers, for both bodies
            m = next(x for x in metas if x["id"] == hat)
            self.assertEqual((m["category"], m["layer"], m["inner_layers"], m["allowed_bodies"], m["colour"]), ("hats", "outer", ["hair"], "both", "plain"))
            self.assertTrue(ft.hides_inner(m))
        self.assertEqual({m["id"] for m in metas}, {"shift_dress", "shirt_untucked_bd", "tee_male", "tee_female", "trainers", "monk_straps", "oxfords_female", "sandals", "ankle_boots", "culturalibre_hair_01", "culturalibre_hair_02", "newsboy_cap", "slouchy_beanie"})  # V3.1-01: the V3-09 blazers are retired; the base tees came with V3.1-03; the shoes with V5-01; the hair with V5-04; the hats with V5-02


class Settle(unittest.TestCase):
    """V3.1-01: settle is cloth pinned on the garment (settle.pin), with rest "fitted" or "template"."""
    OK = {**GOOD, "settle": {"pin": {}}}

    def test_none_and_defaults(self):
        self.assertIsNone(ft.settle_settings(ft.validate_meta(GOOD)))
        s = ft.settle_settings(ft.validate_meta(self.OK))
        self.assertEqual(s["pin"], ft.PIN_DEFAULTS)
        self.assertEqual((s["rest"], s["frames"], s["collide_with"]), ("fitted", 60, []))
        s = ft.settle_settings(ft.validate_meta({**GOOD, "settle": {"pin": {"back_cm": 1.5, "cuffs_cm": 4}, "rest": "template",
                                                                      "collide_with": ["trousers"], "grow_from_skin": ["trousers"],
                                                                      "frames": 90, "bending": 0.1}}))
        self.assertEqual(s["pin"], {"front_cm": 3.5, "back_cm": 1.5, "cuffs_cm": 4})
        self.assertEqual((s["rest"], s["frames"], s["bending"], s["morph_frames"]), ("template", 90, 0.1, 20))

    def test_bad_values_refused(self):
        for st, msg in (("yes", "settle must be"), ({"frames": 30}, "settle needs pin"), ({"pin": []}, "pin must be an object"),
                        ({"pin": {"top_cm": 1}}, "pin has unknown keys"), ({"pin": {"front_cm": -1}}, "front_cm"),
                        ({"pin": {"cuffs_cm": 0}}, "cuffs_cm"), ({"pin": {}, "rest": "loose"}, "settle.rest"),
                        ({"pin": {}, "wind": 1}, "unknown keys"), ({"pin": {}, "frames": 60.5}, "whole number"),
                        ({"pin": {}, "mass": 0}, "settle.mass"), ({"pin": {}, "collide_with": "trousers"}, "collide_with must be"),
                        ({"pin": {}, "grow_from_skin": ["trousers"]}, "grow_from_skin may only"),
                        ({"pin": {}, "collide_with": ["tee"]}, "must not repeat inner_layers"),
                        ({"pin": {}, "rest": "template", "frames": 20, "morph_frames": 20}, "morph_frames must be fewer")):
            with self.subTest(st=st), self.assertRaisesRegex(ft.MetaError, msg):
                ft.validate_meta({**GOOD, "settle": st})


class Removed(unittest.TestCase):
    """V3.1-01: the V3-07b loose fit, inner_push and body-group pins are gone, and named clearly when a meta still has them."""

    def test_removed_fields_refused_by_name(self):
        for m, msg in (({**GOOD, "loose": {}}, "loose was removed in V3.1-01"), ({**GOOD, "loose": "none"}, "loose was removed"),
                       ({**GOOD, "inner_push": "shrinkwrap"}, "inner_push was removed in V3.1-01.*hide_inner"),
                       ({**GOOD, "settle": {"pinned": ["joint-neck"]}}, "settle.pinned was removed.*settle.pin"),
                       ({**GOOD, "settle": {"pin": {}, "pin_above_armpit_cm": 4}}, "settle.pin_above_armpit_cm was removed"),
                       ({**GOOD, "settle": {"pin": {}, "gravity_ramp": 20}}, "settle.gravity_ramp was removed"),
                       ({**GOOD, "settle": {"pin": {}, "pin_small_pieces": True}}, "settle.pin_small_pieces was removed")):
            with self.subTest(m=m), self.assertRaisesRegex(ft.MetaError, msg):
                ft.validate_meta(m)

    def test_loose_code_is_gone(self):
        for f in ("loose_settings", "loose_fit", "torso_bands", "convex_hull", "hull_radii", "drape_envelope", "smooth_up", "hem_lower",
                  "split_by_gap", "LOOSE_DEFAULTS", "INNER_PUSH"):
            self.assertFalse(hasattr(ft, f), f)
        src = open(ft.__file__, encoding="utf8").read()
        for word in ("SHRINKWRAP", "body_normal"):
            self.assertNotIn(word, src)


class HideInner(unittest.TestCase):
    """V3.1-01: hide_inner is on by default for a mid or outer layer with inner_layers."""

    def test_default(self):
        self.assertTrue(ft.hides_inner(ft.validate_meta(GOOD)))  # mid, over the tee
        self.assertTrue(ft.hides_inner(ft.validate_meta({**GOOD, "layer": "outer"})))
        self.assertFalse(ft.hides_inner(ft.validate_meta({**GOOD, "layer": "full"})))
        self.assertFalse(ft.hides_inner(ft.validate_meta({**GOOD, "inner_layers": []})))
        self.assertFalse(ft.hides_inner(ft.validate_meta({**GOOD, "hide_inner": False})))
        self.assertTrue(ft.hides_inner(ft.validate_meta({**GOOD, "layer": "full", "hide_inner": True})))

    def test_bad_values_refused(self):
        with self.assertRaisesRegex(ft.MetaError, "hide_inner must be"):
            ft.validate_meta({**GOOD, "hide_inner": "yes"})
        with self.assertRaisesRegex(ft.MetaError, "hide_inner needs inner_layers"):
            ft.validate_meta({**GOOD, "inner_layers": [], "hide_inner": True})


class GarmentPins(unittest.TestCase):
    """The garment-side pins, on made-up shapes in MakeHuman units (x across, y up, z forward; 1 unit = 10 cm)."""

    @staticmethod
    def shirt():
        # columns x = -3.0 .. 3.0 (step 0.2); the shoulder line at y 15 for |x| <= 2, dropping steeply past it (the sleeve);
        # each column has a front (z 1) and a back (z -1) running down from its top in 0.1 steps
        V = []
        for c in range(-15, 16):
            x = c * 0.2
            top = 15.0 if abs(x) <= 2.0 + 1e-9 else 15.0 - (abs(x) - 2.0) * 3
            for z in (1.0, -1.0):
                for k in range(12):
                    V.append((x, top - k * 0.1, z))
        return V

    def test_bands_front_and_back(self):
        V = self.shirt()
        pins, xl, xr = ft.garment_pins(V, range(len(V)), front_cm=3.5, back_cm=8.0)
        self.assertEqual((xl, xr), (-2.0, 2.0))  # the shoulder tips: the top line drops 0.6 units in the next column
        front = {i for i in pins if V[i][2] > 0}
        self.assertTrue(all(abs(V[i][0]) <= 2.0 + 1e-9 for i in pins))
        self.assertEqual(len(front), 21 * 4)  # 21 columns; the front 0 to 0.3 below the top
        self.assertEqual(len(pins - front), 21 * 9)  # the back 0 to 0.8 below the top
        narrow, _, _ = ft.garment_pins(V, range(len(V)), front_cm=3.5, back_cm=1.5)
        self.assertEqual(len(narrow - front), 21 * 2)

    def test_cuff_pins_by_the_sleeve_openings(self):
        # two square tubes along x (sleeves), open at both ends; the outermost open loops are the cuffs
        V, F = [], []
        for side in (-1, 1):
            base = len(V)
            for s in range(5):  # rings at |x| = 2.0 .. 2.4
                for (y, z) in ((0, 0), (0.1, 0), (0.1, 0.1), (0, 0.1)):
                    V.append((side * (2.0 + s * 0.1), y, z))
            for s in range(4):
                for k in range(4):
                    a, b = base + s * 4 + k, base + s * 4 + (k + 1) % 4
                    F.append([a, b, b + 4, a + 4])
        pins = ft.cuff_pins(V, F, range(len(V)), cuffs_cm=1.5)  # within 0.15 units of the outermost ring
        self.assertEqual(sorted(round(abs(V[i][0]), 1) for i in pins), [2.3] * 8 + [2.4] * 8)


class KeepIslands(unittest.TestCase):
    """V3-07c: keep_islands keeps whole islands of a pack item's mesh (a suit's jacket), checked against a recorded vertex count."""

    def test_off_by_default(self):
        self.assertIsNone(ft.validate_meta(GOOD).get("keep_islands"))
        self.assertIsNone(ft.validate_meta({**GOOD, "keep_islands": None}).get("keep_islands"))

    def test_valid(self):
        m = ft.validate_meta({**GOOD, "keep_islands": [0, 2, 4], "keep_islands_vertices": 5000})
        self.assertEqual(m["keep_islands"], [0, 2, 4])

    def test_bad_values_refused(self):
        for ki, msg in (("0", "non-empty list"), (0, "non-empty list"), ([], "non-empty list"), ([0, 1.5], "whole numbers"),
                        ([True], "whole numbers"), ([-1], "whole numbers"), (["jacket"], "whole numbers"), ([0, 2, 0], "duplicate")):
            with self.subTest(ki=ki), self.assertRaisesRegex(ft.MetaError, msg):
                ft.validate_meta({**GOOD, "keep_islands": ki, "keep_islands_vertices": 10})

    def test_vertex_count_required(self):
        for kv in (KeyError, None, 0, -3, 2.5, True, "10"):
            m = {**GOOD, "keep_islands": [0]}
            if kv is not KeyError:
                m["keep_islands_vertices"] = kv
            with self.subTest(kv=kv), self.assertRaisesRegex(ft.MetaError, "keep_islands_vertices"):
                ft.validate_meta(m)
        with self.assertRaisesRegex(ft.MetaError, "keep_islands is not"):
            ft.validate_meta({**GOOD, "keep_islands_vertices": 10})

    def test_islands_numbered_largest_first(self):
        # vertices 0-2: a triangle; 3-6: two triangles sharing an edge; 7: alone; 8-10: another triangle
        faces = [[0, 1, 2], [3, 4, 5], [4, 5, 6], [8, 9, 10]]
        self.assertEqual(ft.islands(11, faces), [[3, 4, 5, 6], [0, 1, 2], [8, 9, 10], [7]])

    def test_read_obj(self):
        v, f = ft.read_obj("\n".join(["# x", "v 0 0 0", "v 1 0 0", "v 0 1 0", "v 0 0 1", "vt 0 0", "f 1/1 2/1 3/1", "f -1 -2 -3"]))
        self.assertEqual(len(v), 4)
        self.assertEqual(f, [[0, 1, 2], [3, 2, 1]])

    def test_kept_vertices_and_refusals(self):
        isl = ft.islands(11, [[0, 1, 2], [3, 4, 5], [4, 5, 6], [8, 9, 10]])
        self.assertEqual(ft.kept_vertices(isl, [0, 2], 7), [3, 4, 5, 6, 8, 9, 10])
        with self.assertRaisesRegex(ValueError, "out of range"):
            ft.kept_vertices(isl, [4], 1)
        with self.assertRaisesRegex(ValueError, "the mesh has changed"):
            ft.kept_vertices(isl, [0], 5)


if __name__ == "__main__":
    unittest.main()
