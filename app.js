const $=s=>document.querySelector(s);
const PREFIX='awveg-v6-';
const save=(k,v)=>localStorage.setItem(PREFIX+k,JSON.stringify(v));
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(PREFIX+k))??d}catch{return d}};
let profile=get('profile',null), events=get('events',[]), learnDone=get('learnDone',[]), quizDone=get('quizDone',[]);
let page=profile?'home':'setup', vegSel=null, recipeSel=null, lessonSel=null, quizIndex=0, quizScore=0, quizQuestions=[], quizOpportunity=null;
let calendarCursor=new Date();
const recipeImages={'小松菜お浸し':'images/recipe_01.jpeg'};

let remoteRecipes=[];
let remoteLessons=[];
let remoteQuizzes=[];
let remoteNotices=[];
let remoteLoaded=false;
function loadPublishedRecipes(){
  return new Promise((resolve)=>{
    if(!window.RECIPE_API_URL || window.RECIPE_API_URL.includes('ここに')){
      console.warn('API URLが設定されていません');
      resolve();
      return;
    }

    const callbackName='contentCallback_'+Date.now();
    const script=document.createElement('script');
    const separator=window.RECIPE_API_URL.includes('?')?'&':'?';

    const timeout=setTimeout(()=>{
      cleanup();
      console.warn('APIの読み込みがタイムアウトしました');
      resolve();
    },10000);

    function cleanup(){
      clearTimeout(timeout);

      if(script.parentNode){
        script.parentNode.removeChild(script);
      }

      try{
        delete window[callbackName];
      }catch(e){
        window[callbackName]=undefined;
      }
    }

    window[callbackName]=function(data){

      if(data && data.ok===true){

        remoteRecipes=
          Array.isArray(data.recipes) ? data.recipes : [];

        remoteLessons=
          Array.isArray(data.lessons) ? data.lessons : [];

        remoteQuizzes=
          Array.isArray(data.quizzes) ? data.quizzes : [];

        remoteNotices=
          Array.isArray(data.notices) ? data.notices : [];

        remoteLoaded=true;

        console.log(
          '公開データ取得：',
          'レシピ '+remoteRecipes.length+'件',
          '学習 '+remoteLessons.length+'件',
          'クイズ '+remoteQuizzes.length+'件',
          'お知らせ '+remoteNotices.length+'件'
        );

      }else{
        console.warn(
          'APIの応答形式が正しくありません',
          data
        );
      }

      cleanup();
      resolve();
    };

    script.onerror=function(){
      console.warn('APIへの接続に失敗しました');
      cleanup();
      resolve();
    };

    script.src=
      window.RECIPE_API_URL+
      separator+
      'callback='+encodeURIComponent(callbackName)+
      '&_='+Date.now();

    document.head.appendChild(script);
  });
}
function remoteByName(name){return remoteRecipes.find(r=>r['料理名']===name)}
function remoteById(id){
  return remoteRecipes.find(
    r=>String(r['recipe_id']||'').trim()===String(id||'').trim()
  );
}
function recipeDisplayName(name){
  const id=recipeIds[name]||'';
  const r=remoteById(id);

  return r?.['料理名'] || name;
}
function bandLabel(band){
  return {
    low:'低学年',
    mid:'中学年',
    high:'高学年'
  }[band] || '';
}

function sheetLessonsForBand(band){
  if(!remoteLoaded || !remoteLessons.length) return [];

  return remoteLessons
    .filter(r=>String(r['学年区分']||'').trim()===bandLabel(band))
    .sort((a,b)=>(Number(a['ステージ'])||99)-(Number(b['ステージ'])||99))
    .map(r=>{
      const lessonId=String(r['lesson_id']||'').trim();

      const points=[
        r['学習ポイント1'],
        r['学習ポイント2'],
        r['学習ポイント3']
      ].filter(x=>String(x||'').trim()!=='');

      const quiz=remoteQuizzes
  .filter(q=>String(q['lesson_id']||'').trim()===lessonId)
  .map(q=>{
    const choices=[
      q['選択肢1'],
      q['選択肢2'],
      q['選択肢3'],
      q['選択肢4']
    ].filter(x=>String(x||'').trim()!=='');

    const answer=Math.max(
      0,
      (Number(q['正解'])||1)-1
    );

    return {
      question_id:String(q['question_id']||'').trim(),
      lesson_id:lessonId,
      text:q['問題文']||'',
      choices:choices,
      answer:answer,
      correctExplanation:q['正解時解説']||'',
      incorrectExplanation:q['不正解時解説']||'',
      content_version:q['content_version']||'',
      updated:q['更新日']||''
    };
  });

      return {
        lesson_id:lessonId,
        title:r['タイトル']||'',
        intro:r['導入']||'',
        points:points,
        action:r['やってみよう']||'',
        summary:r['まとめ']||'',
        content_version:r['content_version']||'',
        updated:r['更新日']||'',
        quiz:quiz
      };
    });
}

function lessonBank(){
  const sheetBank=sheetLessonsForBand(profile.band);

  if(sheetBank.length){
    return sheetBank;
  }

  return lessons[profile.band] || [];
}
function currentVegetables(){
  return vegetables;
}
function recipePhoto(name){

  let id=recipeIds[name]||'';

  // 詳細画面ではrecipeSelのIDを優先
  if(
    recipeSel &&
    recipeSel.recipe_id
  ){
    id=recipeSel.recipe_id;
  }

  const r=
    remoteById(id) ||
    remoteByName(name);


  if(r && r['完成写真URL']){
    return r['完成写真URL'];
  }


  if(r && r['完成写真ファイル名']){
    return 'images/'+r['完成写真ファイル名'];
  }


  // 移行期間中の旧画像
  return recipeImages[name]||'';
}
function recipeDetailHTML(name){

  // 固定名からrecipe_idを探す
  let id=recipeIds[name]||'';

  // 詳細画面から来た場合はrecipeSelのIDを優先
  if(
    recipeSel &&
    recipeSel.recipe_id
  ){
    id=recipeSel.recipe_id;
  }

  const r=
    remoteById(id) ||
    remoteByName(name);

  if(!r){
    return `
      <p class="note">
        このレシピの材料・作り方は現在準備中です。
      </p>
    `;
  }


  // -----------------------------
  // 材料
  // -----------------------------

  const mats=[];

  for(let i=1;i<=8;i++){

    const ingredient=
      String(r['材料'+i]||'').trim();

    const amount=
      String(r['分量'+i]||'').trim();

    if(ingredient){

      mats.push(`
        <li>
          <span>${ingredient}</span>
          ${amount
            ? `<strong>${amount}</strong>`
            : ''
          }
        </li>
      `);
    }
  }


  // -----------------------------
  // 作り方
  // -----------------------------

  const steps=[];

  for(let i=1;i<=6;i++){

    const step=
      String(r['作り方'+i]||'').trim();

    if(step){
      steps.push(`<li>${step}</li>`);
    }
  }


  // -----------------------------
  // 人数表示
  // -----------------------------

  const servings=
    String(r['何人分']||'').trim();

  let servingsText='';

  if(servings){

    // 「2」と入力されていても
    // 「2人分」と入力されていても対応
    servingsText=
      servings.includes('人')
        ? `（${servings}）`
        : `（${servings}人分）`;
  }


  // -----------------------------
  // 調理時間
  // -----------------------------

  const cookingTime=
    String(r['調理時間(分)']||'').trim();


  // -----------------------------
  // HTML
  // -----------------------------

  return `

    ${cookingTime
      ? `
        <div class="recipeMeta">
          ⏱ 調理時間の目安：${cookingTime}分
        </div>
      `
      : ''
    }

    ${mats.length
      ? `
        <h3>材料${servingsText}</h3>

        <ul class="ingredientList">
          ${mats.join('')}
        </ul>
      `
      : ''
    }

    ${steps.length
      ? `
        <h3>作り方</h3>

        <ol class="recipeSteps">
          ${steps.join('')}
        </ol>
      `
      : ''
    }

    ${r['調理ポイント']
      ? `
        <div class="lessonBox">
          <strong>調理のポイント</strong>
          <p>${r['調理ポイント']}</p>
        </div>
      `
      : ''
    }

    ${r['子どもへの一言']
      ? `
        <div class="lessonBox">
          <strong>やってみよう</strong>
          <p>${r['子どもへの一言']}</p>
        </div>
      `
      : ''
    }

    ${r['大人と一緒に行う工程']
      ? `
        <div class="lessonBox">
          <strong>安全に作ろう</strong>
          <p>${r['大人と一緒に行う工程']}</p>
        </div>
      `
      : ''
    }

  `;
}
// 実学年に合わせた子ども向け表示
function gradeText(key){
  const g=profile?.grade || 1;

  const texts={
    homeQuestion:{
      1:'つぎは どの やさいにする？',
      2:'次は どの やさいにする？',
      3:'次はどの野菜にする？'
    },

    homeGuide:{
  1:'10この やさいから、たべてみたい りょうりを えらぼう。',
  2:'10しゅるいの やさいから、食べてみたい りょうりを 自分でえらぼう。',
  3:'10種類の野菜から、食べてみたい料理を自分で選ぼう。'
},

ateCount:{
  1:'たべた かいすう',
  2:'食べた かいすう',
  3:'食べた回数'
},

vegKinds:{
  1:'たべた やさい',
  2:'やさいの しゅるい',
  3:'野菜の種類'
},
recipeKinds:{
  1:'たべた りょうり',
  2:'食べた りょうり',
  3:'食べた料理'
},
    
    learnStatus:{
      1:'まなぶ',
      2:'まなぶ',
      3:'まなぶ'
    },

    recipeHeading:{
      1:'あき・ふゆの やさいレシピ',
      2:'秋・冬の やさいレシピ',
      3:'秋冬の野菜レシピ'
    }
  };

  const item=texts[key];

  if(!item) return '';

  if(g===1) return item[1];
  if(g===2) return item[2];

  return item[3];
}
const vegReadings={
  '小松菜':'こまつな',
  'ほうれん草':'ほうれんそう',
  'ブロッコリー':'ブロッコリー',
  'カリフラワー':'カリフラワー',
  '人参':'にんじん',
  '大根':'だいこん',
  '白菜':'はくさい',
  '青梗菜':'ちんげんさい',
  'かぶ':'かぶ',
  'ごぼう':'ごぼう'
};

