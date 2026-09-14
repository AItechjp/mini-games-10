import {projectUrl,publishableKey} from './api';
export async function realtimeFetch(path:string,signal?:AbortSignal){
 if(!['/directory','/openings'].includes(path))throw new Error('Invalid collection path');
 return fetch(projectUrl+'/functions/v1/commons-realtime'+path,{headers:{apikey:publishableKey,'x-region':'ap-southeast-2'},signal,cache:'no-store',credentials:'omit'});
}
