// Synthetic contract evidence only; never provider functionality/editorial QA.
export const makeSource = (overrides = {}) => ({
  id: 'synthetic-source', kind: 'upload', title: 'Synthetic source', duration: 20, ...overrides,
});
export const sourceFingerprintFixture = 'a'.repeat(64);
export const mainSelectionFixture = input => ({
  language: 'en',
  parts: [1, 2].map((id, index) => ({
    id, title: `Synthetic part ${id}`, hook: 'Synthetic source statement.',
    reason: 'Synthetic contract evidence, not an editorial quality assessment.',
    hashtags: Array.from({length: 10}, (_, i) => `#tag${i}`),
    segments: [{...input.recipes[0].windows[index], label: 'Nội dung',
      reason: 'Giữ diễn biến nguồn trong fixture.', isPadding: false}].map(({start,end,label,reason,isPadding}) => ({start,end,label,reason,isPadding})),
  })),
});
export const editorialFixture=(input,start,end,external=false)=>{
 const cueIds=[...new Set((input?.contextWindows||[]).flat().filter(c=>c.start<end&&c.end>start).map(c=>c.cueId))];
 return {candidateId:'source-range',kind:cueIds.length?'speech':'action',partUnderstanding:'Synthetic fixture part; not real source understanding.',contentTypes:'mixed/unknown (unit fixture)',observed:'Synthetic fixture evidence only.',startContext:'Fixture establishes its subject at the start.',standalone:true,complete:true,endingBasis:external?'continuous-video':cueIds.length?'speech':'visible-state',cueIds,replayUse:'not-used',alternatives:[]};
};
