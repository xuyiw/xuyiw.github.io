# DAX measures

Synthetic project portfolio data. All names and figures are invented.

These are the measures behind the three report pages. Each headline figure was checked against a separate Python calculation on the same files (see `check/`).

## Reference points

```dax
Latest Closed Month =
CALCULATE ( MAX ( fact_actuals[month_end] ), REMOVEFILTERS () )

Latest Snapshot =
CALCULATE ( MAX ( fact_forecast_snapshots[snapshot_month_end] ), REMOVEFILTERS () )
```

## Budget and actuals

```dax
Budget FY =
CALCULATE ( SUM ( fact_budget[amount_gbp] ), REMOVEFILTERS ( dim_date ) )

Budget YTD =
VAR AsOf = MIN ( MAX ( dim_date[month_end] ), [Latest Closed Month] )
RETURN
    CALCULATE (
        SUM ( fact_budget[amount_gbp] ),
        FILTER ( ALL ( dim_date ), dim_date[month_end] <= AsOf )
    )

Actual YTD =
VAR AsOf = MIN ( MAX ( dim_date[month_end] ), [Latest Closed Month] )
RETURN
    CALCULATE (
        SUM ( fact_actuals[amount_gbp] ),
        FILTER ( ALL ( dim_date ), dim_date[month_end] <= AsOf )
    )

Variance £ = [Actual YTD] - [Budget YTD]

Variance % = DIVIDE ( [Variance £], [Budget YTD] )

Committed =
VAR AsOf = [Latest Closed Month]
RETURN
    CALCULATE ( SUM ( fact_commitments[open_po_gbp] ), dim_date[month_end] = AsOf )
```

Committed is a balance at one date (open purchase orders), so it uses the latest closed month only and is never added across months.

## Forecast and estimate at completion

```dax
Forecast FY =
VAR Snap = [Latest Snapshot]
RETURN
    CALCULATE (
        SUM ( fact_forecast_snapshots[amount_gbp] ),
        fact_forecast_snapshots[snapshot_month_end] = Snap
    )

Forecast Remaining =
VAR Snap = [Latest Snapshot]
RETURN
    CALCULATE (
        SUM ( fact_forecast_snapshots[amount_gbp] ),
        fact_forecast_snapshots[snapshot_month_end] = Snap,
        fact_forecast_snapshots[row_type] = "Forecast"
    )

EAC = [Actual YTD] + [Forecast Remaining]

EAC Variance £ = [EAC] - [Budget FY]

EAC Variance % = DIVIDE ( [EAC Variance £], [Budget FY] )

Forecast FY Prior Month =
VAR PriorSnap = EOMONTH ( [Latest Snapshot], -1 )
RETURN
    CALCULATE (
        SUM ( fact_forecast_snapshots[amount_gbp] ),
        fact_forecast_snapshots[snapshot_month_end] = PriorSnap
    )

Forecast Change % =
DIVIDE ( [Forecast FY] - [Forecast FY Prior Month], [Forecast FY Prior Month] )
```

EAC is estimate at completion for the year: ledger actuals to date plus the project managers' forecast for the months still to come.

## Flags

```dax
Variance Flag =
IF (
    ISBLANK ( [Budget YTD] ),
    BLANK (),
    IF (
        ABS ( [EAC Variance %] ) > 0.05
            || ABS ( COALESCE ( [Forecast Change %], 0 ) ) > 0.10,
        "Review",
        "OK"
    )
)

Projects to Review =
COUNTROWS ( FILTER ( VALUES ( dim_project[project_id] ), [Variance Flag] = "Review" ) )

Capex Actual = CALCULATE ( [Actual YTD], dim_cost_category[capex_opex_default] = "Capex" )

Capex % = DIVIDE ( [Capex Actual], [Actual YTD] )
```

The capex and opex split is a default by cost category, to show the split. It is not an accounting judgement.

## Forecast accuracy (page 2)

Each forecast made one month ahead is compared with the ledger figure for that month. Error ignores direction. Bias keeps it (negative means forecasts run low).

```dax
Forecast Error % =
VAR t =
    FILTER (
        fact_forecast_snapshots,
        fact_forecast_snapshots[months_ahead] = 1
            && NOT ISBLANK ( fact_forecast_snapshots[actual_gbp] )
    )
RETURN
    DIVIDE (
        SUMX ( t, ABS ( fact_forecast_snapshots[amount_gbp] - fact_forecast_snapshots[actual_gbp] ) ),
        SUMX ( t, fact_forecast_snapshots[actual_gbp] )
    )

Forecast Bias % =
VAR t =
    FILTER (
        fact_forecast_snapshots,
        fact_forecast_snapshots[months_ahead] = 1
            && NOT ISBLANK ( fact_forecast_snapshots[actual_gbp] )
    )
RETURN
    DIVIDE (
        SUMX ( t, fact_forecast_snapshots[amount_gbp] - fact_forecast_snapshots[actual_gbp] ),
        SUMX ( t, fact_forecast_snapshots[actual_gbp] )
    )

Forecast FY Walk = SUM ( fact_forecast_snapshots[amount_gbp] )
```

Forecast FY Walk has no snapshot filter of its own. With `snapshot_month_end` on the chart axis, each point is the full-year forecast as submitted at that month-end.

## Reconciliation (page 3)

```dax
Tracker Minus Ledger =
SUMX (
    VALUES ( dim_project[project_id] ),
    VAR LastSub = CALCULATE ( MAX ( fact_pm_submissions[month_end] ) )
    VAR Tracker =
        CALCULATE (
            SUM ( fact_pm_submissions[spend_to_date_gbp] ),
            fact_pm_submissions[month_end] = LastSub
        )
    RETURN
        IF ( ISBLANK ( Tracker ), BLANK (), Tracker - [Actual YTD] )
)

Recon Status =
VAR LastSub = CALCULATE ( MAX ( fact_pm_submissions[month_end] ) )
RETURN
    SWITCH (
        TRUE (),
        ISBLANK ( LastSub ), "No tracker",
        LastSub < [Latest Closed Month], "Not submitted",
        ABS ( [Tracker Minus Ledger] ) >= 10000, "Break",
        "OK"
    )

Lines per Invoice =
CALCULATE (
    COUNTROWS ( fact_actuals ),
    ALLEXCEPT ( fact_actuals, fact_actuals[invoice_ref] )
)

Recon Colour =
SWITCH ( [Recon Status], "Break", "#D64550", "Not submitted", "#E8A33D", BLANK () )
```

A difference of £10,000 or more between the project manager's tracker and the ledger is a Break. A project whose last submission is before the latest closed month shows Not submitted, which is a late submission and not a ledger difference.
