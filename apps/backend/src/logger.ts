export type LogScope="backend"|"websocket"|"auth"|"browser-sync"|"sync-failed"|"profile-lock";
export function log(scope:LogScope,message:string,meta?:Record<string,unknown>){console.log(JSON.stringify({time:new Date().toISOString(),scope,message,...meta}));}
export function logError(scope:LogScope,message:string,error:unknown,meta?:Record<string,unknown>){console.error(JSON.stringify({time:new Date().toISOString(),scope,message,error:error instanceof Error?error.message:String(error),...meta}));}
