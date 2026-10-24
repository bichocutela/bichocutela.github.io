import {describe,it,expect} from 'vitest';
import {active,importedOffers,sortOffers,todayInFortaleza,categoryFor,isoDate,type PromotionOffer} from './promotionModel';
const row=(extra:Partial<PromotionOffer>={}):PromotionOffer=>({id:'0012|1',code:'1',barcode:'',name:'Arroz',category:'Alimentos',family:'De/Por',storeCode:'0012',price:5,previous:10,condition:'',validFrom:'2026-10-01',validTo:'2026-10-31',images:[],...extra});
describe('Android promotion rules',()=>{
 it('rejects impossible calendar dates',()=>{expect(isoDate('2026-02-31')).toBe('');expect(isoDate('24/10/2026')).toBe('2026-10-24');});
 it('uses Fortaleza calendar even when UTC is the following day',()=>expect(todayInFortaleza(new Date('2026-10-25T01:00:00Z'))).toBe('2026-10-24'));
 it('hides future and expired offers and includes both boundary days',()=>{
 expect(active(row(),'2026-10-01')).toBe(true);expect(active(row(),'2026-10-31')).toBe(true);expect(active(row(),'2026-09-30')).toBe(false);expect(active(row(),'2026-11-01')).toBe(false);
 });
 it('keeps latest active daily report per product/family without letting future deltas remove current offers',()=>{
 const base={code:'22',name:'Arroz',barcode:'',price:5,previous:10,from:'24/10/2026',to:'30/10/2026',family:'De/Por'};
 const result=importedOffers('0005',[base,{...base,price:4,from:'2026-10-25'},{...base,family:'Clube',price:3},{...base,code:'bad',price:10},{...base,code:'nan',price:'bad'}],'2026-10-24');
 expect(result).toHaveLength(2);expect(result.find(o=>o.family==='De/Por')?.price).toBe(5);expect(result.every(o=>o.storeCode==='0005')).toBe(true);
 });
 it('orders by discount rather than nominal price and breaks ties consistently',()=>{
 const a=row({id:'a',name:'A',price:8,previous:10});const b=row({id:'b',name:'B',price:50,previous:100});
 expect(sortOffers([a,b],'discountDesc')[0].id).toBe('b');expect(sortOffers([a,b],'discountAsc')[0].id).toBe('a');expect(sortOffers([b,a],'priceAsc')[0].id).toBe('a');expect(sortOffers([a,b],'priceDesc')[0].id).toBe('b');
 });
 it('keeps official departments and distinguishes cleaning water from beverages',()=>{
 expect(categoryFor('Água sanitária 1L')).toBe('Limpeza');expect(categoryFor('Arroz','Saudáveis')).toBe('Saudáveis');expect(categoryFor('Cerveja Petra')).toBe('Bebidas alcoólicas');
 });
});
