(() => {
  'use strict';
  const main = document.querySelector('#main');
  const version = '1.0.0';
  const loadJson = async (path) => {
    const url = new URL(path, document.baseURI);
    url.searchParams.set('v', version);
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('data');
    return response.json();
  };
  const loadScript = (path) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const url = new URL(path, document.baseURI);
    url.searchParams.set('v', version);
    script.src = url.href;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error('script'));
    document.head.append(script);
  });
  const showLoadError = () => {
    main.replaceChildren();
    main.setAttribute('aria-busy', 'false');
    const notice = document.createElement('section');
    notice.className = 'notice warning';
    notice.textContent = '\u0628\u062e\u0634\u06cc \u0627\u0632 \u062f\u0627\u062f\u0647\u200c\u0647\u0627 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0646\u0634\u062f. \u0635\u0641\u062d\u0647 \u0631\u0627 \u062f\u0648\u0628\u0627\u0631\u0647 \u0628\u0627\u0632 \u06a9\u0646\u06cc\u062f \u06cc\u0627 \u0627\u0632 \u062f\u0627\u062f\u0647\u200c\u0647\u0627 \u0648 \u0641\u0627\u06cc\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u0634\u0627\u0631 \u0627\u0637\u0645\u06cc\u0646\u0627\u0646 \u067e\u06cc\u062f\u0627 \u06a9\u0646\u06cc\u062f.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn secondary small';
    retry.textContent = '\u062a\u0644\u0627\u0634 \u0645\u062c\u062f\u062f';
    retry.addEventListener('click', () => location.reload());
    main.append(notice, retry);
  };
  (async () => {
    const [exercise, food] = await Promise.all([
      loadJson('data/exercise-catalog.json'),
      loadJson('data/food-catalog-usda-srlegacy-2018.json')
    ]);
    if (!Array.isArray(exercise.records) || !Array.isArray(food.keys) || !Array.isArray(food.rows)) throw new Error('data');
    window.TavanData = { exerciseRecords: exercise.records, foodCatalog: food };
    for (const path of [
      'assets/js/fit-core.js',
      'assets/js/exercise-catalog.js',
      'assets/js/locale.js',
      'assets/js/bulk-import.js',
      'assets/js/food-catalog.js',
      'assets/js/nutrition-core.js',
      'assets/js/reminder-core.js',
      'assets/js/extensions-v5.js',
      'assets/js/tavan-app.js'
    ]) await loadScript(path);
    main.setAttribute('aria-busy', 'false');
  })().catch(showLoadError);
})();
