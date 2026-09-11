/* Guard existing device-local notebooks against stale writes and failed restores. */
(function(root){
  'use strict';
  class NotebookStorage {
    constructor(storage,key){this.storage=storage;this.key=key;this.observed=null;this.ready=false;}
    read(){this.observed=this.storage.getItem(this.key);this.ready=true;return this.observed;}
    check(){if(!this.ready)throw Error('保存領域を確認できていません。');if(this.storage.getItem(this.key)!==this.observed){const error=Error('別のタブで更新されています。この画面の記録を書き出し、他のタブを閉じて再読み込みしてください。');error.code='conflict';throw error;}}
    write(value){this.check();const raw=JSON.stringify(value);this.storage.setItem(this.key,raw);this.observed=raw;return true;}
    replace(value){
      this.check();const raw=JSON.stringify(value);
      // Keep one exact pre-restore checkpoint. Any quota error leaves the live notebook intact.
      if(this.observed!==null)this.storage.setItem(this.key+':before-restore',this.observed);
      this.check();this.storage.setItem(this.key,raw);this.observed=raw;return true;
    }
    previous(){return this.storage.getItem(this.key+':before-restore');}
  }
  root.NotebookStorage=NotebookStorage;
  if(typeof module!=='undefined'&&module.exports)module.exports=NotebookStorage;
})(typeof globalThis!=='undefined'?globalThis:this);
