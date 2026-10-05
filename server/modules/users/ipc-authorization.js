const service=require('./users.service');
const access=require('./access');
function withIpcAccess(channel,handler){return async(event,...args)=>{
 if(['auth:login','auth:users','db:health'].includes(channel))return handler(event,...args);
 const credentials=args.pop();
 const actor=await service.authenticate(credentials?.sessionToken);
 const write=/:.*(create|save|update|delete|annul|activate|primary|status|manual|restore|run-automatic|quick|opening|quit)/.test(channel);
 if(!['users:session','users:logout','app:quit'].includes(channel)&&!access.allowed(actor,access.resourceKeys(channel,write),write))throw Object.assign(Error('No tienes acceso a este módulo u operación'),{status:403});
 event.authenticatedUser=actor;event.accessToken=credentials?.sessionToken;
 for(const arg of args){if(arg && typeof arg==='object'){
   if(write)arg.userId=actor.id;
   if(Object.prototype.hasOwnProperty.call(arg,'recordedById'))arg.recordedById=actor.id;
   if(Object.prototype.hasOwnProperty.call(arg,'recordedBy'))arg.recordedBy=actor.nombre;
   if(Object.prototype.hasOwnProperty.call(arg,'user'))arg.user=typeof arg.user==='object'?actor:actor.nombre;
 }}
 if(['invoices:annul','invoices:activate','daily-cuts:delete-cash-management','petty-cash:delete'].includes(channel))args[1]=actor.id;
 return handler(event,...args);
};}
module.exports={withIpcAccess};
