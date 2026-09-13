export function routePath(pathname:string):string|null {
  try{return decodeURIComponent(pathname.replace(/^\/commons\/?/,'').replace(/\/$/,''))}
  catch{return null}
}
