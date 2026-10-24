import unittest
from trade_simulator import lineup,resolve_player_ids

class SimulatorTests(unittest.TestCase):
    def setUp(self):
        players = [
            ("q1","QB",20),("q2","QB",10),
            ("r1","RB",19),("r2","RB",18),("r3","RB",17),("r4","RB",3),
            ("w1","WR",16),("w2","WR",15),("w3","WR",14),
            ("t1","TE",13),("t2","TE",12),
            ("k1","K",7),("d1","DEF",6)
        ]
        self.names = {pid:{"name":pid,"position":pos} for pid,pos,val in players}
        self.proj = {pid:{"ppg":val,"status":"test-only"} for pid,pos,val in players}
        self.ids = [p[0] for p in players]

    def test_hyphenated_player_lookup(self):
        names={"9488":{"name":"Jaxon Smith-Njigba","position":"WR"},"9758":{"name":"C.J. Stroud","position":"QB"}}
        self.assertEqual(resolve_player_ids(["Jaxon Smith Njigba","C.J. Stroud"],names),["9488","9758"])
        self.assertEqual(resolve_player_ids(["jaxon smith-njigba"],names),["9488"])

    def test_ambiguous_player_lookup_rejected(self):
        names={"1":{"name":"A-B"},"2":{"name":"AB"}}
        with self.assertRaisesRegex(ValueError,"Ambiguous"):
            resolve_player_ids(["ab"],names)

    def test_two_flex_fill(self):
        out=lineup(self.ids,self.proj,self.names)
        self.assertTrue(out["complete"])
        self.assertEqual(len(out["starters"]),10)
        ids={v["name"] for v in out["starters"]}
        self.assertIn("r3",ids)
        self.assertIn("w3",ids)
        self.assertEqual(out["projected_ppg"],145)

    def test_missing_kicker_blocks_complete(self):
        out=lineup([x for x in self.ids if x!="k1"],self.proj,self.names)
        self.assertFalse(out["complete"])

    def test_higher_ranked_replacement(self):
        original=lineup(self.ids,self.proj,self.names)
        changed=dict(self.proj)
        changed["w3"]={"ppg":24}
        upgraded=lineup(self.ids,changed,self.names)
        self.assertEqual(upgraded["projected_ppg"]-original["projected_ppg"],10)

if __name__=="__main__":
    unittest.main()
