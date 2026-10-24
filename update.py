#!/usr/bin/env python3
"""Read-only Sleeper league snapshot + changed-transaction event history."""
import json, os, pathlib, datetime, urllib.request, urllib.error, time

LEAGUE_ID = os.getenv('SLEEPER_LEAGUE_ID', '1399157532559192064')
ROOT = pathlib.Path(__file__).parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
BASE = 'https://api.sleeper.app/v1'

def fetch(path):
    url=f'{BASE}/{path}'
    last=None
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'DirtyBirds-ReadOnlyMonitor/1.0', 'Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=30) as r:
                return json.load(r)
        except (urllib.error.URLError,TimeoutError, json.JSONDecodeError) as err:
            last=err; time.sleep((attempt+1)*2)
    raise RuntimeError(f'Cannot fetch {url}: {last}')

def save(path,obj):
    path.write_text(json.dumps(obj,indent=2,ensure_ascii=False,sort_keys=True)+'\n',encoding='utf8')

def main():
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    league=fetch(f'league/{LEAGUE_ID}')
    if not isinstance(league,dict) or str(league.get('league_id'))!=LEAGUE_ID:
        raise ValueError('Wrong league ID / malformed response')
    rosters=fetch(f'league/{LEAGUE_ID}/rosters')
    users=fetch(f'league/{LEAGUE_ID}/users')
    state=fetch('state/nfl')
    drafts=fetch(f'league/{LEAGUE_ID}/drafts')
    week=int(state.get('week') or state.get('display_week') or 1)
    weeks=list(range(1,max(week,1)+1))
    # A pre-week-1 transaction bucket may exist; preserve it if available.
    transactions={}
    for w in [0]+weeks:
        transactions[str(w)]=fetch(f'league/{LEAGUE_ID}/transactions/{w}')
    matchups={str(w):fetch(f'league/{LEAGUE_ID}/matchups/{w}') for w in weeks}
    traded_picks=fetch(f'league/{LEAGUE_ID}/traded_picks')
    draft_picks={}
    for d in drafts:
        if d.get('draft_id'):
            draft_picks[str(d['draft_id'])]=fetch(f'draft/{d["draft_id"]}/picks')
    # Player ID dictionary is sizable and updated independently; only fetch when absent or >1 day old.
    player_file=DATA/'players.json'
    if not player_file.exists() or time.time()-player_file.stat().st_mtime>23*3600:
        players=fetch('players/nfl')
        save(player_file,players)
    else:
        players=json.loads(player_file.read_text(encoding='utf8'))
    combined={
        'league_id':LEAGUE_ID,'fetched_at_utc':now,'nfl_state':state,'league':league,
        'users':users,'rosters':rosters,'transactions_by_week':transactions,
        'matchups_by_week':matchups,'drafts':drafts,'draft_picks':draft_picks,
        'traded_picks':traded_picks,
    }
    previous_path=DATA/'latest.json'
    prev=json.loads(previous_path.read_text(encoding='utf8')) if previous_path.exists() else {}
    prior_roster={x['roster_id']:x for x in prev.get('rosters',[])}
    changes=[]
    for roster in rosters:
        rid=roster['roster_id']; prior=prior_roster.get(rid)
        if prior:
            added=sorted(set(roster.get('players') or [])-set(prior.get('players') or []))
            dropped=sorted(set(prior.get('players') or [])-set(roster.get('players') or []))
            if added or dropped:changes.append({'kind':'roster_change','roster_id':rid,'added':added,'dropped':dropped})
            if roster.get('starters')!=prior.get('starters'):changes.append({'kind':'lineup_change','roster_id':rid,'old':prior.get('starters'),'new':roster.get('starters')})
            if roster.get('reserve')!=prior.get('reserve'):changes.append({'kind':'reserve_change','roster_id':rid,'old':prior.get('reserve'),'new':roster.get('reserve')})
    def index_tx(obj):
        return {str(x.get('transaction_id')):x for xs in obj.values() for x in (xs or []) if isinstance(x,dict) and x.get('transaction_id')}
    old_tx=index_tx(prev.get('transactions_by_week',{})); new_tx=index_tx(transactions)
    for txid, tx in new_tx.items():
        if txid not in old_tx:changes.append({'kind':'new_transaction','transaction_id':txid,'transaction':tx})
        elif tx.get('status')!=old_tx[txid].get('status'):
            changes.append({'kind':'transaction_status_change','transaction_id':txid,'old_status':old_tx[txid].get('status'),'new_status':tx.get('status'),'transaction':tx})
    if not prev:changes.append({'kind':'initial_baseline','description':'First snapshot; historical transactions are in latest.json'})
    # Keep durable event history, only append if changed; baseline has no inferred claims.
    events_file=DATA/'events.json'
    events=json.loads(events_file.read_text(encoding='utf8')) if events_file.exists() else []
    events += [{'detected_at_utc':now,**c} for c in changes]
    save(events_file,events)
    save(previous_path,combined)
    playerids=set()
    for r in rosters:
        playerids.update(r.get('players') or []); playerids.update(r.get('reserve') or [])
    for tx in new_tx.values():
        playerids.update((tx.get('adds') or {}).keys()); playerids.update((tx.get('drops') or {}).keys())
    names={p:{'name':(' '.join(filter(None,[players.get(p,{}).get('first_name'),players.get(p,{}).get('last_name')])) or p), 'team':players.get(p,{}).get('team'),'position':players.get(p,{}).get('position')} for p in playerids if p in players}
    save(DATA/'player_names.json',names)
    owners={str(u.get('user_id')):u.get('metadata',{}).get('team_name') or u.get('display_name') or u.get('username') for u in users}
    text=['# FFL / Dirty Birds â Sleeper intelligence feed', '',f'Updated: {now}',f'League: {LEAGUE_ID}',f'NFL week: {week}', '', '## All rosters / records']
    for r in sorted(rosters,key=lambda r:r['roster_id']):
        s=r.get('settings') or {}
        text.append(f"- Roster {r['roster_id']}: {owners.get(str(r.get('owner_id')), str(r.get('owner_id')))} | {s.get('wins',0)}-{s.get('losses',0)} | FAAB used: {s.get('waiver_budget_used','?')}")
    text.extend(['','## Changes detected in this run'])
    if not changes:text.append('No changes versus previous captured snapshot.')
    for ch in changes:
        if ch['kind']=='new_transaction':
            t=ch['transaction']; text.append(f"- Transaction {ch['transaction_id']}: {t.get('type')} / {t.get('status')} / rosters {t.get('roster_ids')} / adds {t.get('adds')} / drops {t.get('drops')} / FAAB bid {((t.get('settings') or {}).get('waiver_bid'))}")
        elif ch['kind']=='roster_change':
            n=lambda ids:', '.join(names.get(p,{}).get('name',p) for p in ids) or 'none'
            text.append(f"- Roster {ch['roster_id']}: added {n(ch['added'])}; dropped {n(ch['dropped'])}")
        else:text.append(f"- {ch['kind']} â roster/transaction {ch.get('roster_id', ch.get('transaction_id',''))}")
    text.extend(['','This is public read-only Sleeper data; transactions include statuses and must not be assumed completed until marked complete.','Raw JSON: data/latest.json; names: data/player_names.json; accumulated changes: data/events.json.'])
    (DATA/'SUMMARY.md').write_text('\n'.join(text)+'\n',encoding='utf8')
    print(f'Wrote snapshot: {len(rosters)} rosters, {len(new_tx)} transactions, {len(changes)} new changes')

if __name__=='__main__':main()