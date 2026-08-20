import { describe,expect,it } from 'vitest';
import { batchUploadRetryDelay,isRetryableBatchUploadStatus } from '../../src/features/uploads/batchApi';
import { restoreStoredBatchPhoto,restoreStoredFile } from '../../src/features/uploads/batchUploadStore';

describe('Batch upload resume helpers',()=>{
  it('reconstructs persisted blob metadata as a File',()=>{
    const blob=new Blob(['wine-label'],{type:'image/heic'});
    const file=restoreStoredFile({blob,name:'IMG_1001.HEIC',type:'image/heic',lastModified:1234},'fallback.jpg');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('IMG_1001.HEIC');
    expect(file.type).toBe('image/heic');
    expect(file.lastModified).toBe(1234);
    expect(file.size).toBe(blob.size);
  });

  it('still restores legacy File-backed IndexedDB photos',()=>{
    const original=new File(['original'],'front.jpg',{type:'image/jpeg',lastModified:10});
    const recognition=new File(['prepared'],'front.jpg',{type:'image/jpeg',lastModified:10});
    const restored=restoreStoredBatchPhoto({original,recognition,metadata:{capturedAt:null,latitude:null,longitude:null,source:'none'},width:3000,height:4000});
    expect(restored.original).toBe(original);
    expect(restored.recognition).toBe(recognition);
    expect(restored.width).toBe(3000);
    expect(restored.height).toBe(4000);
  });

  it('retries only transient upload statuses with bounded backoff',()=>{
    expect(isRetryableBatchUploadStatus(0)).toBe(true);
    expect(isRetryableBatchUploadStatus(408)).toBe(true);
    expect(isRetryableBatchUploadStatus(429)).toBe(true);
    expect(isRetryableBatchUploadStatus(503)).toBe(true);
    expect(isRetryableBatchUploadStatus(400)).toBe(false);
    expect(isRetryableBatchUploadStatus(413)).toBe(false);
    expect(batchUploadRetryDelay(0)).toBe(700);
    expect(batchUploadRetryDelay(1)).toBe(1500);
  });
});
