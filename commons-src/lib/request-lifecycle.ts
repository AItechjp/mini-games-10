// One request owns each screen. Superseded/unmounted requests cannot update it.
export class LatestRequest {
  private generation=0;
  private cancelActive:(()=>void)|undefined;
  begin(milliseconds=15000){
    this.cancel();
    const id=this.generation,controller=new AbortController();
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},milliseconds);
    this.cancelActive=()=>{clearTimeout(timer);controller.abort();};
    return {signal:controller.signal,current:()=>id===this.generation,timedOut:()=>timedOut,
      finish:()=>{clearTimeout(timer);if(id===this.generation)this.cancelActive=undefined;}};
  }
  cancel(){this.generation++;this.cancelActive?.();this.cancelActive=undefined;}
}
