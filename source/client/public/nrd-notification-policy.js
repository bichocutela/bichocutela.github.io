/* One notification contract shared by the page and the background worker. */
(function(root){
 const defaults={enabled:true,productAdded:true,codeChanged:true,suggestionFixed:true,appUpdate:true,promotionUpdated:true,trainingEnabled:false,encarteMode:'OFF'};
 function normalize(raw){const result={...defaults};for(const key of Object.keys(defaults))if(typeof defaults[key]==='boolean'&&typeof raw?.[key]==='boolean')result[key]=raw[key];if(['OFF','SIMPLE','DETAILED'].includes(raw?.encarteMode))result.encarteMode=raw.encarteMode;return result;}
 function content(payload,raw,now=Date.now()){
  const prefs=normalize(raw),data=payload?.data||{},type=data.type||'NEW_PRODUCT';if(!prefs.enabled)return null;
  const flag={NEW_PRODUCT:'productAdded',CODE_CHANGED:'codeChanged',SUGGESTION_FIXED:'suggestionFixed',APP_UPDATE:'appUpdate',PROMOTIONS_UPDATED:'promotionUpdated',PROMOTION_UPDATED:'promotionUpdated',NEW_TRAINING:'trainingEnabled'}[type];
  if(flag&&!prefs[flag])return null;
  let title=payload.notification?.title||data.title||'NRD Códigos',body=payload.notification?.body||data.body||'Há uma atualização no catálogo.';
  let url=data.url|| (data.productCode?'/?product='+encodeURIComponent(data.productCode):'/');
  let id=payload.messageId||payload.fcmMessageId||[type,data.productCode||'',title,body].join('|');
  if(type==='NEW_ENCARTE'){
   const date=value=>typeof value==='string'?Date.parse(value+(/Z$|[+-]\d\d:\d\d$/.test(value)?'':'-03:00')):NaN;
   if(prefs.encarteMode==='OFF'||! /^[1-9]\d*$/.test(data.encarteId||'')||!data.encarteName?.trim()||!(date(data.startDate)<=now&&date(data.endDate)>=now))return null;
   const validity=data.startDate.slice(8,10)+'/'+data.startDate.slice(5,7)+' a '+data.endDate.slice(8,10)+'/'+data.endDate.slice(5,7);
   if(prefs.encarteMode==='SIMPLE'){title='Novo encarte disponível';body='Há um novo encarte para Natal e região. Toque para conferir.';}else{title='Novo Encarte: '+data.encarteName;body=data.encarteName+'\nValidade: '+validity+'. Toque para conferir.';}
   id='NEW_ENCARTE:'+data.encarteId;url='/?encarte='+encodeURIComponent(data.encarteId);
  }
  if(type==='NEW_TRAINING'){id='NEW_TRAINING:'+data.trainingId;url='/?treinamento='+encodeURIComponent(data.trainingId||'');}
  if(type==='PROMOTIONS_UPDATED'||type==='PROMOTION_UPDATED')url='/?promocoes=1';
  try{const target=new URL(url,'https://bichocutela.github.io');if(target.origin!=='https://bichocutela.github.io')url='/';}catch{url='/';}
  return {id,title,body,type,productCode:data.productCode||'',url,receivedAt:now,read:false};
 }
 root.NrdNotificationPolicy={defaults,normalize,content};
})(globalThis);
