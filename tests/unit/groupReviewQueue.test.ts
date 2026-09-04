import { describe,expect,it } from 'vitest';
import { nextPendingKey,savedRecognition } from '../../src/features/uploads/groupReviewQueue';

const bottle=(key:string,overrides:Partial<{savedId:string|null;removed:boolean;recognition:unknown}>={})=>
  ({key,savedId:null,removed:false,recognition:{},...overrides});

describe('the bottle to review next',()=>{
  // Saving cleared the selection, so the panel closed and the next wine meant
  // scrolling back up the photograph to find its Review button - eight times
  // for a lineup of eight.

  it('is the one after the bottle just saved',()=>{
    const lineup=[bottle('a',{savedId:'w1'}),bottle('b'),bottle('c')];
    expect(nextPendingKey(lineup,'a')).toBe('b');
  });

  it('skips a bottle already saved and one taken out of the photo',()=>{
    const lineup=[bottle('a',{savedId:'w1'}),bottle('b',{savedId:'w2'}),bottle('c',{removed:true}),bottle('d')];
    expect(nextPendingKey(lineup,'a')).toBe('d');
  });

  it('wraps to a bottle skipped earlier rather than stranding it',()=>{
    // Reviewing out of order is normal - the readable labels get done first -
    // and the one passed over must still come round.
    const lineup=[bottle('a'),bottle('b'),bottle('c',{savedId:'w3'})];
    expect(nextPendingKey(lineup,'c')).toBe('a');
  });

  it('closes the panel when the last one is done',()=>{
    const lineup=[bottle('a',{savedId:'w1'}),bottle('b',{savedId:'w2'})];
    expect(nextPendingKey(lineup,'b')).toBeNull();
  });

  it('ignores a row the recognition never filled in',()=>{
    // A manual addition with nothing read off the photo has no box to move to.
    const lineup=[bottle('a',{savedId:'w1'}),bottle('b',{recognition:null}),bottle('c')];
    expect(nextPendingKey(lineup,'a')).toBe('c');
  });

  it('still answers when the saved bottle is no longer in the list',()=>{
    const lineup=[bottle('a'),bottle('b')];
    expect(nextPendingKey(lineup,'gone')).toBe('a');
  });
});

describe('what a card says once its wine is saved',()=>{
  // Reported as: a correction typed into the form showed on the wine's own page
  // and nowhere else, so the review list went on showing the model's reading of
  // a wine you had already fixed.
  const read={producer:'Dom Perignon',wineName:'Vintage 2004',vintage:2004,confidence:.92,
    boundingBox:{xMin:330,yMin:130,xMax:480,yMax:1000},grapes:['Chardonnay']};

  it('takes the producer, name and vintage that were actually saved',()=>{
    expect(savedRecognition(read,{producer:'Moët & Chandon',wineName:'Dom Pérignon Vintage',vintage:2004}))
      .toEqual({...read,producer:'Moët & Chandon',wineName:'Dom Pérignon Vintage',vintage:2004});
  });

  it('leaves the detection itself alone',()=>{
    // The box and the confidence describe what was found in the photograph, and
    // the crop they produced is still the crop on the card.
    const saved=savedRecognition(read,{producer:'Krug',wineName:'Grande Cuvée',vintage:null})!;
    expect(saved.boundingBox).toEqual(read.boundingBox);
    expect(saved.confidence).toBe(.92);
    expect(saved.grapes).toEqual(['Chardonnay']);
    expect(saved.vintage,'a wine saved as non-vintage says so').toBeNull();
  });

  it('has nothing to write into for a wine added by hand',()=>{
    expect(savedRecognition(null,{producer:'A',wineName:'B',vintage:null})).toBeNull();
  });

  it('changes nothing when the form did not say who was saved',()=>{
    expect(savedRecognition(read,undefined)).toBe(read);
  });
});
