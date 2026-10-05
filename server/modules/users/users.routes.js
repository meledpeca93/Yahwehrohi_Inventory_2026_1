const express=require('express');
const service=require('./users.service');
const access=require('./access');
function userRoutes(){const router=express.Router();
 router.post('/auth/logout',async(req,res,next)=>{try{await service.revokeSession(req.accessToken);res.json({ok:true});}catch(e){next(e);}});
 router.get('/auth/session',(req,res)=>res.json({user:req.authenticatedUser}));
 router.get('/users',async(req,res,next)=>{try{res.json({users:await service.listUsers(req.authenticatedUser),modules:access.modules,profiles:access.profiles});}catch(e){next(e);}});
 router.post('/users',async(req,res,next)=>{try{res.status(201).json({id:await service.saveUser(req.authenticatedUser,null,req.body)});}catch(e){next(e);}});
 router.put('/users/:id',async(req,res,next)=>{try{res.json({id:await service.saveUser(req.authenticatedUser,Number(req.params.id),req.body)});}catch(e){next(e);}});
 router.delete('/users/:id',async(req,res,next)=>{try{res.json({id:await service.deleteUser(req.authenticatedUser,Number(req.params.id))});}catch(e){next(e);}});
 router.use((error,req,res,next)=>res.status(error.status||500).json({message:error.status?error.message:'No se pudo gestionar el usuario'}));
 return router;
}
async function authorizeHttp(req,res,next){
 if(['/auth/login','/auth/users','/health'].includes(req.path)||req.path.startsWith('/product-image'))return next();
 try{
  req.accessToken=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const user=await service.authenticate(req.accessToken);req.authenticatedUser=user;
  if(!['/auth/session','/auth/logout'].includes(req.path)){
   const write=!['GET','HEAD','OPTIONS'].includes(req.method);
   if(!access.allowed(user,access.resourceKeys(req.path.replace(/^\//,'/api/'),write),write))throw Object.assign(Error('No tienes acceso a este módulo u operación'),{status:403});
  }
  if(req.body && !['GET','HEAD','OPTIONS'].includes(req.method)) {
    req.body.userId=user.id;
    if(Object.prototype.hasOwnProperty.call(req.body,'recordedById'))req.body.recordedById=user.id;
    if(Object.prototype.hasOwnProperty.call(req.body,'recordedBy'))req.body.recordedBy=user.nombre;
    if(Object.prototype.hasOwnProperty.call(req.body,'user'))req.body.user=typeof req.body.user==='object'?user:user.nombre;
  }
  next();
 }catch(error){res.status(error.status||500).json({message:error.status?error.message:'No se pudo verificar el acceso'});}
}
module.exports={userRoutes,authorizeHttp};
