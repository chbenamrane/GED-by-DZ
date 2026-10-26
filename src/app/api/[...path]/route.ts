import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z, ZodError } from 'zod';
import JSZip from 'jszip';
import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { checkOrigin, requireUser, sessionUser, publicUser, rateLimit, checkPassword, createSession, logout, passwordPolicy, passwordHash, hashToken, HttpError } from '@/lib/security';
import { inspectPdf, renderPdf, documentFilename } from '@/lib/pdf';
import { storePdf, readPdf, removePdf } from '@/lib/files';
import { validateFields, validateValues, type Field, type Values, type PageSize } from '@/lib/fields';
import { smtpSettings, saveSmtp, sendMail } from '@/lib/mail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ok=(data:unknown,status=200)=>NextResponse.json({data},{status});
const body=async(r:Request)=>{const text=await r.text();if(Buffer.byteLength(text)>2*1024*1024)throw new HttpError(413,'Requête trop volumineuse.');return JSON.parse(text);};
const nameSchema=z.string().trim().min(1).max(120);
const mailSchema=z.union([z.email(),z.literal('')]);
async function handler(request:NextRequest,context:{params:Promise<{path:string[]}>}){
  try{
    const {path}=await context.params;const route=path.join('/'),method=request.method;
    if(method!=='GET')checkOrigin(request);
    if(route==='auth/me'&&method==='GET')return ok(await sessionUser());
    if(route==='auth/login'&&method==='POST'){
      const {username,password}=z.object({username:z.string().min(1).max(100),password:z.string().max(200)}).parse(await body(request));
      await rateLimit(`login:${username.toLowerCase()}`,8,300);
      const user=await db.user.findUnique({where:{username}});
      const valid=await checkPassword(password,user?.passwordHash??'$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
      if(!user||!valid)throw new HttpError(401,'Identifiants incorrects.');
      await db.rateLimit.deleteMany({where:{id:hashToken(`login:${username.toLowerCase()}`)}});
      await createSession(user.id);return ok(publicUser(user));
    }
    if(route==='auth/logout'&&method==='POST'){await logout();return ok(true);}
    if(route==='auth/forgot'&&method==='POST'){
      const {identifier}=z.object({identifier:z.string().trim().min(1).max(255)}).parse(await body(request));
      await rateLimit(`reset-global`,30,3600);await rateLimit(`reset:${identifier.toLowerCase()}`,5,3600);
      const user=await db.user.findFirst({where:{OR:[{username:identifier},{email:{equals:identifier,mode:'insensitive'}}]}});
      if(user?.email){const token=randomBytes(32).toString('hex');await db.resetToken.create({data:{id:hashToken(token),userId:user.id,expiresAt:new Date(Date.now()+3600_000)}});
        try{await sendMail(user.email,'GED By DZ — Réinitialisation',`Bonjour ${user.username},\n\nChoisissez votre nouveau mot de passe :\n${process.env.APP_URL}/reset-password?token=${token}\n\nCe lien est valable une heure et ne peut être utilisé qu’une fois.`);}catch{console.error('Password recovery email could not be delivered.');}}
      return ok('Si le compte dispose d’une adresse e-mail, un lien de récupération lui sera envoyé.');
    }
    if(route==='auth/reset'&&method==='POST'){
      const {token,password}=z.object({token:z.string().length(64),password:z.string().max(200)}).parse(await body(request));passwordPolicy(password);
      const hashed=await passwordHash(password);
      await db.$transaction(async tx=>{const row=await tx.resetToken.findUnique({where:{id:hashToken(token)}});if(!row||row.expiresAt<new Date())throw new HttpError(400,'Lien invalide ou expiré.');
        const claimed=await tx.resetToken.deleteMany({where:{id:row.id,expiresAt:{gt:new Date()}}});if(!claimed.count)throw new HttpError(400,'Lien déjà utilisé.');
        await tx.user.update({where:{id:row.userId},data:{passwordHash:hashed}});await tx.session.deleteMany({where:{userId:row.userId}});await tx.resetToken.deleteMany({where:{userId:row.userId}});});return ok(true);
    }
    const user=await requireUser();const admin=user.role==='ADMIN';
    const owner=admin?{}:{userId:user.id};
    if(route==='bootstrap'&&method==='GET'){
      const [templates,folders,documents]=await Promise.all([
        db.template.findMany({where:{deletedAt:null,...(!admin?{active:true}:{})},select:{id:true,name:true,color:true,active:true,folderId:true,pageSizes:true,updatedAt:true},orderBy:{name:'asc'}}),
        db.folder.findMany({orderBy:{name:'asc'}}),
        db.document.findMany({where:owner,include:{template:{select:{name:true,color:true}}},orderBy:{createdAt:'desc'},take:500})]);return ok({user,templates,folders,documents});
    }
    if(path[0]==='templates'&&path[1]){
      const template=await db.template.findUnique({where:{id:path[1]}});if(!template||template.deletedAt)throw new HttpError(404,'Modèle introuvable.');
      if(!admin&&!template.active)throw new HttpError(403,'Modèle désactivé.');
      if(path[2]==='file'&&method==='GET')return new NextResponse(new Uint8Array(await readPdf(template.filePath)),{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store'}});
      if(path[2]==='preview'&&method==='POST'){
        await requireUser(true);const b=await body(request);const fields=validateFields(b.fields,template.pageSizes as PageSize[]);
        const values:Values={};for(const f of fields)values[f.key]=f.type==='checkbox'?f.options.map((_,i)=>i):f.type==='number'?'1234.50':f.type==='rating'?'4':f.type==='select'?(typeof f.options[0]==='string'?f.options[0]:''):f.default||`${f.label} (test)`;
        const bytes=await renderPdf({...template,fields},values);return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store'}});
      }
      if(method==='GET')return ok(template);
      await requireUser(true);
      if(method==='PATCH'){
        const b=await body(request);const data:Prisma.TemplateUpdateInput={};
        if(b.name!==undefined)data.name=nameSchema.parse(b.name);
        if(b.color!==undefined)data.color=z.string().regex(/^#[0-9a-f]{6}$/i).parse(b.color);
        if(b.active!==undefined)data.active=z.boolean().parse(b.active);
        if(b.folderId!==undefined)data.folder=b.folderId?{connect:{id:z.string().parse(b.folderId)}}:{disconnect:true};
        if(b.fields!==undefined)data.fields=validateFields(b.fields,template.pageSizes as PageSize[]) as unknown as Prisma.InputJsonValue;
        return ok(await db.template.update({where:{id:template.id},data}));
      }
      if(method==='DELETE'){await db.template.update({where:{id:template.id},data:{deletedAt:new Date(),active:false}});return ok(true);}
    }
    if(route==='templates'&&method==='POST'){
      await requireUser(true);
      if(Number(request.headers.get('content-length'))>11*1024*1024)throw new HttpError(413,'PDF trop volumineux.');
      const form=await request.formData();const file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.pdf')||file.size===0||file.size>10*1024*1024)throw new HttpError(400,'Choisissez un PDF valide de 10 Mo maximum.');
      const name=nameSchema.parse(form.get('name'));const color=z.string().regex(/^#[0-9a-f]{6}$/i).parse(form.get('color')||'#087e70');
      const bytes=new Uint8Array(await file.arrayBuffer());let sizes:PageSize[];try{sizes=await inspectPdf(bytes);}catch{throw new HttpError(400,'PDF illisible, chiffré ou non compatible. Exportez une copie sans protection.');}
      const filePath=await storePdf(bytes);
      try{return ok(await db.template.create({data:{name,color,filePath,pageSizes:sizes as unknown as Prisma.InputJsonValue,folderId:String(form.get('folderId')||'')||null}}),201);}catch(e){await removePdf(filePath);throw e;}
    }
    if(path[0]==='folders'){
      await requireUser(true);
      if(method==='POST')return ok(await db.folder.create({data:{name:z.string().trim().min(1).max(80).parse((await body(request)).name)}}),201);
      if(path[1]&&method==='PATCH')return ok(await db.folder.update({where:{id:path[1]},data:{name:z.string().trim().min(1).max(80).parse((await body(request)).name)}}));
      if(path[1]&&method==='DELETE'){await db.folder.delete({where:{id:path[1]}});return ok(true);}
    }
    if(route==='documents'&&method==='POST'){
      const b=z.object({templateId:z.string(),rows:z.array(z.record(z.string(),z.unknown())).min(1).max(100)}).parse(await body(request));
      const t=await db.template.findFirst({where:{id:b.templateId,active:true,deletedAt:null}});if(!t)throw new HttpError(400,'Modèle indisponible.');
      const rows=b.rows.map(row=>validateValues(t.fields as Field[],row));
      const docs=await db.$transaction(rows.map(values=>db.document.create({data:{templateId:t.id,userId:user.id,username:user.username,values:values as Prisma.InputJsonValue}})));return ok(docs,201);
    }
    if(route==='documents/export'&&method==='POST'){
      const b=z.object({ids:z.array(z.string()).min(1).max(100),email:z.email().optional()}).parse(await body(request));
      const unique=[...new Set(b.ids)];const docs=await db.document.findMany({where:{id:{in:unique},...owner},include:{template:true}});
      if(docs.length!==unique.length)throw new HttpError(403,'Documents absents ou accès refusé.');
      const files=await Promise.all(docs.map(async d=>({filename:documentFilename(d.template.name,d.id),content:Buffer.from(await renderPdf(d.template,d.values as Values))})));
      if(b.email){await sendMail(b.email,'Documents — GED By DZ','Bonjour,\n\nVeuillez trouver ci-joints les documents demandés.\n\nGED By DZ',files);await db.document.updateMany({where:{id:{in:unique}},data:{emailedAt:new Date(),emailedTo:b.email}});return ok(true);}
      const zip=new JSZip();files.forEach(f=>zip.file(f.filename,f.content));const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});await db.document.updateMany({where:{id:{in:unique}},data:{downloadedAt:new Date()}});
      return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="GED-by-DZ_documents.zip"','Cache-Control':'no-store'}});
    }
    if(path[0]==='documents'&&path[1]){
      const d=await db.document.findFirst({where:{id:path[1],...owner},include:{template:true}});if(!d)throw new HttpError(404,'Document introuvable.');
      if(path[2]==='pdf'&&method==='GET'){
        const bytes=await renderPdf(d.template,d.values as Values);await db.document.update({where:{id:d.id},data:{downloadedAt:new Date()}});
        return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(documentFilename(d.template.name,d.id))}`,'Cache-Control':'no-store'}});
      }
      if(method==='GET')return ok(d);
      if(method==='DELETE'){await db.document.delete({where:{id:d.id}});return ok(true);}
    }
    if(path[0]==='users'){
      await requireUser(true);const selection={id:true,username:true,email:true,role:true,createdAt:true};
      if(method==='GET')return ok(await db.user.findMany({select:selection,orderBy:{username:'asc'}}));
      if(method==='POST'){
        const b=z.object({username:z.string().regex(/^[A-Za-z0-9._-]{3,32}$/),password:z.string().max(200),email:mailSchema,role:z.enum(['ADMIN','USER'])}).parse(await body(request));passwordPolicy(b.password);
        return ok(await db.user.create({data:{username:b.username,passwordHash:await passwordHash(b.password),email:b.email||null,role:b.role},select:selection}),201);
      }
      if(path[1]&&method==='PATCH'){
        const b=z.object({email:mailSchema.optional(),password:z.string().max(200).optional()}).parse(await body(request));const data:Prisma.UserUpdateInput={};
        if(b.email!==undefined)data.email=b.email||null;
        if(b.password){passwordPolicy(b.password);data.passwordHash=await passwordHash(b.password);}
        const updated=await db.$transaction(async tx=>{const u=await tx.user.update({where:{id:path[1]},data,select:selection});if(b.password){await tx.session.deleteMany({where:{userId:path[1]}});await tx.resetToken.deleteMany({where:{userId:path[1]}});}return u;});return ok(updated);
      }
      if(path[1]&&method==='DELETE'){if(path[1]===user.id)throw new HttpError(400,'Vous ne pouvez pas supprimer votre compte.');await db.user.delete({where:{id:path[1]}});return ok(true);}
    }
    if(route==='settings'){
      await requireUser(true);
      if(method==='GET'){const s=await smtpSettings();return ok({...s,smtp_pass:undefined,hasPassword:!!s.smtp_pass});}
      if(method==='PATCH'){await saveSmtp(await body(request));return ok(true);}
    }
    if(route==='settings/test'&&method==='POST'){await requireUser(true);const b=z.object({email:z.email()}).parse(await body(request));await sendMail(b.email,'Test — GED By DZ','Votre configuration SMTP fonctionne.');return ok(true);}
    if(route==='profile/password'&&method==='POST'){
      const b=z.object({current:z.string().max(200),password:z.string().max(200)}).parse(await body(request));passwordPolicy(b.password);const u=await db.user.findUniqueOrThrow({where:{id:user.id}});if(!await checkPassword(b.current,u.passwordHash))throw new HttpError(400,'Mot de passe actuel incorrect.');
      await db.$transaction([db.user.update({where:{id:user.id},data:{passwordHash:await passwordHash(b.password)}}),db.session.deleteMany({where:{userId:user.id}}),db.resetToken.deleteMany({where:{userId:user.id}})]);return ok(true);
    }
    throw new HttpError(404,'Route introuvable.');
  }catch(e){
    if(e instanceof HttpError)return NextResponse.json({error:e.message},{status:e.status});
    if(e instanceof ZodError || e instanceof SyntaxError)return NextResponse.json({error:'Données invalides. Vérifiez les champs du formulaire.'},{status:400});
    if(e instanceof Prisma.PrismaClientKnownRequestError){if(e.code==='P2002')return NextResponse.json({error:'Ce nom ou cette adresse e-mail existe déjà.'},{status:409});if(e.code==='P2025')return NextResponse.json({error:'Élément introuvable.'},{status:404});}
    if(e instanceof Error&&(/obligatoire|doit être|option invalide|hors de/.test(e.message)))return NextResponse.json({error:e.message},{status:400});
    console.error('GED request failed:',e instanceof Error?e.name:'unknown');return NextResponse.json({error:'Une erreur est survenue. Vérifiez la connexion à la base et les fichiers du modèle.'},{status:500});
  }
}
export {handler as GET,handler as POST,handler as PATCH,handler as DELETE};
