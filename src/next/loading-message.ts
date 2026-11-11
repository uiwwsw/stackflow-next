const messages = new Map([
  ['ko', '불러오는 중…'], ['ja', '読み込み中…'], ['zh', '正在加载…'], ['zh-Hant', '正在載入…'],
  ['es', 'Cargando…'], ['fr', 'Chargement…'], ['de', 'Wird geladen…'],
  ['pt', 'Carregando…'], ['ar', 'جارٍ التحميل…'],
]);

/** Built-in loading text for a BCP 47 locale, or undefined to use English. */
export function loadingMessage(locale: string) {
  try {
    // maximize() resolves regions such as zh-TW and zh-HK to Traditional script.
    const { language, script } = new Intl.Locale(locale).maximize();
    return messages.get(language === 'zh' && script === 'Hant' ? 'zh-Hant' : language);
  } catch {
    return undefined;
  }
}
