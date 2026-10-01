function doGet(e) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('レシピ入力');
  if (!sh) return json_({ok:false,error:'レシピ入力シートが見つかりません',recipes:[]});
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return json_({ok:true,recipes:[],updatedAt:new Date().toISOString()});
  const headers=values[0].map(String), statusCol=headers.indexOf('公開状態');
  if(statusCol<0)return json_({ok:false,error:'公開状態列が見つかりません',recipes:[]});
  const recipes=values.slice(1).filter(row=>row[statusCol]==='公開').map(row=>{const o={};headers.forEach((h,i)=>{if(h)o[h]=row[i]||''});return o});
  return json_({ok:true,recipes:recipes,count:recipes.length,updatedAt:new Date().toISOString()});
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
