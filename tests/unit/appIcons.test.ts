import { describe,expect,it } from 'vitest';
import { AppIcon,type AppIconKey } from '../../src/components/AppIcons';

const iconKeys:AppIconKey[]=['passport','journal','producers','insights','scan','single-wine','group-photo','batch-scan','pen','close','search','heart','heart-filled'];

describe('app shell icon set',()=>{
  it('draws an svg for every icon key',()=>{
    for(const kind of iconKeys){
      const icon=AppIcon({kind});
      expect(icon.type).toBe('svg');
      expect(icon.props.viewBox).toBe('0 0 24 24');
      expect(icon.props.className).toBe('app-icon');
    }
  });

  it('gives every key its own artwork rather than falling through to the default',()=>{
    // 'close' is the fallback branch, so a key with no drawing of its own would collide with it.
    const drawings=iconKeys.map(kind=>{const {children,fill}=AppIcon({kind}).props;return JSON.stringify({children,fill})});
    expect(new Set(drawings).size).toBe(iconKeys.length);
  });

  it('inherits colour so an icon can sit on any surface',()=>{
    for(const kind of iconKeys)expect(AppIcon({kind}).props.stroke).toBe('currentColor');
    expect(AppIcon({kind:'heart-filled'}).props.fill).toBe('currentColor');
    expect(AppIcon({kind:'heart'}).props.fill).toBe('none');
  });
});
