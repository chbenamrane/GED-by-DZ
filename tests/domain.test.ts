import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectPdf,renderPdf,pagePoint } from '../src/lib/pdf';
import { storePdf,readPdf } from '../src/lib/files';
import { fieldSchema,validateFields,validateValues } from '../src/lib/fields';
import { checkPassword,encrypt,decrypt,passwordPolicy } from '../src/lib/security';
import bcrypt from 'bcryptjs';
test('PDF : dimensions, boîtes, rotations et toutes les pages conservées',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'ged-js-test-'));process.env.STORAGE_DIR=dir;
  try{
    const original=await PDFDocument.create();
    for(const [w,h,r] of [[595,842,0],[792,612,0],[1190,842,0],[300,1500,0],[595,842,90],[595,842,180],[595,842,270]]){const p=original.addPage([w,h]);p.setRotation(degrees(r));p.drawRectangle({x:10,y:30,width:80,height:25});}
    original.getPage(4).setCropBox(10,20,550,780);
    const bytes=await original.save(),filePath=await storePdf(bytes);const before=await inspectPdf(bytes);
    const field=fieldSchema.parse({key:'name',label:'Nom',type:'text',page:4,x:20,y:30});
    const out=await renderPdf({filePath,fields:[field]},{name:'Amina École'});
    assert.deepEqual(await inspectPdf(out),before);assert.deepEqual(new Uint8Array(await readPdf(filePath)),bytes);
    const loaded=await PDFDocument.load(out);assert.deepEqual(loaded.getPage(4).getCropBox(),original.getPage(4).getCropBox());
    assert.equal(pagePoint(original.getPage(4),0,0).x,10);assert.equal(pagePoint(original.getPage(4),0,0).y,20);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('Validation : coordonnées natives, pages et cases hors limites',()=>{
  const f=fieldSchema.parse({key:'test',label:'Texte',type:'text',x:410,y:490});
  assert.equal(validateFields([f],[{width:420,height:500,rotation:0}])[0].x,410);
  assert.throws(()=>validateFields([f],[{width:210,height:297,rotation:0}]));
  assert.throws(()=>validateFields([{...f,page:5}],[{width:420,height:500,rotation:0}]));
});
test('Formulaires : champs requis, choix autorisés et cases dédupliquées',()=>{
  const f=fieldSchema.parse({key:'nom',label:'Nom',type:'text',x:0,y:0,required:true});
  assert.throws(()=>validateValues([f],{}));
  const choice={...f,key:'choice',type:'select' as const,options:['A','B']};assert.throws(()=>validateValues([choice],{choice:'C'}));
  const check={...f,key:'check',type:'checkbox' as const,options:[{label:'A',x:0,y:0}]};
  assert.deepEqual(validateValues([check],{check:[0,0,15,-1,'0']}),{check:[0]});
});
test('Sécurité : compatibilité bcrypt PHP et chiffrement SMTP authentifié',async()=>{
  const hash=(await bcrypt.hash('Password123!',4)).replace('$2b$','$2y$');assert.equal(await checkPassword('Password123!',hash),true);assert.equal(await checkPassword('wrong',hash),false);
  process.env.SETTINGS_ENCRYPTION_KEY='ab'.repeat(32);const sealed=encrypt('smtp-secret');assert.ok(!sealed.includes('smtp-secret'));assert.equal(decrypt(sealed),'smtp-secret');assert.throws(()=>decrypt(sealed.slice(0,-2)+'00'));assert.throws(()=>passwordPolicy('short'));
});
