import unittest

import cup


class CupMacro(unittest.TestCase):
    def test_letters_are_case_insensitive_and_trimmed(self):
        self.assertEqual(cup.cup_macro(" a "), cup.cup_macro("A"))

    def test_bigger_cup_is_a_bigger_macro(self):
        letters = ["AA", "A", "B", "C", "D", "DD"]
        values = [cup.cup_macro(c) for c in letters]
        self.assertEqual(values, sorted(values))
        self.assertEqual(len(set(values)), len(values))

    def test_values_are_inside_the_macro_range(self):
        for c in ("AA", "A", "B", "C", "D", "DD"):
            self.assertTrue(0.0 <= cup.cup_macro(c) <= 1.0)

    def test_unknown_letter_is_refused(self):
        with self.assertRaises(ValueError):
            cup.cup_macro("Z")

    def test_a_small_table_is_used_when_given(self):
        self.assertEqual(cup.cup_macro("B", {"B": 0.25}), 0.25)


if __name__ == "__main__":
    unittest.main()
