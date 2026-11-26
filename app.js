'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  frames:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 3v18m0-9h11"/>',
  book:'<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1zM12 6v14"/>',
  bookmark:'<path d="M6 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 .7c0 2-2.5 2.2-2.5 4M12 17h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bulb:'<path d="M9 17c0-3-3-3.8-3-7a6 6 0 1 1 12 0c0 3.2-3 4-3 7zM9.5 20h5M11 22h2"/>',
  shuffle:'<path d="M3 6h3c4 0 7.5 12 12 12h3m-3-3 3 3-3 3M3 18h3c1.6 0 3.3-2.1 4.7-4.5M13.4 9C15.1 6.8 16.1 6 18 6h3m-3-3 3 3-3 3"/>',
  next:'<path d="m9 5 7 7-7 7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',check:'<path d="m4 12 5 5L20 6"/>',
  cards:'<rect x="7" y="6" width="13" height="15" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h9"/>'
};
function icon(name){return '<svg aria-hidden="true" class="ico" viewBox="0 0 24 24">'+(paths[name]||'')+'</svg>'}
document.querySelectorAll('[data-icon]').forEach(el => el.outerHTML=icon(el.dataset.icon));
const geo={
 '⿰':['Слева направо','Слева','Справа'],'⿱':['Сверху вниз','Сверху','Снизу'],'⿲':['Три части в ряд','Слева','В центре','Справа'],'⿳':['Три части по вертикали','Сверху','В центре','Снизу'],'⿴':['Полный охват','Снаружи','Внутри'],'⿵':['Охват сверху','Снаружи','Внутри'],'⿶':['Охват снизу','Снаружи','Внутри'],'⿷':['Охват слева','Снаружи','Внутри'],'⿸':['Охват слева сверху','Снаружи','Внутри'],'⿹':['Охват справа сверху','Снаружи','Внутри'],'⿺':['Охват слева снизу','Снаружи','Внутри'],'⿻':['Наложение','Первый элемент','Второй элемент'],'⿼':['Охват справа','Снаружи','Внутри'],'⿽':['Охват справа снизу','Снаружи','Внутри'],'⿾':['Отражение','Основа'],'⿿':['Поворот','Основа'],'㇯':['Вычитание черт','Основа','Без элемента']
};
const tips={明:'Представьте солнце и луну рядом. Оба светила помогают вспомнить значение «светлый».',好:'Запомните пару 女 и 子 как женщину с ребёнком. Вместе они образуют знак 好 — «хороший».',森:'Найдите все три дерева 木. Вместе их легко представить густым лесом.',林:'Два дерева 木 рядом образуют рощу 林.',休:'Представьте человека 亻, который прислонился к дереву 木, чтобы отдохнуть.',晶:'Найдите три солнца 日 и представьте, как сверкает кристалл.',妈:'Слева 女 — женщина, справа 马 (mǎ) напоминает о звучании mā. Обратите внимание на разницу в тоне.',安:'Представьте спокойный дом: под крышей 宀 находится 女.',从:'Один человек 人 идёт за другим. Так легко запомнить «следовать».',品:'Три одинаковых 口 образуют треугольник. Попробуйте восстановить их расположение по памяти.'};
const baseNotes=new Set(Array.from('一丨丶丿乙亅人亻火灬水氵口女心忄木日月田山手扌目石禾子金土马耳竹刂辶鱼鸟艹宀门'));
const examples=['好休森林','妈想晶安','清品从明','问体朋男'];
let sequencePage=0;
let examplePage=0, sequence=['明'], trail=['明'], active='明', inputCommitted=false, noticeTimer, graphicEpoch=0;
const inkLoads=new Map();window.INK={};
function info(c){
 const core=window.CORE[c],ext=window.EXTENDED?.[c];
 const fallbackIds=ext?.[2]||'';
 const useExt=(!core?.[2]||core[2].includes('？')) && fallbackIds && !fallbackIds.includes('？') && fallbackIds!==c;
 const ids=useExt?fallbackIds:(core?.[2]||fallbackIds);
 return {known:!!(core||ext),pinyin:core?.[0]||ext?.[0]||'',meaning:core?.[1]||ext?.[1]||'',ids,radical:core?.[3]||ext?.[3]||'',strokes:core?.[4]||ext?.[4]||0,english:!(core?.[5])&&!!(core?.[1]||ext?.[1]),inkMatches:!!core&&!useExt};
}
function parseIds(ids){
 const tokens=Array.from(ids||'');let cursor=0;
 function read(path,where){
  const c=tokens[cursor++];if(!c||path.length>32)return null;
  const op=geo[c];if(!op)return [{c,path:path.join('.'),where:where.join(' · ')}];
  const parts=[];for(let i=1;i<op.length;i++){const child=read([...path,i-1],[...where,op[i]]);if(!child)return null;parts.push(...child)}return parts;
 }
 const out=read([],[]);return cursor===tokens.length&&out?out:[];
}
function shortReading(c){return info(c).pinyin.split(',')[0]}
function caption(d){return (d.meaning||'Значение не указано')+(d.english?' · англ.':'')}
function han(c){return !!window.EXTENDED?.[c]||!!window.CORE[c]||/\p{Script=Han}/u.test(c)}
function inkMarkup(c){
 const g=window.INK[c];if(!g)return '<span class="glyph-fallback" lang="zh-Hans">'+esc(c)+'</span>';
 return '<svg class="ink-glyph" role="img" aria-label="'+esc(c)+'" viewBox="-30 -30 1084 1084"><g transform="scale(1,-1) translate(0,-900)">'+g[0].map((p,i)=>'<path fill="#f4f1d9" data-match="'+esc(g[1][i])+'" d="'+esc(p)+'"/>').join('')+'</g></svg>';
}
function loadInk(c){if(!window.CORE[c])return;const id=c.codePointAt(0)>>8;
 if(!inkLoads.has(id))inkLoads.set(id,new Promise(resolve=>{const script=document.createElement('script');script.src='ink-'+(id>>3)+'.js';script.onload=()=>resolve(true);script.onerror=()=>resolve(false);document.head.append(script)}));
 return inkLoads.get(id);
}
function highlight(path){const nodes=document.querySelectorAll('#art path');for(const el of nodes)el.setAttribute('fill',path==null?'#f4f1d9':el.dataset.match===path?'#ffdd9f':'#8ba49a')}
function notify(message){$('#notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').textContent='',2600)}
function updateSave(){
 const saved=window.Study?.isSaved(active);$('#save').innerHTML=icon(saved?'check':'bookmark')+'<span>'+(saved?'В словаре':'В словарь')+'</span>';$('#save').setAttribute('aria-pressed',String(!!saved));$('#save').disabled=!info(active).known;$('#saved-count').textContent=window.Study?.count()||'';
}
function renderChar(){
 const d=info(active);const myEpoch=++graphicEpoch;
 $('#trail').innerHTML=trail.length<2?'':'<div class="crumb-wrap">Путь разбора '+trail.map((c,i)=>'<button class="crumb" data-back="'+i+'" '+(i===trail.length-1?'disabled':'')+'>'+esc(c)+'</button>').join(' › ')+'</div>';
 $('#specimen').innerHTML='<div class="spec-meta"><span>Иероглиф</span><span>'+(d.strokes?d.strokes+' '+plural(d.strokes,['черта','черты','черт']):'U+'+active.codePointAt(0).toString(16).toUpperCase())+'</span></div><div class="grid-paper" id="art">'+inkMarkup(active)+'</div><div class="reading">'+esc(d.pinyin||'Чтение не указано')+'</div><div class="spec-meaning '+(caption(d).length>26?'long':'')+'">'+esc(caption(d))+'</div>';
 if(!window.INK[active]&&window.CORE[active])loadInk(active)?.then(ok=>{if(ok&&myEpoch===graphicEpoch)$('#art').innerHTML=inkMarkup(active)});
 const operator=Array.from(d.ids||'')[0];const layout=geo[operator];const parts=d.ids&&d.ids!==active&&d.ids!=='？'?parseIds(d.ids):[];
 $('#parts').innerHTML='<div class="parts-title"><h3>Графемы</h3>'+(layout?'<span class="layout-label"><b>'+operator+'</b>'+layout[0]+'</span>':'')+'</div>';
 if(!parts.length){
  $('#parts').insertAdjacentHTML('beforeend','<p class="empty-part">'+(!d.known?'Этого знака пока нет в словаре.':baseNotes.has(active)||d.ids===active?'В этом разборе знак используется как самостоятельная графема.':'Для этого знака в источниках пока нет разбора на части.')+'</p>');
 }else{
  const list=document.createElement('div');list.className='part-list';
  parts.forEach(part=>{
   const unknown=['？','?','〓','�'].includes(part.c),partInfo=info(part.c);
   const b=document.createElement('button');b.type='button';b.className='part-row';const enabled=!unknown&&partInfo.known&&!trail.includes(part.c);
   b.setAttribute('aria-disabled',String(!enabled));if(!enabled)b.tabIndex=-1;
   b.innerHTML='<span class="part-glyph" lang="zh-Hans">'+esc(unknown?'?':part.c)+'</span><span class="part-text"><strong>'+esc(unknown?'Неизвестная часть':partInfo.meaning?caption(partInfo):'Графический компонент')+'</strong><small>'+esc(unknown?'Часть не распознана':partInfo.pinyin||'Чтение не указано')+'</small></span><span class="part-pos">'+esc(part.where)+'</span>'+(enabled?icon('next'):'');
   if(d.inkMatches){b.onpointerenter=b.onfocus=()=>highlight(part.path);b.onpointerleave=b.onblur=()=>highlight(null)}
   if(enabled)b.onclick=()=>{trail.push(part.c);active=part.c;renderChar()};list.append(b);
  });$('#parts').append(list);
 }
 const familiar=tips[active], note=familiar||(parts.length?'Посмотрите на части, затем закройте знак рукой и попробуйте восстановить их расположение.':d.radical?'Словарный ключ этого знака — '+d.radical+'. Попробуйте узнать его в других иероглифах.':'');
 $('#hint').innerHTML=note?'<div class="tip">'+icon('bulb')+'<div><strong>'+(familiar?'Как запомнить':'Для запоминания')+'</strong>'+esc(note)+'</div></div>':'';
 updateSave();renderSequence();
}
function plural(n,forms){return forms[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2]}
function renderSequence(){
 const wrap=$('#sequence');wrap.hidden=sequence.length<=1&&!inputCommitted;
 wrap.replaceChildren();if(wrap.hidden)return;
 const pageSize=16;const pages=Math.ceil(sequence.length/pageSize);
 if(pages>1){const pager=document.createElement('div');pager.className='seq-pager';
 for(const [text,label,step] of [['‹','Предыдущие знаки',-1],['›','Следующие знаки',1]]){
  const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);
  b.disabled=sequencePage+step<0||sequencePage+step>=pages;
  b.onclick=()=>{sequencePage+=step;renderSequence()};pager.append(b);
  if(step===-1){const pos=document.createElement('span');pos.textContent=(sequencePage+1)+' / '+pages;pager.append(pos)}
 }wrap.append(pager)}
 for(const c of sequence.slice(sequencePage*pageSize,(sequencePage+1)*pageSize)){let b=document.createElement('button');b.className='seq-char'+(c===trail[0]?' active':'');b.textContent=c;b.setAttribute('aria-pressed',String(c===trail[0]));b.onclick=()=>{active=c;trail=[c];renderChar()};wrap.append(b)}
 const eligible=sequence.filter(c=>info(c).known);
 if(eligible.length){const b=document.createElement('button');b.className='make-set';b.innerHTML=icon('cards')+'Создать занятие';b.onclick=()=>{location.hash='study';route();window.Study.createSet(eligible,$('#study-root'))};wrap.append(b)}
}
function openChar(c){
 const chars=[...new Set(Array.from(c).filter(han))];if(!chars.length)return;
 sequencePage=0;sequence=chars;active=chars[0];trail=[active];inputCommitted=true;$('#entry').value=c;$('#input-error').hidden=true;location.hash='parse';route();renderChar();
}
function renderExamples(){
 $('#examples').innerHTML=Array.from(examples[examplePage]).map(c=>'<button class="ex-card" data-example="'+c+'"><span class="ex-glyph" lang="zh-Hans">'+c+'</span><span class="ex-info"><strong>'+esc(shortReading(c))+'</strong><small>'+esc(info(c).meaning)+'</small></span></button>').join('');
}
let currentRoute='';
function route(){
 const hash=location.hash.slice(1);const view=['study','library'].includes(hash)?hash:'parse';
 if(currentRoute===view)return;currentRoute=view;$('#workspace').hidden=view!=='parse';$('#study-root').hidden=view==='parse';
 document.querySelectorAll('nav [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 if(view==='study')window.Study.render($('#study-root'));if(view==='library')window.Study.renderLibrary($('#study-root'));if(view==='parse')updateSave();
 window.scrollTo(0,0);
}
$('#search').onsubmit=e=>{e.preventDefault();if(!Array.from($('#entry').value).some(han)){const el=$('#input-error');el.textContent='Введите хотя бы один китайский иероглиф, например 明 или 你好.';el.hidden=false;$('#entry').focus();return}openChar($('#entry').value)};
$('#entry').oninput=()=>$('#input-error').hidden=true;
$('#trail').onclick=e=>{const b=e.target.closest('[data-back]');if(b){trail=trail.slice(0,Number(b.dataset.back)+1);active=trail.at(-1);renderChar()}};
$('#examples').onclick=e=>{const b=e.target.closest('[data-example]');if(b)openChar(b.dataset.example)};
$('#shuffle').onclick=()=>{examplePage=(examplePage+1)%examples.length;renderExamples()};
$('#save').onclick=()=>{window.Study.toggle(active);updateSave()};
function dialog(title,body){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog').showModal()}
$('#help').onclick=()=>dialog('Как пользоваться','<p><b>Разбор.</b> Введите знак или фразу, например 明天, и нажмите «Разобрать». Выберите иероглиф, затем нажмите на его графему, чтобы исследовать её состав.</p><p><b>Свой материал.</b> Кнопка «В словарь» сохраняет знак. «Создать занятие» собирает карточки из введённых иероглифов.</p><p><b>Обучение.</b> Выберите готовый урок, вспомните ответ и оцените себя. Расписание повторений и прогресс сохраняются в этом браузере.</p>');
$('#sources').onclick=()=>dialog('Источники и данные','<p><a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me a Hanzi</a> — структуры знаков, чтения и контуры черт. <a href="LGPL.txt">LGPL</a> и <a href="Arphic.txt">Arphic Public License</a>.</p><p>Расширенная база редких знаков и региональных вариантов описана в <a href="SOURCES.txt">сведениях об источниках</a>. Для части редких знаков доступны только форма, ключ или число черт. Их отображение зависит от шрифтов устройства.</p><p>Русские значения частотной лексики адаптированы из <a href="https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian" target="_blank" rel="noopener">Zitou (zitou.app)</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Для части знаков сохранены английские определения. Чтения даны для отдельных знаков и могут меняться в словах.</p><p>У каждого учебного занятия есть ссылка на оригинал. Прогресс относится к словам в подобранном уроке.</p><p>Фрагмент пейзажа <a href="https://www.clevelandart.org/art/1955.37.8" target="_blank" rel="noopener">из коллекции Cleveland Museum of Art</a>, CC0.</p>');
$('#close').onclick=()=>$('#dialog').close();$('#dialog').onclick=e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#dialog').close()}};
window.HanziApp={openChar,info,notify};window.addEventListener('hashchange',route);window.addEventListener('hanzi-saved',updateSave);renderExamples();renderChar();route();