function vegDisplay(name){
  if(profile?.grade===1){
    const reading=vegReadings[name] || name;

    if(reading===name){
      return name;
    }

    return `<ruby>${name}<rt>${reading}</rt></ruby>`;
  }

  return name;
}
const recipeIds={
  '小松菜お浸し':'R01',
  '小松菜アーモンドフィッシュ炒め':'R02',
  '小松菜クリーム煮':'R03',

  'ほうれん草ショウガお浸し':'R04',
  'ほうれん草エノキサラダ':'R05',
  'ほうれん草ベーコンバター炒め':'R06',

  'やみつきブロッコリー塩昆布':'R07',
  'ブロッコリーハムケチャップ炒め':'R08',
  'ブロッコリーとカニカマのポン酢和え':'R09',

  '塩昆布とカリフラワーの和え物':'R10',
  'カリフラワーのマスタード和え':'R11',
  'カリフラワーのオイル焼き':'R12',

  'キャロットラペ':'R13',
  'にんじんしりしり':'R14',
  'にんじんもやしナムル':'R15',

  '大根ツナポン':'R16',
  '大根みそ':'R17',
  '大根明太マヨ':'R18',

  '白菜の和風おかか和え':'R19',
  '白菜とベーコンのミルフィーユ蒸し':'R20',
  '白菜のツナチーズ焼き':'R21',

  '青梗菜のしらす和え':'R22',
  '青梗菜中華胡麻和え':'R23',
  '青梗菜とちくわのごま和え':'R24',

  'かぶとツナの和え物':'R25',
  'かぶの味噌田楽':'R26',
  'かぶとベーコンのチーズ炒め':'R27',

  'きんぴらごぼう':'R28',
  'ごぼうと卵の炒め物':'R29',
  'ごぼうとアーモンドの甘辛炒め':'R30'
};
const vegetables=[
['小松菜','🥬',['小松菜お浸し','小松菜アーモンドフィッシュ炒め','小松菜クリーム煮']],
['ほうれん草','🌿',['ほうれん草ショウガお浸し','ほうれん草エノキサラダ','ほうれん草ベーコンバター炒め']],
['ブロッコリー','🥦',['やみつきブロッコリー塩昆布','ブロッコリーハムケチャップ炒め','ブロッコリーとカニカマのポン酢和え']],
['カリフラワー','☁️',['塩昆布とカリフラワーの和え物','カリフラワーのマスタード和え','カリフラワーのオイル焼き']],
['人参','🥕',['キャロットラペ','にんじんしりしり','にんじんもやしナムル']],
['大根','🤍',['大根ツナポン','大根みそ','大根明太マヨ']],
['白菜','🥬',['白菜の和風おかか和え','白菜とベーコンのミルフィーユ蒸し','白菜のツナチーズ焼き']],
['青梗菜','🌱',['青梗菜のしらす和え','青梗菜中華胡麻和え','青梗菜とちくわのごま和え']],
['かぶ','⚪',['かぶとツナの和え物','かぶの味噌田楽','かぶとベーコンのチーズ炒め']],
['ごぼう','🟤',['きんぴらごぼう','ごぼうと卵の炒め物','ごぼうとアーモンドの甘辛炒め']]
];
// 各ステージの学習内容と確認クイズは1対1対応。クイズの正答根拠は必ず同じステージ本文に明記。
const lessons={
low:[
{title:'あさごはんと食事',intro:'あさごはんを食べると、1日の生活がはじまります。どんなものを食べているかな。',points:['朝ごはんは、朝に食べる食事です。','食事には、ごはん・パン、魚・肉・卵、野菜など、いろいろな食べものがあります。'],action:'次の朝ごはんで、どんな食べものがあるか見つけよう。',quiz:[['朝に食べる食事はどれ？',['朝ごはん','昼ごはん','夕ごはん'],0,'朝ごはんは、朝に食べる食事だと学びました。'],['食事にはどうするとよいかな？',['いろいろな食べものを見つける','いつも同じものだけを見る','食べものを見ない'],0,'学習では、食事にはいろいろな食べものがあることを確認しました。']]},
{title:'やさいの色・形・食べるところ',intro:'野菜をよく見ると、色や形だけでなく、食べているところにも違いがあります。',points:['野菜には、色・形・かたさなどの違いがあります。','葉を食べる野菜、根を食べる野菜、実を食べる野菜などがあります。'],action:'今日の野菜は、どんな色・形で、どこを食べているか見てみよう。',quiz:[['野菜について、くらべられるものは？',['色や形','名前の文字数だけ','お皿の色だけ'],0,'野菜には色や形などの違いがあると学びました。'],['野菜は、食べるところがみんな同じ？',['ちがうものがある','ぜんぶ同じ','野菜には食べるところがない'],0,'葉・根・実など、食べるところが違う野菜があると学びました。']]},
{title:'食べものはどこから？',intro:'野菜は、畑からそのまま自分の家に来るわけではありません。',points:['野菜を育てる人がいます。','運ぶ人や、お店で売る人など、食卓に届くまでにいろいろな人がかかわっています。'],action:'家にある野菜を1つ選び、どこから来たのか家の人と話そう。',quiz:[['野菜が食卓に届くまでに、だれがかかわる？',['育てる人や運ぶ人など','家の人だけ','だれもかかわらない'],0,'育てる人、運ぶ人、売る人などがかかわると学びました。'],['野菜を育てる人はいる？',['いる','いない','野菜が自分で店に行く'],0,'野菜を育てる人がいることを学習しました。']]},
{title:'食べものを大切に',intro:'食べものが食卓に届くまでには、多くの人の仕事や時間がかかっています。',points:['食べられる量を考えて盛りつけることは、食べものを大切にする行動の一つです。','まだ食べられるものを、むやみに捨てないようにすることも大切です。'],action:'自分が食べられる量を考えてみよう。',quiz:[['食べものを大切にする行動は？',['食べられる量を考える','いつも多く取りすぎる','食べられるものもすぐ捨てる'],0,'食べられる量を考えることを学びました。'],['まだ食べられるものはどうする？',['むやみに捨てない','必ず捨てる','見ないで捨てる'],0,'まだ食べられるものをむやみに捨てないことを学びました。']]},
{title:'いっしょに作る・食べる',intro:'料理や食事は、自分だけでなく、いっしょにいる人ともつながっています。',points:['いっしょに料理するときは、役割を相談して協力します。','食事では、いっしょに食べる人のことも考えて行動します。'],action:'今日できるお手伝いを1つ選ぼう。',quiz:[['いっしょに料理するときは？',['役割を相談して協力する','相手の話を聞かない','片付けをしない'],0,'役割を相談して協力することを学びました。'],['食事のときに考えることは？',['いっしょに食べる人のこと','自分のことだけ','料理とは関係ないことだけ'],0,'いっしょに食べる人のことも考えると学びました。']]},
{title:'きせつと食べもの',intro:'季節によって、よくとれる食べものや、行事で食べる料理があります。',points:['食べものには「旬」とよばれる、よくとれる時期があります。','季節や行事とつながる食べものがあります。'],action:'家族に、秋や冬によく食べる料理を1つ聞いてみよう。',quiz:[['「旬」に近いのは？',['よくとれる時期','お皿の大きさ','料理の名前'],0,'旬は、その食べものがよくとれる時期として学びました。'],['食べものは季節や行事とつながることがある？',['ある','まったくない','食べものに季節は関係しない'],0,'季節や行事とつながる食べものがあると学びました。']]}
],
mid:[
{title:'朝ごはんと生活リズム',intro:'朝ごはんと、起きる時刻・寝る時刻などの生活リズムを一緒に見てみましょう。',points:['朝ごはんは朝の生活の中にある食事です。','食生活をふり返るときは、食事だけでなく起床・就寝などの生活リズムも一緒に見ることができます。'],action:'朝ごはんを食べた日の、起きた時刻と寝た時刻もふり返ろう。',quiz:[['食生活と一緒にふり返るものは？',['起床や就寝などの生活リズム','筆箱の色','靴の大きさ'],0,'起床・就寝などの生活リズムも一緒に見ると学びました。'],['朝ごはんはいつの食事？',['朝','昼','夜'],0,'朝ごはんは朝の生活の中にある食事です。']]},
{title:'野菜のひみつ',intro:'野菜は、種類によって食べている部分や特徴が違います。',points:['根・茎・葉・花・実など、食べる部分が違う野菜があります。','色、形、食感などを比べると、野菜の違いに気づけます。'],action:'2種類の野菜を選び、食べる部分や見た目を比べよう。',quiz:[['野菜の食べる部分について正しいのは？',['根・茎・葉など違いがある','すべて実だけ','すべて根だけ'],0,'根・茎・葉・花・実など、違いがあると学びました。'],['野菜を比べる手がかりは？',['色や形、食感など','値札の色だけ','料理名の長さだけ'],0,'色・形・食感などを比べられると学びました。']]},
{title:'食べ物が届くまで',intro:'食べ物は、生産されたあと、さまざまな過程を通って私たちのところへ届きます。',points:['野菜を作る生産者がいます。','運ぶ人、販売する人など、多くの人が食べ物が届くまでにかかわっています。'],action:'食品の産地表示を1つ見つけてみよう。',quiz:[['食べ物が届くまでに関わる人は？',['生産する人や運ぶ人など','家庭の人だけ','だれもいない'],0,'生産・運搬・販売など多くの人が関わると学びました。'],['産地表示から分かることは？',['どこで生産されたかの手がかり','食器の大きさ','食べる人の人数'],0,'産地を確認する活動を行いました。']]},
{title:'いろいろな食品を組み合わせる',intro:'食事には、さまざまな食品が使われています。',points:['食品にはそれぞれ異なる特徴があります。','一つの食品だけに決めず、いろいろな食品を組み合わせて食べることを考えます。'],action:'今日の食事に使われている食品を3つ見つけよう。',quiz:[['食事を考えるときは？',['いろいろな食品の組み合わせを考える','一つの食品だけを見る','食品を見ない'],0,'いろいろな食品を組み合わせることを学びました。'],['食品の特徴は？',['食品によって異なる','すべて同じ','特徴はない'],0,'食品にはそれぞれ異なる特徴があると学びました。']]},
{title:'食べ物を大切にする',intro:'必要な量を考えることは、食べ物を大切にすることにつながります。',points:['食べられる量を考えて取ることができます。','家庭にある食品を確認して、まだ食べられる食品を活用する工夫もできます。'],action:'家でできる「食べ物を大切にする工夫」を1つ考えよう。',quiz:[['食べ物を大切にする工夫は？',['食べられる量を考えて取る','必要以上に取る','食べられる物も捨てる'],0,'食べられる量を考えることを学びました。'],['家庭にある食品についてできることは？',['確認して活用を考える','確認せず捨てる','いつも新しい物だけ買う'],0,'家庭にある食品を確認して活用する工夫を学びました。']]},
{title:'地域・季節と食文化',intro:'地域には、季節や行事と結びついた料理や食べ物があります。',points:['地域に伝わる料理から、その土地の食文化を知ることができます。','季節や行事に合わせて食べられてきた料理があります。'],action:'家族に、地域や秋冬の行事で食べる料理を聞いてみよう。',quiz:[['地域に伝わる料理から知ることができるのは？',['地域の食文化','計算方法','交通標識'],0,'地域に伝わる料理から食文化を知ることができると学びました。'],['季節や行事と料理は？',['結びついているものがある','まったく関係ない','料理には季節がない'],0,'季節や行事と結びついた料理があると学びました。']]}
],
high:[
{title:'朝食と自分の食生活',intro:'朝食を入り口に、自分の食事の内容や生活を具体的にふり返ります。',points:['朝食も一日の食事の一つとして、何を組み合わせて食べているかを見ることができます。','続けやすくするには、調理時間や準備方法も考える必要があります。'],action:'自分の朝食に取り入れやすい秋冬野菜料理を1つ選ぼう。',quiz:[['朝食をふり返るときの視点は？',['何を組み合わせて食べているか','食器の色だけ','料理名の長さだけ'],0,'朝食で何を組み合わせているかを見ると学びました。'],['朝食を続けやすくする工夫は？',['調理時間や準備方法も考える','毎日複雑な料理だけにする','準備方法を考えない'],0,'調理時間や準備方法も考えると学びました。']]},
{title:'食事の組み合わせ',intro:'食事全体を見るとき、主食・主菜・副菜という料理の組み合わせが手がかりになります。',points:['主食は、ごはん・パン・めんなどを中心にした料理です。','主菜は魚・肉・卵・大豆製品などを多く使う料理、副菜は野菜などを使う料理です。'],action:'今日の食事から、主食・主菜・副菜に当たる料理を探そう。',quiz:[['野菜を使う料理が当てはまることが多いのは？',['副菜','主食','主菜'],0,'副菜は野菜などを使う料理だと学びました。'],['魚・肉・卵・大豆製品などを多く使う料理は？',['主菜','主食','副菜'],0,'主菜について本文で確認しました。']]},
{title:'食品を選ぶ手がかり',intro:'食品を選ぶときには、見た目だけでなく表示や保存方法なども手がかりになります。',points:['食品表示には、食品を選んだり扱ったりするときの情報があります。','期限や保存方法などを確認することは、食品を適切に扱う手がかりになります。'],action:'家庭にある食品を1つ選び、期限や保存方法の表示を確認しよう。',quiz:[['食品を選んだり扱ったりする手がかりになるのは？',['食品表示','容器の好きな色だけ','商品名の文字数だけ'],0,'食品表示が手がかりになると学びました。'],['表示で確認する例は？',['期限や保存方法','食器の数','家族の身長'],0,'期限や保存方法を確認すると学びました。']]},
{title:'生産・流通と食べ物',intro:'食べ物は、生産・流通・販売などを経て食卓に届きます。',points:['生産者だけでなく、運搬や販売など多くの人が関わっています。','産地などの情報を見ることで、食べ物がどこから来たか考える手がかりになります。'],action:'秋冬野菜を1つ選び、産地を確認してみよう。',quiz:[['食べ物が食卓に届くまでについて正しいのは？',['生産・運搬・販売など多くの人が関わる','家庭だけが関わる','販売する人だけが関わる'],0,'生産・運搬・販売など多くの人が関わると学びました。'],['産地情報は何の手がかり？',['食べ物がどこから来たか','料理時間だけ','食器の種類'],0,'産地は食べ物がどこから来たかを考える手がかりです。']]},
{title:'食品ロスと食べ物を大切にする行動',intro:'まだ食べられる食品を捨ててしまうことを減らすために、家庭でもできる行動があります。',points:['食べられる量を考えて準備・盛り付けすることができます。','家にある食品を確認して、使えるものから活用することも一つの方法です。'],action:'家庭でできそうな工夫を1つ決めよう。',quiz:[['食品ロスを減らす行動として考えられるのは？',['食べられる量を考える','必要以上に準備する','食べられる食品も捨てる'],0,'食べられる量を考えることを学びました。'],['家にある食品については？',['確認して使えるものから活用する','確認しない','いつも捨ててから買う'],0,'家にある食品を確認して活用する方法を学びました。']]},
{title:'地域・季節と食文化',intro:'地域の産物や料理、季節・行事の食事には、その地域や日本の食文化が表れています。',points:['地域に伝わる料理を知ることは、地域の食文化を理解する手がかりになります。','季節や行事と結びついた食事も、受け継がれてきた食文化の一つです。'],action:'自分の地域や家庭で秋冬に食べる料理を1つ調べよう。',quiz:[['地域に伝わる料理を調べると何を知る手がかりになる？',['地域の食文化','計算方法','交通ルール'],0,'地域の料理は食文化を理解する手がかりになると学びました。'],['季節や行事の食事について正しいのは？',['食文化と結びつくものがある','食文化とは関係ない','すべて同じ料理である'],0,'季節や行事と結びついた食事も食文化の一つと学びました。']]}
]};
const thresholds=[0,2,4,6,8,10];
function log(type,data={}){events.push({type,ts:Date.now(),date:new Date().toLocaleDateString('ja-JP'),grade:profile?.grade,band:profile?.band,...data});save('events',events)}
// ========================================
// 食行動・調理行動の集計
// ========================================

