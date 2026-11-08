# Portfolio finance practice

Synthetic project portfolio data. All names and figures are invented.

In the data, "LME" is short for London Mochi Exchange, an invented organisation with no connection to any real company.

This is a practice build: a Power BI report for project cost reporting. It uses ten invented projects, an approved budget of £54.0M for 2026, monthly ledger actuals to October 2026, a full-year forecast saved at each month-end, project-manager trackers and purchase-order commitments.

Every headline figure was checked against a separate Python calculation on the same files (see `check/`).

Headline figures at 31 Oct 2026: Budget FY £54.0M, Forecast FY £56.75M, estimate at completion £56.8M, two projects flagged for review.

## What is in this folder

```
portfolio-finance-practice/
  README.md
  report/        three PNGs, the PDF and the .pbix
  dax/           measures.md
  data/clean/    the eight cleaned CSVs (for reference)
  data/raw/      the original messy files the .pbix reads
  check/         answer_key.py and answer_key_output.txt
```

## The report

Three pages:

1. **CFO view.** Budget, actuals, committed, forecast, estimate at completion, variance, projects flagged for review and capex share.
2. **Forecast accuracy.** Error and bias by project manager, bias by project, and how the full-year forecast moved month by month.
3. **Reconciliation.** Project-manager trackers against the ledger. Four breaks with three causes (a timing item, an invoice coded to the wrong project, an invoice posted twice), and one project that had not submitted.

## Open the .pbix

Opens in Power BI Desktop (free, Windows). The data is already loaded in the file. To refresh it, point the data sources at the `data/raw` folder, because the report cleans those files in Power Query. The `data/clean` folder holds the cleaned result for reference.

## Run the check

`check/answer_key.py` recomputes the headline figures from the cleaned CSVs. It needs Python with pandas and numpy.

```
python check/answer_key.py data/clean
```

`check/answer_key_output.txt` is what it prints.

## What is not here

- No live data refresh.
- No row-level security.
- No connection to a project-management tool.
