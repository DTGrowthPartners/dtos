import type { CarteraExportData, CarteraFacturaRow } from './finance-exports';
import * as XLSX from 'xlsx-js-style';

const NAVY = '031D33', BLUE = '0065A7', INK = '071A2E', PALE = 'EBF2F8';
const MONEY = '"$" #,##0.00;[Red]("$" #,##0.00);"$" 0.00';
type Value = string | number;

function documentDetail(row: CarteraFacturaRow): string {
  const description = row.description || 'Sin descripción registrada';
  const payments = (row.payments || []).map((payment) => {
    const detail = [payment.notes || 'Sin descripción registrada', payment.method, payment.reference].filter(Boolean).join(' · ');
    return `${payment.fecha || 'Fecha no registrada'} | $ ${payment.amount.toLocaleString('es-CO', { maximumFractionDigits: 2 })} | ${detail}`;
  });
  return payments.length ? `${description}\n\nABONOS APLICADOS\n${payments.join('\n')}` : description;
}

export function buildCarteraWorkbook(data: CarteraExportData) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: 'Estado de cartera', Author: 'DT Growth Partners', Company: 'DT Growth Partners' };
  function createSheet(name: string, client: string, nit: string, headers: string[], rows: Value[][], widths: number[], numericCols: number[], totals?: Value[], cards?: [number,number,number,string]) {
    const count=headers.length,last=count-1;
    const values: Value[][]=[['DT GROWTH PARTNERS'],['ESTRATEGIA · TECNOLOGÍA · RESULTADOS'],[],[],['ESTADO DE CARTERA'],['Cuentas por cobrar · Valores en pesos colombianos (COP)'],[`CLIENTE: ${client}`],[nit ? `NIT ${nit}` : 'Cartera consolidada'],[`CORTE AL: ${data.periodLabel}`],[],headers,...rows];
    const totalRow=values.length;
    if(totals)values.push(totals);
    let cardRow=-1;
    if(cards){values.push([]);cardRow=values.length;values.push(['TOTAL FACTURADO','','TOTAL ABONADO','','SALDO ACTUAL','','ESTADO'],[cards[0],'',cards[1],'',cards[2],'',cards[3]]);}
    values.push([]);
    const supportRow=values.length;
    values.push(['¿Dudas o necesitas soporte?'],['Estamos atentos para cualquier consulta relacionada con tu cuenta.'],['Contáctanos: administracion@dtgrowthpartners.com'],[],['CARTAGENA, COLOMBIA  |  DTGROWTHPARTNERS.COM'],['CONVERTIMOS ESTRATEGIAS EN RESULTADOS']);
    const ws=XLSX.utils.aoa_to_sheet(values);
    const merges=[0,1,2,4,5,6,7,8,supportRow,supportRow+1,supportRow+2,supportRow+4,supportRow+5].map((r)=>({s:{r,c:0},e:{r,c:last}}));
    if(cards)for(const r of [cardRow,cardRow+1])for(const c of [0,2,4])merges.push({s:{r,c},e:{r,c:c+1}});
    ws['!merges']=merges;ws['!cols']=widths.map(wch=>({wch}));
    ws['!rows']=values.map((row,r)=>{
      if(r===0)return {hpt:36};
      if(r===1)return {hpt:20};
      if(r===2||r===3||r===9||!row.length)return {hpt:9};
      if(r===4)return {hpt:34};
      if(r===5)return {hpt:21};
      if(r>=6&&r<=8)return {hpt:25};
      if(r===10)return {hpt:32};
      if(r===totalRow&&totals)return {hpt:32};
      if(r===cardRow)return {hpt:24};
      if(r===cardRow+1&&cards)return {hpt:34};
      const lines=row.map((v,c)=>{
        const merge=merges.find(m=>m.s.r===r&&m.s.c===c);
        const available=merge?widths.slice(merge.s.c,merge.e.c+1).reduce((sum,w)=>sum+w,0):widths[c];
        return String(v).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/Math.max(1,available-3))),0);
      });
      return {hpt:Math.min(409,Math.max(r>=supportRow?23:44,...lines.map(n=>n*14+12)))};
    });
    ws['!margins']={left:0.25,right:0.25,top:0.35,bottom:0.35,header:0.15,footer:0.15};
    if(rows.length)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:10,c:0},e:{r:10+rows.length,c:last}})};
    for(let r=0;r<values.length;r++)for(let c=0;c<count;c++){
      const cell=ws[XLSX.utils.encode_cell({r,c})]||(ws[XLSX.utils.encode_cell({r,c})]={t:'s',v:''});
      const banner=r<3,head=r===10,total=!!totals&&r===totalRow,card=cards&&(r===cardRow||r===cardRow+1),support=r>=supportRow&&r<=supportRow+2;
      const body=r>10&&r<11+rows.length;
      cell.s={font:{name:'Calibri',sz:r===0?23:r===4?22:r===cardRow+1?16:11,bold:banner||head||total||r===4||r===6||r===cardRow+1||r===supportRow,color:{rgb:banner||head?'FFFFFF':r===4?BLUE:INK}},
        fill:{patternType:'solid',fgColor:{rgb:banner?NAVY:head?BLUE:total?'DCEAF5':card||support||r===6||r===7||r===8?PALE:body&&r%2?'F6F9FC':'FFFFFF'}},
        alignment:{vertical:body?'top':'center',horizontal:(body||total)&&numericCols.includes(c)?'right':'left',wrapText:true,indent:1},
        border:body||head||total?{bottom:{style:'thin',color:{rgb:'D7E1EC'}},left:{style:'thin',color:{rgb:'D7E1EC'}},right:{style:'thin',color:{rgb:'D7E1EC'}}}:{}};
      if((body||total)&&typeof cell.v==='number'&&numericCols.includes(c))cell.z=MONEY;
      if(body&&headers[c]==='Saldo'){cell.s.font.bold=true;cell.s.font.color={rgb:BLUE};}
      if(body&&headers[c]==='Estado'){
        cell.s.fill={patternType:'solid',fgColor:{rgb:cell.v==='Parcial'?'E0F5ED':'FFF2CE'}};
        cell.s.font={name:'Calibri',sz:11,bold:true,color:{rgb:cell.v==='Parcial'?'126B41':'9B5E00'}};
        cell.s.alignment={vertical:'center',horizontal:'center',wrapText:true};
      }
    }
    if(totals&&rows.length)for(const c of numericCols){const cell=ws[XLSX.utils.encode_cell({r:totalRow,c})];cell.f=`SUM(${XLSX.utils.encode_col(c)}12:${XLSX.utils.encode_col(c)}${11+rows.length})`;}
    if(cards)for(const c of [0,2,4]){const cell=ws[XLSX.utils.encode_cell({r:cardRow+1,c})];cell.z=MONEY;if(totals)cell.f=`${XLSX.utils.encode_col(3+c/2)}${totalRow+1}`;}
    const safe=name.replace(/[\\/?*[\]:]/g,' ').slice(0,31)||'Cartera';let unique=safe,index=2;while(workbook.SheetNames.includes(unique))unique=safe.slice(0,26)+' '+index++;
    XLSX.utils.book_append_sheet(workbook,ws,unique);
  }
  const documents=data.facturas||[];
  if(data.vista==='general')createSheet('Resumen','Todos los clientes','',['Cliente','NIT','Documentos','Antigüedad','Saldo pendiente'],data.clientes.map(r=>[r.clientName,r.nit,r.facturas,r.bucketLabel,r.saldo]),[48,24,16,24,26],[4],['TOTAL CARTERA','','','',data.totalCartera]);
  const groups=new Map<string,CarteraFacturaRow[]>();
  for(const row of documents){const name=row.clientName||(data.vista==='cliente'?data.clientName:'Cliente');const key=name+'|'+(row.clientNit||'');groups.set(key,[...(groups.get(key)||[]),row]);}
  for(const rows of groups.values()){
    const client=rows[0].clientName||(data.vista==='cliente'?data.clientName:'Cliente'),nit=rows[0].clientNit||(data.vista==='cliente'?data.clientNit:'');
    const total=rows.reduce((s,r)=>s+r.totalAmount,0),paid=rows.reduce((s,r)=>s+r.paidAmount,0),balance=rows.reduce((s,r)=>s+r.saldo,0);
    createSheet(client,client,nit,['Documento / Tipo','Fecha','Descripción','Valor','Abonado','Saldo','Estado'],rows.map(r=>[r.invoiceNumber+'\n'+r.tipoDocumento,r.fecha,documentDetail(r),r.totalAmount,r.paidAmount,r.saldo,r.statusLabel]),[25,15,58,19,19,19,17],[3,4,5],['TOTALES','','',total,paid,balance,''],[total,paid,balance,paid>0?'Parcial':'Pendiente']);
  }
  if(!documents.length&&data.vista==='cliente')createSheet('Cartera',data.clientName,data.clientNit,['Documento / Tipo','Fecha','Descripción','Valor','Abonado','Saldo','Estado'],[],[25,15,58,19,19,19,17],[3,4,5],['SIN SALDO PENDIENTE','','',0,0,0,''],[0,0,0,'Sin saldo']);
  const payments=documents.flatMap(r=>(r.payments||[]).map(p=>[r.clientName||(data.vista==='cliente'?data.clientName:''),r.invoiceNumber,p.fecha,p.amount,p.method,p.reference,p.notes]));
  if(payments.length)createSheet('Abonos',data.vista==='cliente'?data.clientName:'Todos los clientes',data.vista==='cliente'?data.clientNit:'',['Cliente','Documento','Fecha de abono','Valor aplicado','Medio de pago','Referencia','Observaciones'],payments,[26,25,18,19,20,24,52],[3]);
  return workbook;
}
