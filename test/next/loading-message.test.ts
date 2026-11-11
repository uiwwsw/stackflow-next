import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadingMessage} from '../../src/next/loading-message.ts';

test('loading text follows the language and Chinese script of the locale', () => {
  assert.equal(loadingMessage('ko-KR'), '불러오는 중…');
  assert.equal(loadingMessage('JA'), '読み込み中…');
  assert.equal(loadingMessage('zh'), '正在加载…');
  assert.equal(loadingMessage('zh-CN'), '正在加载…');
  assert.equal(loadingMessage('zh-TW'), '正在載入…');
  assert.equal(loadingMessage('zh-HK'), '正在載入…');
  assert.equal(loadingMessage('zh-Hant'), '正在載入…');
  assert.equal(loadingMessage('en-US'), undefined);
  assert.equal(loadingMessage('ko_KR'), undefined);
});