const ateEvents=()=>
  events.filter(e=>e.type==='ate');

const cookEvents=()=>
  events.filter(e=>
    [
      'selfMade',
      'togetherMade',
      'made'
    ].includes(e.type)
  );


// 食べた総回数
const ateCount=()=>
  ateEvents().length;


// 食べた野菜の種類数
const uniqueVeg=()=>
  new Set(
    ateEvents()
      .map(e=>e.veg)
      .filter(Boolean)
  ).size;


// ----------------------------------------
// イベントからrecipe_idを取得
// 旧記録にも対応
// ----------------------------------------

function eventRecipeId(e){

  if(e.recipe_id){
    return String(e.recipe_id).trim();
  }

  // 旧データは料理名からrecipe_idへ変換
  if(e.recipe && recipeIds[e.recipe]){
    return recipeIds[e.recipe];
  }

  // IDに変換できない旧記録
  return '';
}


// ----------------------------------------
// 食べたレシピ種類数
// ----------------------------------------

function uniqueAteRecipes(){

  const ids=new Set();
  const legacy=new Set();

  ateEvents().forEach(e=>{

    const id=eventRecipeId(e);

    if(id){
      ids.add(id);
    }
    else if(e.recipe){
      legacy.add(
        (e.veg||'')+'|'+e.recipe
      );
    }

  });

  return ids.size+legacy.size;
}


