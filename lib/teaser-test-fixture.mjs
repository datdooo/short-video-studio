// Synthetic contract evidence only; never provider functionality/editorial QA.
export const editorialFixture=(input,start,end,external=false)=>{
 const cueIds=[...new Set((input?.contextWindows||[]).flat().filter(c=>c.start<end&&c.end>start).map(c=>c.cueId))];
 return {candidateId:'source-range',kind:cueIds.length?'speech':'action',partUnderstanding:'Synthetic fixture part; not real source understanding.',contentTypes:'mixed/unknown (unit fixture)',observed:'Synthetic fixture evidence only.',startContext:'Fixture establishes its subject at the start.',standalone:true,complete:true,endingBasis:external?'continuous-video':cueIds.length?'speech':'visible-state',cueIds,replayUse:'not-used',alternatives:[]};
};
