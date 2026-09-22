import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

test('actual edge adapter rejects failed inserts and skips unfinished bounties', async () => {
  let handler, generated=0, inserted=0, status='done', insertError={message:'db secret'}, providerOk=true;
  const answers=['A tweet','One\n---\nTwo\n---\nThree\n---\nFour\n---\nFive',Array(300).fill('word').join(' ')];
  const db={from(table){
    if(table==='bounty_executions') return {select(){return this;},eq(){return this;},async maybeSingle(){return {
      data:{title:'Fix retries',description:'Bound retries after transient failure',execution_status:status},error:null};}};
    if(table==='outreach_sent') return {async insert(){inserted++;return {error:insertError};}};
    throw new Error('Unexpected table');
  }};
  const context=vm.createContext({Response,Request,console,Deno:{
    env:{get(key){return key==='GROQ_API_KEY'?'test-only-placeholder':key==='GROQ_MODEL'?'mock-model':'';}},serve(fn){handler=fn;}
  },fetch:async () => {const value=answers[generated++ % 3];return {ok:providerOk,json:async()=>({choices:[{message:{content:value}}]})};}});
  const root=new URL('../src/agents/',import.meta.url);
  const core=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('content-core.ts',root),'utf8')),{context});
  const adapter=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('content-agent.ts',root),'utf8')),{context});
  const supabase=new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db);},{context});
  await adapter.link(spec=>spec==='./content-core.ts'?core:supabase);
  await adapter.evaluate();
  const request=()=>new Request('https://local.invalid/',{method:'POST',body:JSON.stringify({bounty_id:'test'})});
  let response=await handler(request());
  assert.equal(response.status,500); assert.equal(inserted,1);
  assert.ok(!(await response.text()).includes('db secret'));
  status='running'; generated=0; inserted=0;
  response=await handler(request());
  assert.equal(response.status,500); assert.equal(generated,0); assert.equal(inserted,0);
  status='done'; insertError=null;
  response=await handler(request()); assert.equal(response.status,200);
  const result=await response.json(); assert.equal(result.ok,true);assert.equal(result.content.thread.length,5);
  providerOk=false;inserted=0;
  response=await handler(request());assert.equal(response.status,500);assert.equal(inserted,0);
});

