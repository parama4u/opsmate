(() => {
  const selection = window.getSelection()?.toString().trim().slice(0, 4000) || '';
  const context = {
    title: document.title.slice(0, 300),
    url: window.location.href,
    selection,
  };
  const appUrl = window.ORGCHAI_APP_URL || 'https://orgchai.com';
  const target = new URL('/en/dashboard', appUrl);
  target.searchParams.set('context', JSON.stringify(context));
  window.open(target.toString(), '_blank', 'noopener,noreferrer');
})();
