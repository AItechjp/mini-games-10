(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rng32=seed=>{let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};

  window.ARCADE_GAME={
    title:'STAR STRIKE',
    instructions:'指またはマウスで自機を動かします。射撃は自動。敵を連続撃破するとコンボ倍率が上がります。敵弾に当たると減点。',
    create({canvas,controlsRoot,onScore,onToast}){
      const ctx=canvas.getContext('2d',{alpha:false});
      const keys=Object.create(null);
      let running=false,raf=0,last=0,rand=Math.random;
      let player={x:480,y:465,targetX:480,targetY:465,inv:0};
      let bullets=[],enemies=[],enemyBullets=[],particles=[],stars=[];
      let score=0,kills=0,combo=0,maxCombo=0,spawnAcc=0,fireAcc=0,elapsed=0;

      function resetStars(seed){const r=rng32(seed^0x91abc);stars=Array.from({length:90},()=>({x:r()*canvas.width,y:r()*canvas.height,s:1+r()*2.2,v:30+r()*110}));}
      function spawnEnemy(){
        const roll=rand();
        const type=roll<.68?'scout':roll<.9?'zig':'tank';
        const hp=type==='tank'?3:type==='zig'?2:1;
        enemies.push({
          x:60+rand()*(canvas.width-120),y:-34,baseX:0,t:0,type,hp,maxHp:hp,
          speed:type==='tank'?72:110+rand()*55,phase:rand()*Math.PI*2,fire:.55+rand()*1.35
        });
        enemies[enemies.length-1].baseX=enemies[enemies.length-1].x;
      }
      function fire(){bullets.push({x:player.x-9,y:player.y-22,vy:-560},{x:player.x+9,y:player.y-22,vy:-560});}
      function hitPlayer(){
        if(player.inv>0)return;
        player.inv=.85;combo=0;score=Math.max(0,score-120);onScore(score);onToast('HIT -120');
        for(let i=0;i<14;i++)particles.push({x:player.x,y:player.y,vx:(rand()-.5)*210,vy:(rand()-.5)*210,life:.3+rand()*.35});
      }
      function killEnemy(e){
        kills++;combo++;maxCombo=Math.max(maxCombo,combo);
        const mult=1+Math.min(4,Math.floor(combo/5));
        const base=e.type==='tank'?180:e.type==='zig'?110:70;
        const gain=base*mult;score+=gain;onScore(score);onToast(`x${mult} +${gain}`);
        for(let i=0;i<10;i++)particles.push({x:e.x,y:e.y,vx:(rand()-.5)*190,vy:(rand()-.5)*190,life:.25+rand()*.35});
      }
      function circleHit(ax,ay,ar,bx,by,br){const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy<(ar+br)*(ar+br);}

      function update(dt){
        elapsed+=dt;player.inv=Math.max(0,player.inv-dt);
        const speed=330*dt;
        if(keys.ArrowLeft||keys.KeyA||keys.left)player.targetX-=speed;
        if(keys.ArrowRight||keys.KeyD||keys.right)player.targetX+=speed;
        if(keys.ArrowUp||keys.KeyW||keys.up)player.targetY-=speed;
        if(keys.ArrowDown||keys.KeyS||keys.down)player.targetY+=speed;
        player.targetX=clamp(player.targetX,28,canvas.width-28);player.targetY=clamp(player.targetY,canvas.height*.52,canvas.height-28);
        player.x+=(player.targetX-player.x)*Math.min(1,dt*12);player.y+=(player.targetY-player.y)*Math.min(1,dt*12);

        fireAcc+=dt;while(fireAcc>=.145){fireAcc-=.145;fire();}
        spawnAcc+=dt;while(spawnAcc>=.42){spawnAcc-=.42;spawnEnemy();}

        for(const s of stars){s.y+=s.v*dt;if(s.y>canvas.height){s.y=-4;s.x=rand()*canvas.width;}}
        for(const b of bullets)b.y+=b.vy*dt;
        for(const b of enemyBullets){b.x+=b.vx*dt;b.y+=b.vy*dt;}
        for(const e of enemies){
          e.t+=dt;e.y+=e.speed*dt;
          if(e.type==='zig')e.x=e.baseX+Math.sin(e.t*4.2+e.phase)*72;
          else if(e.type==='scout')e.x=e.baseX+Math.sin(e.t*2.3+e.phase)*22;
          e.x=clamp(e.x,28,canvas.width-28);
          e.fire-=dt;
          if(e.fire<=0&&e.y>40&&e.y<canvas.height*.72){
            e.fire=.8+rand()*1.4;
            const dx=player.x-e.x,dy=player.y-e.y,len=Math.hypot(dx,dy)||1,sp=e.type==='tank'?205:175;
            enemyBullets.push({x:e.x,y:e.y+14,vx:dx/len*sp,vy:dy/len*sp});
          }
        }

        for(const b of bullets){
          if(b.dead)continue;
          for(const e of enemies){
            if(e.dead)continue;
            const r=e.type==='tank'?26:20;
            if(circleHit(b.x,b.y,4,e.x,e.y,r)){b.dead=true;e.hp--;if(e.hp<=0){e.dead=true;killEnemy(e);}break;}
          }
        }
        for(const eb of enemyBullets){if(!eb.dead&&circleHit(eb.x,eb.y,5,player.x,player.y,16)){eb.dead=true;hitPlayer();}}
        for(const e of enemies){if(!e.dead&&e.y>canvas.height-45&&circleHit(e.x,e.y,22,player.x,player.y,18)){e.dead=true;hitPlayer();}}

        bullets=bullets.filter(b=>!b.dead&&b.y>-30);
        enemyBullets=enemyBullets.filter(b=>!b.dead&&b.y<canvas.height+30&&b.x>-30&&b.x<canvas.width+30);
        enemies=enemies.filter(e=>!e.dead&&e.y<canvas.height+45);
        for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;p.life-=dt;}
        particles=particles.filter(p=>p.life>0);
      }

      function render(){
        const w=canvas.width,h=canvas.height;
        const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#020617');bg.addColorStop(.55,'#071a34');bg.addColorStop(1,'#0a1020');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
        for(const s of stars){ctx.fillStyle=`rgba(210,230,255,${.35+s.s*.15})`;ctx.fillRect(s.x,s.y,s.s,s.s*2.4);}
        ctx.strokeStyle='rgba(125,211,252,.07)';ctx.lineWidth=1;for(let x=80;x<w;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo((x-w/2)*1.32+w/2,h);ctx.stroke();}

        for(const b of bullets){ctx.fillStyle='#7dd3fc';ctx.shadowBlur=12;ctx.shadowColor='#7dd3fc';ctx.fillRect(b.x-2,b.y-12,4,18);ctx.shadowBlur=0;}
        for(const b of enemyBullets){ctx.fillStyle='#fb7185';ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();}
        for(const e of enemies){
          ctx.save();ctx.translate(e.x,e.y);
          const tank=e.type==='tank',zig=e.type==='zig';
          ctx.fillStyle=tank?'#f97316':zig?'#a78bfa':'#f43f5e';ctx.shadowBlur=14;ctx.shadowColor=ctx.fillStyle;
          ctx.beginPath();ctx.moveTo(0,22);ctx.lineTo(tank?-28:-20,-13);ctx.lineTo(0,-23);ctx.lineTo(tank?28:20,-13);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
          ctx.fillStyle='#fff';ctx.fillRect(-4,-6,8,9);
          if(e.maxHp>1){ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(-25,28,50,4);ctx.fillStyle='#86efac';ctx.fillRect(-25,28,50*(e.hp/e.maxHp),4);}
          ctx.restore();
        }
        for(const p of particles){ctx.fillStyle=`rgba(255,225,120,${clamp(p.life*2,0,1)})`;ctx.fillRect(p.x,p.y,4,4);}

        ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(player.inv*14)%2===0)ctx.globalAlpha=.28;
        ctx.shadowBlur=18;ctx.shadowColor='#38bdf8';ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-19,20);ctx.lineTo(-5,14);ctx.lineTo(0,24);ctx.lineTo(5,14);ctx.lineTo(19,20);ctx.closePath();ctx.fill();ctx.fillStyle='#38bdf8';ctx.fillRect(-4,-9,8,17);ctx.restore();

        ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(12,12,230,54);ctx.fillStyle='#fff';ctx.font='800 16px system-ui';ctx.fillText(`KILL ${kills}   COMBO ${combo}`,24,37);ctx.fillStyle='#fde68a';ctx.font='700 13px system-ui';ctx.fillText(`MAX COMBO ${maxCombo}`,24,57);
      }

      function loop(now){if(!running)return;const dt=Math.min(.035,(now-last)/1000||.016);last=now;update(dt);render();raf=requestAnimationFrame(loop);}

      const keyDown=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;};
      const keyUp=e=>{keys[e.code]=false;};
      const pointer=e=>{if(!running)return;const rect=canvas.getBoundingClientRect();player.targetX=(e.clientX-rect.left)/rect.width*canvas.width;player.targetY=(e.clientY-rect.top)/rect.height*canvas.height;player.targetY=clamp(player.targetY,canvas.height*.5,canvas.height-22);};
      window.addEventListener('keydown',keyDown,{passive:false});window.addEventListener('keyup',keyUp);canvas.addEventListener('pointerdown',pointer);canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pointer(e);});

      const controlHandlers=[];controlsRoot?.querySelectorAll('[data-shooter]').forEach(btn=>{const action=btn.dataset.shooter;const down=e=>{e.preventDefault();keys[action]=true;};const up=e=>{e.preventDefault();keys[action]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);controlHandlers.push([btn,down,up]);});

      function drawIdle(){ctx.fillStyle='#020617';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#a78bfa';ctx.font='900 46px system-ui';ctx.textAlign='center';ctx.fillText('STAR STRIKE',canvas.width/2,canvas.height/2-10);ctx.fillStyle='#aeb9d4';ctx.font='700 18px system-ui';ctx.fillText('DODGE • COMBO • DESTROY • 20 SECONDS',canvas.width/2,canvas.height/2+34);ctx.textAlign='start';}
      drawIdle();

      return{
        start(seed){rand=rng32(seed||1);resetStars(seed||1);player={x:canvas.width/2,y:canvas.height-74,targetX:canvas.width/2,targetY:canvas.height-74,inv:0};bullets=[];enemies=[];enemyBullets=[];particles=[];score=kills=combo=maxCombo=0;spawnAcc=0;fireAcc=0;elapsed=0;onScore(0);running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);},
        stop(){running=false;cancelAnimationFrame(raf);render();return{kills,combo:maxCombo};},
        destroy(){running=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);canvas.removeEventListener('pointerdown',pointer);for(const [btn,down,up]of controlHandlers){btn.removeEventListener('pointerdown',down);btn.removeEventListener('pointerup',up);btn.removeEventListener('pointercancel',up);btn.removeEventListener('pointerleave',up);}}
      };
    }
  };
})();
