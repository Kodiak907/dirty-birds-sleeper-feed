#!/usr/bin/env python3
"""Autonomous read-only waiver research. No claims, no inferred NFL activation."""
import concurrent.futures as cf
import datetime as dt
import email.utils
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

D=Path(__file__).resolve().parent/"data"
NOW=dt.datetime.now(dt.timezone.utc)
def read(n,default):
    try: return json.loads((D/n).read_text(encoding="utf-8"))
    except (OSError,ValueError): return default
def norm(s): return re.sub("[^a-z0-9]","",str(s or "").lower())
def get_news(p):
    name=p["name"]
    q='"'+name+'" NFL injury OR practice OR snaps OR targets OR waiver'
    url="https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":q,"hl":"en-US","gl":"US","ceid":"US:en"})
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 DirtyBirdsResearch/1.0"})
    out=[]
    try:
        with urllib.request.urlopen(req,timeout=8) as r: body=r.read(600000)
        root=ET.fromstring(body)
        for item in root.findall("./channel/item")[:16]:
            title=(item.findtext("title") or "").strip()
            link=(item.findtext("link") or "").strip()
            pub=item.findtext("pubDate") or ""
            if not link.startswith("https://") or not title: continue
            if name.split()[-1].lower().strip("'.") not in title.lower(): continue
            try:
                when=email.utils.parsedate_to_datetime(pub)
                if when.tzinfo is None:when=when.replace(tzinfo=dt.timezone.utc)
                if (NOW-when.astimezone(dt.timezone.utc)).total_seconds()>8*86400:continue
            except (TypeError,ValueError):continue
            src=item.find("source")
            out.append({"title":title[:230],"url":link,"published":when.date().isoformat(),
                        "publisher":(src.text or "") if src is not None else "News index",
                        "verification":"HEADLINE_ONLY_NOT_FACT_CHECKED"})
            if len(out)>=4:break
        return out,None
    except Exception as exc:
        return [],type(exc).__name__

