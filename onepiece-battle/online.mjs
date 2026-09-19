import {BattleRoom} from './transport.mjs';
import {createGame,act,legalActions,viewFor} from './engine.mjs';

const deckOK = id => ['ST01','ST02'].includes(id);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
const sameAction = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// The host validates all moves. Only a redacted view and legal options are sent
// to the guest. This is a casual host-authoritative game, not a tournament server.
export class BattleSession extends EventTarget {
  constructor(config) {
    super();this.room=new BattleRoom(config);this.side=0;this.code='';this.peer=false;
    this.connected=false;this.state=null;this.guestView=null;this.guestActions=[];
    this.decks=['ST01',null];this.rev=0;this.closed=false;this.session='';
    this.room.addEventListener('connection',e=>{
      this.connected=e.detail.online;this.peer=e.detail.peer;
      if(this.peer)this.sendState();this.emitUpdate();
    });
    this.room.addEventListener('message',e=>this.receive(e.detail));
    this.room.addEventListener('error',e=>this.error(e.detail));
    this.timer=setInterval(()=>{if(this.room.ready){this.sendState();this.emitUpdate();}},3000);
  }
  error(message){this.dispatchEvent(new CustomEvent('error',{detail:String(message)}));}
  async create(deckId='ST01') {
    if(!deckOK(deckId))throw Error('対応デッキを選んでください。');
    this.side=0;this.decks[0]=deckId;this.code=await this.room.create();this.emitUpdate();return this.code;
  }
  async join(code,deckId='ST02') {
    if(!deckOK(deckId))throw Error('対応デッキを選んでください。');
    this.side=1;this.decks[1]=deckId;this.code=await this.room.join(code);
    this.room.broadcast('deck',{deck:deckId});this.emitUpdate();return this.code;
  }
  start() {
    if(this.side!==0||!this.peer||!this.connected||!this.decks.every(deckOK))throw Error('対戦相手の参加とデッキ選択を待っています。');
    if(this.state&&this.state.phase!=='ended')throw Error('対戦はすでに始まっています。');
    const random=crypto.getRandomValues(new Uint32Array(2));
    this.state=createGame({decks:this.decks,first:random[0]%2,seed:random[1]});
    this.session=crypto.randomUUID();this.rev=1;this.sendState();this.emitUpdate();
  }
  action(action) {
    if(!this.peer||!this.connected)throw Error('再接続を待っています。');
    if(this.side===0)this.apply(0,action);
    else {
      if(!this.guestActions.some(a=>sameAction(a,action)))throw Error('現在選べる操作を選んでください。');
      this.room.broadcast('move',{session:this.session,rev:this.rev,action});
      this.guestActions=[];this.emitUpdate();
    }
  }
  apply(side,action) {
    if(!this.state)throw Error('対戦を開始してください。');
    if(!legalActions(this.state,side).some(a=>sameAction(a,action)))throw Error('その操作は現在できません。');
    this.state=act(this.state,side,action);this.rev++;this.sendState();this.emitUpdate();
  }
  receive({type,body}) {
    if(!body||typeof body!=='object')return;
    if(this.side===0) {
      if(type==='deck'&&!this.state&&deckOK(body.deck)){const changed=this.decks[1]!==body.deck;this.decks[1]=body.deck;if(changed)this.sendState();this.emitUpdate();}
      if(type==='move'&&this.state&&body.session===this.session){
        if(body.rev!==this.rev){this.sendState();return;}
        try{this.apply(1,body.action);}catch(e){this.room.broadcast('move-error',{message:e.message});this.sendState();}
      }
      return;
    }
    if(type==='lobby'&&!this.guestView){this.decks[0]=body.deck;this.room.broadcast('deck',{deck:this.decks[1]});this.emitUpdate();}
    if(type==='snapshot'&&typeof body.session==='string'&&Number.isSafeInteger(body.rev)&&body.view&&Array.isArray(body.actions)){
      if(this.session===body.session&&body.rev<this.rev)return;
      this.session=body.session;this.rev=body.rev;this.guestView=body.view;this.guestActions=body.actions;this.emitUpdate();
    }
    if(type==='move-error')this.error(body.message||'操作を送信できませんでした。');
  }
  sendState() {
    if(this.side===1){if(!this.guestView)this.room.broadcast('deck',{deck:this.decks[1]});return;}
    if(this.state)this.room.broadcast('snapshot',{session:this.session,rev:this.rev,view:viewFor(this.state,1),actions:legalActions(this.state,1)});
    else this.room.broadcast('lobby',{deck:this.decks[0]});
  }
  emitUpdate() {
    if(this.closed)return;
    const view=this.side===0?(this.state?viewFor(this.state,0):null):this.guestView;
    const actions=this.side===0?(this.state?legalActions(this.state,0):[]):this.guestActions;
    this.dispatchEvent(new CustomEvent('update',{detail:{view,actions:this.connected&&this.peer?actions:[],side:this.side,code:this.code||this.room.code,connected:this.connected,peer:this.peer,
      status:!this.connected?'再接続中…':!this.peer?'対戦相手の接続を待っています':!view?'2人が接続しました。ホストが対戦を開始できます。':'接続中',decks:this.decks,rev:this.rev}}));
  }
  async leave(){this.closed=true;clearInterval(this.timer);await this.room.leave();}
}
