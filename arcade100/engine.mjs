import {GAMES,GAME_BY_ID} from './catalog.mjs';
import {cleanAction,endClock,publicView,clamp} from './engines/common.mjs';
import * as arena from './engines/arena.mjs';
import * as combat from './engines/combat.mjs';
import * as race from './engines/race.mjs';
import * as sports from './engines/sports.mjs';
import * as board from './engines/board.mjs';
import * as cards from './engines/cards.mjs';
import * as puzzle from './engines/puzzle.mjs';
import * as social from './engines/social.mjs';
export const ENGINES={arena,combat,race,sports,board,cards,puzzle,social};
export function createGame(id,players,seed=1){const spec=GAME_BY_ID[id];if(!spec||!ENGINES[spec.family])throw new Error('Unknown game');if(!Array.isArray(players)||players.length<spec.minPlayers||players.length>spec.maxPlayers)throw new Error('Invalid player count');return ENGINES[spec.family].create(spec,players,seed);}
export function isRealtime(s){return !!ENGINES[s.family]?.realtime;}
export function action(s,side,raw){if(!Number.isInteger(side)||side<0||side>=s.players.length||s.phase!=='playing')return false;const a=cleanAction(raw);if(!a)return false;const valid=ENGINES[s.family].act(s,side,a);if(valid)s.version++;return !!valid;}
export function tick(s,inputs={},dt=1/30){if(s.phase!=='playing')return;s.t+=clamp(dt,0,.1);const sanitized={};for(const p of s.players){const i=inputs[p.side]||{};sanitized[p.side]={x:clamp(i.x,-1,1),y:clamp(i.y,-1,1),primary:!!i.primary,aimX:clamp(i.aimX,0,1000),aimY:clamp(i.aimY,0,600)};}ENGINES[s.family].step(s,sanitized,clamp(dt,0,.1));endClock(s);}
export function view(s,side){const v=ENGINES[s.family].view?ENGINES[s.family].view(s,side):publicView(s,side);delete v.seed;delete v.data.selected;return v;}
export {GAMES,GAME_BY_ID};