def main():
    board=read("ACTIONABLE_GM_BOARD.json",{})
    watch=read("waiver_watchlist.json",{})
    meta=read("player_metadata.json",{})
    usage=read("external_metrics.json",{}).get("players",{})
    snap=read("latest.json",{})
    state=read("auto_waiver_scout_state.json",{}).get("players",{})
    owned={str(pid) for r in snap.get("rosters",[]) for pid in r.get("players",[])}
    index={norm(v.get("name")):(str(k),v) for k,v in meta.items() if v.get("name")}
    names=[x.get("player") for x in board.get("waiver_research_shortlist",[])]
    names += [x.get("name") for x in watch.get("projection_opportunity_screen",[])]
    for pos in ("WR","RB","TE","QB"):
        names += [x.get("name") for x in watch.get("position_rankings",{}).get(pos,[])[:15]]
    # All shortlist candidates + extra emerging high-projection players; not Coach-curated.
    wanted=[];seen=set()
    for name in names:
        key=norm(name)
        if key in seen or key not in index:continue
        pid,p=index[key]
        if pid in owned:continue
        seen.add(key);wanted.append((pid,p))
        if len(wanted)>=50:break
    by_team_pos={}
    for pid,p in meta.items():
        if p.get("position") in ("RB","WR","TE","QB") and p.get("team"):
            by_team_pos.setdefault((p["team"],p["position"]),[]).append((str(pid),p))
    output=[];next_state={}
    for pid,p in wanted:
        name=p.get("name");team=p.get("team");pos=p.get("position")
        m=usage.get(pid,usage.get(name,{})) or {}
        try:share=float(m.get("snap_share_pct"))
        except (ValueError,TypeError):share=None
        signals=[]
        status=str(p.get("injury_status") or "")
        if status and status.lower() not in ("active","healthy"):
            signals.append({"type":"Own Sleeper injury flag (unverified)",
              "description":f"{name}: {status}. Check official club report before making a claim.",
              "source_url":"https://www.nfl.com/injuries/"})
        teammates=[]
        for other_id,other in by_team_pos.get((team,pos),[]):
            if other_id==pid:continue
            tag=str(other.get("injury_status") or "").upper()
            if tag not in ("IR","OUT","PUP","DOUBTFUL","QUESTIONABLE"):continue
            try: ahead=(int(other["depth_chart_order"])<=int(p["depth_chart_order"]))
            except (KeyError,TypeError,ValueError):ahead=False
            if ahead:teammates.append(other["name"]+" ("+tag+")")
        if teammates:
            signals.append({"type":"Teammate depth opportunity — provider-tag only",
              "description":f"{team} {pos} teammates listed ahead in Sleeper: "+", ".join(teammates[:4])+". Verify official injury and role before assuming more work.",
              "source_url":"https://www.nfl.com/injuries/"})
        # Actual nflverse-backed participation/production, if published.
        # These are recent averages, NOT projections or guarantees.
        for field,threshold,label in (
            ("targets_per_game",6,"Recent target volume"),
            ("rush_attempts_per_game",12,"Recent carry workload"),
            ("receptions_per_game",4,"Recent reception volume")):
            x=m.get(field)
            try: number=float(x)
            except (TypeError,ValueError):continue
            if number>=threshold:
                signals.append({"type":label,
                    "description":f"{number:.1f} {field.replace('_per_game','').replace('_',' ')} per appearance in the source's recent sample; check trend and role.",
                    "source_url":m.get("source")})
        injury_record=m.get("injury_report_record")
        if isinstance(injury_record,dict) and injury_record:
            summary=", ".join(str(injury_record[k]) for k in
                ("week","report_status","practice_status","report_primary_injury") if injury_record.get(k))
            signals.append({"type":"Published injury report observation — historical",
                "description":"nflverse injury observation: "+summary+
                ". This record is not official game-day status and may be stale.",
                "source_url":m.get("source")})
        previous=state.get(pid,{}).get("share")
        if share is not None:
            if isinstance(previous,(int,float)) and share-previous>=8:
                signals.append({"type":"Measured snap share increase",
                  "description":f"Snap share up {share-previous:.1f} percentage points between stored scouting snapshots ({previous:.1f}% → {share:.1f}%). Confirm sample weeks.",
                  "source_url":m.get("source")})
            if share>=75:
                signals.append({"type":"High recent participation",
                  "description":f"Snap share {share:.1f}%; targets, touches and route trends still need verification.",
                  "source_url":m.get("source")})
        output.append({"id":pid,"name":name,"team":team,"position":pos,"snap_share_pct":share,
          "checked_at":NOW.isoformat(),"signals":signals,"news":[]})
        next_state[pid]={"share":share,"status":status}
    errors=[]
    # Parallel public news research on top thirty, every scheduled run.
    with cf.ThreadPoolExecutor(max_workers=6) as executor:
        tasks={executor.submit(get_news,p):p for p in output[:30]}
        for future in cf.as_completed(tasks):
            item=tasks[future]
            try:articles,err=future.result()
            except Exception as exc:articles,err=[],type(exc).__name__
            item["news"]=articles
            if err:errors.append(err)
    result={"schema_version":1,"generated_at_utc":NOW.isoformat(),
      "source_snapshot_utc":snap.get("fetched_at_utc"),
      "candidate_count":len(output),"news_queries_attempted":min(30,len(output)),
      "news_query_failures":len(errors),"news_status":"degraded" if errors else "connected",
      "limitations":["Public news index displays dated headlines only; link and verify individual reporting.",
        "Sleeper injury and depth ranks are provider reports, not official NFL activations.",
        "Only first 30 candidates get news-index queries per run; every candidate gets depth and usage screening.",
        "No automatic trades, lineup changes, drops or waiver claims."],
      "candidates":output}
    (D/"AUTOMATED_WAIVER_SCOUTING.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (D/"auto_waiver_scout_state.json").write_text(json.dumps({"players":next_state},indent=2)+"\n",encoding="utf-8")
    print("Waiver scouting:",len(output),"candidates,",len(errors),"news source errors")
if __name__=="__main__":main()
