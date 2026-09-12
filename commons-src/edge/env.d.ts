declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):unknown};
declare module 'npm:postgres@3.4.7' {const postgres:any;export default postgres}
