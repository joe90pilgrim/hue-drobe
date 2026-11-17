"""Cup letter to MPFB cupsize macro (V2-09). No Blender needed. The table is spike/cup_sizes.json."""
import json
import pathlib

TABLE_PATH = pathlib.Path(__file__).resolve().parent.parent / "spike" / "cup_sizes.json"


def cup_macro(letter, table=None):
    """The cupsize macro (0..1) for a cup letter such as "A" or "dd". Raises ValueError for a letter the table does not have."""
    table = table if table is not None else json.load(open(TABLE_PATH))["cupsize_macro"]
    key = str(letter).strip().upper()
    if key not in table:
        raise ValueError(f"unknown cup {letter!r}; known: {', '.join(table)}")
    return table[key]
