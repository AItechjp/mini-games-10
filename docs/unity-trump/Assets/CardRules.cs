using System;
using System.Collections.Generic;
using System.Linq;
public static class CardRules {
 public static int Rank(int c)=>c==52?0:c%13+1;
 public static void Shuffle<T>(IList<T> cards,Random rng){for(int i=cards.Count-1;i>0;i--){int j=rng.Next(i+1);T v=cards[i];cards[i]=cards[j];cards[j]=v;}}
 public static List<int> Deck(Random rng,bool joker=false){var d=Enumerable.Range(0,joker?53:52).ToList();Shuffle(d,rng);return d;}
 public static void RemovePairs(List<int> hand){for(int i=0;i<hand.Count;i++){if(hand[i]==52)continue;int j=hand.FindIndex(i+1,c=>Rank(c)==Rank(hand[i]));if(j<0)continue;hand.RemoveAt(j);hand.RemoveAt(i--);}}
 public static bool Adjacent(int a,int b){int delta=Math.Abs(Rank(a)-Rank(b));return delta==1||delta==12;}
}
public class OldMaid {
 public List<int>[] hands={new List<int>(),new List<int>(),new List<int>(),new List<int>()};
 public List<int> winners=new List<int>(); public int turn; public int loser=-1; public int lastCard=-1;
 public bool Finished=>loser>=0;
 public OldMaid(Random rng){var deck=CardRules.Deck(rng,true);for(int i=0;i<deck.Count;i++)hands[i%4].Add(deck[i]);foreach(var hand in hands){CardRules.RemovePairs(hand);CardRules.Shuffle(hand,rng);}Finish();if(!Finished)while(hands[turn].Count==0)turn=(turn+1)%4;}
 public int Target(){int t=(turn+1)%4;while(t!=turn&&hands[t].Count==0)t=(t+1)%4;return t;}
 void Finish(){for(int i=0;i<4;i++)if(hands[i].Count==0&&!winners.Contains(i))winners.Add(i);if(winners.Count==3)loser=Enumerable.Range(0,4).First(i=>hands[i].Count>0);}
 public bool Draw(int index){if(Finished)return false;int t=Target();if(index<0||index>=hands[t].Count)return false;lastCard=hands[t][index];hands[t].RemoveAt(index);hands[turn].Add(lastCard);CardRules.RemovePairs(hands[turn]);Finish();if(!Finished){do{turn=(turn+1)%4;}while(hands[turn].Count==0);}return true;}
}
public class MemoryGame {
 public int[] cards; public bool[] matched=new bool[24];public int first=-1,second=-1,turn;public int[] scores={0,0}; public int moves;
 public bool Finished=>scores[0]+scores[1]==12;
 public MemoryGame(Random rng){cards=Enumerable.Range(0,12).Concat(Enumerable.Range(13,12)).ToArray();CardRules.Shuffle(cards,rng);}
 public bool Flip(int index){if(Finished||second>=0||index<0||index>=24||matched[index]||first==index)return false;if(first<0)first=index;else{second=index;moves++;}return true;}
 public bool Resolve(){if(second<0)return false;bool pair=CardRules.Rank(cards[first])==CardRules.Rank(cards[second]);if(pair){matched[first]=matched[second]=true;scores[turn]++;}else turn=1-turn;first=second=-1;return pair;}
}
public class SpeedGame {
 public List<int>[] stocks={new List<int>(),new List<int>()};public List<int>[] hands={new List<int>(),new List<int>()};public int[] piles=new int[2];public int winner=-1;
 public SpeedGame(Random rng){var deck=CardRules.Deck(rng);piles[0]=deck[0];piles[1]=deck[1];stocks[0]=deck.Skip(2).Take(25).ToList();stocks[1]=deck.Skip(27).ToList();Refill(0);Refill(1);}
 void Refill(int p){while(hands[p].Count<4&&stocks[p].Count>0){hands[p].Add(stocks[p][0]);stocks[p].RemoveAt(0);}}
 public bool CanPlay(int p,int i,int pile)=>i>=0&&i<hands[p].Count&&pile>=0&&pile<2&&CardRules.Adjacent(hands[p][i],piles[pile]);
 public bool HasMove(int p)=>hands[p].Any(c=>piles.Any(t=>CardRules.Adjacent(c,t)));
 public bool Play(int p,int i,int pile){if(winner>=0||!CanPlay(p,i,pile))return false;piles[pile]=hands[p][i];hands[p].RemoveAt(i);Refill(p);if(hands[p].Count==0)winner=p;return true;}
 public bool Redeal(){if(winner>=0||HasMove(0)||HasMove(1))return false;for(int p=0;p<2;p++){if(stocks[p].Count>0){piles[p]=stocks[p][0];stocks[p].RemoveAt(0);}else if(hands[p].Count>0){piles[p]=hands[p][0];hands[p].RemoveAt(0);}Refill(p);}bool a=hands[0].Count==0,b=hands[1].Count==0;if(a||b)winner=a&&b?2:a?0:1;return true;}
}
