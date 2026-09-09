(() => {
  'use strict';
  const data = globalThis.YOBI_COMPLETE_DATA;
  if (!data?.cards) return;
  const patch = (id, fields) => {
    const card = data.cards.find((item) => item.id === id);
    if (card) Object.assign(card, fields);
  };
  patch('gen02', {
    title: '十分条件',
    statement: 'PがQの十分条件であるとは、Pが成り立てば必ずQが成り立つことをいう。'
  });
  patch('gen03', {
    statement: '「AかつB」の否定は、「Aでない、又はBでない」と論理的に同値である。'
  });
  patch('civ23', {
    statement: '債権の譲渡を債務者その他の第三者に対抗するには、原則として譲渡人から債務者への通知又は債務者の承諾が必要である。'
  });
})();
