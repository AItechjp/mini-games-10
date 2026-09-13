using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
public static class TrumpTests {
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 public static void Run(){
  Check(CardRules.Adjacent(0,12)&&!CardRules.Adjacent(0,0)&&!CardRules.Adjacent(0,2),"Speed adjacency");
  var h=new List<int>{0,13,26,39,52};CardRules.RemovePairs(h);Check(h.SequenceEqual(new[]{52}),"Pair removal preserves joker");
  for(int seed=0;seed<150;seed++){
   var r=new System.Random(seed);var old=new OldMaid(r);int steps=0;while(!old.Finished&&steps++<5000){int target=old.Target();Check(target!=old.turn,"Target active neighbor");old.Draw(r.Next(old.hands[target].Count));}Check(old.Finished&&old.hands[old.loser].SequenceEqual(new[]{52}),"Old Maid terminates with joker only");
   var memory=new MemoryGame(r);for(int rank=1;rank<=12;rank++){int a=Array.FindIndex(memory.cards,c=>CardRules.Rank(c)==rank);int b=Array.FindLastIndex(memory.cards,c=>CardRules.Rank(c)==rank);Check(memory.Flip(a)&&!memory.Flip(a)&&memory.Flip(b),"Memory distinct cards");Check(memory.Resolve(),"Memory pair");}Check(memory.Finished&&memory.scores[0]==12,"Memory winner");
   var speed=new SpeedGame(r);steps=0;while(speed.winner<0&&steps++<3000){bool moved=false;for(int p=0;p<2&&speed.winner<0;p++){for(int i=0;i<speed.hands[p].Count;i++){int pile=Enumerable.Range(0,2).Where(t=>speed.CanPlay(p,i,t)).DefaultIfEmpty(-1).First();if(pile>=0){speed.Play(p,i,pile);moved=true;break;}}}if(!moved)Check(speed.Redeal(),"Speed deadlock redeal");}Check(speed.winner>=0,"Speed terminates");
  }
  var mismatch=new MemoryGame(new System.Random(2));int different=Array.FindIndex(mismatch.cards,c=>CardRules.Rank(c)!=CardRules.Rank(mismatch.cards[0]));mismatch.Flip(0);mismatch.Flip(different);Check(!mismatch.Flip(2),"Two-card lock");Check(!mismatch.Resolve()&&mismatch.turn==1,"Mismatch passes turn");
  Debug.Log("TRUMP_TESTS_OK: 150 seeded complete games per mode, adjacency, pairs, turn and lock checks");
 }
}
