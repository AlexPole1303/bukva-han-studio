/* Local study journal and flashcards. No external services. */
(() => {
  'use strict';
  const STORAGE = 'bukva-han.study.v1';
  const DAY = 86400000;
  const app = () => window.HanziApp || {};
  const courses = () => Array.isArray(window.COURSES) ? window.COURSES : [];
  const han = /\p{Script=Han}/u;
  function isHanzi(char) { return han.test(char) || Boolean(app().info?.(char)?.known); }
  const layoutNames = {'⿰':'Слева направо','⿱':'Сверху вниз','⿲':'Три части в ряд','⿳':'Три части по вертикали',
    '⿴':'Полный охват','⿵':'Охват сверху','⿶':'Охват снизу','⿷':'Охват слева','⿸':'Охват слева сверху',
    '⿹':'Охват справа сверху','⿺':'Охват слева снизу','⿻':'Наложение','⿼':'Охват справа','⿽':'Охват справа снизу',
    '⿾':'Отражение','⿿':'Поворот','㇯':'Вычитание черт'};
  function composition(char) {
    if ([...char].length !== 1) return null;
    const ids = app().info?.(char)?.ids;
    if (!ids) return null;
    const tokens=[...ids];
    if (!layoutNames[tokens[0]]) return null;
    const parts=tokens.filter(t => !layoutNames[t]);
    if (!parts.some(part => !['？','?','〓','�'].includes(part))) return null;
    return {layout:layoutNames[tokens[0]],parts,ids};
  }
  let memory = {saved: [], reviews: {}, days: {}, active: null};
  let view = null;
  let container = null;
  let storageUnavailable = false;

  function state() {
    if (storageUnavailable) return memory;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj.saved) && obj.reviews && obj.days) memory = obj;
      }
    } catch { /* Use the journal kept in this tab if storage is unavailable. */ }
    return memory;
  }
  function persist(data) {
    memory = data;
    try { localStorage.setItem(STORAGE, JSON.stringify(data)); }
    catch {
      if (!storageUnavailable) app().notify?.('Браузер не разрешил сохранение. Прогресс доступен до закрытия вкладки.');
      storageUnavailable = true;
    }
  }
  function dayKey(at = new Date()) {
    return [at.getFullYear(), at.getMonth() + 1, at.getDate()].join('-');
  }
  function wordKey(word) {
    return word.hanzi + '|' + (word.pinyin || '').normalize('NFC').toLowerCase().replace(/[\s'’·]/g, '') + (word.mode === 'ids' ? '|ids' : '');
  }
  function uniqueWords(list) {
    return [...new Map(list.filter(w => w?.hanzi).map(w => [wordKey(w), w])).values()];
  }
  function localWord(char) {
    const info = app().info?.(char) || {};
    return {hanzi: char, pinyin: info.pinyin || '', ru: info.meaning || ''};
  }
  function isSaved(char) { return state().saved.includes(char); }
  function toggle(char) {
    if (typeof char !== 'string' || [...char].length !== 1 || !isHanzi(char)) return false;
    const data = state(), add = !data.saved.includes(char);
    data.saved = add ? [char, ...data.saved] : data.saved.filter(c => c !== char);
    persist(data);
    window.dispatchEvent(new Event('hanzi-saved'));
    return add;
  }
  function count() { return state().saved.length; }
  function plural(n, forms) {
    const t = Math.abs(n) % 100, unit = t % 10;
    return n + ' ' + forms[t > 10 && t < 20 ? 2 : unit === 1 ? 0 : unit > 1 && unit < 5 ? 1 : 2];
  }
  const wordCount = n => plural(n, ['слово','слова','слов']);
  const cardCount = n => plural(n, ['карточка','карточки','карточек']);
  const dayCount = n => plural(n, ['день','дня','дней']);
  function progress(words, data) {
    const items = uniqueWords(words);
    const learned = items.filter(w => data.reviews[wordKey(w)]?.learned).length;
    return {learned, total: items.length};
  }
  function streak(days) {
    const date = new Date();
    if (!days[dayKey(date)]) date.setDate(date.getDate() - 1);
    let n = 0;
    while (days[dayKey(date)]) {
      n++;
      date.setDate(date.getDate() - 1);
    }
    return n;
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, cls, action) {
    const btn = el('button', 'hz-btn ' + cls, label);
    btn.type = 'button';
    btn.addEventListener('click', action);
    return btn;
  }
  function icon(name) {
    const paths = {
      book: ['M4 5v14c3-1 5-1 8 1 3-2 5-2 8-1V5c-3-1-5-1-8 1-3-2-5-2-8-1Z','M12 6v14'],
      cards: ['M9 5h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z','M4 17V5a3 3 0 0 1 3-3h8'],
      bookmark: ['M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z'],
      check: ['m5 12 4 4L19 6'],
      back: ['m14 6-6 6 6 6'],
      next: ['m9 6 6 6-6 6'],
      close: ['m6 6 12 12','m18 6L6 18'],
      time: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z','M12 7v5l3 2']
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('class','hz-icon');
    for (const d of paths[name] || []) {
      const p = document.createElementNS(svg.namespaceURI, 'path');
      p.setAttribute('d', d); svg.append(p);
    }
    return svg;
  }
  function iconButton(label, name, cls, action) {
    const btn = button(label, cls, action);
    btn.prepend(icon(name)); return btn;
  }
  function title(text, description) {
    const box = el('header','hz-heading');
    box.append(el('h1','', text));
    if (description) box.append(el('p','',description));
    return box;
  }
  function sourceLink(url, label) {
    const a = el('a','hz-link',label);
    try {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
    } catch { /* Show plain source label. */ }
    return a;
  }
  function sectionHeading(label) { return el('h2','hz-section-title',label); }
  function meter(p, label) {
    const box = el('div','hz-meter');
    const value = el('progress');
    value.max = Math.max(1, p.total); value.value = p.learned;
    value.setAttribute('aria-label', label);
    box.append(value, el('span','', p.learned + ' из ' + p.total));
    return box;
  }
  function open(next, focus = true) {
    view = next;
    draw();
    if (focus && container) {
      const heading = container.querySelector('.hz-study h1');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      container.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
  function navBack(label, dest) {
    return iconButton(label, 'back', 'hz-back', () => open(dest));
  }
  function start(words, label, origin, type) {
    const data = state();
    const queue = uniqueWords(words).map(w => ({hanzi:w.hanzi, pinyin:w.pinyin || '', ru:w.ru || '', mode:w.mode || 'lex'}));
    if (!queue.length) return;
    data.active = {id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
      type, label, origin, queue, index:0, known:0, reveal:false};
    persist(data); open({screen:'cards'});
  }
  function dueWords(data, now = Date.now()) {
    const setWords = new Set((data.sets || []).flatMap(set => set.words.map(wordKey)));
    return Object.values(data.reviews).filter(r => r.word && r.due <= now &&
      (r.fromLesson || r.fromPreset || data.saved.includes(r.word.hanzi) || setWords.has(wordKey({...r.word,mode:'lex'}))))
      .sort((a,b) => a.due-b.due).map(r => r.word);
  }
  function tomorrow(days) {
    const at = new Date(); at.setDate(at.getDate() + days); at.setHours(0,0,0,0);
    return at.getTime();
  }
  function schedule(previous, grade) {
    const today = dayKey();
    const record = {...previous};
    if (grade === 'again') {
      record.interval = 0; record.due = Date.now() + 10 * 60000;
    } else if (grade === 'hard') {
      record.interval = 1; record.due = tomorrow(1);
    } else {
      const previousDays = record.interval || 0;
      const alreadyScheduled = record.lastAdvance === today && previousDays > 0;
      record.interval = alreadyScheduled ? previousDays : Math.min(120, previousDays ? Math.max(3, Math.round(previousDays * 2.3)) : 1);
      record.lastAdvance = today;
      record.due = tomorrow(record.interval);
      record.learned = true;
    }
    return record;
  }
  function gradeCard(id,index,grade) {
    const data = state(), a = data.active;
    if (!a || a.id !== id || a.index !== index || !a.reveal) { draw(); return; }
    const word = a.queue[index], key = wordKey(word);
    const r = schedule(data.reviews[key], grade);
    r.word = word;
    r.fromLesson = r.fromLesson || a.type === 'lesson';
    r.fromPreset = r.fromPreset || a.type === 'preset';
    r.reviews = (r.reviews || 0) + 1;
    data.reviews[key] = r;
    const today = dayKey();
    data.days[today] = (data.days[today] || 0) + 1;
    a.index++;
    a.known += Number(grade === 'good');
    a.reveal = false;
    if (a.index === a.queue.length) {
      const result = {screen:'result',known:a.known,total:a.queue.length,origin:a.origin,label:a.label};
      data.active = null; persist(data); open(result);
    } else {
      persist(data); draw();
      container?.querySelector('.hz-flip')?.focus({preventScroll:true});
    }
  }
  function stat(value, name) {
    const box = el('div','hz-stat'); box.append(el('strong','',value),el('span','',name));return box;
  }
  function actionBox(name, heading, description, btn) {
    const box = el('div','hz-action');
    const mark = el('span','hz-action-icon'); mark.append(icon(name));
    const text = el('div','hz-action-copy'); text.append(el('h3','',heading),el('p','',description));
    box.append(mark,text); if (btn) box.append(btn); return box;
  }
  function home(root, data) {
    const due = dueWords(data);
    root.append(title('Обучение','Учите слова по урокам и возвращайтесь к ним с помощью карточек.'));
    const stats = el('div','hz-stats');
    stats.append(stat(String(Object.values(data.reviews).filter(r => r.learned).length),'Карточек узнано'),
      stat(String(data.days[dayKey()] || 0),'Ответов сегодня'), stat(dayCount(streak(data.days)),'Серия занятий'));
    root.append(stats);
    if (data.active) {
      root.append(actionBox('cards','Незавершённое занятие',data.active.label + ' · карточка ' + (data.active.index+1) + ' из ' + data.active.queue.length,
        button('Продолжить','hz-primary',() => open({screen:'cards'}))));
    }
    root.append(actionBox('time',due.length ? 'Пора повторить' : 'Повторение по расписанию',
      due.length ? cardCount(due.length) + ' к повторению' : (Object.keys(data.reviews).length ? 'Пока всё повторено. Новые занятия доступны ниже.' : 'После первого занятия здесь появятся карточки для повторения.'),
      due.length ? button('Повторить','hz-primary',() => start(due,'Повторение',{screen:'home'},'due')) : null));
    root.append(sectionHeading('Учебники'));
    const deck = el('div','hz-courses');
    for (const c of courses()) {
      const p = progress(c.lessons.flatMap(l => l.words),data);
      const b = el('article','hz-course');
      const meta = el('div','hz-course-meta'); meta.append(icon('book'), el('span','',plural(c.lessons.length,['урок','урока','уроков']) + ' · ' + wordCount(p.total)));
      const name = el('h3','',c.title);
      const desc = el('p','',c.description);
      b.append(meta,name,desc,meter(p,'Прогресс по учебнику'),button('К урокам','hz-secondary',() => open({screen:'course',courseId:c.id})));
      deck.append(b);
    }
    root.append(deck);
    setsSection(root,data);
  }
  const presets = [
    {id:'nature',title:'Природа',words:[
      ['日','rì','солнце, день'],['月','yuè','луна, месяц'],['山','shān','гора'],['水','shuǐ','вода'],
      ['木','mù','дерево'],['火','huǒ','огонь'],['土','tǔ','земля, почва'],['林','lín','лес']]},
    {id:'body',title:'Человек',words:[
      ['人','rén','человек'],['口','kǒu','рот'],['手','shǒu','рука'],['目','mù','глаз'],
      ['耳','ěr','ухо'],['心','xīn','сердце'],['头','tóu','голова'],['足','zú','стопа']]},
    {id:'numbers',title:'Числа до десяти',words:[
      ['一','yī','один'],['二','èr','два'],['三','sān','три'],['四','sì','четыре'],['五','wǔ','пять'],
      ['六','liù','шесть'],['七','qī','семь'],['八','bā','восемь'],['九','jiǔ','девять'],['十','shí','десять']]}
  ].map(set => ({...set, words: set.words.map(([hanzi,pinyin,ru]) => ({hanzi,pinyin,ru}))}));
  function extractChars(input) {
    return [...new Set([...String(Array.isArray(input) ? input.join('') : input || '')].filter(c => isHanzi(c)))];
  }
  function setsSection(root,data) {
    const top = el('div','hz-section-bar');
    top.append(sectionHeading('Свои наборы'),button('Создать набор','hz-secondary',() => open({screen:'editSet'})));
    root.append(top);
    if (data.sets?.length) root.append(setRows(data.sets,false,data));
    else root.append(el('p','hz-empty-hint','Соберите карточки из иероглифов, которые встречаете в текстах или на занятиях.'));
    root.append(sectionHeading('Тематические подборки'),setRows(presets,true,data));
  }
  function setRows(sets,preset,data) {
    const list = el('div','hz-lessons');
    for (const set of sets) {
      const b = button('','hz-lesson-row',() => open({screen:'set',id:set.id,preset}));
      const mark = el('span','hz-set-mark',set.words[0]?.hanzi || '字'); mark.lang='zh-Hans';
      const text = el('span','hz-lesson-copy');
      const p = progress(set.words,data);
      text.append(el('strong','',set.title),el('small','',cardCount(p.total) + (p.learned ? ' · узнано ' + p.learned : '')));
      b.append(mark,text,icon('next'));list.append(b);
    }
    return list;
  }
  function available(w) {
    return Boolean(w.pinyin || w.ru);
  }
  function setScreen(root,data) {
    const set = (view.preset ? presets : data.sets || []).find(s => s.id === view.id);
    if (!set) { view={screen:'home'};home(root,data);return; }
    const origin={...view};
    root.append(navBack('К обучению',{screen:'home'}),title(set.title,cardCount(set.words.length)));
    if (data.active?.origin?.screen === 'set' && data.active.origin.id === set.id) {
      root.append(actionBox('cards','Незавершённое занятие','Карточка ' + (data.active.index+1) + ' из ' + data.active.queue.length,
        button('Продолжить','hz-primary',() => open({screen:'cards'}))));
    }
    const bar = el('div','hz-toolbar');
    const type=view.preset ? 'preset' : 'set';
    const ready=set.words.filter(available);
    const structural=set.words.filter(w => composition(w.hanzi));
    if (ready.length) bar.append(iconButton('Учить по карточкам','cards','hz-primary',() => start(ready,set.title,origin,type)));
    if (structural.length) bar.append(button('Назвать графемы','hz-secondary',() => start(structural.map(w => ({...w,mode:'ids'})),set.title,origin,type)));
    if (!view.preset) {
      bar.append(button('Изменить набор','hz-secondary',() => open({screen:'editSet',id:set.id})));
    }
    root.append(bar);
    if (ready.length !== set.words.length) root.append(el('p','hz-empty-hint',
      'Знаки без чтения и перевода пропускаются в карточках на значение. Если известен состав, они доступны в тренировке графем.'));
    const list = el('div','hz-wordlist');
    let rendered=0;
    const more=button('Показать ещё','hz-secondary hz-more',() => next());
    function next() {
      const part=set.words.slice(rendered,rendered+100);
      for (const word of part) {
        const row=el('div','hz-wordrow');
        const main=el('div','hz-word-main');
        const glyph=button(word.hanzi,'hz-glyph',() => app().openChar?.(word.hanzi));
        glyph.lang='zh-Hans';glyph.setAttribute('aria-label','Разобрать ' + word.hanzi);
        main.append(glyph,el('span','hz-pinyin',word.pinyin));
        row.append(main,el('span','hz-word-meaning',word.ru || (word.pinyin ? 'Перевод пока отсутствует':'Нет чтения и перевода')));
        list.append(row);
      }
      rendered+=part.length;
      if (rendered>=set.words.length) more.hidden=true;
    }
    next();root.append(list,more);
  }
  function setEditor(root,data) {
    const existing = (data.sets || []).find(s => s.id === view.id);
    const back = existing ? {screen:'set',id:existing.id} : {screen:'home'};
    root.append(navBack(existing ? 'К набору' : 'К обучению',back),
      title(existing ? 'Изменить набор' : 'Свой набор','Вставьте иероглифы или фразу. Каждый уникальный знак станет отдельной карточкой.'));
    const form = el('form','hz-edit-form');
    const name = el('input');name.type='text';name.maxLength=100;name.value=existing?.title || '';name.placeholder='Например, слова к экзамену';
    const input=el('textarea');input.rows=3;input.value=existing?.words.map(w => w.hanzi).join('') || view.chars || ''; input.placeholder='你好明天';
    const nameLabel=el('label','','Название набора'), glyphLabel=el('label','','Иероглифы');
    nameLabel.append(name);glyphLabel.append(input);
    const detail=el('div','hz-form-count');
    const updateCount=()=> {detail.textContent=cardCount(extractChars(input.value).length);};
    updateCount();input.addEventListener('input',updateCount);
    const error=el('p','hz-form-error');error.setAttribute('role','alert');
    const save=el('button','hz-btn hz-primary','Сохранить набор');save.type='submit';
    const actions=el('div','hz-toolbar');actions.append(save);
    if (existing) {
      actions.append(button('Удалить набор','hz-back',() => {
        const fresh=state();
        if (!window.confirm('Удалить набор «' + existing.title + '»? История ответов сохранится.')) return;
        fresh.sets=(fresh.sets || []).filter(s => s.id !== existing.id);
        if (fresh.active?.origin?.id === existing.id) fresh.active=null;
        persist(fresh);open({screen:'home'});
      }));
    }
    form.append(nameLabel,glyphLabel,detail,error,actions);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (save.disabled) return;
      const chars=extractChars(input.value), title=name.value.trim() || (chars.length ? chars.slice(0,6).join('') + (chars.length>6 ? '…':'') : '');
      if (!chars.length) {error.textContent='Введите хотя бы один иероглиф.';input.focus();return;}
      const signature=chars.slice().sort().join('');
      const duplicate=(state().sets || []).find(s => s.id !== existing?.id && s.words.map(w => w.hanzi).sort().join('') === signature);
      if (duplicate) {
        error.replaceChildren(document.createTextNode('Такой набор уже существует. '),button('Открыть «' + duplicate.title + '»','hz-back',() => open({screen:'set',id:duplicate.id})));return;
      }
      save.disabled=true;save.textContent='Сохранение…';
      const words=[];
      for (let i=0;i<chars.length;i+=48) {
        const group=await Promise.all(chars.slice(i,i+48).map(async char => {
          if (!app().infoAsync) return localWord(char);
          try {
            const info=await app().infoAsync(char);
            return info ? {hanzi:char,pinyin:info.pinyin || '',ru:info.meaning || ''} : localWord(char);
          } catch { return localWord(char); }
        }));
        words.push(...group);
      }
      if (!form.isConnected) return;
      const fresh=state();fresh.sets=fresh.sets || [];
      const id=existing?.id || 'set-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const set={id,title,words};
      if (existing) fresh.sets=fresh.sets.map(s => s.id===id ? set:s);
      else fresh.sets.unshift(set);
      persist(fresh);open({screen:'set',id});
    });
    root.append(form);
  }
  function courseScreen(root,data,c) {
    root.append(navBack('К учебникам',{screen:'home'}),title(c.title,c.description));
    const source = el('div','hz-source');source.append(sourceLink(c.source,'Оригинал учебника'));
    if (c.author) source.append(el('span','',c.author));
    if (c.license) source.append(el('span','',c.license));
    root.append(source);
    const words = c.lessons.flatMap(l => l.words);
    const progressBox = el('div','hz-progress-box');
    progressBox.append(el('h2','','Слова учебника'),meter(progress(words,data),'Прогресс по учебнику'),
      el('p','','Слово засчитывается после первого ответа «Помню».'));
    root.append(progressBox,sectionHeading('Уроки'));
    const list = el('div','hz-lessons');
    c.lessons.forEach((l,index) => {
      const dest = {screen:'lesson',courseId:c.id,lesson:index};
      const b = button('','hz-lesson-row',() => open(dest));
      const p = progress(l.words,data);
      const mark = el('span','hz-lesson-icon');
      mark.append(icon(p.total && p.learned === p.total ? 'check':'book'));
      const text = el('span','hz-lesson-copy');
      text.append(el('strong','',l.title),el('small','', 'Узнано ' + p.learned + ' из ' + p.total));
      b.append(mark,text,icon('next')); list.append(b);
    });
    root.append(list);
  }
  function chipsFor(word) {
    const chips = el('div','hz-glyph-links');
    const chars = [...new Set([...word.hanzi].filter(c => isHanzi(c)))];
    for (const c of chars) {
      const b = button(c,'hz-glyph',() => app().openChar?.(c));
      b.lang = 'zh-Hans'; b.setAttribute('aria-label','Разобрать ' + c); chips.append(b);
    }
    return chips;
  }
  function lessonScreen(root,data,c,l) {
    const origin = {...view};
    root.append(navBack(c.title,{screen:'course',courseId:c.id}),title(l.title,wordCount(uniqueWords(l.words).length) + ' в уроке'));
    const toolbar = el('div','hz-toolbar');
    const words = uniqueWords(l.words), unseen = words.filter(w => !data.reviews[wordKey(w)]?.learned);
    toolbar.append(iconButton(unseen.length ? 'Учить слова' : 'Повторить урок','cards','hz-primary',
      () => start(unseen.length ? unseen : words,l.title,origin,'lesson')),sourceLink(l.source,'Открыть урок учебника'));
    root.append(toolbar);
    const list = el('div','hz-wordlist');
    for (const word of words) {
      const row = el('div','hz-wordrow');
      const info = el('div','hz-word-main'); const glyph = el('strong','hz-word-text',word.hanzi); glyph.lang = 'zh-Hans';
      info.append(glyph,el('span','hz-pinyin',word.pinyin));
      row.append(info,el('span','hz-word-meaning',word.ru));
      if (data.reviews[wordKey(word)]?.learned) {
        const flag = el('span','hz-known'); flag.setAttribute('aria-label','Слово узнано'); flag.title='Слово узнано'; flag.append(icon('check')); row.append(flag);
      }
      list.append(row);
    }
    root.append(list);
  }
  function cardsScreen(root,data) {
    const a = data.active;
    if (!a?.queue?.[a.index]) { view = {screen:'home'}; home(root,data); return; }
    const word = a.queue[a.index], comp = composition(word.hanzi), structural = word.mode === 'ids';
    root.append(navBack('Отложить занятие',a.origin),title(a.label,structural ? 'Назовите графемы и вспомните их расположение.' : 'Вспомните чтение и значение, затем проверьте себя.'));
    const track = el('div','hz-session-progress');
    track.append(el('span','','Карточка ' + (a.index+1) + ' из ' + a.queue.length));
    const pr = el('progress'); pr.max = a.queue.length; pr.value = a.index; pr.setAttribute('aria-label','Пройдено карточек');
    track.append(pr); root.append(track);
    const face = el('div','hz-card-face');
    const term = el('div','hz-card-term',word.hanzi); term.lang='zh-Hans';face.append(term);
    if (a.reveal) {
      if (!structural) face.append(el('div','hz-card-pinyin',word.pinyin || 'Чтение не указано'),el('div','hz-card-meaning',word.ru || 'Значение не указано'));
      if (comp) {
        const block=el('div','hz-components');
        if (comp.parts.length > 2 && [...comp.ids].slice(1).some(c => layoutNames[c])) {
          block.append(el('small','','Вложенная структура'),el('strong','',comp.ids));
        } else block.append(el('small','',comp.layout),el('strong','',comp.parts.join(' + ')));
        face.append(block);
      }
    } else {
      face.append(button('Показать ответ','hz-flip',() => {
        const d = state();
        if (d.active?.id === a.id && d.active.index === a.index) {d.active.reveal = true; persist(d);}
        draw();
        container?.querySelector('.hz-rates button')?.focus({preventScroll:true});
      }));
    }
    root.append(face);
    if (!a.reveal) return;
    const rates = el('div','hz-rates');
    const knownDays = schedule(data.reviews[wordKey(word)],'good').interval;
    for (const [id,label,time] of [['again','Ещё раз','через 10 минут'],['hard','Трудно','завтра'],['good','Помню',knownDays === 1 ? 'завтра':'через ' + dayCount(knownDays)]]) {
      const sessionId = a.id, index = a.index;
      const b = button('','hz-rate hz-rate-' + id,() => gradeCard(sessionId,index,id));
      b.append(el('strong','',label),el('small','',time)); rates.append(b);
    }
    root.append(rates);
    const glyphs = chipsFor(word);
    if (glyphs.childElementCount) {
      const row = el('div','hz-breakdown');row.append(el('span','','Разобрать знаки'),glyphs);root.append(row);
    }
  }
  function resultScreen(root) {
    const res = view;
    root.append(title('Занятие завершено',res.label));
    const box = el('div','hz-result'); const mark = el('span','hz-action-icon');mark.append(icon('check'));
    box.append(mark,el('h2','','Узнали ' + res.known + ' из ' + res.total),
      el('p','','Оценки сохранены. Следующее повторение каждого слова назначено по вашему ответу.'));
    const links = el('div','hz-toolbar');
    links.append(button('К обучению','hz-primary',()=>{
      if (location.hash === '#library') location.hash='study';
      open({screen:'home'});
    }));
    if (res.origin.screen === 'lesson') links.append(button('Вернуться к уроку','hz-secondary',()=>open(res.origin)));
    else if (res.origin.screen === 'library') links.append(button('В словарь','hz-secondary',()=>open(res.origin)));
    box.append(links); root.append(box);
  }
  function library(root,data) {
    root.append(title('Мой словарь','Сохранённые иероглифы для разбора и повторения.'));
    if (data.active?.type === 'library') root.append(actionBox('cards','Незавершённое занятие','Карточка ' + (data.active.index+1) + ' из ' + data.active.queue.length,
      button('Продолжить','hz-primary',() => open({screen:'cards'}))));
    if (!data.saved.length) {
      root.append(actionBox('bookmark','В словаре пока нет знаков','Откройте иероглиф в разборе и нажмите кнопку сохранения.',
        button('Разобрать 明','hz-secondary',() => app().openChar?.('明')))); return;
    }
    const words = data.saved.map(localWord);
    const ready=words.filter(available),structural=words.filter(w => composition(w.hanzi));
    const toolbar=el('div','hz-toolbar');
    toolbar.append(el('span','hz-meta',plural(words.length,['иероглиф','иероглифа','иероглифов'])));
    if (ready.length) toolbar.append(iconButton('Повторить по карточкам','cards','hz-primary', () => start(ready,'Мой словарь',{screen:'library'},'library')));
    if (structural.length) toolbar.append(button('Назвать графемы','hz-secondary',() => start(structural.map(w => ({...w,mode:'ids'})),'Мой словарь',{screen:'library'},'library')));
    root.append(toolbar);
    const list = el('div','hz-library-list');
    for (const w of words) {
      const row = el('article','hz-library-item');
      const b = button('','hz-library-open',() => app().openChar?.(w.hanzi));
      const glyph = el('span','hz-library-char',w.hanzi);glyph.lang='zh-Hans';
      const text = el('span','hz-library-copy'); text.append(el('strong','',w.pinyin || w.hanzi),el('span','',w.ru || 'Открыть разбор'));
      b.append(glyph,text);
      const remove = iconButton('','close','hz-remove',() => { toggle(w.hanzi); draw(); app().notify?.('Иероглиф удалён из словаря'); });
      remove.setAttribute('aria-label','Убрать ' + w.hanzi + ' из словаря');remove.title='Убрать из словаря';
      row.append(b,remove);list.append(row);
    }
    root.append(list);
  }
  function draw() {
    if (!container || !view) return;
    const root = el('div','hz-study');
    const data = state(), c = courses().find(c => c.id === view.courseId);
    switch (view.screen) {
      case 'cards': cardsScreen(root,data); break;
      case 'editSet': setEditor(root,data); break;
      case 'set': setScreen(root,data); break;
      case 'result': resultScreen(root); break;
      case 'library': library(root,data); break;
      case 'course': if (c) {courseScreen(root,data,c);break;} home(root,data);break;
      case 'lesson': if (c?.lessons[view.lesson]) {lessonScreen(root,data,c,c.lessons[view.lesson]);break;} home(root,data);break;
      default: home(root,data);
    }
    container.replaceChildren(root);
  }
  function bind(root,screen) {
    container = root; open({screen},false);
  }
  window.addEventListener('storage',event => {
    if (event.key !== STORAGE && event.key !== null) return;
    if (!event.newValue) memory = {saved: [], reviews: {}, days: {}, active: null};
    if (container?.isConnected && container.firstElementChild?.classList.contains('hz-study')) draw();
    window.dispatchEvent(new Event('hanzi-saved'));
  });
  window.Study = {
    render:root => bind(root,'home'), renderLibrary:root => bind(root,'library'),
    createSet:(chars,root) => { container=root; open({screen:'editSet',chars:extractChars(chars).join('')}); },
    isSaved,toggle,count
  };
})();
