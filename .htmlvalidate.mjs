// Author: Rasel Al Mamun
// html-validate configuration for the built pages in dist/ (FD-126).
export default {
  extends: ['html-validate:recommended'],
  rules: {
    // Markup is formatted by Prettier: <!doctype html>.
    'doctype-style': ['error', { style: 'lowercase' }],
    // Both void-element forms are valid: the source writes <meta />, Vite injects <link> tags
    // for the built assets without the slash.
    'void-style': 'off',
    // dist/ is generated: Handlebars leaves indentation-only lines where blocks render empty.
    'no-trailing-whitespace': 'off',
    // Project and post pages use the full formal title of the work in <title>.
    'long-title': 'off',
    // Scrollable code blocks are focusable <pre role="region" aria-label> (WCAG 2.1.1).
    'prefer-native-element': ['error', { exclude: ['region'] }],
    // The research archive filter is a live search form (results update while typing,
    // FD-115); it has no submit button by design.
    'wcag/h32': 'off',
  },
};
