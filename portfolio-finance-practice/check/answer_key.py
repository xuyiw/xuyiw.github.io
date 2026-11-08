import sys
import os
import numpy as np
import pandas as pd

D = sys.argv[1]
rd = lambda f: pd.read_csv(os.path.join(D, f), encoding="utf-8-sig")
proj = rd("dim_project.csv")
bud = rd("fact_budget.csv")
act = rd("fact_actuals.csv")
com = rd("fact_commitments.csv")
snap = rd("fact_forecast_snapshots.csv")
pm = rd("fact_pm_submissions.csv")
pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 30)
pd.options.display.float_format = "{:,.1f}".format

short = proj.set_index("project_id").project_name.str.slice(0, 22)

# --- story 2: P001 cumulative variance by month
print("== P001 cumulative budget vs actual by month ==")
b = bud[bud.project_id == "LME-P001"].groupby("month_end").amount_gbp.sum().cumsum()
a = act[act.project_id == "LME-P001"].groupby("month_end").amount_gbp.sum().reindex(b.index).fillna(0).cumsum()
t = pd.DataFrame({"budget_cum": b, "actual_cum": a, "var": a - b})
print(t.head(10))

# --- as-of measures
LM = act.month_end.max()
LS = snap.snapshot_month_end.max()
print("\nLatest closed month:", LM, " latest snapshot:", LS)

bytd = bud[bud.month_end <= LM].groupby("project_id").amount_gbp.sum()
aytd = act[act.month_end <= LM].groupby("project_id").amount_gbp.sum()
committed = com[com.month_end == LM].set_index("project_id").open_po_gbp
s_latest = snap[snap.snapshot_month_end == LS]
ffy = s_latest.groupby("project_id").amount_gbp.sum()
frem = s_latest[s_latest.row_type == "Forecast"].groupby("project_id").amount_gbp.sum()
eac = aytd + frem
prior = snap[snap.snapshot_month_end == "2026-09-30"].groupby("project_id").amount_gbp.sum()
fchg = ffy / prior - 1
bfy = bud.groupby("project_id").amount_gbp.sum()
dfp = pd.DataFrame({"name": short, "BudgetFY": bfy, "BudgetYTD": bytd, "ActualYTD": aytd, "Committed": committed,
                    "ForecastFY": ffy, "EAC": eac, "PriorFY": prior})
dfp["VarYTD"] = dfp.ActualYTD - dfp.BudgetYTD
dfp["VarYTD%"] = dfp.VarYTD / dfp.BudgetYTD * 100
dfp["EACvar"] = dfp.EAC - dfp.BudgetFY
dfp["EACvar%"] = dfp.EACvar / dfp.BudgetFY * 100
dfp["FcstChg%"] = fchg * 100
dfp["Flag"] = np.where((dfp["EACvar%"].abs() > 5) | (dfp["FcstChg%"].abs() > 10), "Review", "OK")
print("\n== Project table (as of Oct) ==")
print(dfp.drop(columns=["PriorFY"]).to_string())
print("\nTotals:", dfp[["BudgetFY", "BudgetYTD", "ActualYTD", "Committed", "ForecastFY", "EAC"]].sum().to_dict())
print("Projects to Review:", (dfp.Flag == "Review").sum(), list(dfp[dfp.Flag == "Review"].index))

# --- story 1: P005 forecast FY by snapshot
print("\n== P005 forecast FY by snapshot ==")
x = snap[snap.project_id == "LME-P005"].groupby("snapshot_month_end").amount_gbp.sum()
print(pd.DataFrame({"ForecastFY": x, "chg%": x.pct_change() * 100}))
tot = snap.groupby("snapshot_month_end").amount_gbp.sum()
print("\nPortfolio forecast FY by snapshot:\n", tot)

# --- story 3: forecast accuracy by PM (lag-1)
f1 = snap[(snap.row_type == "Forecast") & (snap.months_ahead == 1) & snap.actual_gbp.notna()].copy()
f1 = f1.merge(proj[["project_id", "pm"]], on="project_id")
f1["abs_err"] = (f1.amount_gbp - f1.actual_gbp).abs()
f1["err"] = f1.amount_gbp - f1.actual_gbp
g = f1.groupby("pm").agg(abs_err=("abs_err", "sum"), err=("err", "sum"), actual=("actual_gbp", "sum"), n=("err", "size"))
g["Error%"] = g.abs_err / g.actual * 100
g["Bias%"] = g.err / g.actual * 100
print("\n== Lag-1 forecast accuracy by PM ==")
print(g)
tg = f1.agg(dict(abs_err="sum", err="sum", actual_gbp="sum"))
print("Portfolio Error%:", tg.abs_err / tg.actual_gbp * 100, " Bias%:", tg.err / tg.actual_gbp * 100)
g2 = f1.groupby("project_id").agg(abs_err=("abs_err", "sum"), err=("err", "sum"), actual=("actual_gbp", "sum"))
g2["Error%"] = g2.abs_err / g2.actual * 100
g2["Bias%"] = g2.err / g2.actual * 100
print("\n== by project ==")
print(g2[["Error%", "Bias%"]])

# --- story 4: tracker vs ledger
tr = pm.sort_values("month_end").groupby("project_id").tail(1).set_index("project_id")
tr = tr[["month_end", "spend_to_date_gbp"]]
rec = pd.DataFrame({"tracker_ytd": tr.spend_to_date_gbp, "tracker_month": tr.month_end, "ledger_ytd": aytd})
rec["diff"] = rec.tracker_ytd - rec.ledger_ytd
rec["status"] = np.where(rec.tracker_month < LM, "Not submitted",
                         np.where(rec["diff"].abs() >= 10000, "Break", "OK"))
print("\n== Tracker vs ledger (Oct YTD) ==")
print(rec)

# P009 note
print("\nP009 PM comment: ", pm[(pm.project_id == "LME-P009")].tail(2).to_dict("records"))
print("P009 delivery status:", proj.set_index("project_id").loc["LME-P009", "delivery_status"])
