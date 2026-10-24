#!/usr/bin/env python3
"""Dirty Birds read-only transaction radar.

Runs AFTER update.py. Compares the current snapshot against persisted radar state,
so historical transactions are not mislabeled as newly detected transactions.
No tokens, secrets, or Sleeper write permissions required.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
STATE_FILE = DATA / 'radar_state.json'
REPORT_FILE = DATA / 'RADAR.md'
LATEST_FILE = DATA / 'radar_latest.json'
HISTORY_FILE = DATA / 'radar_history.json'


def load(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def save(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def player_name(player_id, names):
    if not player_id:
        return '?'
    entry = names.get(str(player_id), {})
    return entry.get('name') or str(player_id)


def collect_transactions(snapshot):
    transactions = {}
    for bucket in (snapshot.get('transactions_by_week') or {}).values():
        for obj in bucket or []:
            if isinstance(obj, dict) and obj.get('transaction_id') is not None:
                transactions[str(obj['transaction_id'])] = obj
    return transactions


def owner_names(snapshot):
    users = {str(u.get('user_id')): u for u in snapshot.get('users', [])}
    result = {}
    for r in snapshot.get('rosters', []):
        owner_id = str(r.get('owner_id'))
        user = users.get(owner_id, {})
        metadata = user.get('metadata') or {}
        result[str(r.get('roster_id'))] = metadata.get('team_name') or user.get('display_name') or user.get('username') or f'Roster {r.get("roster_id")}'
    return result


def format_roster(roster_id, owners):
    return f'{owners.get(str(roster_id), "Roster " + str(roster_id))} (#{roster_id})'


def describe(tx, owners, names):
    typ = str(tx.get('type') or 'unknown')
    status = str(tx.get('status') or 'unknown')
    roster_ids = tx.get('roster_ids') or []
    members = ', '.join(format_roster(x, owners) for x in roster_ids) or 'Unspecified roster'
    pieces = [f'{typ.upper()} · {status.upper()} · {members}']
    # For trades and waivers, map each player to receiving or releasing roster.
    for label, attr in [('Added', 'adds'), ('Dropped', 'drops')]:
        values = tx.get(attr) or {}
        if values:
            details = ', '.join(f'{player_name(pid,names)} → {format_roster(rid, owners)}' for pid, rid in sorted(values.items()))
            pieces.append(f'{label}: {details}')
    settings = tx.get('settings') or {}
    if settings.get('waiver_bid') is not None:
        pieces.append(f'FAAB bid: ${settings["waiver_bid"]}')
    return ' | '.join(pieces)


def main():
    DATA.mkdir(exist_ok=True)
    if not (DATA / 'latest.json').exists():
        raise FileNotFoundError('data/latest.json missing: run update.py first')
    snapshot = load(DATA / 'latest.json', {})
    names = load(DATA / 'player_names.json', {})
    transactions = collect_transactions(snapshot)
    owners = owner_names(snapshot)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    previous_state = load(STATE_FILE, None)
    statuses = {tid: str(tx.get('status') or 'unknown') for tid, tx in transactions.items()}
    changes = []

    if previous_state is not None:
        prior = previous_state.get('transaction_statuses', {})
        for tid, tx in transactions.items():
            before = prior.get(tid)
            after = statuses[tid]
            if before is None:
                changes.append({'kind': 'new_transaction', 'id': tid, 'status': after, 'transaction': tx})
            elif before != after:
                changes.append({'kind': 'status_change', 'id': tid, 'old_status': before, 'status': after, 'transaction': tx})
        # Do not delete older statuses in case Sleeper returns fewer weeks temporarily.
        statuses = {**prior, **statuses}
    else:
        # Upgrade initialization: use original collector's previous transaction IDs
        # if available, to avoid suppressing transactions seen between syncs.
        # If unavailable, explicitly establish baseline, never call history "new".
        changes = []

    report = {
        'generated_at_utc': now,
        'sleeper_snapshot_at_utc': snapshot.get('fetched_at_utc'),
        'league_id': snapshot.get('league_id'),
        'is_initial_baseline': previous_state is None,
        'transactions_indexed': len(transactions),
        'changes_count': len(changes),
        'completed_count': sum(c['status'] == 'complete' for c in changes),
        'pending_count': sum(c['status'] in ('pending','processing') for c in changes),
        'failed_count': sum(c['status'] == 'failed' for c in changes),
        'changes': changes,
    }
    history = load(HISTORY_FILE, [])
    history.extend({'detected_at_utc': now, 'kind': c['kind'], 'id': c['id'],
                    'old_status': c.get('old_status'), 'status': c['status'],
                    'description': describe(c['transaction'], owners, names)} for c in changes)

    # Only write report & state after all calculations succeed.
    save(LATEST_FILE, report)
    save(HISTORY_FILE, history)
    save(STATE_FILE, {'last_checked_utc': now, 'transaction_statuses': statuses})

    lines = [
        '# Dirty Birds — League Transaction Radar',
        '',
        f'Generated: {now}',
        f'Sleeper snapshot: {snapshot.get("fetched_at_utc", "unknown")}',
        f'League: {snapshot.get("league_id", "unknown")}',
        '',
        '## New activity since previous radar run',
        '',
    ]
    if previous_state is None:
        lines += ['**Baseline established.** Existing transactions were indexed, not misreported as fresh activity.',
                  'Fresh transaction alerts start with the next successful run.', '']
    elif not changes:
        lines += ['No newly detected transactions or transaction-status changes.', '']
    else:
        lines += [f'**{len(changes)} transaction changes:** {report["completed_count"]} completed, '
                  f'{report["pending_count"]} pending/processing, {report["failed_count"]} failed.', '']
        for c in changes[:80]:
            preface = 'NEW' if c['kind'] == 'new_transaction' else f'STATUS {c.get("old_status")} → {c["status"]}'
            lines.append(f'- **{preface}** · transaction `{c["id"]}` · {describe(c["transaction"], owners, names)}')
        if len(changes) > 80:
            lines += [f'- ... {len(changes)-80} more (see `radar_latest.json`).']
        lines.append('')
    lines += ['## Recently detected activity (up to 25)', '']
    if history:
        for item in reversed(history[-25:]):
            lines.append(f'- {item["detected_at_utc"]} · {item["kind"]} · {item["description"]}')
    else:
        lines.append('No fresh activity detected since radar initialization.')
    lines += ['', '## Important limits', '',
              '- A NEW event means *first observed by this radar*, not necessarily performed in the last hour.',
              '- Pending or failed waivers are NOT completed acquisitions; trust the Sleeper status field.',
              '- This reports transaction IDs and status changes, not independent NFL news or real-time lineup alerts.',
              '- GitHub Action scheduling is approximate; this report is only as fresh as the snapshot timestamp.',
              '- Data collection is read-only. No fantasy roster actions can be submitted from this script.', '']
    REPORT_FILE.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Radar ready: {len(transactions)} indexed transactions; {len(changes)} changes; baseline={previous_state is None}')


if __name__ == '__main__':
    main()
