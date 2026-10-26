import { PDFDocument, degrees, rgb, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, access } from 'node:fs/promises';
import { readPdf } from './files';
import type { Field, PageSize, Values } from './fields';
const MM=72/25.4;
export function pageGeometry(page:PDFPage):PageSize {
  const box=page.getCropBox();const rotation=((page.getRotation().angle%360)+360)%360;
  if(rotation%90!==0)throw new Error('Rotation PDF non prise en charge.');
  return {width:(rotation%180?box.height:box.width)/MM,height:(rotation%180?box.width:box.height)/MM,rotation};
}
export async function inspectPdf(bytes:Uint8Array):Promise<PageSize[]> {
  if(bytes.length>10*1024*1024)throw new Error('Le PDF dépasse 10 Mo.');
  const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  if(!pdf.getPageCount())throw new Error('Le PDF ne contient aucune page.');
  return pdf.getPages().map(pageGeometry);
}
/** Coordonnées visibles depuis le coin supérieur gauche, sans modifier les boîtes ni la rotation. */
export function pagePoint(page:PDFPage,xMm:number,yMm:number){
  const b=page.getCropBox();const r=pageGeometry(page).rotation;const x=xMm*MM,y=yMm*MM;
  switch(r){
    case 90:return {x:b.x+y,y:b.y+x};
    case 180:return {x:b.x+b.width-x,y:b.y+y};
    case 270:return {x:b.x+b.width-y,y:b.y+b.height-x};
    default:return {x:b.x+x,y:b.y+b.height-y};
  }
}
async function getFont(pdf:PDFDocument,bold=false):Promise<PDFFont>{
  const candidates=[process.env.PDF_FONT_PATH,process.platform==='win32'?`C:/Windows/Fonts/arial${bold?'bd':''}.ttf`:'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].filter(Boolean) as string[];
  for(const p of candidates){try{await access(p);pdf.registerFontkit(fontkit);return await pdf.embedFont(await readFile(p),{subset:true});}catch{ /* essayer la police de secours */ }}
  return pdf.embedFont(bold?StandardFonts.HelveticaBold:StandardFonts.Helvetica);
}
export async function renderPdf(template:{filePath:string;fields:unknown},values:Values){
  const pdf=await PDFDocument.load(await readPdf(template.filePath),{updateMetadata:false});
  const regular=await getFont(pdf),bold=await getFont(pdf,true);
  for(const f of template.fields as Field[]){
    const page=pdf.getPage(f.page??0);const angle=pageGeometry(page).rotation;const font=f.bold?bold:regular;
    const raw=values[f.key]??'';
    if(f.type==='checkbox'){
      const selected=Array.isArray(raw)?raw:[];
      f.options.forEach((o,i)=>{if(typeof o==='string'||!selected.includes(i))return;const s=f.size*.13;
        for(const [a,b] of [[[o.x-s,o.y-s],[o.x+s,o.y+s]],[[o.x-s,o.y+s],[o.x+s,o.y-s]]])page.drawLine({start:pagePoint(page,a[0],a[1]),end:pagePoint(page,b[0],b[1]),thickness:1.2,color:rgb(0,0,0)});
      });continue;
    }
    if(Array.isArray(raw)||(!raw&&!f.required))continue;
    let text=String(raw);
    if(f.type==='rating')text=`${text}/5`;
    if(f.type==='number'&&text)text=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(text.replace(/\s/g,'').replace(',','.'))).replace(/\u202f/g,' ');
    if(f.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(text))text=text.split('-').reverse().join('/');
    const maxWidth=(f.max_width_mm||Math.max(1,pageGeometry(page).width-f.x))*MM;
    const lines:string[]=[];
    for(const paragraph of text.split(/\r?\n/)){
      if(f.type==='textarea'){
        let line='';for(const word of paragraph.split(' ')){const next=line?`${line} ${word}`:word;if(line&&font.widthOfTextAtSize(next,f.size)>maxWidth){lines.push(line);line=word;}else line=next;}lines.push(line);
      }else{let line=paragraph;while(line&&font.widthOfTextAtSize(line,f.size)>maxWidth)line=line.slice(0,-1);lines.push(line);break;}
    }
    lines.forEach((line,i)=>{
      const y=f.y+i*f.size*1.25/MM;if(y>pageGeometry(page).height)return;
      const point=pagePoint(page,f.x,y);
      if(f.clear_before)page.drawRectangle({...pagePoint(page,f.x,y+1),width:maxWidth,height:f.size*1.3,rotate:degrees(angle),color:rgb(1,1,1)});
      page.drawText(line,{...point,size:f.size,font,rotate:degrees(angle),color:rgb(0,0,0)});
    });
  }
  return pdf.save();
}
export function documentFilename(name:string,id:string){return `${name.replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,90)}_${id}.pdf`;}
