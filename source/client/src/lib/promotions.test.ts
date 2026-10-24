import {it,expect,vi} from 'vitest';
const remote=vi.hoisted(()=>({read:vi.fn(),request:vi.fn()}));
vi.mock('./nrdRemote',()=>({readPromotionConfig:remote.read,remoteRequest:remote.request}));
it('shares ACP snapshots, isolates document-store errors, validates complete pages and removes disabled stores',async()=>{
 const {fetchPromotions}=await import('./promotions');
 const config:any={'0012':{enabled:true},'0005':{enabled:true,revision:'v1',pages:1,count:1}};
 const imported={code:'99',name:'Arroz Teste',price:4,previous:10,from:'2020-01-01',to:'2099-01-01',family:'Clube'};
 let documentFails=false;
 remote.read.mockImplementation(async(path:string)=>{
 if(path==='config/promotion_stores')return config;
 if(path==='config/acpOfferValidity')return {};
 if(documentFails)throw Error('offline');
 return {items:[imported]};
 });
 remote.request.mockImplementation(async(_service:string,input:any)=> input.operation==='promotion_status'?{revision:'a'.repeat(64),count:1}:{revision:'a'.repeat(64),count:1,removedIds:[],items:[{id:'1',hash:'b'.repeat(64),item:{id:1,code:'1',barCode:'123',description:'Arroz ACP',value:5,previousValue:10,productCategories:[{description:'De-Por'}],imageUrl:'https://example.test/rice.jpg'}}]});
 const first=await fetchPromotions();expect(first.offers).toHaveLength(2);expect(first.offers.find(o=>o.storeCode==='0012')?.images).toEqual(['https://example.test/rice.jpg']);expect(first.offers.find(o=>o.storeCode==='0005')?.family).toBe('Clube');
 await fetchPromotions();expect(remote.request.mock.calls.filter(([,input])=>input.operation==='promotion_sync')).toHaveLength(1);
 // A new revision must be complete before replacing the previous display.
 config['0005'].revision='v2';documentFails=true;
 const partial=await fetchPromotions();expect(partial.warnings).toHaveLength(1);expect(partial.offers.some(o=>o.storeCode==='0005')).toBe(true);
 config['0005'].enabled=false;
 const disabled=await fetchPromotions();expect(disabled.offers.every(o=>o.storeCode==='0012')).toBe(true);expect(disabled.stores).toEqual(['0012']);
});
