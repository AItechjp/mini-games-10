using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
public class TrumpTable:MonoBehaviour {
 readonly System.Random rng=new System.Random();
 OldMaid old;MemoryGame memory;SpeedGame speed;string game="babanuki",message="";bool rules=true,started;float nextAction;int selected=-1;float elapsed;
 readonly Dictionary<int,int> seen=new Dictionary<int,int>();
 Font font;GUIStyle label,button;Texture2D white;int theme;
 string Title=>game=="memory"?"神経衰弱":game=="speed"?"スピード":"ババ抜き";
 void Start(){font=Resources.Load<Font>("Japanese");white=Texture2D.whiteTexture;string url=Application.absoluteURL;if(url.Contains("game=memory"))game="memory";else if(url.Contains("game=speed"))game="speed";ResetGame();Debug.Log("TRUMP_RUNTIME_OK "+game);}
 void ResetGame(){old=new OldMaid(rng);memory=new MemoryGame(rng);speed=new SpeedGame(rng);seen.Clear();selected=-1;elapsed=0;message="準備ができたら「対戦を始める」";started=false;rules=true;}
 string Person(int p)=>p==0?"あなた":"CPU "+p;
 bool Finished=>game=="memory"?memory.Finished:game=="speed"?speed.winner>=0:old.Finished;
 void Update(){if(!started||rules||Finished)return;elapsed+=Time.deltaTime;if(Time.time<nextAction)return;
  if(game=="babanuki"&&old.turn!=0){int p=old.turn;old.Draw(rng.Next(old.hands[old.Target()].Count));message=Person(p)+" がカードを引きました";nextAction=Time.time+.9f;}
  if(game=="memory"){
   if(memory.second>=0){bool pair=memory.Resolve();message=pair?"ペア！ もう一度めくれます":"違う数字でした。相手の番です";nextAction=Time.time+.7f;}
   else if(memory.turn==1){var available=Enumerable.Range(0,24).Where(i=>!memory.matched[i]&&i!=memory.first).ToList();int pick=-1;
    if(memory.first>=0){pick=available.Where(i=>seen.ContainsKey(i)&&CardRules.Rank(seen[i])==CardRules.Rank(memory.cards[memory.first])).DefaultIfEmpty(-1).First();}
    else{pick=available.Where(i=>seen.ContainsKey(i)&&available.Any(j=>j!=i&&seen.ContainsKey(j)&&CardRules.Rank(seen[i])==CardRules.Rank(seen[j]))).DefaultIfEmpty(-1).First();}
    if(pick<0)pick=available[rng.Next(available.Count)];Flip(pick);nextAction=Time.time+1f;
   }
  }
  if(game=="speed"){
   if(!speed.HasMove(0)&&!speed.HasMove(1)){speed.Redeal();selected=-1;message="両者出せないため、場札を入れ替えました";nextAction=Time.time+1.1f;}
   else{for(int i=0;i<speed.hands[1].Count;i++){int t=Enumerable.Range(0,2).Where(p=>speed.CanPlay(1,i,p)).DefaultIfEmpty(-1).First();if(t>=0){speed.Play(1,i,t);message="CPU が出しました";break;}}nextAction=Time.time+1.6f;}
  }
 }
 void Flip(int i){if(!memory.Flip(i))return;seen[i]=memory.cards[i];nextAction=Time.time+1.05f;Debug.Log("TRUMP_MEMORY_FLIP "+i);}
 void Box(float x,float y,float w,float h,Color c){GUI.color=c;GUI.DrawTexture(new Rect(x,y,w,h),white);GUI.color=Color.white;}
 void Text(float x,float y,float w,float h,string s,int size=22,Color? color=null,TextAnchor align=TextAnchor.MiddleLeft){label.fontSize=size;label.normal.textColor=color??new Color(.9f,.95f,.92f);label.alignment=align;GUI.Label(new Rect(x,y,w,h),s,label);}
 bool Button(float x,float y,float w,float h,string s,bool enabled=true){GUI.enabled=enabled;button.fontSize=20;bool result=GUI.Button(new Rect(x,y,w,h),s,button);GUI.enabled=true;return result;}
 bool Card(float x,float y,int c,bool back=false,bool active=true,float width=72,float height=98,bool highlight=false){
  Box(x+3,y+5,width,height,new Color(0,0,0,.3f));Box(x,y,width,height,highlight?new Color(.95f,.75f,.32f):back?new Color(.14f,.31f,.34f):new Color(.95f,.94f,.88f));
  if(back){Box(x+5,y+5,width-10,height-10,new Color(.08f,.22f,.25f));Text(x,y,width,height,"◇",34,new Color(.6f,.77f,.7f),TextAnchor.MiddleCenter);}
  else{int r=CardRules.Rank(c);string rank=r==0?"JK":r==1?"A":r==11?"J":r==12?"Q":r==13?"K":r.ToString();Color ink=c==52?new Color(.4f,.2f,.6f):c/13==1||c/13==2?new Color(.72f,.16f,.22f):new Color(.08f,.17f,.2f);Text(x+8,y+4,width-12,30,rank,24,ink);Text(x,y+28,width,height-30,c==52?"★":new[]{"♠","♥","♦","♣"}[c/13],30,ink,TextAnchor.MiddleCenter);}
  bool pressed=false;if(active){var transparent=new GUIStyle(GUIStyle.none);pressed=GUI.Button(new Rect(x,y,width,height),"",transparent);}return pressed;
 }
 void OnGUI(){if(old==null)return;if(label==null){label=new GUIStyle(GUI.skin.label){font=font,wordWrap=true};button=new GUIStyle(GUI.skin.button){font=font};}
  float scale=Mathf.Min(Screen.width/1100f,Screen.height/760f);GUI.matrix=Matrix4x4.TRS(new Vector3((Screen.width-1100*scale)/2,(Screen.height-760*scale)/2,0),Quaternion.identity,Vector3.one*scale);
  Box(0,0,1100,760,new Color(.025f,.09f,.10f));Box(24,105,1052,590,new Color(.045f,.19f,.19f));Box(24,105,1052,3,new Color(.7f,.57f,.3f));
  Text(32,14,520,24,"AITECH   /   2D   /   トランプ",16,new Color(.62f,.76f,.71f));Text(32,42,360,48,Title,34);
  if(Button(670,36,115,44,"ルール")){rules=!rules;nextAction=Time.time+1;}
  if(Button(798,36,115,44,"再戦"))ResetGame();
  if(Button(926,36,145,44,"一覧へ"))Application.OpenURL(new Uri(new Uri(Application.absoluteURL),"../games-trump.html").AbsoluteUri);
  Text(40,117,860,40,!started?"CPU対戦 · 操作はクリック / タップ":Finished?Result():Status(),22,new Color(.98f,.82f,.48f));Text(947,117,100,40,Mathf.FloorToInt(elapsed)+" 秒",18);
  if(game=="babanuki")DrawOld();else if(game=="memory")DrawMemory();else DrawSpeed();
  Text(40,710,1020,36,message,20,new Color(.69f,.83f,.77f));
  if(rules)DrawRules();else if(Finished){Box(260,278,580,185,new Color(.035f,.1f,.12f,.98f));Text(280,294,540,65,Result(),30,null,TextAnchor.MiddleCenter);if(Button(410,380,280,54,"もう一度遊ぶ"))ResetGame();}
 }
 string Status()=>game=="babanuki"?(old.turn==0?Person(old.Target())+" の裏向きカードを1枚選んでください":Person(old.turn)+" の番です"):game=="memory"?(memory.turn==0?"あなたの番：同じ数字を2枚そろえよう":"CPU が考えています"):"自分のカード → 出せる場札をクリック（AとKもつながります）";
 string Result()=>game=="babanuki"?(old.loser==0?"ジョーカーが残りました！":Person(old.loser)+" にジョーカー！ あなたの勝ち"):game=="memory"?(memory.scores[0]==memory.scores[1]?"引き分け！":memory.scores[0]>memory.scores[1]?"あなたの勝ち！":"CPU の勝ち！")+("  "+memory.scores[0]+" 対 "+memory.scores[1]):speed.winner==2?"引き分け！":speed.winner==0?"あなたの勝ち！":"CPU の勝ち！";
 void DrawOld(){for(int p=1;p<4;p++){float x=65+(p-1)*350;Box(x,172,320,78,new Color(.035f,.13f,.15f));Text(x+18,183,290,48,Person(p)+"  ·  "+(old.hands[p].Count==0?"あがり":old.hands[p].Count+" 枚"),24);}
  if(!old.Finished){int target=old.Target();Text(60,268,960,32,Person(target)+" の手札",20);int count=old.hands[target].Count;float w=Mathf.Min(76,950f/Mathf.Max(1,count));for(int i=0;i<count;i++)if(Card(60+i*w,310,0,true,started&&!rules&&old.turn==0,w-5,110)){old.Draw(i);message="カードを引き、同じ数字のペアを捨てました";nextAction=Time.time+1;Debug.Log("TRUMP_OLD_DRAW");}}
  Text(60,468,960,36,"あなたの手札  ·  "+old.hands[0].Count+" 枚"+(old.hands[0].Count==0?"  あがり！ 最後まで見届けよう":""),22);
  float spacing=Mathf.Min(80,960f/Mathf.Max(1,old.hands[0].Count));for(int i=0;i<old.hands[0].Count;i++)Card(60+i*spacing,524,old.hands[0][i],false,false,spacing-5,115);
 }
 void DrawMemory(){Text(62,168,650,35,"あなた  "+memory.scores[0]+" 組     CPU  "+memory.scores[1]+" 組",24);Text(820,168,230,35,memory.moves+" 回めくった",18);
  for(int i=0;i<24;i++){float x=190+i%6*122,y=218+i/6*112;if(memory.matched[i]){Text(x,y,86,98,"✓",30,new Color(.33f,.54f,.46f),TextAnchor.MiddleCenter);continue;}bool face=i==memory.first||i==memory.second;if(Card(x,y,memory.cards[i],!face,started&&!rules&&memory.turn==0&&memory.second<0,86,98))Flip(i);}
 }
 void DrawSpeed(){Text(74,171,940,36,"CPU    残り "+(speed.hands[1].Count+speed.stocks[1].Count)+" 枚",24);for(int i=0;i<speed.hands[1].Count;i++)Card(345+i*100,220,0,true,false,80,100);
  Text(80,355,220,75,"場札\n前後の数字を重ねる",20);for(int p=0;p<2;p++){bool ok=selected>=0&&speed.CanPlay(0,selected,p);if(Card(440+p*135,353,speed.piles[p],false,started&&!rules&&selected>=0,90,116,ok)&&selected>=0){if(speed.Play(0,selected,p)){selected=-1;message="ナイス！ 続けて出そう";Debug.Log("TRUMP_SPEED_PLAY");}else message="その場札には出せません。前後の数字を選ぼう";}}
  Text(74,504,900,32,"あなた    残り "+(speed.hands[0].Count+speed.stocks[0].Count)+" 枚    山札 "+speed.stocks[0].Count+" 枚",24);for(int i=0;i<speed.hands[0].Count;i++)if(Card(345+i*100,553,speed.hands[0][i],false,started&&!rules,80,110,i==selected))selected=i;
 }
 void DrawRules(){Box(0,105,1100,590,new Color(0,0,0,.74f));Box(190,175,720,470,new Color(.055f,.13f,.15f));Text(230,200,640,56,Title+" の遊び方",30);
  string text=game=="babanuki"?"あなたとCPU3人の4人対戦です。\n\n1. 次の人の裏向きカードを1枚選びます。\n2. 同じ数字のペアは自動で捨てられます。\n3. 手札がなくなった人から、あがりです。\n\n最後にジョーカーを持っている人が負け。\nあがった後も、残りの対戦を見届けられます。":game=="memory"?"あなたとCPUで24枚・12組を取り合います。\n\n1. 裏向きのカードを2枚選びます。\n2. 同じ数字なら獲得し、続けてめくれます。\n3. 違う数字なら、相手に交代します。\n\nすべてのペアを取り終えた時に、組数が多い方の勝ち。\nCPUは公開されたカードを覚えて対戦します。":"あなたとCPUが同時にカードを出します。\n\n1. 下の手札を選び、中央の場札を選びます。\n2. 場札の前後の数字を出せます（K ⇄ A も可）。\n3. 空いた手札は山札から自動補充されます。\n\n両者とも出せない時は場札を自動で入れ替えます。\n手札と山札を先になくした方が勝ち。同時なら引き分け。";
  Text(230,270,640,275,text,22);if(Button(340,565,420,54,started?"ゲームに戻る":"対戦を始める")){rules=false;started=true;nextAction=Time.time+1.4f;message="対戦スタート！";Debug.Log("TRUMP_STARTED "+game);}
 }
}
