import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../../../firebase-messaging-sw.js',import.meta.url),'utf8');
function worker(fetcher:any, cacheFull=false){
 const put=vi.fn(async()=>{if(cacheFull)throw Error('quota');});const cached=new Response('old-release');
 const context:any={self:{addEventListener:vi.fn()},firebase:{initializeApp:vi.fn(),messaging:()=>({onBackgroundMessage:vi.fn()})},importScripts:vi.fn(),caches:{open:async()=>({put,match:async()=>cached})},fetch:fetcher,AbortSignal,Response};
 vm.runInNewContext("globalThis.NrdNotificationPolicy={defaults:{}};\n"+source+'\n globalThis.navigate = serveNavigation;',context);
 return {navigate:context.navigate,put};
}
it('opens the current online release even when an old shell is cached',async()=>{
 const fetcher=vi.fn(async()=>new Response('current-release'));const {navigate,put}=worker(fetcher);
 expect(await (await navigate({},new Request('https://example.test/'))).text()).toBe('current-release');
 expect(fetcher.mock.calls[0][1].cache).toBe('no-store');expect(put).toHaveBeenCalledOnce();
});
it('retains the last working shell when offline',async()=>{
 const {navigate}=worker(async()=>{throw Error('offline');});expect(await (await navigate({},new Request('https://example.test/'))).text()).toBe('old-release');
});

it('does not discard a valid new release when browser storage is full',async()=>{
 const {navigate}=worker(async()=>new Response('current-release'),true);expect(await (await navigate({},new Request('https://example.test/'))).text()).toBe('current-release');
});
