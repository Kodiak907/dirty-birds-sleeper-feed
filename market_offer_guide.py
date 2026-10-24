#!/usr/bin/env python3
"""Read-only market-informed offer planning from attributed redraft reference values.

NOT an acceptance predictor. All prices are TheTradeCalc native 12-team FULL-PPR
redraft values; FFL uses half-PPR. Missing prices BLOCK offer guidance.
"""
import json,datetime as dt
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
def read(f):return json.loads((D/f).read_text(encoding="utf-8"))
def summarize(deal,market):
 given=[market.get(str(p["id"])) for p in deal["give"]]
 received=[market.get(str(p["id"])) for p in deal["receive"]]
 if any(x is None for x in given+received):return None
 paid=sum(float(x["value"]) for x in given)
 incoming=sum(float(x["value"]) for x in received)
 if incoming<=0 or paid<=0:return None
 ratio=paid/incoming
 # Ratio 1.0 means approximate balance in source native value units.
 return {"paid":round(paid),"received":round(incoming),
  "paid_to_received_ratio":round(ratio,3),
  "relative_value_difference_pct":round((ratio-1)*100,1)}
def main():
 market=read("market_values.json");ideas=read("TRADE_IDEAS.json")
 if market.get("count",0)<60:raise ValueError("No qualified source-backed market data")
 all_deals=[]
 unpriced=[]
 for d in ideas["suggestions"]:
  quote=summarize(d,market["players"])
  if quote is None:
   unpriced.append({"receive":[p["name"] for p in d["receive"]],
     "give":[p["name"] for p in d["give"]],"reason":"One or more players has no matched market value"})
   continue
  report={**d,"market_quote":quote}
  # Pricing too far away from source reference is an informative screen,
  # not an estimate of real-world likelihood.
  ratio=quote["paid_to_received_ratio"]
  if ratio<0.8 or ratio>1.12:continue
  # Trade discovery itself requires both starting lineups to improve.
  # Avoid weak, redundant packages with the same gain and an added outgoing player.
  comparable=[]
  for other in all_deals:
   if (other["opponent_roster_id"]==d["opponent_roster_id"] and
      {p["id"] for p in other["receive"]}=={p["id"] for p in d["receive"]} and
      other["dirty_birds_delta_ppg"]>=d["dirty_birds_delta_ppg"]-0.05 and
      {p["id"] for p in other["give"]}.issubset({p["id"] for p in d["give"]})):
    comparable.append(other)
  if comparable:continue
  # A balance-first opening band is convention, not a probability.
  report["market_screen"]="in_range"
  report["starter_benefit"]={"us":d["dirty_birds_delta_ppg"],"them":d["opponent_delta_ppg"]}
  report["opening_note"]="Consider exploratory discussion only after current injury, workload, playoff review."
  report["maximum_price_note"]="No justified maximum offer without validated market, player risk, and Coach's priorities."
  report["acceptance_probability"]=None
  all_deals.append(report)
 all_deals.sort(key=lambda x:(
   x["dirty_birds_delta_ppg"]+min(x["opponent_delta_ppg"],4)*.6-
   abs(1-x["market_quote"]["paid_to_received_ratio"])*2),reverse=True)
 dedup=[];keys=set();per_team={}
 for x in all_deals:
  key=(x["opponent_roster_id"],tuple(sorted(p["id"] for p in x["receive"])))
  if key in keys or per_team.get(x["opponent_roster_id"],0)>=2:continue
  dedup.append(x);keys.add(key)
  per_team[x["opponent_roster_id"]]=per_team.get(x["opponent_roster_id"],0)+1
  if len(dedup)>=5:break
 result={"generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
  "source":"Values by TheTradeCalc — https://thetradecalc.com",
  "source_as_of":market.get("as_of"),
  "market_baseline":"12-team 1QB FULL PPR redraft; FFL is HALF PPR",
  "market_band":"Screen paid/received between 0.80 and 1.12 in publisher native value units",
  "not_a_probability":True,"no_automatic_trade_offers":True,
  "limitations":["Value ratios are not exchange rates or manager acceptance probabilities.",
   "Full-PPR market baseline differs from FFL half-PPR.",
   "1-for-2 packages may require a separate cut; no FAAB or roster depth insurance priced.",
   "No numerical maximum price is endorsed without additional context.",
   "Verify current injuries and NFL snap/target usage before contacting a manager."],
  "qualified_top_five":dedup,"priced_candidates":len(all_deals),
  "unpriced_cases":len(unpriced),"unpriced_examples":unpriced[:10]}
 (D/"MARKET_OFFER_GUIDE.json").write_text(json.dumps(result,indent=2,ensure_ascii=False,sort_keys=True)+"\n")
 lines=["# Dirty Birds — Market-Screened Negotiation Guide","",
  "Values by TheTradeCalc: https://thetradecalc.com","",
  f"Updated: {result['generated_at_utc']}","",
  "**Read-only market-informed shortlist, not acceptance predictions or authorized offers.**",
  "TheTradeCalc's reference is 12-team full-PPR redraft. FFL is half-PPR; do not treat this as precise FFL pricing.","",
  f"Fully priced in-range opportunities: {len(all_deals)}. Unpriced candidate packages: {len(unpriced)}.","",
  "| # | Opponent | Our outgoing | Incoming | Market paid / received | Our lineup Δ | Their lineup Δ |",
  "|---:|---:|---|---|---:|---:|---:|"]
 for i,d in enumerate(dedup,1):
  outbound=", ".join(x["name"] for x in d["give"])
  inbound=", ".join(x["name"] for x in d["receive"])
  q=d["market_quote"]
  lines.append(f'| {i} | {d["opponent_roster_id"]} | {outbound} | {inbound} | {q["paid_to_received_ratio"]:.2f}× | {d["dirty_birds_delta_ppg"]:+.2f} | {d["opponent_delta_ppg"]:+.2f} |')
 if not dedup:lines+=["","No fully priced, mutually beneficial packages passed the conservative market screen. Do not force a trade."]
 lines+=["","## Negotiation protocol","",
  "1. Opening: discuss the other team's documented position need; check the proposed package's independent values and injury reports.",
  "2. Counteroffer: rerun discovery with the revised package; require lineup upside, full market coverage and acceptable roster cuts.",
  "3. Walk-away: do not claim a numerical maximum from uncalibrated full-PPR values. Preserve roster depth and playoff flexibility.",
  "4. Coach authorizes each offer. No trade or waiver action is executed."]
 (D/"MARKET_OFFER_GUIDE.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("Market offers:",len(all_deals),"screened;",len(dedup),"shortlisted;",len(unpriced),"unpriced")
if __name__=="__main__":main()
