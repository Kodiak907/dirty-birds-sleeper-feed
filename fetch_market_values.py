#!/usr/bin/env python3
"""Import dated editorial trade chart values; preserve each source's native scale.

This is NOT a prediction of a manager accepting a trade.
Fails closed if source layout changes or too few distinct NFL players match.
"""
import urllib.request,html.parser,re,json,datetime as dt,collections
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
URL="https://www.fantasypros.com/2026/10/fantasy-football-trade-value-chart-week-7-2026/"
class Tables(html.parser.HTMLParser):
 def __init__(self):
  super().__init__();self.in_table=False;self.in_cell=False;self.current=[];self.rows=[];self.table=[];self.tables=[];self.textbuf=[]
 def handle_starttag(self,tag,attrs):
  if tag=="table":self.in_table=True;self.table=[]
  if self.in_table and tag=="tr":self.rows=[]
  if self.in_table and tag in ("td","th"):self.in_cell=True;self.textbuf=[]
 def handle_data(self,data):
  if self.in_cell:self.textbuf.append(data)
 def handle_endtag(self,tag):
  if tag in ("td","th") and self.in_cell:
   self.rows.append(" ".join("".join(self.textbuf).split()));self.in_cell=False
  if tag=="tr" and self.in_table and self.rows:self.table.append(self.rows);self.rows=[]
  if tag=="table" and self.in_table:
   self.tables.append(self.table);self.in_table=False
def normalize(s):return re.sub("[^a-z0-9]","",s.casefold())
def main():
 req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0 (compatible; FFO-Research/1.0)"})
 with urllib.request.urlopen(req,timeout=30) as h:raw=h.read().decode("utf8","replace")
 parser=Tables();parser.feed(raw)
 names=json.loads((D/"player_names.json").read_text())
 match=collections.defaultdict(set)
 for pid,p in names.items():
  if p.get("name"):match[normalize(p["name"])].add(str(pid))
 players={};identified_tables=0
 for table in parser.tables:
  if len(table)<3:continue
  header=[x.lower() for x in table[0]]
  if not any("value" in h for h in header) or not any("name" in h or "player" in h for h in header):continue
  ni=next(i for i,h in enumerate(header) if "name" in h or "player" in h)
  vi=next(i for i,h in enumerate(header) if "value" in h)
  identified_tables+=1
  for row in table[1:]:
   if max(ni,vi)>=len(row):continue
   rawname=row[ni].strip()
   try:v=float(row[vi].replace(",","").replace("+",""))
   except ValueError:continue
   ids=match.get(normalize(rawname),set())
   if len(ids)!=1:continue
   pid=next(iter(ids))
   players[pid]={"name":names[pid]["name"],"position":names[pid].get("position"),
      "value":v}
 if len(players)<50:raise RuntimeError(f"Source format/coverage failed: {len(players)} matched across {identified_tables} trade chart tables; no output saved.")
 out={"as_of":dt.datetime.now(dt.timezone.utc).isoformat(),"source":URL,
  "scale":"FantasyPros editorial week-7 2026 native redraft trade chart units (NOT normalized)",
  "source_date":"2026-10-20","scoring_note":"Editorial chart, not necessarily exact FFL custom half-PPR settings",
  "matching":"Unique normalized Sleeper player name only; uncertain rows excluded",
  "count":len(players),"players":players}
 (D/"market_values.json").write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
 print("Sourced FantasyPros market chart values:",len(players),"players")
if __name__=="__main__":main()
