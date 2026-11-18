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


if __name__ == "__main__":
    unittest.main()