// ----------------------------------------
// 調理したレシピ種類数
// ----------------------------------------

function uniqueCookRecipes(){

  const ids=new Set();
  const legacy=new Set();

  cookEvents().forEach(e=>{

    const id=eventRecipeId(e);

    if(id){
      ids.add(id);
    }
    else if(e.recipe){
      legacy.add(
        (e.veg||'')+'|'+e.recipe
      );
    }

  });

  return ids.size+legacy.size;
}


// ----------------------------------------
// 実践日数
// 食べた／作った日のユニーク日数
// ----------------------------------------

function challengeDayCount(){

  return new Set(
    events
      .filter(e=>
        [
          'ate',
          'selfMade',
          'togetherMade',
          'made'
        ].includes(e.type)
      )
      .map(e=>ymdFromTs(e.ts))
  ).size;
}


// ========================================
// 「まなぶ」解放
//
// 同じ料理を何度食べても記録は残す。
// ただし学習解放は
// 「食べたレシピの種類数」で判定する。
// ========================================

function unlockedStage(){

  const count=uniqueAteRecipes();

  let n=0;

  thresholds.forEach((t,i)=>{
    if(count>=t){
      n=i;
    }
  });

  return n;
}
function head(t,s=''){return `<div class=top><div><div class=brand>${t}</div><div class=sub>${s}</div></div><span>🍂</span></div>`}
function setup(){app.innerHTML=head('朝食やさいチャレンジ','はじめに学年をえらんでね')+`<div class=card><h2>あなたは何年生？</h2><p>学年に合わせて「まなぶ」と確認クイズが変わります。</p><div class=gradegrid>${[1,2,3,4,5,6].map(g=>`<button onclick=chooseGrade(${g})><b>${g}</b>年生</button>`).join('')}</div><p class=note>1・2年生＝低学年、3・4年生＝中学年、5・6年生＝高学年として内容を切り替えます。</p></div>`;nav.innerHTML=''}
function chooseGrade(g){profile={id:'local-'+Date.now(),grade:g,band:bandOf(g),version:'autumn-winter-v7'};save('profile',profile);log('grade_selected');page='home';render()}
function home(){

  let c=ateCount();
let u=uniqueVeg();
let recipeKinds=uniqueAteRecipes();
let stage=unlockedStage();
let next=thresholds.find(t=>t>recipeKinds);

  let msg='';

  if(next){

   if(profile.grade===1){
  msg=`あと ${next-recipeKinds}しゅるい、べつの りょうりを たべると、つぎの「まなぶ」が ひらくよ！`;
}
else if(profile.grade===2){
  msg=`あと ${next-recipeKinds}しゅるい、べつの料理を 食べると、次の「まなぶ」が ひらくよ！`;
}
else{
  msg=`あと ${next-recipeKinds}種類、別の料理を食べると、次の「まなぶ」がひらくよ！`;
}

  }else{

    if(profile.grade===1){
      msg='6つの「まなぶ」が ぜんぶ ひらいたよ！';
    }
    else if(profile.grade===2){
      msg='6つの「まなぶ」が ぜんぶ ひらいたよ！';
    }
    else{
      msg='6つの「まなぶ」がすべて開きました！';
    }
  }

  app.innerHTML=
    head(
      appTitle(),
      `${profile.grade}年生・${bandName[profile.band]}`
    )+

    `<div class=hero>

      <b>${gradeText('homeQuestion')}</b>

      <p>${gradeText('homeGuide')}</p>

    </div>

    <div class=stats>

  <div class=card>
    <b>${c}</b>
    <span class=note>
      ${gradeText('ateCount')}
    </span>
  </div>

  <div class=card>
  <b>${recipeKinds}</b>
  <span class=note>
    TEST 食べた料理
  </span>
</div>

  <div class=card>
    <b>${stage+1}/6</b>
<span class=note>
  ${gradeText('learnStatus')}
</span>
  </div>

</div>

    <div class=unlock>

      🌱 <b>${msg}</b>

      <div class=progress>
        <i style="width:${Math.min(100,recipeKinds/10*100)}%"></i>
      </div>

    </div>

    <h2>${gradeText('recipeHeading')}</h2>

    <div class=homeRows>
      ${currentVegetables()
        .map(homeRecipeRow)
        .join('')}
    </div>`;
}
function recipeStatus(veg,name){

  const recipeId=recipeIds[name]||'';

  const sameRecipe=e=>{

    // 新しい記録はrecipe_idで判定
    if(recipeId && e.recipe_id){
      return String(e.recipe_id)===String(recipeId);
    }

    // recipe_idがない旧記録との互換
    return (
      e.veg===veg &&
      e.recipe===name
    );
  };


  const selfMadeCount=
    events.filter(e=>
      e.type==='selfMade' &&
      sameRecipe(e)
    ).length;


  const togetherMadeCount=
    events.filter(e=>
      e.type==='togetherMade' &&
      sameRecipe(e)
    ).length;


  const oldMadeCount=
    events.filter(e=>
      e.type==='made' &&
      sameRecipe(e)
    ).length;


  const ateCount=
    events.filter(e=>
      e.type==='ate' &&
      sameRecipe(e)
    ).length;


  return {

    selfMadeCount,
    togetherMadeCount,
    oldMadeCount,
    ateCount,

    // 既存処理との互換用
    selfMade:selfMadeCount>0,
    togetherMade:togetherMadeCount>0,
    oldMade:oldMadeCount>0,
    ate:ateCount>0

  };
}
function homeRecipeRow(v){

  return `
    <section class=homeRow>

      <div class=vegTitle>
        <span>${v[1]}</span>
        <b>${vegDisplay(v[0])}</b>
        <small>
          ${ateEvents().some(e=>e.veg===v[0])
            ? (profile.grade===1 ? '✓ たべた きろくあり' : '✓ 食べた記録あり')
            : ''
          }
        </small>
      </div>

      <div class=threeRecipes>

       ${v[2].map((name,i)=>{

  const displayName=recipeDisplayName(name);
  let st=recipeStatus(v[0],name);

         let cookText='';
let cookOn=false;

const totalCook=
  st.selfMadeCount+
  st.togetherMadeCount+
  st.oldMadeCount;


if(totalCook>0){

  cookOn=true;

  const parts=[];

  if(st.selfMadeCount>0){

    parts.push(
      profile.grade===1
        ? `じぶん ${st.selfMadeCount}かい`
        : `自分 ${st.selfMadeCount}回`
    );

  }


  if(st.togetherMadeCount>0){

    parts.push(
      profile.grade===1
        ? `いっしょ ${st.togetherMadeCount}かい`
        : `いっしょ ${st.togetherMadeCount}回`
    );

  }


  if(st.oldMadeCount>0){

    parts.push(
      profile.grade===1
        ? `つくった ${st.oldMadeCount}かい`
        : `作った ${st.oldMadeCount}回`
    );

  }


  cookText=
    '✓ '+parts.join('・');

}
else{

  cookText=
    profile.grade===1
      ? '○ まだ つくっていない'
      : '○ まだ作っていない';

}

          return `
            <button
              class=homeRecipe
              onclick="openRecipeHome('${v[0]}',${i})">

              ${
                recipePhoto(name)
                ? `${
  recipePhoto(name)
    ? `<img
         class="recipePhoto"
         src="${recipePhoto(name)}"
         alt="${displayName}">
      `
    : `<div class="photoPlaceholder">
         ${v[1]}
       </div>`
}
                  `
                : `<div class=photoPlaceholder>
                     ${v[1]}
                   </div>`
              }

              <b>${displayName}</b>

              <div class=checks>

                <span class="check ${cookOn?'on':''}">
                  ${cookText}
                </span>

              <span class="check ${st.ateCount>0?'on':''}">

  ${
    st.ateCount>0

      ? (
          profile.grade===1
            ? `✓ たべた ${st.ateCount}かい`
            : `✓ 食べた ${st.ateCount}回`
        )

      : (
          profile.grade===1
            ? '○ まだ たべていない'
            : '○ まだ食べていない'
        )
  }

</span>

              </div>

            </button>
          `;

        }).join('')}

      </div>

    </section>
  `;
}
function openRecipeHome(vegName,i){
  vegSel=currentVegetables().find(v=>v[0]===vegName);

  const name=vegSel[2][i];
  const recipeId=recipeIds[name]||'';
  const remote=remoteById(recipeId);

  recipeSel={
    recipe_id:recipeId,
    veg:remote?.['野菜名']||vegName,
    name:remote?.['料理名']||name
  };

  log('recipe_open',{
    recipe_id:recipeSel.recipe_id,
    veg:recipeSel.veg,
    recipe:recipeSel.name
  });

  page='recipe';
  render();
}
function recipe(){

  const remote=
    remoteById(recipeSel.recipe_id);

  const displayName=
    remote?.['料理名'] ||
    recipeSel.name;

  const displayVeg=
    remote?.['野菜名'] ||
    recipeSel.veg;

  let g={
    low:'おうちの人といっしょに、できることを見つけよう。',
    mid:'できるところは自分で。包丁や火はおうちの人と安全を確認しよう。',
    high:'調理の手順と安全を考えながら参加しよう。'
  }[profile.band];

  app.innerHTML=`
    <button class=back onclick="go('home')">‹ ホームにもどる</button>

   ${head(displayName,displayVeg)}

    ${recipePhoto(recipeSel.name)
  ? `
      <div class="card recipePhotoCard">

        <img
          class="detailRecipePhoto"
          src="${recipePhoto(recipeSel.name)}"
          alt="${displayName}">

      </div>
    `
  : ''
}

    <div class=card>
      <div class=lessonBox>
        <strong>今日のチャレンジ</strong>
        <p>${g}</p>
      </div>

      ${recipeDetailHTML(recipeSel.name)}
    </div>

    <div class=card>
      <h3>やったことを記録</h3>

      <p class=note>
  この料理で、やったことを記録しよう。
</p>

      <div class=actions>
        <button class=made onclick="mark('selfMade')">
          👩‍🍳 自分で作った
        </button>

        <button class=made onclick="mark('togetherMade')">
          👨‍👩‍👧 いっしょに作った
        </button>

        <button class=ate onclick="mark('ate')">
          😋 食べた
        </button>
      </div>

      <p class=note>
  「自分で作った」は、自分で料理したとき。
  「いっしょに作った」は、おうちの人などといっしょに料理したとき。
  「食べた」は、食べたときに記録しよう。
</p>
    </div>
  `;
}
function mark(t){

  const now=Date.now();

  // 同じレシピ・同じ行動を
  // 5秒以内に再度押した場合だけ誤操作として防止
  const duplicate=events
    .slice()
    .reverse()
    .find(e=>
      e.type===t &&
      eventRecipeId(e)===(recipeSel.recipe_id||'')
    );

  if(
    duplicate &&
    now-duplicate.ts<5000
  ){
    alert('この記録は、いま登録したばかりです。');
    return;
  }


  log(t,{
    recipe_id:recipeSel.recipe_id||'',
    veg:recipeSel.veg,
    recipe:recipeSel.name
  });


  if(t==='selfMade'){
    alert('「自分で作った」を記録しました。');
  }

  if(t==='togetherMade'){
    alert('「いっしょに作った」を記録しました。');
  }

  if(t==='ate'){
    alert('「食べた」を記録しました。');
  }

  render();
}
function completedLessonIndices(){
  return lessonBank()
    .map((_,i)=>i)
    .filter(i=>learnDone.includes(profile.band+'-'+i));
}
function quizOpportunityState(){
  let n=completedLessonIndices().length;
  let available=QUIZ_MILESTONES.filter(m=>n>=m && !quizDone.includes(profile.band+'-m'+m));
  return {n,available,next:QUIZ_MILESTONES.find(m=>n<m)};
}
function quizPrompt(){let qs=quizOpportunityState();if(!qs.available.length)return '';let m=qs.available[0];return `<div class="card quizPrompt"><b>📝 学んだことをクイズでたしかめてみる？</b><p>${m}つの「まなぶ」が終わりました。これまで学んだ内容だけから問題が出ます。</p><button class=primary onclick="openQuizChoice(${m})">クイズをえらぶ</button><p class=note>今はやらなくても大丈夫。あとからいつでも挑戦できます。</p></div>`}
function learn(){let u=unlockedStage(), bank=lessonBank(),qs=quizOpportunityState();app.innerHTML=head('まなぶ',`${profile.grade}年生に合わせた内容です`)+`<div class=card><b>まず学ぶ。クイズはあとで、自分で選んで挑戦。</b><p class=note>クイズは複数の学習を終えた後に表示され、未学習の内容からは出題しません。</p></div>${quizPrompt()}<div class=timeline>${bank.map((L,i)=>{let open=i<=u,done=learnDone.includes(profile.band+'-'+i);return `<div class="stage ${open?'open':'closed'}"><b>${open?'🔓':'🔒'} ${i+1}. ${L.title}${done?' ✓学習':''}</b><span class=note>${i===0?'最初からOPEN':`${thresholds[i]}種類の料理を食べるとOPEN`}</span>${open?`<button class=secondary onclick="openLesson(${i})">${done?'もう一度見る':'学んでみる'}</button>`:''}</div>`}).join('')}</div>${qs.next?`<p class=note>次のクイズ選択は「まなぶ」を${qs.next}つ完了すると表示されます。</p>`:''}`}
function openLesson(i){
  lessonSel=i;
  const L=lessonBank()[i];

  log('lesson_open',{
    stage:i+1,
    lesson_id:L?.lesson_id||'',
    title:L?.title||''
  });

  page='lesson';
  render();
}
function lesson(){
  let bank=lessonBank();
  let L=bank[lessonSel];

  if(!L){
    app.innerHTML=
      `<button class=back onclick="go('learn')">‹ まなぶにもどる</button>`+
      head('まなぶ','')+
      `<div class=card><p>学習内容を読み込めませんでした。</p></div>`;
    return;
  }

  let key=profile.band+'-'+lessonSel;
  let done=learnDone.includes(key);

  let summary=
    L.summary ||
    (L.points ? L.points.join(' ') : '');

  app.innerHTML=
    `<button class=back onclick="go('learn')">‹ まなぶにもどる</button>`+
    head(L.title,`${lessonSel+1} / ${bank.length}`)+
    `<div class="card lesson">

      <div class=lessonBox>
        <strong>まず考えてみよう</strong>
        <p>${L.intro||''}</p>
      </div>

      <div class=lessonBox>
        <strong>ここを覚えよう</strong>
        <ul>
          ${(L.points||[]).map(x=>`<li>${x}</li>`).join('')}
        </ul>
      </div>

      <div class=lessonBox>
        <strong>やってみよう</strong>
        <p>${L.action||''}</p>
      </div>

      <div class=lessonBox>
        <strong>まとめ</strong>
        <p>${summary}</p>
      </div>

      ${L.updated
        ? `<p class=note>内容更新：${L.updated}</p>`
        : ''
      }

      ${done
        ? `<div class=doneBox>
             ✓ この「まなぶ」は完了しています。<br>
             <span class=note>
               クイズは「まなぶ」一覧に、いくつか学習したあとで表示されます。
             </span>
           </div>`
        : `<button class=primary onclick="finishLesson()">
             ここまで学んだ
           </button>`
      }

    </div>`;
}
function finishLesson(){
  let bank=lessonBank();
  let L=bank[lessonSel];
  let k=profile.band+'-'+lessonSel;

  if(!learnDone.includes(k)){
    learnDone.push(k);
    save('learnDone',learnDone);

    log('lesson_complete',{
      stage:lessonSel+1,
      lesson_id:L?.lesson_id||'',
      title:L?.title||'',
      content_version:L?.content_version||''
    });
  }

  page='learn';
  render();
}
function openQuizChoice(m){quizOpportunity=m;log('quiz_choice_open',{milestone:m,learned:completedLessonIndices().length});page='quizChoice';render()}
function quizChoice(){
  let m=quizOpportunity;
  let key=profile.band+'-m'+m;

  if(quizDone.includes(key)){
    go('learn');
    return;
  }

  const bank=lessonBank();
  const completed=completedLessonIndices();

  let questionCount=0;

  completed.forEach(i=>{
    const L=bank[i];

    if(L && Array.isArray(L.quiz)){
      questionCount+=L.quiz.length;
    }
  });

  const quizCount=Math.min(4,questionCount);

  app.innerHTML=
    `<button class=back onclick="go('learn')">
       ‹ まなぶにもどる
     </button>`+
    head(
      'クイズにちょうせん',
      `「まなぶ」${m}つ完了後の確認`
    )+
    `<div class=card>
       <h2>これまで学んだことをたしかめる？</h2>

       <p>
         完了した「まなぶ」の内容だけから
         ${quizCount}問出題します。
       </p>

       ${
         quizCount>0
         ? `<button class=primary onclick="startPooledQuiz(${m})">
              ${quizCount}問クイズをはじめる
            </button>`
         : `<p class=note>
              現在、公開されているクイズはありません。
            </p>`
       }

       <button class=secondary onclick="go('learn')">
         今はやらない
       </button>

       <p class=note>
         やらなくても次の学習や野菜チャレンジに進めます。
       </p>
     </div>`;
}
function shuffledQuestion(q){

  const items=q.choices.map((text,index)=>({
    text:text,
    correct:index===q.answer
  }));

  // Fisher-Yates shuffle
  for(let i=items.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [items[i],items[j]]=[items[j],items[i]];
  }

  return {
    ...q,
    choices:items.map(x=>x.text),
    answer:items.findIndex(x=>x.correct)
  };
}
function startPooledQuiz(m){

  const bank=lessonBank();
  const completed=completedLessonIndices();

  let candidates=[];

  completed.forEach(i=>{

    const L=bank[i];

    if(!L || !Array.isArray(L.quiz) || L.quiz.length===0){
      return;
    }

     // この学習に登録されている問題から1問選ぶ
    const selected=
      L.quiz[Math.floor(Math.random()*L.quiz.length)];

    // 選択肢の順番をランダムにする
    const shuffled=
      shuffledQuestion(selected);

    candidates.push({
      q:shuffled,
      stage:i,
      lesson_id:L.lesson_id||'',
      lesson_title:L.title||'',
      lesson_version:L.content_version||''
    });

  });

  // 学習が5・6個の場合でも、1回のクイズは最大4問
  // どの学習を採用するかをランダム化
  for(let i=candidates.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [candidates[i],candidates[j]]=
      [candidates[j],candidates[i]];
  }

  quizQuestions=candidates.slice(0,4);

  quizIndex=0;
  quizScore=0;
  quizOpportunity=m;

  log('learning_quiz_start',{
    milestone:m,
    completed_lessons:completed.length,
    candidate_lessons:candidates.length,
    total:quizQuestions.length,

    question_ids:quizQuestions.map(z=>
      z.q.question_id||''
    ),

    lesson_ids:quizQuestions.map(z=>
      z.lesson_id||''
    )
  });

  if(quizQuestions.length===0){

    alert('現在、挑戦できるクイズはありません。');

    page='learn';
    render();
    return;
  }

  page='pooledQuiz';
  render();
}

