#!/usr/bin/env python3
"""Tests for transparent and reproducible championship bracket assumptions."""
import unittest
from championship_simulator import bracket,run
import random
class ChampionshipTests(unittest.TestCase):
 def test_bracket_reproducible(self):
  seed=[1,2,3,4,5,6]
  pts={i:{15:110,16:110,17:110} for i in seed}
  a=bracket(seed,pts,random.Random(42))
  b=bracket(seed,pts,random.Random(42))
  self.assertEqual(a,b)
  self.assertIn(a[0],seed)
  self.assertEqual(len(a[1]),2)
 def test_incomplete_forecast_blocks(self):
  snapshot={"rosters":[{"roster_id":i,"players":[],"reserve":[],
    "settings":{"wins":7-i,"losses":i,"fpts":0,"fpts_decimal":0}} for i in range(1,7)],"users":[]}
  result=run(snapshot,{}, {},10)
  self.assertEqual(result["status"],"blocked_incomplete_forecasts")
  self.assertGreater(len(result["warnings"]),0)
if __name__=="__main__":unittest.main()
