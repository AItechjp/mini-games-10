import {Component,type ReactNode} from 'react';

/** Keep a broken route recoverable without clearing a guest's saved identity. */
export class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="commons-loading" role="alert">
      <h1>ページを表示できませんでした</h1>
      <p>通信状態を確認して、もう一度読み込んでください。</p>
      <p>再読み込みすると、まだ保存されていない入力は失われる場合があります。</p>
      <div className="recovery-actions"><button type="button" onClick={()=>location.reload()}>再読み込み</button><a href="/commons/">サイト一覧へ</a><a href="/commons/help/">困ったときは</a></div>
    </main>;
  }
}
