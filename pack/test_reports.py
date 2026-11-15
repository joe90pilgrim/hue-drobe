"""Fails if the committed reports in pack/reports were not built from the current pack/fit_config.json.
Editing the fit config without rebuilding (python pack/build_pack.py --reports-to pack/reports) leaves the checks validating old garments.
Run: python -m unittest discover -s pack"""
import json, pathlib, unittest

import fit

HERE = pathlib.Path(__file__).resolve().parent
CFG = json.load(open(HERE / "fit_config.json"))
BODIES = sorted(p.stem for p in (HERE.parent / "spike" / "fixtures").glob("*.json") if not p.stem.endswith("_garments"))


class CommittedReports(unittest.TestCase):
    def test_one_report_per_synthetic_body(self):
        have = sorted(p.name[: -len("_report.json")] for p in (HERE / "reports").glob("*_report.json"))
        self.assertEqual(have, BODIES)

    def test_built_from_current_config(self):
        want = fit.config_hash(CFG)
        for name in BODIES:
            r = json.load(open(HERE / "reports" / f"{name}_report.json"))
            self.assertEqual(r.get("fit_config_sha256"), want,
                             f"{name}: report not built from the current pack/fit_config.json; rebuild with "
                             "python pack/build_pack.py --reports-to pack/reports")


if __name__ == "__main__":
    unittest.main()