function pooledQuiz(){

  const z=quizQuestions[quizIndex];
  const q=z.q;

  app.innerHTML=
    `<button class=back onclick="abandonQuiz()">
       ‹ あとでやる
     </button>`+
    head(
      '確認クイズ',
      `${quizIndex+1} / ${quizQuestions.length}`
    )+
    `<div class=card>

       <p class=note>
         これまでに学んだ内容から出題しています。
       </p>

       <h2>${q.text}</h2>

       <div class=choice>
         ${q.choices.map((x,i)=>
           `<button onclick="pooledAns(${i})">
              ${x}
            </button>`
         ).join('')}
       </div>

     </div>`;
}
function pooledAns(i){

  const z=quizQuestions[quizIndex];
  const q=z.q;

  const ok=i===q.answer;

  if(ok){
    quizScore++;
  }

  log('learning_quiz_answer',{

    milestone:quizOpportunity,

    stage:z.stage+1,

    lesson_id:z.lesson_id||'',

    question_id:q.question_id||'',

    content_version:q.content_version||'',

    selected_answer:i+1,

    correct_answer:q.answer+1,

    correct:ok

  });

  const explanation=
    ok
      ? q.correctExplanation
      : (
          q.incorrectExplanation ||
          q.correctExplanation
        );

  app.innerHTML=
    head(
      '答え合わせ',
      '確認クイズ'
    )+
    `<div class=card>

       <h2>
         ${ok
           ? '○ よくできました'
           : '学んだところを確認しよう'
         }
       </h2>

       <div class=lessonBox>

         <strong>
           ${ok
             ? '確認しよう'
             : 'もう一度見てみよう'
           }
         </strong>

         <p>${explanation}</p>

       </div>

       <button
         class=primary
         onclick="nextPooledQ()">

         ${quizIndex+1<quizQuestions.length
           ? '次の問題'
           : '結果を見る'
         }

       </button>

     </div>`;
}
function nextPooledQ(){quizIndex++;if(quizIndex<quizQuestions.length){page='pooledQuiz';render()}else{let key=profile.band+'-m'+quizOpportunity;if(!quizDone.includes(key))quizDone.push(key);save('quizDone',quizDone);log('learning_quiz_complete',{milestone:quizOpportunity,score:quizScore,total:quizQuestions.length,accuracy:quizQuestions.length?quizScore/quizQuestions.length:null});page='quizResult';render()}}
function abandonQuiz(){log('learning_quiz_abandon',{milestone:quizOpportunity,answered:quizIndex,total:quizQuestions.length});page='learn';render()}
function quizResult(){app.innerHTML=head('クイズ完了',`これまでの学びを確認しました`)+`<div class=hero><b>${quizScore} / ${quizQuestions.length} 問</b><p>クイズは任意です。次の野菜や「まなぶ」に進めます。</p><button class=primary onclick="go('home')">次の野菜を見てみる</button><button class=secondary onclick="go('learn')">まなぶ一覧へ</button></div>`}
function ymdFromTs(ts){let d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthEvents(d){let k=monthKey(d);return events.filter(e=>ymdFromTs(e.ts).startsWith(k))}
function dayEvents(dateStr){return events.filter(e=>ymdFromTs(e.ts)===dateStr)}
function eventIcon(e){

  if(e.type==='selfMade') return '👩‍🍳';

  if(e.type==='togetherMade') return '👪';

  // 旧記録
  if(e.type==='made') return '🍳';

  if(e.type==='ate') return '🥕';

  if(e.type==='lesson_complete') return '📖';

  if(e.type==='learning_quiz_complete') return '✓';

  return '';
}
function calendarHTML(d){
 let y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),startDay=first.getDay(),cells=[];
 for(let i=0;i<startDay;i++)cells.push('<div class="calCell empty"></div>');
 for(let day=1;day<=last.getDate();day++){
   let ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, ev=dayEvents(ds), icons=[...new Set(ev.map(eventIcon).filter(Boolean))];
   let active=icons.length?' active':'';
   cells.push(`<button class="calCell${active}" onclick="showDay('${ds}')"><b>${day}</b><span>${icons.join('')}</span></button>`);
 }
 return `<div class=calendarCard><div class=calHead><button onclick="moveMonth(-1)">‹</button><b>${y}年 ${m+1}月</b><button onclick="moveMonth(1)">›</button></div><div class=calWeek><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class=calGrid>${cells.join('')}</div><div class=calLegend><span>👩‍🍳 自分で作った</span><span>👪 いっしょに作った</span><span>🥕 食べた</span><span>📖 学んだ</span><span>✓ クイズ</span></div>`
}
function moveMonth(n){calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+n,1);record()}
function showDay(ds){

  let ev=dayEvents(ds).filter(e=>
    [
      'selfMade',
      'togetherMade',
      'made',
      'ate',
      'lesson_complete',
      'learning_quiz_complete'
    ].includes(e.type)
  );

  let label=
    new Date(ds+'T00:00:00')
      .toLocaleDateString(
        'ja-JP',
        {
          month:'long',
          day:'numeric',
          weekday:'short'
        }
      );

  let body=ev.length
    ? ev.map(e=>{

        if(e.type==='selfMade'){
          return `
            <li>
              👩‍🍳 自分で作った：
              ${e.veg||''} ${e.recipe||''}
            </li>
          `;
        }

        if(e.type==='togetherMade'){
          return `
            <li>
              👪 いっしょに作った：
              ${e.veg||''} ${e.recipe||''}
            </li>
          `;
        }

        // 以前のデータ
        if(e.type==='made'){
          return `
            <li>
              🍳 作った（旧記録）：
              ${e.veg||''} ${e.recipe||''}
            </li>
          `;
        }

        if(e.type==='ate'){
          return `
            <li>
              🥕 食べた：
              ${e.veg||''} ${e.recipe||''}
            </li>
          `;
        }

        if(e.type==='lesson_complete'){
          return `
            <li>
              📖 学んだ：
              ${e.title||('ステージ'+e.stage)}
            </li>
          `;
        }

        if(e.type==='learning_quiz_complete'){
          return `
            <li>
              ✓ クイズ：
              ${e.score}/${e.total}問
            </li>
          `;
        }

        return '';

      }).join('')

    : '<li>この日の記録はありません。</li>';

  document.querySelector('#dayDetail').innerHTML=
    `<h3>${label}</h3>
     <ul>${body}</ul>`;

  document.querySelector('#dayDetail')
    .scrollIntoView({
      behavior:'smooth',
      block:'nearest'
    });
}
function record(){

  // ---------- クイズ記録 ----------
  let starts=
    events.filter(e=>e.type==='learning_quiz_start').length;

  let completes=
    events.filter(e=>e.type==='learning_quiz_complete').length;

  let answers=
    events.filter(e=>e.type==='learning_quiz_answer');

  let correct=
    answers.filter(e=>e.correct).length;

  let opportunities=
    QUIZ_MILESTONES.filter(
      m=>completedLessonIndices().length>=m
    ).length;

  let startRate=
    opportunities
      ? Math.round(starts/opportunities*100)
      : 0;

  let completeRate=
    opportunities
      ? Math.round(completes/opportunities*100)
      : 0;

  let acc=
    answers.length
      ? Math.round(correct/answers.length*100)
      : 0;


  // ---------- 今月の記録 ----------
  let me=monthEvents(calendarCursor);

  let challengeDays=
    new Set(
      me
        .filter(e=>
          [
            'selfMade',
            'togetherMade',
            'made',
            'ate',
            'lesson_complete',
            'learning_quiz_complete'
          ].includes(e.type)
        )
        .map(e=>ymdFromTs(e.ts))
    ).size;

  let monthAte=
    me.filter(e=>e.type==='ate');

  let monthVeg=
    new Set(
      monthAte.map(e=>e.veg)
    ).size;

  let monthSelfMade=
    me.filter(e=>e.type==='selfMade').length;

  let monthTogetherMade=
    me.filter(e=>e.type==='togetherMade').length;

  // 以前の「作った」記録
  let monthOldMade=
    me.filter(e=>e.type==='made').length;

  let monthCook=
    monthSelfMade+
    monthTogetherMade+
    monthOldMade;

  let monthLearn=
    me.filter(e=>e.type==='lesson_complete').length;

// ---------- 行動の広がり・継続 ----------
let allAteRecipeKinds=
  uniqueAteRecipes();

let allCookRecipeKinds=
  uniqueCookRecipes();

let allChallengeDays=
  challengeDayCount();
  
  // ---------- これまでの調理記録 ----------
  let allSelfMade=
    events.filter(e=>e.type==='selfMade').length;

  let allTogetherMade=
    events.filter(e=>e.type==='togetherMade').length;

  let allOldMade=
    events.filter(e=>e.type==='made').length;

  let allCook=
    allSelfMade+
    allTogetherMade+
    allOldMade;


  // ---------- 最近の記録 ----------
  let history=
    events
      .filter(e=>
        [
          'selfMade',
          'togetherMade',
          'made',
          'ate',
          'lesson_complete',
          'learning_quiz_complete'
        ].includes(e.type)
      )
      .slice()
      .reverse()
      .slice(0,12)
      .map(e=>{

        let d=
          new Date(e.ts)
            .toLocaleDateString(
              'ja-JP',
              {
                month:'numeric',
                day:'numeric'
              }
            );

        if(e.type==='selfMade'){
          return `
            <li>
              <span>${d}</span>
              👩‍🍳 ${e.veg}「${e.recipe}」を自分で作った
            </li>
          `;
        }

        if(e.type==='togetherMade'){
          return `
            <li>
              <span>${d}</span>
              👪 ${e.veg}「${e.recipe}」をいっしょに作った
            </li>
          `;
        }

        if(e.type==='made'){
          return `
            <li>
              <span>${d}</span>
              🍳 ${e.veg}「${e.recipe}」を作った（旧記録）
            </li>
          `;
        }

        if(e.type==='ate'){
          return `
            <li>
              <span>${d}</span>
              🥕 ${e.veg}「${e.recipe}」を食べた
            </li>
          `;
        }

        if(e.type==='lesson_complete'){
          return `
            <li>
              <span>${d}</span>
              📖 ${e.title}を学んだ
            </li>
          `;
        }

        if(e.type==='learning_quiz_complete'){
          return `
            <li>
              <span>${d}</span>
              ✓ クイズ ${e.score}/${e.total}問
            </li>
          `;
        }

        return '';

      })
      .join('')
      ||
      '<li>まだ記録はありません。</li>';


  // ---------- 画面表示 ----------
  app.innerHTML=
    head(
      'きろく',
      'チャレンジをふり返ろう'
    )+

    `<h2>カレンダー</h2>

     ${calendarHTML(calendarCursor)}

     <div
       id=dayDetail
       class="card dayDetail">

       <p class=note>
         日にちをタップすると、その日の記録が見られます。
       </p>

     </div>`+


    `<h2>今月のまとめ</h2>

     <div class=monthStats>

       <div class=card>
         <b>${challengeDays}</b>
         <span>チャレンジした日</span>
       </div>

       <div class=card>
         <b>${monthSelfMade}</b>
         <span>自分で作った</span>
       </div>

       <div class=card>
         <b>${monthTogetherMade}</b>
         <span>いっしょに作った</span>
       </div>

       <div class=card>
         <b>${monthAte.length}</b>
         <span>食べた回数</span>
       </div>

       <div class=card>
         <b>${monthVeg}</b>
         <span>野菜の種類</span>
       </div>

       <div class=card>
         <b>${monthLearn}</b>
         <span>学んだ数</span>
       </div>

     </div>`+


    `<h2>これまでの記録</h2>

     <div class=stats>

  <div class=card>
    <b>${ateCount()}</b>
    <span class=note>食べた回数</span>
  </div>

  <div class=card>
    <b>${allAteRecipeKinds}</b>
    <span class=note>食べた料理の種類</span>
  </div>

  <div class=card>
    <b>${uniqueVeg()}</b>
    <span class=note>食べた野菜の種類</span>
  </div>

  <div class=card>
    <b>${allChallengeDays}</b>
    <span class=note>チャレンジした日</span>
  </div>

  <div class=card>
    <b>${allSelfMade}</b>
    <span class=note>自分で作った回数</span>
  </div>

  <div class=card>
    <b>${allTogetherMade}</b>
    <span class=note>いっしょに作った回数</span>
  </div>

  <div class=card>
    <b>${allCook}</b>
    <span class=note>調理した回数</span>
  </div>

  <div class=card>
    <b>${allCookRecipeKinds}</b>
    <span class=note>調理した料理の種類</span>
  </div>

  <div class=card>
    <b>${learnDone.length}</b>
    <span class=note>学習完了</span>
  </div>

</div>

     <div class=card>
       <ul class=history>
         ${history}
       </ul>
     </div>`+


    `<h2>学習・クイズ記録</h2>

     <div class=card>

       <p>
         クイズ提示機会：${opportunities}回 ／
         開始：${starts}回 ／
         完了：${completes}回
       </p>

       <p>
         開始率：${startRate}%　
         完了率：${completeRate}%
       </p>

       <p>
         回答：${answers.length}問　
         正答率：${acc}%
       </p>

       <p class=note>
         クイズを実施しなかった場合も提示機会として記録します。
       </p>

     </div>`;
}
function notice(){

  // 更新日の新しい順に並べる
  const notices=[...remoteNotices].sort((a,b)=>{
    const da=String(a['更新日']||'');
    const db=String(b['更新日']||'');
    return db.localeCompare(da);
  });

  let body='';

  if(notices.length===0){

    body=`
      <div class="card">
        <p>現在、お知らせはありません。</p>
      </div>
    `;

  }else{

    body=notices.map(n=>{

      const title=n['タイトル']||'お知らせ';
      const text=n['本文']||'';
      const date=n['更新日']||'';

      return `
        <article class="card noticeCard">

          <div class="noticeDate">
            ${date ? `更新日：${date}` : ''}
          </div>

          <h2>${title}</h2>

          <div class="noticeText">
            ${String(text).replace(/\n/g,'<br>')}
          </div>

        </article>
      `;

    }).join('');

  }

  app.innerHTML=
    head(
      'お知らせ',
      '新しい情報をチェックしよう'
    )+
    `
      <div class="noticeList">
        ${body}
      </div>
    `;
}
function settings(){app.innerHTML=head('せってい','秋冬版 v7')+`<div class=card><b>${profile.grade}年生・${bandName[profile.band]}</b><p>学年を変えると、学ぶ内容と確認クイズが切り替わります。</p><button class=secondary onclick="changeGrade()">学年を選び直す</button></div>`}
function changeGrade(){if(confirm('学年を選び直しますか？ 行動記録は残ります。')){profile=null;localStorage.removeItem(PREFIX+'profile');page='setup';render()}}
function go(p){
  page=p;
  render();
  scrollTo(0,0);
}

function navRender(){

  if(page==='setup'){
    nav.innerHTML='';
    return;
  }

  let n=[
    ['home','⌂','ホーム'],
    ['learn','📖','まなぶ'],
    ['record','▣','きろく'],
    ['notice','🔔','お知らせ'],
    ['settings','⚙','設定']
  ];

  nav.innerHTML=n.map(x=>
    `<button
      class="${page===x[0]?'active':''}"
      onclick="go('${x[0]}')">
      <b>${x[1]}</b>
      ${x[2]}
    </button>`
  ).join('');
}

function render(){

  let f={
    setup,
    home,
    recipe,
    learn,
    lesson,
    quizChoice,
    pooledQuiz,
    quizResult,
    record,
    notice,
    settings
  }[page]||home;

  f();
  navRender();
}

loadPublishedRecipes().finally(()=>render());
