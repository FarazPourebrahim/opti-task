"""The production text builders (oa3/inference.py) must produce byte-identical strings to the ones the model was
trained on (oa2/data.py). If one of these tests fails, production inputs no longer match training (DESIGN.md §3).

Run: python -m pytest tests  (no GPU and no model download needed)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

OA3_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OA3_DIR))

from oa3.config import import_oa2, load_config  # noqa: E402

CFG = load_config(OA3_DIR / "config.yaml")
import_oa2(CFG)

from oa2 import data as oa2_data  # noqa: E402
from oa3.data import nested_sample  # noqa: E402
from oa3.inference import MemberProfile, TaskInput, clean_text, profile_text, task_text  # noqa: E402

TRICKY = [
    None, "", "   ", "plain", '"quoted"', '"""triple"""', '""""four""""', '"', '""', '"a"b"', '"unbalanced',
    "  lots \n\n of\t\twhitespace \r\n here ", "x" * 9000, '"  inner spaces  "', "ünïcødé nbsp",
]


@pytest.mark.parametrize("value", TRICKY)
@pytest.mark.parametrize("max_chars", [None, 8000, 5])
def test_clean_text_matches_oa2(value, max_chars):
    assert clean_text(value, max_chars) == oa2_data._clean(value, max_chars)


def _write_tawos_subset(d: Path, issues: list[dict], components: dict[int, list[str]]) -> None:
    """Minimal Issue/Project/Component/Issue_Component CSVs in the TAWOS layout, for oa2.data._load_issue_base."""
    pd.DataFrame([{"ID": 1, "Project_Key": "MESOS"}, {"ID": 2, "Project_Key": "XD"}]).to_csv(d / "Project.csv",
                                                                                             index=False)
    names = sorted({n for v in components.values() for n in v})
    comp_id = {n: i + 1 for i, n in enumerate(names)}
    pd.DataFrame({"ID": list(comp_id.values()), "Name": list(comp_id.keys())}).to_csv(d / "Component.csv",
                                                                                      index=False)
    pd.DataFrame([{"Issue_ID": iid, "Component_ID": comp_id[n]} for iid, v in components.items() for n in v]
                 ).to_csv(d / "Issue_Component.csv", index=False)
    rows = [{"ID": r["id"], "Title": r["title"], "Description_Text": r["desc"], "Type": r["type"],
             "Story_Point": "", "Creation_Date": "2020-01-01 00:00:00", "Project_ID": r["project_id"],
             "Title_Changed_After_Estimation": "0", "Description_Changed_After_Estimation": "0"} for r in issues]
    pd.DataFrame(rows).to_csv(d / "Issue.csv", index=False)


def test_task_text_matches_oa2(tmp_path):
    issues = [
        {"id": 10, "project_id": 1, "type": "Bug", "title": '"Agent crashes"', "desc": "When the cgroup\n\nis removed"},
        {"id": 11, "project_id": 2, "type": " Story ", "title": "No components", "desc": ""},
        {"id": 12, "project_id": 1, "type": "Task", "title": "", "desc": ""},
        {"id": 13, "project_id": 2, "type": "Improvement", "title": "Long", "desc": "y " * 6000},
        {"id": 14, "project_id": 1, "type": "Bug", "title": "Dup comps", "desc": '"""wrapped"""'},
    ]
    components = {10: ["containerizer", "agent"], 14: ["agent", " agent ", "  "], 13: ['"docs"']}
    _write_tawos_subset(tmp_path, issues, components)
    base = oa2_data._load_issue_base(tmp_path, 8000).set_index("Issue_ID")
    keys = {1: "MESOS", 2: "XD"}
    for r in issues:
        t = TaskInput(project_key=keys[r["project_id"]], issue_type=r["type"], title=r["title"], description=r["desc"],
                      components=components.get(r["id"], []))
        assert task_text(t, 8000) == base.loc[r["id"], "text"], r["id"]


def test_profile_text_matches_oa2():
    users = pd.read_csv(Path(CFG["dataset_dir"]) / "User.csv", keep_default_na=False)
    for _, row in users.iterrows():
        m = MemberProfile(member_id=row["ID"], level=row["Expertise_Level"], area=row["Expertise_Area"],
                          years_experience=row["Years_Experience"], role=row["Role_In_Project"],
                          role_class=row["Role_Class"])
        assert profile_text(m) == oa2_data.member_profile_text(row)


def test_query_prefix_matches_oa2_run():
    """The prefix OA3 trains with is the one OA2's winning run recorded."""
    import json
    runs = Path(CFG["oa2_dir"]) / "reports_tast_assignment" / "runs"
    run = json.loads(next(p for p in runs.glob("*qwen3_embedding*.json") if "__2026" not in p.name)
                     .read_text(encoding="utf-8"))
    hp = run["training"]["hyperparameters"]
    assert CFG["prompt"]["query_prefix_resolved"] == hp["query_prefix"]
    assert CFG["prompt"]["doc_prefix"] == hp["doc_prefix"]


def test_nested_sampling_is_a_superset():
    pool = np.arange(1000, 6000)
    small, large = nested_sample(pool, 500, 1), nested_sample(pool, 2000, 1)
    assert set(small) <= set(large)
    assert len(set(large)) == 2000
    assert np.array_equal(nested_sample(pool[::-1], 500, 1), small)  # independent of the pool's order
    assert len(nested_sample(pool, 10_000, 1)) == len(pool)          # budget above the pool -> everything
