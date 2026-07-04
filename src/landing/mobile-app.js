document.addEventListener('DOMContentLoaded',function(){
var btn=document.getElementById('connectWalletBtn');
var ws=document.getElementById('walletSection');
if(btn){btn.addEventListener('click',function(e){e.preventDefault();if(ws){ws.style.display=ws.style.display==='none'?'block':'none'}})}
var btns=document.querySelectorAll('.wallet-btn');
btns.forEach(function(b){b.addEventListener('click',function(){
var w=this.getAttribute('data-wallet');
var u={phantom:'https://phantom.app/ul/browse/https://kjtirbnxxymeumycrhqv.supabase.co',backpack:'https://backpack.app/earn/ai-growth-engine',solflare:'https://solflare.com/ul/browse/ai-growth-engine'};
window.location.href=u[w]||'https://phantom.app/ul/browse/'+encodeURIComponent(window.location.href)})})
var items=document.querySelectorAll('.bounty-item');
items.forEach(function(i){i.addEventListener('click',function(){var n=this.getAttribute('data-issue');if(n){window.open('https://github.com/Nexussyn/ai-growth-engine/issues/'+n,'_blank')}})})
})